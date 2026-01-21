(function(){
  const PAGE_ID = 'ne_dom';

  // Scale: Never=0, Rarely=1, Sometimes=2, Often=3, Almost always=4
  const SCALE = [
    { v: 0, label: 'Never / almost never' },
    { v: 1, label: 'Rarely' },
    { v: 2, label: 'Sometimes' },
    { v: 3, label: 'Often' },
    { v: 4, label: 'Almost always' }
  ];

  // Structured versions of the exact ideas you provided (no personal “life story” invention).
  const presenceItems = [
    {
      id: 'ne_p1',
      title: 'My mind naturally generates many different possibilities / paths.',
      note: 'Diverse ideas, aspirations, “what-if” branches.',
      examples: [
        'You quickly see multiple ways something could play out.',
        'You get energized by exploring alternatives, not just one plan.'
      ]
    },
    {
      id: 'ne_p2',
      title: 'I value open-mindedness and resourcefulness, and I enjoy creating new approaches.',
      note: 'Preference for novel methods; old methods may feel stale.',
      examples: [
        'You enjoy trying new tools/solutions rather than repeating the same method.',
        'You adapt by reframing or changing the approach when stuck.'
      ]
    },
    {
      id: 'ne_p3',
      title: 'Interesting possibilities lift my mood quickly; I like brainstorming with people.',
      note: 'Hopeful/optimistic “spark” from options and ideas.',
      examples: [
        'A new possibility makes you perk up and re-engage.',
        'You like bouncing ideas back-and-forth to develop them.'
      ]
    },
    {
      id: 'ne_p4',
      title: 'Feeling stuck (no room to change) feels especially bad to me.',
      note: '“No possibility” feels dire; stuckness feels heavy.',
      examples: [
        'You feel trapped when life becomes too fixed or repetitive.',
        'You seek new options when you sense a dead-end.'
      ]
    },
    {
      id: 'ne_p5',
      title: 'I strongly dislike people who are closed-minded, overly rigid, or pessimistic “wet blankets.”',
      note: 'Reactivity to unimaginative / overly literal / rigid attitudes.',
      examples: [
        'You get frustrated with “we always do it this way.”',
        'You dislike shutting down ideas before exploring them.'
      ]
    },
    {
      id: 'ne_p6',
      title: 'I have received feedback like: scattered, impractical, inconsistent, unreliable, or unpredictable.',
      note: 'Common downside labels associated with high Ne.',
      examples: [
        'Others say you jump between interests or start more than you finish.',
        'Others feel you ignore practical details or logistics.'
      ]
    }
  ];

  // Your “NOT Ne dominant” signs (as exclusion items).
  const exclusionItems = [
    {
      id: 'ne_x1',
      title: 'I rarely have new ideas and I usually refuse to entertain new possibilities.',
      note: 'Low openness to alternatives.',
      examples: [
        'Brainstorming feels annoying or pointless.',
        'You prefer sticking to the known path almost always.'
      ]
    },
    {
      id: 'ne_x2',
      title: 'I genuinely enjoy routine, repetitive practice, and logistical planning.',
      note: 'Routine comfort as a preference (not just coping).',
      examples: [
        'You prefer repeating what works.',
        'Maintaining systems feels more satisfying than exploring new ones.'
      ]
    },
    {
      id: 'ne_x3',
      title: 'I must think through every contingency before acting.',
      note: 'High need for certainty before action.',
      examples: [
        'You delay action until fully prepared.',
        'You avoid improvising because it feels unsafe.'
      ]
    },
    {
      id: 'ne_x4',
      title: 'I do not dream big and I don’t relate to big-picture possibility thinking.',
      note: 'Low pull toward future possibilities.',
      examples: [
        'You focus mostly on immediate, concrete goals.',
        '“Dreaming” feels unrealistic or unnecessary.'
      ]
    }
  ];

  function el(tag, attrs = {}, children = []){
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if(k === 'class') node.className = v;
      else node.setAttribute(k, v);
    });
    children.forEach(ch => node.appendChild(ch));
    return node;
  }

  function renderQuestion(item, kind, saved){
    const defaultVal = (saved && typeof saved[item.id] === 'number') ? saved[item.id] : 0;

    const title = el('div', { class: 'qtitle' });
    title.textContent = item.title;

    const meta = el('div', { class: 'qmeta' });
    meta.textContent = item.note || '';

    const select = el('select', { 'data-qid': item.id, 'data-kind': kind });
    SCALE.forEach(opt => {
      const o = document.createElement('option');
      o.value = String(opt.v);
      o.textContent = opt.label;
      if(opt.v === defaultVal) o.selected = true;
      select.appendChild(o);
    });

    const selectRow = el('div', { class: 'select-row' }, [
      el('label', {}, [document.createTextNode('How often is this true?')]),
      select
    ]);

    let examplesNode = null;
    if(item.examples && item.examples.length){
      const ul = el('ul');
      item.examples.forEach(t => ul.appendChild(el('li', {}, [document.createTextNode(t)])));
      examplesNode = el('details', { class: 'examples' }, [
        el('summary', {}, [document.createTextNode('Examples (optional)')]),
        ul
      ]);
    }

    const top = el('div', { class: 'qtop' }, [
      el('div', {}, [title, meta]),
    ]);

    const qcard = el('div', { class: 'qcard' }, [top, selectRow]);
    if(examplesNode) qcard.appendChild(examplesNode);
    return qcard;
  }

  function computeScores(presenceAnswers, exclusionAnswers){
    const presence = Object.values(presenceAnswers).reduce((a,b)=>a+b,0);
    const exclusion = Object.values(exclusionAnswers).reduce((a,b)=>a+b,0);
    const net = presence - exclusion;

    // Placeholder confidence thresholds (tune later)
    let confidence = 'Low';
    if(net >= 14) confidence = 'High';
    else if(net >= 8) confidence = 'Medium';

    return { presence, exclusion, net, confidence };
  }

  function main(){
    const presenceList = document.getElementById('presenceList');
    const exclusionList = document.getElementById('exclusionList');

    const saved = window.AppStorage.loadPage(PAGE_ID) || {};
    const savedAnswers = saved.answers || {};

    const presenceAnswers = {};
    const exclusionAnswers = {};

    presenceItems.forEach(item => {
      const card = renderQuestion(item, 'presence', savedAnswers);
      presenceList.appendChild(card);
      presenceAnswers[item.id] = (typeof savedAnswers[item.id] === 'number') ? savedAnswers[item.id] : 0;
    });

    exclusionItems.forEach(item => {
      const card = renderQuestion(item, 'exclusion', savedAnswers);
      exclusionList.appendChild(card);
      exclusionAnswers[item.id] = (typeof savedAnswers[item.id] === 'number') ? savedAnswers[item.id] : 0;
    });

    const presenceScoreEl = document.getElementById('presenceScore');
    const exclusionScoreEl = document.getElementById('exclusionScore');
    const netScoreEl = document.getElementById('netScore');
    const confidenceEl = document.getElementById('confidence');

    function refresh(){
      const s = computeScores(presenceAnswers, exclusionAnswers);
      presenceScoreEl.textContent = String(s.presence);
      exclusionScoreEl.textContent = String(s.exclusion);
      netScoreEl.textContent = String(s.net);
      confidenceEl.textContent = s.confidence;
    }

    document.addEventListener('change', (e) => {
      const t = e.target;
      if(!(t instanceof HTMLSelectElement)) return;
      const qid = t.getAttribute('data-qid');
      const kind = t.getAttribute('data-kind');
      if(!qid || !kind) return;

      const val = parseInt(t.value, 10);
      if(Number.isNaN(val)) return;

      if(kind === 'presence') presenceAnswers[qid] = val;
      if(kind === 'exclusion') exclusionAnswers[qid] = val;

      refresh();
    });

    refresh();

    const saveBtn = document.getElementById('saveBtn');
    const saveStatus = document.getElementById('saveStatus');
    saveBtn.addEventListener('click', () => {
      const answers = { ...presenceAnswers, ...exclusionAnswers };
      const scores = computeScores(presenceAnswers, exclusionAnswers);
      window.AppStorage.savePage(PAGE_ID, {
        answers,
        scores,
        updated_at: new Date().toISOString()
      });
      saveStatus.textContent = `Saved ✓ (${new Date().toLocaleString()})`;
    });

    const resetPageBtn = document.getElementById('resetPageBtn');
    resetPageBtn.addEventListener('click', () => {
      if(!confirm('Reset answers for this page?')) return;
      window.AppStorage.resetPage(PAGE_ID);
      location.reload();
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', main);
  }else{
    main();
  }
})();
