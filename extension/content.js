/* ═══════════════════════════════════════════════════════════════
   Veritas — content.js
   Показывает кнопку "Check" при выделении текста,
   вызывает бэкенд, рендерит боковую панель с результатом.
   ═══════════════════════════════════════════════════════════════ */

let API_BASE = "http://localhost:8000";

// Загружаем сохранённый URL из storage
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get("apiBase", (data) => {
    if (data.apiBase) API_BASE = data.apiBase;
  });
  // Слушаем обновления из popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_API_BASE") API_BASE = msg.apiBase;
  });
}

let btn = null;
let panel = null;
let currentText = "";

/* ── 1. Floating "Check" button ─────────────────────────────── */

function createBtn() {
  if (btn) return;
  btn = document.createElement("div");
  btn.id = "veritas-btn";
  btn.innerHTML = `
    <div class="vt-pulse"></div>
    <svg class="vt-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z"
        fill="#6c63ff" stroke="#a78bfa" stroke-width="0.5"/>
    </svg>
    Veritas
  `;
  btn.addEventListener("click", onCheckClick);
  document.body.appendChild(btn);
}

function removeBtn() {
  if (btn) { btn.remove(); btn = null; }
}

function positionBtn(x, y) {
  if (!btn) return;
  const OFFSET = 12;
  let left = x;
  let top = y - 44;

  // не выходить за края экрана
  const bw = 100; // примерная ширина кнопки
  if (left + bw > window.innerWidth - 8) left = window.innerWidth - bw - 8;
  if (left < 4) left = 4;
  if (top < 4) top = y + OFFSET;

  btn.style.left = (left + window.scrollX) + "px";
  btn.style.top  = (top  + window.scrollY) + "px";
}

document.addEventListener("mouseup", (e) => {
  // задержка: ждём пока selection зафиксируется
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";

    if (text.length < 30) {
      removeBtn();
      return;
    }

    currentText = text;
    createBtn();

    // позиционируем у курсора
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    positionBtn(e.clientX, rect.top + window.scrollY);
  }, 10);
});

document.addEventListener("mousedown", (e) => {
  if (btn && !btn.contains(e.target) && (!panel || !panel.contains(e.target))) {
    removeBtn();
  }
});

/* ── 2. Panel ────────────────────────────────────────────────── */

function createPanel() {
  if (panel) return;
  panel = document.createElement("div");
  panel.id = "veritas-panel";
  document.body.appendChild(panel);
  // trigger reflow then open
  requestAnimationFrame(() => {
    requestAnimationFrame(() => panel.classList.add("open"));
  });
}

function closePanel() {
  if (!panel) return;
  panel.classList.remove("open");
  setTimeout(() => { if (panel) { panel.remove(); panel = null; } }, 380);
}

function renderHeader() {
  return `
    <div class="vt-header">
      <div class="vt-header-left">
        <div class="vt-logo">V</div>
        <div>
          <div class="vt-title">Veritas</div>
          <div class="vt-subtitle">Проверка подлинности текста</div>
        </div>
      </div>
      <button class="vt-close" id="veritas-close">✕</button>
    </div>
  `;
}

function renderLoading(text) {
  return `
    ${renderHeader()}
    <div class="vt-body">
      <div class="vt-text-label">Анализируемый текст</div>
      <div class="vt-text-box">${escHtml(text)}</div>
      <div class="vt-loading">
        <div class="vt-spinner"></div>
        <div class="vt-loading-text">Анализ достоверности…</div>
      </div>
    </div>
  `;
}

function renderResult(text, data) {
  const score = data.ml_score ?? data.score ?? 0;
  const cls   = scoreClass(score);
  const label = scoreLabel(cls);
  const desc  = scoreDesc(cls);
  const conf  = Math.round((data.confidence ?? 0) * 100);

  // sensationalism
  const sens = data.sensationalism || {};
  const sensDetected = sens.detected;
  const sensTriggers = (sens.triggers || []).join(", ");

  // readability
  const read = data.readability || {};
  const readLevel = read.level || "—";
  const readFlesch = read.flesch_score != null ? Math.round(read.flesch_score) : "—";

  // probs
  const probs = data.probs || [];
  const pLow  = probs[0] != null ? Math.round(probs[0] * 100) : "—";
  const pMid  = probs[1] != null ? Math.round(probs[1] * 100) : "—";
  const pHigh = probs[2] != null ? Math.round(probs[2] * 100) : "—";

  return `
    ${renderHeader()}
    <div class="vt-body">

      <div class="vt-text-label">Анализируемый текст</div>
      <div class="vt-text-box">${escHtml(text)}</div>

      <!-- Verdict -->
      <div class="vt-verdict ${cls}">
        <div class="vt-verdict-glow"></div>
        <div class="vt-verdict-top">
          <div class="vt-verdict-dot"></div>
          <div class="vt-verdict-label">${label}</div>
        </div>
        <div class="vt-verdict-desc">${desc}</div>
      </div>

      <!-- Score bar -->
      <div class="vt-score-section ${cls}">
        <div class="vt-score-header">
          <span class="vt-score-title">Индикатор доверия</span>
          <span class="vt-score-value">${score}<span style="font-size:13px;opacity:.5">/100</span></span>
        </div>
        <div class="vt-score-bar-bg">
          <div class="vt-score-bar-fill" style="width:${score}%"></div>
        </div>
      </div>

      <!-- Meta chips -->
      <div class="vt-meta-row">
        <div class="vt-meta-chip">
          <div class="vt-meta-chip-label">Уверенность</div>
          <div class="vt-meta-chip-value">${conf}%</div>
        </div>
        <div class="vt-meta-chip">
          <div class="vt-meta-chip-label">Фейк</div>
          <div class="vt-meta-chip-value">${pLow}%</div>
        </div>
        <div class="vt-meta-chip">
          <div class="vt-meta-chip-label">Спорно</div>
          <div class="vt-meta-chip-value">${pMid}%</div>
        </div>
        <div class="vt-meta-chip">
          <div class="vt-meta-chip-label">Достоверно</div>
          <div class="vt-meta-chip-value">${pHigh}%</div>
        </div>
      </div>

      <!-- Signals -->
      <div class="vt-signals">
        <div class="vt-signals-title">Сигналы</div>
        ${renderSignals(data)}
      </div>

      <!-- Readability / Sensationalism -->
      <div class="vt-extra-row">
        <div class="vt-extra-chip ${sensDetected ? 'warn' : ''}">
          <div class="chip-dot"></div>
          ${sensDetected
            ? `Кликбейт: ${sensTriggers || "обнаружен"}`
            : "Кликбейт не обнаружен"}
        </div>
        <div class="vt-extra-chip">
          <div class="chip-dot"></div>
          Читаемость: ${readLevel} (${readFlesch})
        </div>
      </div>

    </div>
  `;
}

