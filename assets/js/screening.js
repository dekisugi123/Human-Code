(function(){
  const PAGE_ID = 'screening_exclude_v1';

  // Option B: 0..4 bubbles
  const SCALE = [
    { v: 0, key: 'screen_scale_0' },
    { v: 1, key: 'screen_scale_1' },
    { v: 2, key: 'screen_scale_2' },
    { v: 3, key: 'screen_scale_3' },
    { v: 4, key: 'screen_scale_4' }
  ];

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function tagForScore(pct){
    // Higher = deprioritize
    if(pct == null) return 'unknown';
    if(pct >= 70) return 'deprioritize';
    if(pct >= 40) return 'consider';
    return 'check';
  }

  function labelForTag(tag){
    if(tag === 'deprioritize') return window.App.t('screening_tag_deprioritize', 'Deprioritize');
    if(tag === 'consider') return window.App.t('screening_tag_consider', 'Consider later');
    if(tag === 'check') return window.App.t('screening_tag_check', 'Worth checking');
    return window.App.t('screening_tag_unknown', 'Not enough info');
  }

  function el(tag, attrs={}, children=[]){
    return window.App.el(tag, attrs, children);
  }

  // Map 0..4 -> existing l1..l5 bubble styles
  function bubbleClassForValue(v){
    return (
      v === 0 ? 'bubble l1' :
      v === 1 ? 'bubble l2' :
      v === 2 ? 'bubble l3' :
      v === 3 ? 'bubble l4' : 'bubble l5'
    );
  }

  function renderLikert(itemId, currentValue, isSkipped, onPick, onSkip){
    const row = el('div', { class: 'likert-row screening-likert' });

    const left = el('div', {
      class: 'likert-label disagree',
      text: window.App.t('screen_scale_left', '0')
    });

    const right = el('div', {
      class: 'likert-label agree',
      text: window.App.t('screen_scale_right', '4')
    });

    const bubbles = el('div', {
      class: 'bubbles screening-bubbles',
      role: 'radiogroup',
      'aria-label': window.App.t('screening_likert_aria', 'Answer scale')
    });

    // Skip button (needs to be in scope for click handlers)
    const skipBtn = el('button', {
      type: 'button',
      class: 'pill-btn screening-skip' + (isSkipped ? ' active' : ''),
      'aria-pressed': isSkipped ? 'true' : 'false',
      text: window.App.t('screening_skip', 'Skip / Can’t judge')
    });

    const btns = []; // keep references so we can toggle selected classes in-place

    function setSelectedUI(value){
      // Clear all first
      btns.forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });

      // If skipped, keep all unselected
      if(isSkipped) return;

      // Mark the matching one selected
      const idx = SCALE.findIndex(s => s.v === value);
      if(idx >= 0){
        const b = btns[idx];
        b.classList.add('selected');
        b.setAttribute('aria-checked', 'true');
      }
    }

    function setSkippedUI(skippedOn){
      isSkipped = skippedOn;

      skipBtn.classList.toggle('active', skippedOn);
      skipBtn.setAttribute('aria-pressed', skippedOn ? 'true' : 'false');

      if(skippedOn){
        // Clear bubble UI when skipped
        btns.forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-checked', 'false');
        });
      }else{
        // Restore selection UI
        setSelectedUI(currentValue);
      }
    }

    // Build bubbles
    SCALE.forEach(s => {
      const cls = bubbleClassForValue(s.v);
      const selected = (!isSkipped && currentValue === s.v);

      const btn = el('button', {
        type: 'button',
        class: cls + (selected ? ' selected' : ''),
        role: 'radio',
        'aria-checked': selected ? 'true' : 'false',
        'aria-label': window.App.t(s.key, String(s.v))
      });

      btn.addEventListener('click', () => {
        // Immediately update UI (so user sees it)
        currentValue = s.v;
        setSkippedUI(false);      // un-skip if needed
        setSelectedUI(currentValue);

        // Then update state + results
        onPick(s.v);
      });

      btns.push(btn);
      bubbles.appendChild(btn);
    });

    skipBtn.addEventListener('click', () => {
      const next = !isSkipped;

      // Update UI instantly
      setSkippedUI(next);

      // Update state + results
      onSkip(next);

      // If un-skipping and state chooses default 2, show it
      if(!next){
        // after onSkip(false), your handler sets answer=2 if missing
        // we reflect that visually here:
        currentValue = 2;
        setSelectedUI(currentValue);
      }
    });

    const meta = el('div', { class: 'q-meta-row screening-meta' }, [skipBtn]);

    row.appendChild(left);
    row.appendChild(bubbles);
    row.appendChild(right);

    const wrap = el('div', { class: 'screening-answer-wrap' }, [row, meta]);
    return wrap;
  }

  function computeGroupPct(group, state){
    const values = [];
    group.items.forEach(it => {
      const skipped = !!state.skipped[it.id];
      if(skipped) return;
      const v = state.answers[it.id];
      if(typeof v === 'number') values.push(v);
    });
    if(values.length === 0) return null;
    const avg = values.reduce((a,b)=>a+b,0) / values.length; // 0..4
    return clamp(Math.round((avg / 4) * 100), 0, 100);
  }

  function computeAll(data, state){
    const groups = data.groups || [];
    const out = {};
    groups.forEach(g => {
      out[g.id] = computeGroupPct(g, state);
    });
    return out;
  }

  function renderQuestion(groupId, item, state, onUpdate){
    const block = el('div', { class: 'q-block screening-qblock' });

    block.appendChild(el('div', {
      class: 'q-text screening-qtext',
      text: item.text
    }));

    // Examples/hints
    if(item.examples && item.examples.length){
      const hint = el('div', { class: 'hint-box' });
      hint.appendChild(el('div', {
        class: 'hint-title',
        text: window.App.t('screening_hints_title', 'Hints (grounded examples)')
      }));

      const ul = el('ul', { class: 'hint-list' });
      item.examples.forEach(ex => {
        ul.appendChild(el('li', { class: 'hint-item', text: ex }));
      });
      hint.appendChild(ul);
      block.appendChild(hint);
    }

    const cur = state.answers[item.id];
    const skipped = !!state.skipped[item.id];

    block.appendChild(renderLikert(
      item.id,
      (typeof cur === 'number') ? cur : null,
      skipped,
      (picked) => {
        state.answers[item.id] = picked;
        state.skipped[item.id] = false;
        onUpdate();
      },
      (skipOn) => {
        state.skipped[item.id] = skipOn;
        if(skipOn){
          delete state.answers[item.id];
        }else{
          // if un-skip and no prior answer, set neutral mid (2)
          if(typeof state.answers[item.id] !== 'number') state.answers[item.id] = 2;
        }
        onUpdate();
      }
    ));

    return block;
  }

  function renderAll(data, state){
    const list = document.getElementById('screeningList');
    if(!list) return;

    list.innerHTML = '';

    (data.groups || []).forEach(group => {
      const card = el('div', { class: 'screening-group' });

      const header = el('div', { class: 'screening-group-head' }, [
        el('div', { class: 'screening-group-title', text: group.groupTitle || '' }),
        el('div', { class: 'screening-group-sub', text: window.App.t('screening_group_note', 'Answer based on patterns across your life.') })
      ]);

      card.appendChild(header);

      group.items.forEach(it => {
        card.appendChild(renderQuestion(group.id, it, state, () => {
          updateUI(data, state);
        }));
      });

      list.appendChild(card);
    });
  }

  function updateResults(data, state){
    const byGroup = computeAll(data, state);

    const grid = document.getElementById('resultsGrid');
    if(grid){
      grid.innerHTML = '';

      (data.groups || []).forEach(g => {
        const pct = byGroup[g.id];
        const tag = tagForScore(pct);

        const box = el('div', { class: 'result-card' });

        const top = el('div', { class: 'result-top' }, [
          el('div', { class: 'result-title', text: g.groupTitle }),
          el('div', { class: 'result-tag ' + tag, text: labelForTag(tag) })
        ]);

        const valueText = (pct == null)
          ? window.App.t('screening_not_enough', '—')
          : `${pct}%`;

        box.appendChild(top);
        box.appendChild(el('div', { class: 'result-value', text: valueText }));

        const explain = (pct == null)
          ? window.App.t('screening_need_answers', 'Answer at least 1 item (or un-skip) to compute.')
          : window.App.t('screening_meaning', 'Higher = deprioritize.');

        box.appendChild(el('div', { class: 'result-sub', text: explain }));

        grid.appendChild(box);
      });
    }

    return byGroup;
  }

  async function renderDomLinks(state, groupScores){
    const host = document.getElementById('domLinks');
    if(!host) return;

    host.innerHTML = '';

    const lang = window.App.getLang();
    const casesPath = (lang === 'vi') ? './data/cases_vi.json' : './data/cases_en.json';

    let cases;
    try{
      cases = await window.App.loadJSON(casesPath);
    }catch(e){
      host.appendChild(el('div', { class: 'muted', text: 'Missing cases file: ' + casesPath }));
      return;
    }

    const pages = (cases && cases.pages) ? cases.pages : {};
    const keys = Object.keys(pages);

    const entries = [];
    for(const k of keys){
      const jsonRel = pages[k];
      const href = './pages/' + k.replaceAll('_','-') + '.html';
      const groupId = k.split('_')[0]; // ne_dom -> ne

      let title = k;
      if(typeof jsonRel === 'string'){
        try{
          const pageObj = await window.App.loadJSON('./data/' + jsonRel);
          if(pageObj && pageObj.title) title = pageObj.title;
        }catch(e){
          // ignore
        }
      }

      const pct = (Object.prototype.hasOwnProperty.call(groupScores, groupId))
        ? groupScores[groupId]
        : null;

      entries.push({ key: k, href, title, groupId, pct });
    }

    entries.sort((a,b) => {
      const av = (a.pct == null) ? 999 : a.pct;
      const bv = (b.pct == null) ? 999 : b.pct;
      if(av !== bv) return av - bv;
      return a.title.localeCompare(b.title);
    });

    entries.forEach(ent => {
      const tag = tagForScore(ent.pct);
      const tagLabel = labelForTag(tag);

      const sub = (ent.pct == null)
        ? window.App.t('screening_tag_unknown', 'Not enough info')
        : `${tagLabel} · ${ent.pct}%`;

      const card = el('a', {
        class: 'link-card',
        href: ent.href
      });

      card.appendChild(el('div', { class: 'link-title', text: ent.title }));
      card.appendChild(el('div', { class: 'link-sub', text: sub }));

      host.appendChild(card);
    });
  }

  function updateUI(data, state){
    const groupScores = updateResults(data, state);
    state._scores = groupScores;
    renderDomLinks(state, groupScores);
  }

  function loadPaths(){
    return {
      ui: { en: './data/ui_en.json', vi: './data/ui_vi.json' },
      exclude: { en: './data/exclude_en.json', vi: './data/exclude_vi.json' }
    };
  }

  async function main(){
    const paths = loadPaths();

    await window.App.init({ ui: paths.ui });
    window.App.applyI18n(document);

    const pill = document.getElementById('langPill');
    const btn = document.getElementById('langToggleBtn');

    function refreshLangUI(){
      if(pill) pill.textContent = window.App.getLang().toUpperCase();
    }
    refreshLangUI();

    if(btn){
      btn.addEventListener('click', async () => {
        const next = window.App.getLang() === 'en' ? 'vi' : 'en';
        await window.App.setLang(next);
        window.location.reload();
      });
    }

    const lang = window.App.getLang();
    const excludePath = paths.exclude[lang];
    const data = await window.App.loadJSON(excludePath);

    const scaleLine = document.getElementById('scaleLine');
    if(scaleLine && data.scale && data.scale.labels){
      const labels = data.scale.labels;
      const skip = (data.scale.skip || window.App.t('screening_skip', 'Skip / Can’t judge'));
      scaleLine.textContent = `${labels[0]} → ${labels[4]} · ${skip}`;
    }

    const saved = window.AppStorage.loadPage(PAGE_ID) || {};
    const state = {
      answers: saved.answers || {},
      skipped: saved.skipped || {},
      _scores: saved.scores || {}
    };

    renderAll(data, state);
    updateUI(data, state);

    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const status = document.getElementById('saveStatus');

    if(saveBtn){
      saveBtn.addEventListener('click', () => {
        updateUI(data, state);
        window.AppStorage.savePage(PAGE_ID, {
          answers: state.answers,
          skipped: state.skipped,
          scores: state._scores,
          updated_at: new Date().toISOString()
        });
        if(status){
          status.textContent = window.App.t('saved_ok', 'Saved.');
          setTimeout(() => (status.textContent = ''), 1400);
        }
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        const msg = window.App.t('reset_confirm', 'Reset this page?');
        if(!confirm(msg)) return;
        window.AppStorage.resetPage(PAGE_ID);
        window.location.reload();
      });
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', main);
  }else{
    main();
  }
})();
