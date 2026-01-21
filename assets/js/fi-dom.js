(function(){
  const PAGE_ID = 'fi_dom';

  // 1..5 bubbles
  const SCALE = [
    { v: 1, key: 'scale_1' },
    { v: 2, key: 'scale_2' },
    { v: 3, key: 'scale_3' },
    { v: 4, key: 'scale_4' },
    { v: 5, key: 'scale_5' }
  ];

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function isStrong(v){ return v === 4 || v === 5; }
  function centeredPoints(v){ return v - 3; } // 1..5 -> -2..+2

  /**
   * Same scoring model as Ne-dom:
   * - raw score centered around 0 (negative -> unlikely Fi-dom, positive -> likely)
   * - normalized by max possible => normScore in [-1,+1]
   * - displayed score100 = (normScore+1)/2 * 100
   * - examples bonus when strong (4–5) and at least 1 example checked
   * - can't recall reduces accuracy and disables bonus for that item
   * - strong but no example (and not can't recall) reduces accuracy slightly
   */
  function computeScore(items, answers, examples, cantRecall){
    let raw = 0;
    let cant = 0;
    let unconfirmedStrong = 0;

    let maxCore = 0;
    let maxBonus = 0;

    for(const it of items){
      const dir = (typeof it.dir === 'number') ? it.dir : 1;
      const absDir = Math.abs(dir);

      maxCore += 2 * absDir;
      if(it.examples && it.examples.length) maxBonus += 1 * absDir;

      const v = answers[it.id];
      if(typeof v !== 'number') continue;

      raw += centeredPoints(v) * dir;

      const cantOn = !!cantRecall[it.id];
      if(cantOn){
        cant += 1;
        continue;
      }

      if(isStrong(v) && it.examples && it.examples.length){
        let anyChecked = false;
        for(let i=0;i<it.examples.length;i++){
          const exId = `${it.id}__ex${i}`;
          if(examples[exId]) { anyChecked = true; break; }
        }
        if(anyChecked){
          raw += 1 * dir;
        }else{
          unconfirmedStrong += 1;
        }
      }
    }

    const penaltyEach = 10;     // per can't recall
    const noExamplePenalty = 3; // per strong but no example
    const accuracy = clamp(
      100 - cant * penaltyEach - unconfirmedStrong * noExamplePenalty,
      25,
      100
    );

    const maxPossible = Math.max(1, (maxCore + maxBonus));
    const normScore = clamp(raw / maxPossible, -1, 1);

    const score100 = clamp(Math.round((normScore + 1) * 50), 0, 100);

    const sep = Math.abs(normScore);
    let confidence = 'low';
    if(accuracy >= 85 && sep >= 0.35) confidence = 'high';
    else if(accuracy >= 70 && sep >= 0.22) confidence = 'medium';

    const MIN_ACC_FOR_VERDICT = 55;
    const TH = 0.18;

    let verdict = 'inconclusive';
    if(accuracy < MIN_ACC_FOR_VERDICT){
      verdict = 'inconclusive';
    }else if(normScore >= TH){
      verdict = 'likely';
    }else if(normScore <= -TH){
      verdict = 'unlikely';
    }else{
      verdict = 'inconclusive';
    }

    const verdictPct = clamp(
      Math.round(0.6 * accuracy + 0.4 * (sep * 100)),
      0,
      100
    );

    return {
      rawScore: raw,
      normScore,
      score100,
      accuracy,
      confidence,
      verdict,
      verdictPct,
      cantRecallCount: cant,
      unconfirmedStrongCount: unconfirmedStrong
    };
  }

  function el(tag, attrs={}, children=[]){
    return window.App.el(tag, attrs, children);
  }

  function renderLikert(currentValue, onPick){
    const row = el('div', { class: 'likert-row' });

    const left = el('div', {
      class: 'likert-label disagree',
      text: window.App.t('scale_left', 'Never')
    });
    const right = el('div', {
      class: 'likert-label agree',
      text: window.App.t('scale_right', 'Always')
    });

    const bubbles = el('div', {
      class: 'bubbles',
      role: 'radiogroup',
      'aria-label': window.App.t('likert_aria', 'Answer scale')
    });

    SCALE.forEach(s => {
      const cls =
        s.v === 1 ? 'bubble l1' :
        s.v === 2 ? 'bubble l2' :
        s.v === 3 ? 'bubble l3' :
        s.v === 4 ? 'bubble l4' : 'bubble l5';

      const selected = (currentValue === s.v);

      const btn = el('button', {
        type: 'button',
        class: cls + (selected ? ' selected' : ''),
        role: 'radio',
        'aria-checked': selected ? 'true' : 'false',
        'aria-label': window.App.t(s.key, String(s.v))
      });

      btn.addEventListener('click', () => onPick(s.v));
      bubbles.appendChild(btn);
    });

    row.appendChild(left);
    row.appendChild(bubbles);
    row.appendChild(right);

    return row;
  }

  function renderExamples(item, state, onUpdate){
    const v = state.answers[item.id];
    if(typeof v !== 'number') return null;
    if(!isStrong(v)) return null;
    if(!item.examples || item.examples.length === 0) return null;

    const box = el('div', { class: 'followup' });

    box.appendChild(el('div', {
      class: 'followup-title',
      text: window.App.t('followup_title', 'If you answered strong (4–5): which examples fit your real life?')
    }));

    box.appendChild(el('div', {
      class: 'small-muted',
      text: window.App.t('followup_note', 'Pick any that match. You can skip.')
    }));

    const list = el('ul', { class: 'ex-list' });

    item.examples.forEach((txt, idx) => {
      const exId = `${item.id}__ex${idx}`;
      const checked = !!state.examples[exId];

      const input = el('input', { type: 'checkbox', id: exId });
      input.checked = checked;

      input.addEventListener('change', () => {
        if(input.checked){
          state.cantRecall[item.id] = false;
        }

        if(input.checked) state.examples[exId] = true;
        else delete state.examples[exId];

        onUpdate(false);
      });

      const label = el('label', { for: exId });
      label.appendChild(el('span', { text: txt }));

      list.appendChild(el('li', { class: 'ex-item' }, [input, label]));
    });

    const cantId = `${item.id}__cant`;
    const cantInput = el('input', { type: 'checkbox', id: cantId });
    cantInput.checked = !!state.cantRecall[item.id];

    cantInput.addEventListener('change', () => {
      const on = cantInput.checked;
      state.cantRecall[item.id] = on;

      if(on){
        for(let i=0;i<item.examples.length;i++){
          delete state.examples[`${item.id}__ex${i}`];
        }
      }

      onUpdate(true);
    });

    const cantLabel = el('label', { for: cantId });
    cantLabel.appendChild(el('span', { text: window.App.t('cant_recall', "Can't recall / not sure") }));

    list.appendChild(el('li', { class: 'ex-item' }, [cantInput, cantLabel]));

    box.appendChild(list);
    return box;
  }

  function renderQuestion(item, state, onUpdate){
    const block = el('div', { class: 'q-block' });

    block.appendChild(el('div', { class: 'q-text', text: item.text }));

    const current = state.answers[item.id];
    block.appendChild(renderLikert(current, (picked) => {
      state.answers[item.id] = picked;

      if(!isStrong(picked)){
        state.cantRecall[item.id] = false;
        if(item.examples && item.examples.length){
          for(let i=0;i<item.examples.length;i++){
            delete state.examples[`${item.id}__ex${i}`];
          }
        }
      }

      onUpdate(true);
    }));

    const exBox = renderExamples(item, state, onUpdate);
    if(exBox) block.appendChild(exBox);

    return block;
  }

  function updateScoreUI(items, state){
    const s = computeScore(items, state.answers, state.examples, state.cantRecall);

    const scoreEl = document.getElementById('scoreValue');
    if(scoreEl) scoreEl.textContent = String(s.score100);

    const accEl = document.getElementById('accuracyValue');
    if(accEl) accEl.textContent = `${s.accuracy}%`;

    const confEl = document.getElementById('confidenceValue');
    if(confEl){
      confEl.textContent =
        s.confidence === 'high' ? window.App.t('conf_high', 'High') :
        s.confidence === 'medium' ? window.App.t('conf_med', 'Medium') :
        window.App.t('conf_low', 'Low');
    }

    const bar = document.getElementById('accuracyBar');
    if(bar) bar.style.width = `${s.accuracy}%`;

    const verdictEl = document.getElementById('verdictValue');
    if(verdictEl){
      verdictEl.textContent =
        s.verdict === 'likely'
          ? window.App.t('fi_verdict_likely', 'Likely Fi-dominant') + ` (${s.verdictPct}%)`
          : s.verdict === 'unlikely'
            ? window.App.t('fi_verdict_unlikely', 'Unlikely Fi-dominant') + ` (${s.verdictPct}%)`
            : window.App.t('verdict_inconclusive', 'Inconclusive');
    }

    state._computed = s;
  }

  function loadPathsForPage(){
    return {
      cases: { en: '../data/cases_en.json', vi: '../data/cases_vi.json' },
      ui: { en: '../data/ui_en.json', vi: '../data/ui_vi.json' }
    };
  }

  async function main(){
    const paths = loadPathsForPage();

    await window.App.init({ ui: paths.ui });
    window.App.applyI18n(document);

    const langBtn = document.getElementById('langToggleBtn');
    const langPill = document.getElementById('langPill');

    function refreshLangUI(){
      if(langPill) langPill.textContent = window.App.getLang().toUpperCase();
    }
    refreshLangUI();

    if(langBtn){
      langBtn.addEventListener('click', async () => {
        const next = window.App.getLang() === 'en' ? 'vi' : 'en';
        await window.App.setLang(next);
        window.location.reload();
      });
    }

    const casesPath = paths.cases[window.App.getLang()];
    const cases = await window.App.loadJSON(casesPath);

    const page = cases.pages && cases.pages.fi_dom;
    if(!page) throw new Error('Missing pages.fi_dom in cases JSON.');

    const titleEl = document.getElementById('pageTitle');
    const introEl = document.getElementById('pageIntro');
    if(titleEl) titleEl.textContent = page.title || '';
    if(introEl) introEl.textContent = page.intro || '';

    const items = page.items || [];
    const list = document.getElementById('questionList');

    const saved = window.AppStorage.loadPage(PAGE_ID) || {};
    const state = {
      answers: saved.answers || {},
      examples: saved.examples || {},
      cantRecall: saved.cantRecall || {},
      _computed: null
    };

    items.forEach(it => {
      if(!Object.prototype.hasOwnProperty.call(state.answers, it.id)){
        state.answers[it.id] = 3;
      }
      if(!Object.prototype.hasOwnProperty.call(state.cantRecall, it.id)){
        state.cantRecall[it.id] = false;
      }
    });

    function renderAll(){
      if(!list) return;
      list.innerHTML = '';
      items.forEach(it => {
        list.appendChild(renderQuestion(it, state, (rerender=true) => {
          if(rerender) renderAll();
          updateScoreUI(items, state);
        }));
      });
      updateScoreUI(items, state);
    }

    renderAll();

    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const status = document.getElementById('saveStatus');

    if(saveBtn){
      saveBtn.addEventListener('click', () => {
        updateScoreUI(items, state);
        window.AppStorage.savePage(PAGE_ID, {
          answers: state.answers,
          examples: state.examples,
          cantRecall: state.cantRecall,
          scores: state._computed,
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
