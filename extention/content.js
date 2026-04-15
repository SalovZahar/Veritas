/* ═══════════════════════════════════════════════════════════════
   Veritas — content.js
   Flow:
     1. User selects text  →  floating "Check" button appears
     2. Click Check        →  panel opens, calls /classify + /sources
     3. Results render     →  "Deep Analysis" button appears
     4. Click Analysis     →  calls /deep-analyse, renders detailed view
   ═══════════════════════════════════════════════════════════════ */

let API_BASE = "http://localhost:8000";

// Load saved API URL
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get("apiBase", (d) => { if (d.apiBase) API_BASE = d.apiBase; });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_API_BASE") API_BASE = msg.apiBase;
  });
}

/* ── State ──────────────────────────────────────────────────── */
let btn           = null;
let panel         = null;
let currentText   = "";
let lastClassify  = null;   // cached for deep analysis
let lastSources   = null;   // cached for deep analysis

/* ══════════════════════════════════════════════════════════════
   1. Floating "Check" button
   ══════════════════════════════════════════════════════════════ */

function createBtn() {
  if (btn) return;
  btn = document.createElement("div");
  btn.id = "veritas-btn";
  btn.innerHTML = `<div class="vt-btn-dot"></div>Check`;
  btn.addEventListener("click", onCheckClick);
  document.body.appendChild(btn);
}

function removeBtn() {
  if (btn) { btn.remove(); btn = null; }
}

function positionBtn(clientX, rangeTop) {
  if (!btn) return;
  const W = 80;
  let left = Math.min(clientX, window.innerWidth - W - 8);
  if (left < 4) left = 4;
  let top = rangeTop - 44;
  if (top < 4) top = rangeTop + 14;
  btn.style.left = (left + window.scrollX) + "px";
  btn.style.top  = (top  + window.scrollY) + "px";
}

document.addEventListener("mouseup", (e) => {
  setTimeout(() => {
    const sel  = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (text.length < 30) { removeBtn(); return; }
    currentText = text;
    createBtn();
    try {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      positionBtn(e.clientX, rect.top);
    } catch (_) {}
  }, 10);
});

document.addEventListener("mousedown", (e) => {
  if (btn && !btn.contains(e.target) && (!panel || !panel.contains(e.target))) {
    removeBtn();
  }
});

/* ══════════════════════════════════════════════════════════════
   2. Panel
   ══════════════════════════════════════════════════════════════ */

function createPanel() {
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "veritas-panel";
    document.body.appendChild(panel);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("open")));
}

function closePanel() {
  if (!panel) return;
  panel.classList.remove("open");
  setTimeout(() => { panel && panel.remove(); panel = null; }, 360);
  lastClassify = null;
  lastSources  = null;
}

function bindClose() {
  panel?.querySelector("#vt-close")?.addEventListener("click", closePanel);
}

/* ══════════════════════════════════════════════════════════════
   3. HTML builders
   ══════════════════════════════════════════════════════════════ */

function header(subtitle) {
  return `
    <div class="vt-header">
      <div class="vt-header-left">
        <div class="vt-logo">V</div>
        <div>
          <div class="vt-header-title">Veritas</div>
          <div class="vt-header-sub">${subtitle}</div>
        </div>
      </div>
      <button class="vt-close" id="vt-close">✕</button>
    </div>`;
}

function snippetHtml(text) {
  return `
    <div>
      <div class="vt-label">Analysed text</div>
      <div class="vt-snippet">${esc(text)}</div>
    </div>`;
}

// ── Loading state ────────────────────────────────────────────
function renderLoading(text) {
  panel.innerHTML = header("Checking credibility…") + `
    <div class="vt-body">
      ${snippetHtml(text)}
      <div class="vt-loading">
        <div class="vt-spinner"></div>
        <div class="vt-loading-text">Running model and searching sources…</div>
      </div>
    </div>`;
  bindClose();
}

