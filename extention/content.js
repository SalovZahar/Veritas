/* ═══════════════════════════════════════════════════════════════
   Veritas — content.js
   UI by friend, ML integration added.

   Flow:
     Trigger btn → Mode menu → [Check Entire Page | Check Selected Text]
     → Main modal with textarea → [Quick Check] → classify + sources
     → [Deep Analysis] → deep_analyse (reuses cached results)
   ═══════════════════════════════════════════════════════════════ */

// ── Config ────────────────────────────────────────────────────
let API_BASE = "http://localhost:8000";
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get("apiBase", (d) => { if (d.apiBase) API_BASE = d.apiBase; });
}

// ── State ─────────────────────────────────────────────────────
let lastClassifyResult = null;
let lastSourcesResult  = null;
let lastText           = "";

// ── Inject HTML ───────────────────────────────────────────────
const triggerBtn = document.createElement('button');
triggerBtn.id = 'ta-trigger-btn';
triggerBtn.innerHTML = 'Verify Page';
document.body.appendChild(triggerBtn);

const modalHTML = `
  <div id="ta-overlay" class="ta-hidden">

    <div id="ta-mode-menu" class="ta-modal-box">
      <div class="ta-header-bar" style="border-radius:12px 12px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
          <h2 style="margin:0;color:white;font-size:18px;">Select Mode</h2>
          <button class="ta-close-x" style="background:transparent;border:none;color:white;font-size:20px;cursor:pointer;">✕</button>
        </div>
      </div>
      <div style="padding:24px;display:flex;flex-direction:column;gap:12px;">
        <button id="ta-btn-all" class="ta-mode-opt" style="background:#f0f4ff;color:#5f0865;border:1px solid #5f0865;padding:15px;border-radius:8px;font-weight:bold;cursor:pointer;text-align:left;font-size:15px;">🌐 Check Entire Page</button>
        <button id="ta-btn-select" class="ta-mode-opt" style="background:#f0f4ff;color:#5f0865;border:1px solid #5f0865;padding:15px;border-radius:8px;font-weight:bold;cursor:pointer;text-align:left;font-size:15px;">🖱️ Check Selected Text</button>
      </div>
    </div>

    <div id="ta-main-modal" class="ta-modal-box ta-hidden" style="width:700px;">
      <div class="ta-header-bar" style="border-radius:12px 12px 0 0;padding:20px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <h2 style="margin:0;color:white;font-size:18px;">Text Analysis</h2>
            <p style="margin:5px 0 0;font-size:13px;color:#e0e0e0;">Verifying information authenticity</p>
          </div>
          <button class="ta-close-x" style="background:transparent;border:none;color:white;font-size:20px;cursor:pointer;">✕</button>
        </div>
      </div>

      <div id="ta-result-banner" class="ta-hidden">
        <div class="ta-result-icon"></div>
        <div class="ta-result-text">
          <div class="ta-result-title"></div>
          <div class="ta-result-desc"></div>
        </div>
      </div>

      <div id="ta-body" style="max-height:65vh;overflow-y:auto;padding:24px;">

        <div style="margin-bottom:10px;">
          <span style="font-weight:bold;color:#333;font-size:16px;">Target Text:</span>
        </div>

        <textarea id="ta-textarea" readonly
          style="width:100%;height:120px;margin-bottom:20px;border-radius:8px;border:1px solid #e0e0e0;
                 padding:12px;font-family:inherit;font-size:14px;line-height:1.5;resize:none;box-sizing:border-box;"></textarea>

        <div style="display:flex;gap:15px;margin-bottom:25px;">
          <button id="ta-check-btn"
            style="flex:1;background:#5f0865;color:white;border:none;padding:14px;
                   border-radius:8px;font-weight:bold;font-size:15px;cursor:pointer;">
            Quick Check
          </button>
          <button id="ta-deep-check-btn"
            style="flex:1;background:white;color:#5f0865;border:2px solid #5f0865;padding:14px;
                   border-radius:8px;font-weight:bold;font-size:15px;cursor:pointer;opacity:0.4;"
            disabled>
            🔍 Deep Analysis
          </button>
        </div>

        <div class="ta-legend" style="font-size:14px;color:#666;">
          <p style="margin-bottom:12px;font-weight:bold;color:#333;">Trust Indicators:</p>
          <div style="display:flex;gap:20px;">
            <span style="display:flex;align-items:center;gap:6px;"><span style="display:block;width:12px;height:12px;border-radius:50%;background:#00c853;"></span>Reliable</span>
            <span style="display:flex;align-items:center;gap:6px;"><span style="display:block;width:12px;height:12px;border-radius:50%;background:#ffbc00;"></span>Partly Reliable</span>
            <span style="display:flex;align-items:center;gap:6px;"><span style="display:block;width:12px;height:12px;border-radius:50%;background:#ff3d00;"></span>Unreliable</span>
          </div>
        </div>

        <div id="ta-sources-section" class="ta-hidden"
          style="margin-top:25px;border-top:1px solid #eee;padding-top:20px;">
          <p style="font-weight:bold;color:#333;margin-bottom:15px;">Information Sources:</p>
          <div id="ta-sources-list"></div>
        </div>

        <div id="ta-deep-section" class="ta-hidden"
          style="margin-top:25px;border-top:1px solid #eee;padding-top:20px;">
          <p style="font-weight:bold;color:#333;margin-bottom:15px;">🔬 Deep Analysis:</p>
          <div id="ta-deep-content"></div>
        </div>

      </div>
    </div>
  </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHTML);

// ── DOM refs ──────────────────────────────────────────────────
const overlay        = document.getElementById('ta-overlay');
const modeMenu       = document.getElementById('ta-mode-menu');
const mainModal      = document.getElementById('ta-main-modal');
const textarea       = document.getElementById('ta-textarea');
const btnAll         = document.getElementById('ta-btn-all');
const btnSelect      = document.getElementById('ta-btn-select');
const checkBtn       = document.getElementById('ta-check-btn');
const deepCheckBtn   = document.getElementById('ta-deep-check-btn');
const resultBanner   = document.getElementById('ta-result-banner');
const sourcesSection = document.getElementById('ta-sources-section');
const sourcesList    = document.getElementById('ta-sources-list');
const deepSection    = document.getElementById('ta-deep-section');
const deepContent    = document.getElementById('ta-deep-content');

// ── SVG Icons ─────────────────────────────────────────────────
const iconSuccess = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
const iconWarning = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const iconError   = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function scoreToClass(score) {
  if (score >= 65) return 'success';
  if (score >= 35) return 'warning';
  return 'error';
}

function scoreToLabel(score) {
  if (score >= 65) return 'Reliable';
  if (score >= 35) return 'Partly Reliable';
  return 'Unreliable';
}

function scoreToDesc(score, conf) {
  const pct = Math.round(conf * 100);
  if (score >= 65) return `Text appears credible. Model confidence: ${pct}%.`;
  if (score >= 35) return `May contain inaccuracies or bias. Model confidence: ${pct}%. Verify with additional sources.`;
  return `High fake-news risk detected. Model confidence: ${pct}%. Cross-check before sharing.`;
}

function resetModal() {
  resultBanner.className = 'ta-hidden';
  sourcesSection.classList.add('ta-hidden');
  deepSection.classList.add('ta-hidden');
  deepContent.innerHTML = '';
  sourcesList.innerHTML = '';
  deepCheckBtn.disabled = true;
  deepCheckBtn.style.opacity = '0.4';
  deepCheckBtn.textContent = '🔍 Deep Analysis';
  checkBtn.textContent = 'Quick Check';
  checkBtn.disabled = false;
  lastClassifyResult = null;
  lastSourcesResult  = null;
}

function openMainModal(text) {
  textarea.value = text;
  lastText = text;
  resetModal();
  modeMenu.classList.add('ta-hidden');
  mainModal.classList.remove('ta-hidden');
}

// ── Render sources ────────────────────────────────────────────
function renderSources(sourcesData) {
  sourcesList.innerHTML = '';
  const sources = sourcesData?.sources || [];

  if (!sources.length) {
    sourcesList.innerHTML = '<p style="color:#999;font-size:14px;">No sources found for this text.</p>';
    sourcesSection.classList.remove('ta-hidden');
    return;
  }

  sources.forEach(src => {
    const card = document.createElement('a');
    card.className = 'ta-source-card';
    card.href = src.url || '#';
    card.target = '_blank';
    card.rel = 'noopener';
    card.style.textDecoration = 'none';

    const badge = src.trusted
      ? `<span class="ta-source-tag" style="background:#e8f5e9;color:#2e7d32;border-color:#c8e6c9;">✓ Trusted</span>`
      : `<span class="ta-source-tag">Unknown</span>`;

    card.innerHTML = `
      <div class="ta-source-icon">${src.trusted ? '✅' : '🔗'}</div>
      <div class="ta-source-info">
        <div class="ta-source-title">${esc(src.trusted_name || src.title || src.domain)}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">
          ${badge}
          <span style="font-size:12px;color:#aaa;">${esc(src.domain)}</span>
        </div>
        ${src.snippet
          ? `<div style="font-size:12px;color:#888;margin-top:5px;line-height:1.4;">${esc(src.snippet.slice(0,120))}…</div>`
          : ''}
      </div>`;

    sourcesList.appendChild(card);
  });

  sourcesSection.classList.remove('ta-hidden');
}

// ── Render deep analysis ──────────────────────────────────────
function renderDeepAnalysis(result) {
  const verdictColor = {
    real:'#00c853', likely_real:'#69f0ae',
    mixed:'#ffbc00',
    likely_fake:'#ff6d00', fake:'#ff3d00',
  }[result.verdict] || '#ffbc00';

  const verdictLabel = {
    real:'REAL', likely_real:'LIKELY REAL',
    mixed:'MIXED',
    likely_fake:'LIKELY FAKE', fake:'FAKE',
  }[result.verdict] || (result.verdict || 'UNKNOWN').toUpperCase();

  const signals = result.signals || {};
  const all = [
    ...(signals.factual_issues     || []).map(t => ({ icon:'🔍', text:t })),
    ...(signals.manipulation_signs || []).map(t => ({ icon:'⚠️', text:t })),
    ...(signals.source_analysis    || []).map(t => ({ icon:'📰', text:t })),
    ...(signals.contradictions     || []).map(t => ({ icon:'⚡', text:t })),
  ];

  const signalsHtml = all.length
    ? all.map(s => `
        <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f0f0f0;
                    font-size:14px;color:#555;line-height:1.4;">
          <span style="flex-shrink:0;">${s.icon}</span>
          <span>${esc(s.text)}</span>
        </div>`).join('')
    : '<p style="color:#999;font-size:14px;">No specific signals detected.</p>';

  deepContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:14px;
                background:#f8f9fa;border-radius:10px;margin-bottom:16px;">
      <div style="width:14px;height:14px;border-radius:50%;background:${verdictColor};
                  box-shadow:0 0 8px ${verdictColor}80;flex-shrink:0;"></div>
      <div>
        <div style="font-size:16px;font-weight:bold;color:${verdictColor};">${verdictLabel}</div>
        <div style="font-size:13px;color:#888;margin-top:2px;">LLM confidence: ${result.confidence}%</div>
      </div>
    </div>

    <div style="font-size:14px;color:#444;line-height:1.6;margin-bottom:16px;
                padding:12px;background:#f8f9fa;border-radius:8px;">
      ${esc(result.explanation || '')}
    </div>

    ${all.length ? `
    <div style="margin-bottom:16px;">
      <p style="font-weight:bold;color:#333;margin-bottom:8px;font-size:14px;">Detected Signals:</p>
      ${signalsHtml}
    </div>` : ''}

    ${result.final_reasoning ? `
    <div style="background:#f8f9fa;border-radius:8px;padding:14px;">
      <p style="font-weight:bold;color:#333;margin-bottom:8px;font-size:14px;">Full Reasoning:</p>
      <p style="font-size:13px;color:#555;line-height:1.7;margin:0;">${esc(result.final_reasoning)}</p>
    </div>` : ''}
  `;

  deepSection.classList.remove('ta-hidden');
  setTimeout(() => deepSection.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
}

