const $ = (s) => document.querySelector(s);
const STORAGE = "leh_proto_v1";

const defaultState = {
  lang: "vi",
  screen: "welcome", // welcome | context | quiz | results
  context: { job:"", people:"", place:"", goal:"" },
  answers: {} // questionId -> 0..4 or null
};

let state = loadState();
let UI = null;
let DATA = null;

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE);
    if(!raw) return structuredClone(defaultState);
    const s = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...s,
      context: { ...defaultState.context, ...(s.context||{}) }
    };
  }catch{
    return structuredClone(defaultState);
  }
}
function saveState(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }

async function loadLang(lang){
  const [uiRes, dataRes] = await Promise.all([
    fetch(`data/ui_${lang}.json`),
    fetch(`data/cases_${lang}.json`)
  ]);
  UI = await uiRes.json();
  DATA = await dataRes.json();

  $("#appTitle").textContent = UI.appTitle;
  $("#tagline").textContent = UI.tagline;
  $("#languageLabel").textContent = UI.language;
  $("#restartBtn").textContent = UI.restart;
  $("#footerText").textContent = UI.footer;

  render();
}

function setScreen(s){ state.screen = s; saveState(); render(); }

function restart(){
  state = structuredClone(defaultState);
  state.lang = $("#langSelect").value || "vi";
  saveState();
  render();
}

function ensureAnswers(){
  for(const c of DATA.cases){
    for(const q of c.questions){
      if(!(q.id in state.answers)) state.answers[q.id] = null;
    }
  }
  saveState();
}

function scoreCases(){
  const out = [];
  for(const c of DATA.cases){
    let score = 0, max = 0;
    for(const q of c.questions){
      const w = q.weight ?? 1.0;
      const v = (state.answers[q.id] == null) ? 0 : state.answers[q.id];
      score += v * w;
      max += 4 * w;
    }
    out.push({ id:c.id, pct: max ? score/max : 0 });
  }
  out.sort((a,b)=>b.pct-a.pct);
  return out;
}