// ── Main result state ─────────────────────────────────────────
function renderResult(text, classify, sources) {
  const score = classify.score ?? 0;
  const cls   = scoreClass(score);
  const conf  = Math.round((classify.confidence ?? 0) * 100);
  const pFake = Math.round((classify.probs?.fake ?? 0) * 100);
  const pReal = Math.round((classify.probs?.real ?? 0) * 100);

  panel.innerHTML = header("Credibility check") + `
    <div class="vt-body">

      ${snippetHtml(text)}

      <!-- Verdict -->
      <div class="vt-verdict ${cls}">
        <div class="vt-verdict-glow"></div>
        <div class="vt-verdict-row">
          <div class="vt-dot"></div>
          <div class="vt-verdict-name">${verdictLabel(cls)}</div>
        </div>
        <div class="vt-verdict-desc">${verdictDesc(cls)}</div>
      </div>

      <!-- Score bar -->
      <div class="vt-score-block ${cls}">
        <div class="vt-score-top">
          <span class="vt-label" style="margin:0">Trust score</span>
          <span class="vt-score-num">${score}<span style="font-size:11px;opacity:.45">/100</span></span>
        </div>
        <div class="vt-bar-bg">
          <div class="vt-bar-fill" id="vt-bar" style="width:0%"></div>
        </div>
      </div>

      <!-- Chips -->
      <div class="vt-chips">
        <div class="vt-chip">
          <div class="vt-chip-label">Confidence</div>
          <div class="vt-chip-val">${conf}%</div>
        </div>
        <div class="vt-chip">
          <div class="vt-chip-label">Real prob.</div>
          <div class="vt-chip-val">${pFake}%</div>
        </div>
        <div class="vt-chip">
          <div class="vt-chip-label">Fake prob.</div>
          <div class="vt-chip-val">${pReal}%</div>
        </div>
      </div>

      <!-- Sources -->
      <div>
        <div class="vt-label">Sources found</div>
        ${buildSources(sources)}
      </div>

      <div class="vt-divider"></div>

      <!-- Deep analysis button -->
      <button class="vt-analyse-btn" id="vt-deep-btn">
        🔬 Run Deep Analysis
      </button>

    </div>`;

  bindClose();

  // animate bar
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const bar = panel?.querySelector("#vt-bar");
    if (bar) bar.style.width = score + "%";
  }));

  panel?.querySelector("#vt-deep-btn")?.addEventListener("click", onDeepClick);
}

// ── Deep analysis loading state ───────────────────────────────
function renderDeepLoading() {
  const btn = panel?.querySelector("#vt-deep-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<div class="vt-btn-spinner"></div>Analysing with AI…`;
  }
}

// ── Deep analysis result (appended below button) ──────────────
function renderDeepResult(result) {
  const btn = panel?.querySelector("#vt-deep-btn");
  if (btn) btn.remove();

  const cls = deepVerdictClass(result.verdict);

  // Collect all signals into flat list
  const signals = [];
  const s = result.signals || {};
  (s.factual_issues     || []).forEach(t => signals.push({ icon: "🔍", text: t }));
  (s.manipulation_signs || []).forEach(t => signals.push({ icon: "⚠️", text: t }));
  (s.source_analysis    || []).forEach(t => signals.push({ icon: "📰", text: t }));
  (s.contradictions     || []).forEach(t => signals.push({ icon: "⚡", text: t }));

  const signalsHtml = signals.length
    ? signals.map(s => `
        <div class="vt-deep-signal">
          <span class="vt-sig-icon">${s.icon}</span>
          <span>${esc(s.text)}</span>
        </div>`).join("")
    : `<div class="vt-deep-signal"><span class="vt-sig-icon">ℹ️</span><span>No specific signals found.</span></div>`;

  const block = document.createElement("div");
  block.innerHTML = `
    <div class="vt-deep-header">
      <div class="vt-deep-header-icon">🔬</div>
      <div>
        <div class="vt-deep-header-title">Deep Analysis</div>
        <div class="vt-deep-header-sub">Powered by LLM (OpenRouter)</div>
      </div>
    </div>
    <div class="vt-deep-card">
      <div class="vt-deep-verdict-row">
        <div class="vt-dot ${cls}"></div>
        <div class="vt-deep-verdict-text ${cls}" style="color:${deepVerdictColor(cls)}">
          ${deepVerdictLabel(result.verdict)} — ${result.confidence}% confidence
        </div>
      </div>
      <div class="vt-deep-explanation">${esc(result.explanation || "")}</div>
      <div>
        <div class="vt-label" style="margin-bottom:6px">Signals detected</div>
        <div class="vt-deep-signals">${signalsHtml}</div>
      </div>
      ${result.final_reasoning ? `
        <div class="vt-deep-reasoning">
          <div class="vt-label" style="margin-bottom:6px">Full reasoning</div>
          ${esc(result.final_reasoning)}
        </div>` : ""}
    </div>`;

  panel?.querySelector(".vt-body")?.appendChild(block);

  // scroll to bottom
  const body = panel?.querySelector(".vt-body");
  if (body) setTimeout(() => body.scrollTo({ top: body.scrollHeight, behavior: "smooth" }), 100);
}

