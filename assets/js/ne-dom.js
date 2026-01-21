(function(){
  const PAGE_ID = 'ne_dom';

  // 1..5 bubbles (Option B)
  const SCALE = [
    { v: 1, key: 'scale_1' },
    { v: 2, key: 'scale_2' },
    { v: 3, key: 'scale_3' },
    { v: 4, key: 'scale_4' },
    { v: 5, key: 'scale_5' }
  ];

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function isStrong(v){ return v === 4 || v === 5; }

  // Convert 1..5 to centered points: (-2,-1,0,+1,+2)
  function centeredPoints(v){ return v - 3; }

  // Scoring rules (prototype but matches what you asked):
  // - Base score from Likert (centeredPoints * dir)
  // - If user picked 4–5 and ticks >=1 example => bonus points in same direction (dir)
  // - "Can't recall" exists INSIDE examples and makes the answer "null"
  //   -> contributes 0 score AND reduces accuracy.
  function computeScore(items, answers, examples){
    let sum = 0;
    let answered = 0;
    let cantRecall = 0;

    for(const it of items){
      const v = answers[it.id];

      if(v === null){
        cantRecall += 1;
        continue;
      }

      if(typeof v === 'number'){
        answered += 1;
        const base = centeredPoints(v) * (it.dir || 1);
        sum += base;

        // Example bonus only when strong (4–5)
        if(isStrong(v) && it.examples && it.examples.length){
          // if any example checked (excluding cant)
          let anyChecked = false;
          for(let i=0;i<it.examples.length;i++){
            const exId = `${it.id}__ex${i}`;
            if(examples[exId]) { anyChecked = true; break; }
          }
          if(anyChecked){
            sum += 1 * (it.dir || 1); // small confirm bonus
          }
        }
      }
    }

    // Accuracy penalty for cant-recall answers
    const recallPenaltyEach = 12; // stronger penalty since it's explicit "can't recall"
    const accuracy = clamp(100 - cantRecall * recallPenaltyEach, 30, 100);

    const abs = Math.abs(sum);
    let confidence = 'low';
    if(accuracy >= 85 && abs >= 8) confidence = 'high';
    else if(accuracy >= 70 && abs >= 5) confidence = 'medium';

    return { score: sum, answered, cantRecall, total: items.length, accuracy, confidence };
  }

  function el(tag, attrs={}, children=[]){
    return window.App.el(tag, attrs, children);
  }

  function renderLikert(qid, currentValue, onPick){
    const row = el('div', { class: 'likert-row' });

    const left = el('div', { class: 'likert-label disagree', text: window.App.t('scale_left', 'Disagree') });
    const right = el('div', { class: 'likert-label agree', text: window.App.t('scale_right', 'Agree') });

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
    if(v === null) return null;
    if(!isStrong(v)) return null;
    if(!item.examples || item.examples.length === 0) return null;

    const box = el('div', { class: 'followup' });

    const title = el('div', {
      class: 'followup-title',
      text: window.App.t('followup_title', 'If you answered strong (4–5): which examples fit your real life?')
    });

    const note = el('div', {
      class: 'small-muted',
      text: window.App.t('followup_note', 'Pick any that match. Skip if you don’t want to.')
    });

    const list = el('ul', { class: 'ex-list' });

    // Normal example checkboxes
    item.examples.forEach((txt, idx) => {
      const exId = `${item.id}__ex${idx}`;
      const checked = !!state.examples[exId];

      const input = el('input', { type: 'checkbox', id: exId });
      input.checked = checked;

      input.addEventListener('change', () => {
        const cantId = `${item.id}__cant`;
        // If they check any example, uncheck cant-recall if it was set
        if(input.checked){
          if(state.examples[cantId]) delete state.examples[cantId];
        }

        if(input.checked) state.examples[exId] = true;
        else delete state.examples[exId];

        onUpdate();
      });

      const label = el('label', { for: exId });
      label.appendChild(el('span', { text: txt }));

      list.appendChild(el('li', { class: 'ex-item' }, [input, label]));
    });

    // "Can't recall" checkbox INSIDE examples
    const cantId = `${item.id}__cant`;
    const cantChecked = !!state.examples[cantId];

    const cantInput = el('input', { type: 'checkbox', id: cantId });
    cantInput.checked = cantChecked;

    cantInput.addEventListener('change', () => {
      if(cantInput.checked){
        // Mark cant recall and clear normal examples
        state.examples[cantId] = true;
        for(let i=0;i<item.examples.length;i++){
          delete state.examples[`${item.id}__ex${i}`];
        }
        // Convert answer to null so it reduces accuracy / contributes 0
        state.answers[item.id] = null;
      }else{
        delete state.examples[cantId];
        // Restore to last strong value if we have it, else 4
        state.answers[item.id] = state.lastStrong[item.id] || 4;
      }
      onUpdate(true); // re-render question block
    });

    const cantLabel = el('label', { for: cantId });
    cantLabel.appendChild(el('span', { text: window.App.t('cant_recall', "Can't recall / not sure") }));

    list.appendChild(el('li', { class: 'ex-item' }, [cantInput, cantLabel]));

    box.appendChild(title);
    box.appendChild(note);
    box.appendChild(list);

    return box;
  }

  function renderQuestion(item, state, onUpdate){
    const block = el('div', { class: 'q-block' });

    const qText = el('div', { class: 'q-text', text: item.text });
    block.appendChild(qText);

    const current = (state.answers[item.id] === null) ? null : state.answers[item.id];

    const likert = renderLikert(item.id, current, (picked) => {
      // If previously null, allow re-answer
      state.answers[item.id] = picked;

      // track last strong value for restoring after cant-recall
      if(isStrong(picked)){
        state.lastStrong[item.id] = picked;
      }

      // If user picked any value, clear cant-recall example flag for this question
      const cantId = `${item.id}__cant`;
      if(state.examples[cantId]) delete state.examples[cantId];

      onUpdate(true);
    });

    block.appendChild(likert);

    // Follow-up examples
    const exBox = renderExamples(item, state, onUpdate);
    if(exBox) block.appendChild(exBox);

    return block;
  }

  function updateScoreUI(items, state){
    const s = computeScore(items, state.answers, state.examples);

    document.getElementById('scoreValue').textContent = String(s.score);
    document.getElementById('accuracyValue').textContent = `${s.accuracy}%`;

    const confText =
      s.confidence === 'high' ? window.App.t('conf_high', 'High') :
      s.confidence === 'medium' ? window.App.t('conf_med', 'Medium') :
      window.App.t('conf_low', 'Low');

    document.getElementById('confidenceValue').textContent = confText;

    const bar = document.getElementById('accuracyBar');
    bar.style.width = `${s.accuracy}%`;

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

    // --- Language toggle (fix: no custom reload logic, just set + reload) ---
    const langBtn = document.getElementById('langToggleBtn');
    const langPill = document.getElementById('langPill');

    function refreshLangUI(){
      langPill.textContent = window.App.getLang().toUpperCase();
    }
    refreshLangUI();

    langBtn.addEventListener('click', async () => {
      const next = window.App.getLang() === 'en' ? 'vi' : 'en';
      await window.App.setLang(next);
      // hard reload to re-fetch correct json for page + UI
      window.location.reload();
    });

    const casesPath = paths.cases[window.App.getLang()];
    const cases = await window.App.loadJSON(casesPath);

    const page = cases.pages && cases.pages.ne_dom;
    if(!page) throw new Error('Missing pages.ne_dom in cases JSON.');

    document.getElementById('pageTitle').textContent = page.title;
    document.getElementById('pageIntro').textContent = page.intro;

    // Load saved state
    const saved = window.AppStorage.loadPage(PAGE_ID) || {};
    const state = {
      answers: saved.answers || {},
      examples: saved.examples || {},
      lastStrong: saved.lastStrong || {},
      _computed: null
    };

    const items = page.items || [];
    const list = document.getElementById('questionList');

    function renderAll(){
      list.innerHTML = '';
      items.forEach(it => {
        // default neutral if missing
        if(!Object.prototype.hasOwnProperty.call(state.answers, it.id)){
          state.answers[it.id] = 3;
        }
        const node = renderQuestion(it, state, (rerender=true) => {
          if(rerender) renderAll();
          updateScoreUI(items, state);
        });
        list.appendChild(node);
      });

      updateScoreUI(items, state);
    }

    renderAll();

    // Save/reset
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const status = document.getElementById('saveStatus');

    saveBtn.addEventListener('click', () => {
      updateScoreUI(items, state);
      window.AppStorage.savePage(PAGE_ID, {
        answers: state.answers,
        examples: state.examples,
        lastStrong: state.lastStrong,
        scores: state._computed,
        updated_at: new Date().toISOString()
      });
      status.textContent = window.App.t('saved_ok', 'Saved.');
      setTimeout(() => (status.textContent = ''), 1400);
    });

    resetBtn.addEventListener('click', () => {
      const msg = window.App.t('reset_confirm', 'Reset this page?');
      if(!confirm(msg)) return;
      window.AppStorage.resetPage(PAGE_ID);
      window.location.reload();
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', main);
  }else{
    main();
  }
})();
