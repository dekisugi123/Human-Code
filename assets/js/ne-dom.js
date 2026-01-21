(function () {
  const PAGE_ID = "ne_dom";

  // =========================
  // Option B: 5-point scale
  // + "Don't remember"
  // Values: 1..5, and -1 for "Don't remember"
  // =========================
  const SCALE = [
    { v: 1, label: "Never" },
    { v: 2, label: "Rarely" },
    { v: 3, label: "Sometimes" },
    { v: 4, label: "Often" },
    { v: 5, label: "Almost always" },
    { v: -1, label: "Don’t remember / can’t recall" },
  ];

  // Top-2 highest (4-5) triggers showing examples
  const TOP2_MIN = 4;

  // =========================
  // Ne-dominant confirmation items (NO exclusion section)
  // Keep them clean, short, not "Part A / Part B"
  // =========================
  const items = [
    {
      id: "ne_1",
      title:
        "My mind naturally generates many different possibilities or paths (\"what-if\" branches).",
      examples: [
        "You quickly see multiple ways something could go.",
        "You naturally jump to alternative interpretations or options.",
        "You often ask “What else could we do?” before committing.",
      ],
    },
    {
      id: "ne_2",
      title:
        "I feel energized by new ideas, new angles, or new options—even if I don’t act on them yet.",
      examples: [
        "New possibilities lift your mood or motivation quickly.",
        "You get a “spark” when a new angle appears.",
        "You feel more alive when there are options to explore.",
      ],
    },
    {
      id: "ne_3",
      title:
        "I enjoy brainstorming (alone or with others) more than following a fixed plan.",
      examples: [
        "You like bouncing ideas back and forth to expand them.",
        "You prefer exploring alternatives before locking in.",
        "You can generate variants quickly, even under time pressure.",
      ],
    },
    {
      id: "ne_4",
      title:
        "Feeling stuck (few options, repetitive life, little possibility to change) feels especially unbearable to me.",
      examples: [
        "When life becomes repetitive, you urgently search for new options.",
        "A “dead-end” feeling makes you restless or low.",
        "You feel better once you can see a new path forward.",
      ],
    },
    {
      id: "ne_5",
      title:
        "I strongly value open-mindedness and exploring alternatives; rigid thinking annoys me.",
      examples: [
        "You dislike “we always do it this way” without trying alternatives.",
        "You get frustrated when people shut down ideas too early.",
        "You prefer “let’s explore” over “just follow the rule.”",
      ],
    },
    {
      id: "ne_6",
      title:
        "I’ve been told I can be scattered, inconsistent, or impractical because I chase possibilities.",
      examples: [
        "You start more ideas than you finish.",
        "You switch interests when something more interesting appears.",
        "You may forget practical details while exploring concepts.",
      ],
    },
  ];

  // =========================
  // DOM helpers
  // =========================
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const ch of children) node.appendChild(ch);
    return node;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // =========================
  // Scoring (prototype)
  // - Primary score: sum of 1..5 responses
  // - "Don't remember" penalizes confidence heavily
  // =========================
  function computeScores(answers) {
    let sum = 0;
    let answered = 0;
    let dontRememberCount = 0;

    for (const it of items) {
      const v = answers[it.id];
      if (typeof v !== "number") continue;

      if (v === -1) {
        dontRememberCount += 1;
        continue;
      }

      answered += 1;
      sum += v; // 1..5
    }

    // Normalize-ish presence strength (0..1)
    // If answered==0 -> 0
    const maxPossible = answered * 5;
    const strength = maxPossible > 0 ? sum / maxPossible : 0;

    // Confidence: starts from coverage + strength, then reduced by don't-remember
    const coverage = items.length > 0 ? answered / items.length : 0;
    let conf = 0.45 * coverage + 0.55 * strength;

    // big penalty per "don't remember"
    conf -= dontRememberCount * 0.18;

    conf = clamp(conf, 0, 1);

    let confidenceLabel = "Low";
    if (conf >= 0.72) confidenceLabel = "High";
    else if (conf >= 0.5) confidenceLabel = "Medium";

    return {
      presence: sum, // reuse existing UI box "Ne presence"
      exclusion: dontRememberCount, // reuse existing UI box "Ne exclusion" (now shows don't-remember count)
      net: Math.round(conf * 100), // reuse "Net" box as Confidence %
      confidence: confidenceLabel,
      meta: {
        answered,
        dontRememberCount,
        strength: Number(strength.toFixed(3)),
        coverage: Number(coverage.toFixed(3)),
        confidence01: Number(conf.toFixed(3)),
      },
    };
  }

  // =========================
  // Render one question with:
  // - big bubble radio scale (like your image)
  // - examples only appear when value is 4 or 5
  // - includes "Don't remember"
  // =========================
  function renderQuestion(it, savedAnswers) {
    const defaultVal =
      savedAnswers && typeof savedAnswers[it.id] === "number"
        ? savedAnswers[it.id]
        : null;

    const qTitle = el("div", { class: "qtitle", text: it.title });

    // Big choices row
    const choicesRow = el("div", { class: "likert-row" });

    // We'll create a radio group per question
    const name = `q_${it.id}`;

    SCALE.forEach((opt) => {
      const inputId = `${name}_${opt.v}`;

      // wrapper
      const wrap = el("label", {
        class:
          opt.v === -1 ? "likert-choice dont-remember" : "likert-choice",
        for: inputId,
      });

      const input = el("input", {
        type: "radio",
        id: inputId,
        name,
        value: String(opt.v),
        "data-qid": it.id,
      });

      if (defaultVal !== null && opt.v === defaultVal) input.checked = true;

      const bubble = el("span", { class: "bubble", "aria-hidden": "true" });
      const label = el("span", { class: "choice-label", text: opt.label });

      wrap.appendChild(input);
      wrap.appendChild(bubble);
      wrap.appendChild(label);

      choicesRow.appendChild(wrap);
    });

    // Examples box (hidden by default; shown only when 4 or 5)
    const exTitle = el("div", {
      class: "examples-title",
      text: "Examples (only shown when you choose Often / Almost always)",
    });

    const exList = el("ul", { class: "examples-list" });
    (it.examples || []).forEach((t) => {
      exList.appendChild(el("li", { text: t }));
    });

    const examplesBox = el("div", { class: "examples-box hidden" }, [
      exTitle,
      exList,
    ]);

    // Whole card
    const card = el("div", { class: "qcard big" }, [
      qTitle,
      choicesRow,
      examplesBox,
    ]);

    // Set initial examples visibility
    if (defaultVal !== null && defaultVal >= TOP2_MIN) {
      examplesBox.classList.remove("hidden");
    }

    return { card, examplesBox };
  }

  // =========================
  // Inject minimal CSS (so you don’t have to edit CSS yet)
  // This makes it "like the image": big text, big bubbles, clean.
  // =========================
  function injectStyleOnce() {
    if (document.getElementById("ne_dom_inline_style")) return;

    const css = `
      /* Big readable page */
      .qcard.big{ padding: 22px; border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; }
      .qtitle{ font-size: 28px; line-height: 1.25; font-weight: 600; margin-bottom: 18px; }
      .likert-row{ display:flex; flex-wrap: wrap; gap: 16px; align-items: center; }

      .likert-choice{
        display:flex; align-items:center; gap:10px;
        cursor:pointer; user-select:none;
        padding: 10px 12px; border-radius: 12px;
      }
      .likert-choice:hover{ background: rgba(0,0,0,0.03); }

      .likert-choice input{ position:absolute; opacity:0; pointer-events:none; }
      .bubble{
        width: 44px; height: 44px; border-radius: 999px;
        border: 4px solid rgba(0,0,0,0.25);
        display:inline-block;
      }
      .choice-label{ font-size: 20px; line-height: 1.1; }

      /* Checked states */
      .likert-choice input:checked + .bubble{
        border-color: rgba(0,0,0,0.75);
      }

      /* "Don't remember" more obvious */
      .likert-choice.dont-remember .bubble{
        border-style: dashed;
      }

      .examples-box{
        margin-top: 16px;
        background: rgba(0,0,0,0.03);
        border-radius: 14px;
        padding: 14px 16px;
      }
      .examples-box.hidden{ display:none; }
      .examples-title{ font-size: 16px; opacity: 0.75; margin-bottom: 10px; }
      .examples-list{ margin: 0; padding-left: 18px; }
      .examples-list li{ font-size: 18px; line-height: 1.35; margin: 6px 0; }

      /* Reduce “letters stuck together” */
      .stack{ display:flex; flex-direction:column; gap: 18px; }
    `;

    const style = document.createElement("style");
    style.id = "ne_dom_inline_style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // =========================
  // Main
  // =========================
  function main() {
    injectStyleOnce();

    // Render into presenceList if exists, else exclusionList, else main container
    const mount =
      document.getElementById("presenceList") ||
      document.getElementById("exclusionList") ||
      document.querySelector("main") ||
      document.body;

    // Clear existing content if any
    if (mount) mount.innerHTML = "";

    const saved = window.AppStorage?.loadPage(PAGE_ID) || {};
    const savedAnswers = saved.answers || {};

    const answers = {};

    // Build UI
    const exampleBoxesById = {};

    items.forEach((it) => {
      const { card, examplesBox } = renderQuestion(it, savedAnswers);
      mount.appendChild(card);

      const v =
        typeof savedAnswers[it.id] === "number" ? savedAnswers[it.id] : null;
      if (v !== null) answers[it.id] = v;

      exampleBoxesById[it.id] = examplesBox;
    });

    // Score elements (reuse existing ids from your HTML)
    const presenceScoreEl = document.getElementById("presenceScore");
    const exclusionScoreEl = document.getElementById("exclusionScore");
    const netScoreEl = document.getElementById("netScore");
    const confidenceEl = document.getElementById("confidence");

    function refreshScores() {
      const s = computeScores(answers);

      // If score widgets are present, update them; otherwise do nothing
      if (presenceScoreEl) presenceScoreEl.textContent = String(s.presence);
      if (exclusionScoreEl) exclusionScoreEl.textContent = String(s.exclusion); // now shows "don't remember count"
      if (netScoreEl) netScoreEl.textContent = String(s.net); // now shows confidence %
      if (confidenceEl) confidenceEl.textContent = s.confidence;

      return s;
    }

    // Handle clicks/changes (radio inputs)
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "radio") return;

      const qid = t.getAttribute("data-qid");
      if (!qid) return;

      const val = parseInt(t.value, 10);
      if (Number.isNaN(val)) return;

      answers[qid] = val;

      // Show examples only when 4 or 5
      const exBox = exampleBoxesById[qid];
      if (exBox) {
        if (val >= TOP2_MIN) exBox.classList.remove("hidden");
        else exBox.classList.add("hidden");
      }

      refreshScores();
    });

    // Initial refresh
    const initialScores = refreshScores();

    // Save / Reset buttons (reuse your existing HTML buttons)
    const saveBtn = document.getElementById("saveBtn");
    const saveStatus = document.getElementById("saveStatus");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const scores = refreshScores();
        window.AppStorage.savePage(PAGE_ID, {
          answers: { ...answers },
          scores,
          updated_at: new Date().toISOString(),
        });
        if (saveStatus) {
          saveStatus.textContent = `Saved ✓ (${new Date().toLocaleString()})`;
        }
      });
    }

    const resetPageBtn = document.getElementById("resetPageBtn");
    if (resetPageBtn) {
      resetPageBtn.addEventListener("click", () => {
        if (!confirm("Reset answers for this page?")) return;
        window.AppStorage.resetPage(PAGE_ID);
        location.reload();
      });
    }

    // If nothing was answered but saved had scores, don't care; prototype.
    // (We compute live anyway.)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