function renderSignals(data) {
  const items = [];

  if (data.sensationalism?.detected) {
    items.push({ icon: "⚠️", text: "Сенсационный заголовок / кликбейт" });
  }
  if (data.readability?.level === "difficult") {
    items.push({ icon: "📖", text: "Сложный стиль изложения" });
  }
  if (data.ml_score !== undefined) {
    if (data.ml_score >= 65) items.push({ icon: "✅", text: "Модель оценила текст как достоверный" });
    else if (data.ml_score >= 35) items.push({ icon: "🔍", text: "Модель не уверена — рекомендуется проверка" });
    else items.push({ icon: "🚨", text: "Модель считает текст маловероятно достоверным" });
  }
  if (!items.length) {
    items.push({ icon: "ℹ️", text: "Сигналы не обнаружены" });
  }

  return items.map(i =>
    `<div class="vt-signal-item">
      <span class="vt-signal-icon">${i.icon}</span>
      <span>${i.text}</span>
    </div>`
  ).join("");
}

function renderSources(sources) {
  if (!sources || !sources.length) {
    return `<div class="vt-sources">
      <div class="vt-sources-title">Источники</div>
      <div style="font-size:12px;color:#4a4a6a;padding:8px 0">Источники не найдены</div>
    </div>`;
  }

  const items = sources.map(s => {
    const icon = s.trusted ? "✅" : "🔗";
    const badge = s.trusted
      ? `<span class="vt-source-badge trusted">Проверен</span>`
      : `<span class="vt-source-badge unknown">Неизвестен</span>`;
    return `
      <a class="vt-source-item" href="${s.url}" target="_blank" rel="noopener">
        <div class="vt-source-favicon">${icon}</div>
        <div class="vt-source-info">
          <div class="vt-source-name">${escHtml(s.trusted_name || s.title || s.domain)}</div>
          <div class="vt-source-domain">${s.domain}</div>
        </div>
        ${badge}
      </a>
    `;
  }).join("");

  return `<div class="vt-sources">
    <div class="vt-sources-title">Источники информации</div>
    ${items}
  </div>`;
}

function renderError(msg) {
  return `
    ${renderHeader()}
    <div class="vt-body">
      <div class="vt-error">
        ⚠️ Не удалось подключиться к серверу.<br>
        <small style="opacity:.7">${escHtml(msg)}</small><br><br>
        Убедись, что бэкенд запущен на <code>${API_BASE}</code>
      </div>
    </div>
  `;
}

/* ── 3. API calls ────────────────────────────────────────────── */

async function onCheckClick() {
  removeBtn();
  createPanel();
  panel.innerHTML = renderLoading(currentText);
  bindClose();

  let classifyData, sourcesData;

  try {
    // Параллельно вызываем classify и sources
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
      }).catch(() => null), // sources не критичны
    ]);

    if (!classifyRes.ok) throw new Error(`HTTP ${classifyRes.status}`);
    classifyData = await classifyRes.json();
    sourcesData  = sourcesRes ? await sourcesRes.json() : null;

  } catch (err) {
    panel.innerHTML = renderError(err.message);
    bindClose();
    return;
  }

  panel.innerHTML =
    renderResult(currentText, classifyData) +
    renderSources(sourcesData?.sources || []);

  // animate score bar
  requestAnimationFrame(() => {
    const fill = panel.querySelector(".vt-score-bar-fill");
    if (fill) {
      fill.style.width = "0%";
      requestAnimationFrame(() => {
        fill.style.width = (classifyData.ml_score ?? 0) + "%";
      });
    }
    bindClose();
  });
}

/* ── 4. Utils ────────────────────────────────────────────────── */

function bindClose() {
  const closeBtn = panel?.querySelector("#veritas-close");
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
}

function scoreClass(score) {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function scoreLabel(cls) {
  return { high: "Можно доверять", medium: "Доверять частично", low: "Не доверять" }[cls];
}

function scoreDesc(cls) {
  return {
    high:   "Текст, вероятно, достоверен. Признаков дезинформации не обнаружено.",
    medium: "В тексте есть неточности или предвзятость. Проверьте источники.",
    low:    "Высокий риск фейка. Рекомендуется проверить в авторитетных источниках.",
  }[cls];
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