// ── Error ─────────────────────────────────────────────────────
function renderError(msg) {
  panel.innerHTML = header("Error") + `
    <div class="vt-body">
      <div class="vt-error">
        Could not connect to Veritas server.<br>
        <code>${esc(msg)}</code><br><br>
        Make sure the backend is running at<br>
        <code>${API_BASE}</code>
      </div>
    </div>`;
  bindClose();
}

function renderDeepError(msg) {
  const btn = panel?.querySelector("#vt-deep-btn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = "🔬 Run Deep Analysis";
  }
  const body = panel?.querySelector(".vt-body");
  if (!body) return;
  const err = document.createElement("div");
  err.className = "vt-error";
  err.innerHTML = `Deep analysis failed.<br><code>${esc(msg)}</code>`;
  body.appendChild(err);
}

/* ══════════════════════════════════════════════════════════════
   4. Sources HTML
   ══════════════════════════════════════════════════════════════ */
function buildSources(sourcesData) {
  const list = sourcesData?.sources || [];
  if (!list.length) {
    return `<div style="font-size:12px;color:#3d3d5c;padding:6px 0">No sources found.</div>`;
  }
  return `<div class="vt-sources-list">` +
    list.map(s => `
      <a class="vt-source" href="${esc(s.url)}" target="_blank" rel="noopener">
        <div class="vt-source-icon">${s.trusted ? "✅" : "🔗"}</div>
        <div class="vt-source-body">
          <div class="vt-source-name">${esc(s.trusted_name || s.title || s.domain)}</div>
          <div class="vt-source-domain">${esc(s.domain)}</div>
        </div>
        <span class="vt-badge ${s.trusted ? "trusted" : "unknown"}">${s.trusted ? "Trusted" : "Unknown"}</span>
      </a>`).join("") +
    `</div>`;
}

/* ══════════════════════════════════════════════════════════════
   5. API calls
   ══════════════════════════════════════════════════════════════ */

async function onCheckClick() {
  removeBtn();
  createPanel();
  renderLoading(currentText);

  try {
    const [classifyRes, sourcesRes] = await Promise.all([
      fetch(`${API_BASE}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentText }),
      }),
      fetch(`${API_BASE}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentText }),
      }).catch(() => null),
    ]);

    if (!classifyRes.ok) {
      const err = await classifyRes.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${classifyRes.status}`);
    }

    lastClassify = await classifyRes.json();
    lastSources  = sourcesRes ? await sourcesRes.json() : { sources: [], error: null };

  } catch (err) {
    renderError(err.message);
    return;
  }

  renderResult(currentText, lastClassify, lastSources);
}

async function onDeepClick() {
  if (!lastClassify || !lastSources) return;
  renderDeepLoading();

  let result;
  try {
    const res = await fetch(`${API_BASE}/deep-analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:           currentText,
        model_result:   lastClassify,
        sources_result: lastSources,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    result = await res.json();

  } catch (err) {
    renderDeepError(err.message);
    return;
  }

  renderDeepResult(result);
}

/* ══════════════════════════════════════════════════════════════
   6. Helpers
   ══════════════════════════════════════════════════════════════ */

function scoreClass(score) {
  if (score >= 65) return "real";
  if (score >= 35) return "mixed";
  return "fake";
}
function verdictLabel(cls) {
  return { real: "Trustworthy", mixed: "Partially Trustworthy", fake: "Not Trustworthy" }[cls];
}
function verdictDesc(cls) {
  return {
    real:  "The text appears credible. No major disinformation signals detected.",
    mixed: "The text may contain inaccuracies or bias. Verify with additional sources.",
    fake:  "High fake-news risk. Cross-check with authoritative sources before sharing.",
  }[cls];
}

function deepVerdictClass(verdict) {
  if (!verdict) return "mixed";
  if (verdict === "real" || verdict === "likely_real") return "real";
  if (verdict === "fake" || verdict === "likely_fake") return "fake";
  return "mixed";
}
function deepVerdictColor(cls) {
  return { real:"#22c55e", mixed:"#eab308", fake:"#ef4444" }[cls] || "#eab308";
}
function deepVerdictLabel(verdict) {
  return {
    real:        "REAL",
    likely_real: "LIKELY REAL",
    mixed:       "MIXED",
    likely_fake: "LIKELY FAKE",
    fake:        "FAKE",
  }[verdict] || (verdict || "UNKNOWN").toUpperCase();
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