// ── Quick Check ───────────────────────────────────────────────
async function runQuickCheck() {
  const text = textarea.value.trim();
  if (text.length < 10) { alert('Please enter at least 10 characters.'); return; }

  lastText = text;
  checkBtn.disabled = true;
  checkBtn.textContent = 'Analyzing…';
  deepCheckBtn.disabled = true;
  deepCheckBtn.style.opacity = '0.4';
  resultBanner.className = 'ta-hidden';
  sourcesSection.classList.add('ta-hidden');
  deepSection.classList.add('ta-hidden');

  try {
    const [classifyRes, sourcesRes] = await Promise.all([
      fetch(`${API_BASE}/classify`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text }),
      }),
      fetch(`${API_BASE}/sources`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text }),
      }).catch(() => null),
    ]);

    if (!classifyRes.ok) {
      const err = await classifyRes.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${classifyRes.status}`);
    }

    lastClassifyResult = await classifyRes.json();
    lastSourcesResult  = sourcesRes ? await sourcesRes.json() : { sources:[], error:null };

  } catch (err) {
    resultBanner.className = 'ta-result-error';
    resultBanner.querySelector('.ta-result-icon').innerHTML = iconError;
    resultBanner.querySelector('.ta-result-title').textContent = 'Connection Failed';
    resultBanner.querySelector('.ta-result-desc').textContent =
      `Cannot reach server at ${API_BASE}. Run: uvicorn api.server:app --port 8000`;
    checkBtn.disabled = false;
    checkBtn.textContent = 'Quick Check';
    return;
  }

  // Show banner
  const score = lastClassifyResult.score ?? 0;
  const type  = scoreToClass(score);
  const icon  = type === 'success' ? iconSuccess : type === 'warning' ? iconWarning : iconError;
  resultBanner.className = `ta-result-${type}`;
  resultBanner.querySelector('.ta-result-icon').innerHTML = icon;
  resultBanner.querySelector('.ta-result-title').textContent = scoreToLabel(score);
  resultBanner.querySelector('.ta-result-desc').textContent =
    scoreToDesc(score, lastClassifyResult.confidence ?? 0);

  renderSources(lastSourcesResult);

  checkBtn.disabled = false;
  checkBtn.textContent = 'Quick Check';
  deepCheckBtn.disabled = false;
  deepCheckBtn.style.opacity = '1';
}

// ── Deep Analysis ─────────────────────────────────────────────
async function runDeepAnalysis() {
  if (!lastClassifyResult || !lastSourcesResult) return;

  deepCheckBtn.disabled = true;
  deepCheckBtn.style.opacity = '0.4';
  deepCheckBtn.textContent = 'Analyzing…';
  deepSection.classList.add('ta-hidden');

  try {
    const res = await fetch(`${API_BASE}/deep-analyse`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        text: lastText,
        model_result: lastClassifyResult,
        sources_result: lastSourcesResult,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    renderDeepAnalysis(await res.json());

  } catch (err) {
    deepContent.innerHTML = `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;
                  padding:14px;font-size:14px;color:#856404;">
        ⚠️ Deep analysis failed: ${esc(err.message)}<br>
        <small>Make sure LLM_API_KEY is set in your .env file.</small>
      </div>`;
    deepSection.classList.remove('ta-hidden');
  }

  deepCheckBtn.disabled = false;
  deepCheckBtn.style.opacity = '1';
  deepCheckBtn.textContent = '🔍 Deep Analysis';
}

// ── Event wiring ──────────────────────────────────────────────
triggerBtn.onclick = () => {
  overlay.classList.remove('ta-hidden');
  modeMenu.classList.remove('ta-hidden');
  mainModal.classList.add('ta-hidden');
};

document.querySelectorAll('.ta-close-x').forEach(btn => {
  btn.onclick = () => {
    overlay.classList.add('ta-hidden');
    document.getElementById('ta-floating-confirm')?.remove();
  };
});

btnAll.onclick = () => {
  const allText = Array.from(
    document.querySelectorAll('p, h1, h2, h3, article, section')
  )
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 20)
    .join('\n\n')
    .slice(0, 5000);

  openMainModal(allText || 'No readable text found on this page.');
};

btnSelect.onclick = () => {
  overlay.classList.add('ta-hidden');
  const handleMouseUp = (e) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 5) {
      showFloatingButton(e.pageX, e.pageY, selectedText);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };
  document.addEventListener('mouseup', handleMouseUp);
};

function showFloatingButton(x, y, text) {
  document.getElementById('ta-floating-confirm')?.remove();

  const floatBtn = document.createElement('button');
  floatBtn.id = 'ta-floating-confirm';
  floatBtn.innerHTML = '✨ Verify Selection';

  Object.assign(floatBtn.style, {
    position:'absolute', top:(y+10)+'px', left:(x+10)+'px',
    zIndex:'2147483647', background:'#5f0865', color:'white',
    border:'none', padding:'8px 16px', borderRadius:'20px',
    cursor:'pointer', fontWeight:'bold', fontSize:'13px',
  });

  document.body.appendChild(floatBtn);

  floatBtn.onclick = () => {
    openMainModal(text);
    overlay.classList.remove('ta-hidden');
    floatBtn.remove();
  };
}

checkBtn.onclick     = () => runQuickCheck();
deepCheckBtn.onclick = () => runDeepAnalysis();