function esc(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function viewWelcome(){
  return `
    <h1 class="h1">${esc(UI.appTitle)}</h1>
    <p class="p">${esc(UI.tagline)}</p>
    <div class="hr"></div>
    <div class="row">
      <div class="col">
        <div class="badge">1) ${esc(UI.yourContextTitle)} → 2) ${esc(UI.quizTitle)} → 3) ${esc(UI.resultsTitle)}</div>
        <div style="height:10px"></div>
        <p class="p">• Data nằm trong <b>/data</b> (JSON) để bạn mở rộng “full list câu hỏi” dần dần.</p>
        <div style="height:10px"></div>
        <p class="p">• Kết quả sẽ trả <b>3 ví dụ thực tế</b> (templates) để người dùng thay [ngoặc] bằng chi tiết đời họ.</p>
      </div>
      <div class="col">
        <div class="qcard">
          <p class="qtext">Preview</p>
          <p class="small">“Khi <b>[người]</b> nhờ bạn làm <b>[việc]</b> gấp…”</p>
        </div>
      </div>
    </div>
    <div class="hr"></div>
    <button id="startBtn" class="primary" type="button">${esc(UI.start)}</button>
  `;
}

function viewContext(){
  const c = state.context;
  return `
    <div class="badge">${esc(UI.yourContextTitle)}</div>
    <h1 class="h1" style="margin-top:10px">${esc(UI.yourContextTitle)}</h1>
    <p class="p">${esc(UI.yourContextHint)}</p>
    <div class="hr"></div>

    <label class="label">${esc(UI.context_job)}</label>
    <input id="ctx_job" value="${esc(c.job)}" placeholder="e.g., student / engineer">

    <label class="label">${esc(UI.context_people)}</label>
    <input id="ctx_people" value="${esc(c.people)}" placeholder="e.g., boss / partner">

    <label class="label">${esc(UI.context_place)}</label>
    <input id="ctx_place" value="${esc(c.place)}" placeholder="e.g., office / home">

    <label class="label">${esc(UI.context_goal)}</label>
    <input id="ctx_goal" value="${esc(c.goal)}" placeholder="e.g., say no politely">

    <div class="hr"></div>
    <div class="row">
      <button id="backBtn" type="button">${esc(UI.back)}</button>
      <button id="nextBtn" class="primary" type="button">${esc(UI.next)}</button>
    </div>
  `;
}

function viewQuiz(){
  ensureAnswers();

  const allQ = [];
  for(const c of DATA.cases){
    for(const q of c.questions) allQ.push({ ...q, caseTitle: c.title });
  }

  const answered = Object.values(state.answers).filter(v=>v!=null).length;
  const total = allQ.length;

  const scaleLabels = DATA.scale.labels;
  const scaleValues = DATA.scale.values;

  const qHtml = allQ.map((q, i) => {
    const v = state.answers[q.id];
    const choices = scaleValues.map((val, idx) => `
      <div class="choice ${v===val?'active':''}" tabindex="0" data-qid="${esc(q.id)}" data-val="${val}">
        <div class="small">${esc(scaleLabels[idx])}</div>
        <div><b>${val}</b></div>
      </div>
    `).join("");

    return `
      <div class="qcard">
        <p class="qtext">${i+1}. ${esc(q.text)}</p>
        <div class="small">(${esc(q.caseTitle)})</div>
        <div style="height:10px"></div>
        <div class="scale">${choices}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="row" style="align-items:center; justify-content:space-between">
      <div class="badge">${esc(UI.quizTitle)}</div>
      <div class="badge">${esc(UI.progress)}: ${answered}/${total}</div>
    </div>
    <h1 class="h1" style="margin-top:10px">${esc(UI.quizTitle)}</h1>
    <p class="p">${esc(UI.customizeTip)}</p>
    <div class="hr"></div>
    ${qHtml}
    <div class="hr"></div>
    <div class="row">
      <button id="backBtn" type="button">${esc(UI.back)}</button>
      <button id="nextBtn" class="primary" type="button">${esc(UI.next)}</button>
    </div>
  `;
}

function fillTokens(text){
  // “nhẹ nhàng” thôi: nếu có context thì replace vài token phổ biến
  const c = state.context;
  const rep = (k, v) => v && v.trim() ? v.trim() : k;

  return text
    .replaceAll("[person]", rep("[person]", c.people))
    .replaceAll("[người]", rep("[người]", c.people))
    .replaceAll("[task]", rep("[task]", c.goal))
    .replaceAll("[việc]", rep("[việc]", c.goal))
    .replaceAll("[topic]", rep("[topic]", c.goal))
    .replaceAll("[chủ đề]", rep("[chủ đề]", c.goal))
    .replaceAll("[place]", rep("[place]", c.place));
}

function viewResults(){
  const ranked = scoreCases().slice(0,3);

  const cards = ranked.map(r => {
    const c = DATA.cases.find(x=>x.id===r.id);
    const pct = Math.round(r.pct * 100);

    const signals = c.signals.map(s=>`<li>${esc(s)}</li>`).join("");
    const steps = c.howToPullFromLife.map(s=>`<li>${esc(s)}</li>`).join("");
    const ex = c.exampleTemplates.slice(0,3).map(e=>`
      <div class="qcard">
        <p class="qtext">${esc(e.title)}</p>
        <p class="p">${esc(fillTokens(e.text))}</p>
      </div>
    `).join("");

    return `
      <div class="case">
        <div class="caseTitle">
          <b>${esc(c.title)}</b>
          <span class="score">${pct}%</span>
        </div>
        <p class="p" style="margin-top:6px">${esc(c.oneLiner)}</p>

        <div class="hr"></div>
        <div class="row">
          <div class="col">
            <div class="badge">${esc(UI.whyThis)}</div>
            <ul class="p" style="margin:10px 0 0 18px">${signals}</ul>
          </div>
          <div class="col">
            <div class="badge">How to get a concrete example</div>
            <ul class="p" style="margin:10px 0 0 18px">${steps}</ul>
          </div>
        </div>

        <div class="hr"></div>
        <div class="badge">${esc(UI.exampleIdeas)}</div>
        ${ex}
      </div>
    `;
  }).join("");

  return `
    <div class="badge">${esc(UI.resultsTitle)}</div>
    <h1 class="h1" style="margin-top:10px">${esc(UI.topMatches)}</h1>
    <p class="p">${esc(UI.customizeTip)}</p>
    <div class="hr"></div>
    ${cards}
    <div class="hr"></div>
    <div class="row" style="justify-content:space-between">
      <button id="backBtn" type="button">${esc(UI.back)}</button>
      <button id="copyBtn" class="primary" type="button">${esc(UI.copySummary)}</button>
    </div>
    <div id="toast" class="small" style="display:none; margin-top:10px"></div>
  `;
}

function render(){
  if(!UI || !DATA){
    $("#app").innerHTML = `<p class="p">Loading…</p>`;
    return;
  }
  const app = $("#app");
  if(state.screen === "welcome") app.innerHTML = viewWelcome();
  if(state.screen === "context") app.innerHTML = viewContext();
  if(state.screen === "quiz") app.innerHTML = viewQuiz();
  if(state.screen === "results") app.innerHTML = viewResults();

  wire();
}

function wire(){
  $("#restartBtn").onclick = restart;

  const start = $("#startBtn");
  if(start) start.onclick = ()=>setScreen("context");

  const back = $("#backBtn");
  if(back){
    back.onclick = ()=>{
      if(state.screen==="context") setScreen("welcome");
      else if(state.screen==="quiz") setScreen("context");
      else if(state.screen==="results") setScreen("quiz");
    };
  }

  const next = $("#nextBtn");
  if(next){
    next.onclick = ()=>{
      if(state.screen==="context"){
        state.context.job = $("#ctx_job").value;
        state.context.people = $("#ctx_people").value;
        state.context.place = $("#ctx_place").value;
        state.context.goal = $("#ctx_goal").value;
        saveState();
        setScreen("quiz");
      } else if(state.screen==="quiz"){
        setScreen("results");
      }
    };
  }

  // quiz choices
  if(state.screen === "quiz"){
    document.querySelectorAll("[data-qid]").forEach(el=>{
      const pick = ()=>{
        const qid = el.getAttribute("data-qid");
        const val = Number(el.getAttribute("data-val"));
        state.answers[qid] = val;
        saveState();
        render();
      };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); pick(); }
      });
    });
  }

  // copy summary
  const copy = $("#copyBtn");
  if(copy){
    copy.onclick = async ()=>{
      const ranked = scoreCases().slice(0,3).map(r=>{
        const c = DATA.cases.find(x=>x.id===r.id);
        return `- ${c.title}: ${Math.round(r.pct*100)}%`;
      }).join("\n");

      const c = state.context;
      const ctx = [
        c.job ? `job: ${c.job}` : null,
        c.people ? `people: ${c.people}` : null,
        c.place ? `place: ${c.place}` : null,
        c.goal ? `goal: ${c.goal}` : null,
      ].filter(Boolean).join("\n") || "(empty)";

      const text = `${UI.appTitle}\n\n${UI.topMatches}\n${ranked}\n\ncontext\n${ctx}`;
      await navigator.clipboard.writeText(text);

      const toast = $("#toast");
      toast.style.display = "block";
      toast.textContent = UI.copied;
      setTimeout(()=>toast.style.display="none", 1200);
    };
  }
}

function init(){
  const sel = $("#langSelect");
  sel.value = state.lang || "vi";
  sel.addEventListener("change", ()=>{
    state.lang = sel.value;
    saveState();
    loadLang(state.lang);
  });
  loadLang(state.lang);
}

init();
