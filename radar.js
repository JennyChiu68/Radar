const SEMI_GAUGE_LENGTH = 63;

const APP_STATE = {
  data: null,
  derived: null,
  historySnapshots: [],
  sourceMap: new Map(),
  heatmapExpanded: false
};

const TONE_MAP = {
  red: {
    textClass: "text-primary",
    badgeClass: "bg-primary/20 text-primary border border-primary/40",
    borderClass: "border-primary/40",
    leftBorderClass: "border-l-primary",
    dotClass: "bg-primary",
    glowClass: "shadow-[0_0_12px_rgba(255,59,48,1)]",
    softGlowClass: "shadow-[0_0_8px_rgba(255,59,48,0.5)]",
    heatClass: "bg-primary/80",
    hex: "#FF3B30"
  },
  yellow: {
    textClass: "text-tertiary",
    badgeClass: "bg-tertiary/20 text-tertiary border border-tertiary/40",
    borderClass: "border-tertiary/40",
    leftBorderClass: "border-l-tertiary",
    dotClass: "bg-tertiary",
    glowClass: "shadow-[0_0_10px_rgba(252,196,25,0.8)]",
    softGlowClass: "shadow-[0_0_8px_rgba(252,196,25,0.5)]",
    heatClass: "bg-tertiary/80",
    hex: "#fcc419"
  },
  green: {
    textClass: "text-success",
    badgeClass: "bg-success/20 text-success border border-success/40",
    borderClass: "border-success/40",
    leftBorderClass: "border-l-success",
    dotClass: "bg-success",
    glowClass: "shadow-[0_0_10px_rgba(88,214,141,0.8)]",
    softGlowClass: "shadow-[0_0_8px_rgba(88,214,141,0.5)]",
    heatClass: "bg-success/80",
    hex: "#58d68d"
  }
};

const RADAR_BLIP_LAYOUT = {
  ceasefire: {
    wrapperStyle: "top: 23.7%; left: 34.8%; z-index: 30; width: 0; height: 0;",
    labelClass: "absolute bottom-3 radar-tag shadow-lg transform -translate-x-1/2",
    dotVariant: "default"
  },
  hormuz: {
    wrapperStyle: "top: 31.6%; left: 81.9%; z-index: 30; width: 0; height: 0;",
    labelClass: "absolute bottom-3 radar-tag shadow-lg transform -translate-x-[70%]",
    dotVariant: "ping"
  },
  civilian_infra: {
    wrapperStyle: "top: 66.8%; left: 79.1%; z-index: 30; width: 0; height: 0;",
    labelClass: "absolute top-3 radar-tag shadow-lg transform translate-x-1/4",
    dotVariant: "soft"
  },
  new_front: {
    wrapperStyle: "top: 80.5%; left: 32.4%; z-index: 30; width: 0; height: 0;",
    labelClass: "absolute top-3 radar-tag shadow-lg transform -translate-x-1/4",
    dotVariant: "medium"
  },
  energy_shipping: {
    wrapperStyle: "top: 50%; left: 15.6%; z-index: 30; width: 0; height: 0;",
    labelClass: "absolute top-3 left-0 radar-tag shadow-lg",
    dotVariant: "default"
  }
};

const RADAR_LABELS = {
  ceasefire: "停火/谈判",
  hormuz: "霍尔木兹",
  civilian_infra: "民用设施",
  new_front: "新战线",
  energy_shipping: "能源安全"
};

const RADAR_ORDER = ["ceasefire", "hormuz", "civilian_infra", "new_front", "energy_shipping"];
const MODAL_METRIC_IDS = {
  hormuz: "m-hormuz",
  ceasefire: "m-nego",
  new_front: "m-front",
  civilian_infra: "m-civil",
  energy_shipping: "m-energy"
};

const HISTORY_SIGNAL_LABELS = {
  green: "短暂缓和",
  yellow: "胶着脆弱",
  red: "升级高压"
};

function getTone(tone) {
  return TONE_MAP[tone] || TONE_MAP.red;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value ?? "";
  }
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
  }
}

function splitDateParts(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map((value) => Number(value));
  return { year, month, day };
}

function formatMonthDay(dateString) {
  const { month, day } = splitDateParts(dateString);
  return `${month}月${day}日`;
}

function formatHeatmapDate(dateString) {
  const { month, day } = splitDateParts(dateString);
  return `${month}/${day}`;
}

function formatSnapshotDisplay(snapshotTime) {
  if (!snapshotTime) {
    return "";
  }
  const [datePart, timePart = ""] = String(snapshotTime).trim().split(/\s+/);
  const date = datePart.replace(/-/g, ".");
  if (!timePart) {
    return date;
  }
  const time = /^\d{2}:\d{2}$/.test(timePart) ? `${timePart}:00` : timePart;
  return `${date} / ${time}`;
}

function roundScore(value) {
  return Math.round(Number(value) || 0);
}

function clampScore(score) {
  return Math.max(0, Math.min(100, roundScore(score)));
}

function lookupBand(value, bands, key) {
  return (bands || []).find((band) => {
    const min = band.min ?? Number.NEGATIVE_INFINITY;
    const max = band.max ?? Number.POSITIVE_INFINITY;
    return value >= min && value <= max;
  })?.[key];
}

function lookupTone(score, bands) {
  return lookupBand(score, bands, "tone") || "yellow";
}

function lookupRiskLabel(score, bands) {
  return lookupBand(score, bands, "label") || "";
}

function lookupHistoryTone(score, data) {
  return lookupBand(score, data.history?.history_ui_tones || data.bands?.ui_tones, "tone") || "red";
}

function metricScore(metric, facts) {
  const value = facts?.[metric.fact];
  if (metric.type === "enum") {
    return metric.scores?.[value] ?? 0;
  }
  if (metric.type === "band") {
    return lookupBand(Number(value), metric.bands, "score") ?? 0;
  }
  return 0;
}

function applyHardFloors(score, dimension) {
  return (dimension.hard_floor_rules || []).reduce((current, rule) => {
    const factValue = dimension.facts?.[rule.fact];
    if ((rule.any_of || []).includes(factValue)) {
      return Math.max(current, rule.min_score || 0);
    }
    return current;
  }, score);
}

function computeDimension(dimension, config) {
  const rawScore = (dimension.metrics || []).reduce((sum, metric) => {
    return sum + metricScore(metric, dimension.facts) * (metric.weight || 0);
  }, 0);
  const rounded = roundScore(applyHardFloors(rawScore, dimension));
  return {
    ...dimension,
    score: rounded,
    tone: lookupTone(rounded, config.bands.ui_tones),
    riskLabel: lookupRiskLabel(rounded, config.bands.risk_labels)
  };
}

function computeDerived(data) {
  const dimensions = (data.dimensions || []).map((dimension) => computeDimension(dimension, data));
  const overallScore = roundScore(dimensions.reduce((sum, dimension) => {
    return sum + dimension.score * (dimension.overall_weight || 0);
  }, 0));

  return {
    overallScore,
    overallTone: lookupTone(overallScore, data.bands.ui_tones),
    overallLabel: lookupRiskLabel(overallScore, data.bands.risk_labels),
    dimensions
  };
}

function getSnapshotAdjustment(snapshot) {
  const delta = Number(snapshot?.score_adjustment?.delta || 0);
  return Number.isFinite(delta) ? delta : 0;
}

function withSnapshotFacts(data, snapshot) {
  if (!snapshot?.facts) {
    return data;
  }
  return {
    ...data,
    dimensions: (data.dimensions || []).map((dimension) => {
      const overrideFacts = snapshot.facts?.[dimension.id];
      if (!overrideFacts) {
        return dimension;
      }
      return {
        ...dimension,
        facts: {
          ...(dimension.facts || {}),
          ...overrideFacts
        }
      };
    })
  };
}

function computeHistorySnapshots(data) {
  return (data.history?.snapshots || []).map((snapshot) => {
    const snapshotData = withSnapshotFacts(data, snapshot);
    const derived = computeDerived(snapshotData);
    const adjustedOverallScore = clampScore(derived.overallScore + getSnapshotAdjustment(snapshot));

    return {
      ...snapshot,
      overallScore: adjustedOverallScore,
      overallTone: lookupTone(adjustedOverallScore, data.bands.ui_tones),
      historyTone: lookupHistoryTone(adjustedOverallScore, data),
      overallLabel: lookupRiskLabel(adjustedOverallScore, data.bands.risk_labels),
      dimensions: derived.dimensions
    };
  });
}

function buildSourceMap(sources) {
  return new Map((sources || []).map((source) => [source.id, source]));
}

function getAlertConfig(tone, labelOverride) {
  const label = labelOverride || HISTORY_SIGNAL_LABELS[tone];
  if (tone === "green") {
    return {
      icon: "check_circle",
      label: label || "持续观察",
      iconClass: "text-success text-2xl",
      textClass: "text-[14px] font-bold text-success tracking-tighter"
    };
  }
  if (tone === "yellow") {
    return {
      icon: "warning",
      label: label || "高度警戒",
      iconClass: "text-tertiary text-2xl",
      textClass: "text-[14px] font-bold text-tertiary tracking-tighter"
    };
  }
  return {
    icon: "error",
    label: label || "紧急警报",
    iconClass: "text-primary text-2xl emergency-glow",
    textClass: "text-[14px] font-bold text-primary tracking-tighter emergency-glow"
  };
}

function getHistorySignalTone(score, data) {
  return lookupBand(score, data.history?.history_ui_tones, "tone") || lookupTone(score, data.bands?.ui_tones);
}

function renderAlertBadge(data, score) {
  const tone = getHistorySignalTone(score, data);
  const config = getAlertConfig(tone, HISTORY_SIGNAL_LABELS[tone]);
  setHtml(
    "alertBadge",
    `<span class="material-symbols-outlined ${config.iconClass}">${config.icon}</span><span class="${config.textClass}">${config.label}</span>`
  );
}

function renderRadarDot(tone, variant) {
  if (variant === "ping") {
    return `
      <div class="absolute w-2.5 h-2.5">
        <div class="w-2.5 h-2.5 ${tone.dotClass} rounded-full animate-ping absolute inset-0"></div>
        <div class="w-2.5 h-2.5 ${tone.dotClass} rounded-full ${tone.glowClass}"></div>
      </div>
    `;
  }
  if (variant === "soft") {
    return `<div class="absolute w-2.5 h-2.5 ${tone.dotClass} rounded-full opacity-70 ${tone.softGlowClass}"></div>`;
  }
  if (variant === "medium") {
    return `<div class="absolute w-2.5 h-2.5 ${tone.dotClass} rounded-full opacity-80 ${tone.glowClass}"></div>`;
  }
  return `<div class="absolute w-2.5 h-2.5 ${tone.dotClass} rounded-full ${tone.glowClass}"></div>`;
}

function renderRadarBlips(dimensions) {
  const byId = new Map((dimensions || []).map((dimension) => [dimension.id, dimension]));
  return RADAR_ORDER.map((id) => {
    const dimension = byId.get(id);
    const layout = RADAR_BLIP_LAYOUT[id];
    if (!dimension || !layout) {
      return "";
    }
    const tone = getTone(dimension.tone);
    const label = RADAR_LABELS[id] || dimension.title;
    return `
      <div class="absolute flex justify-center items-center" style="${layout.wrapperStyle}">
        <div class="${layout.labelClass} border ${tone.borderClass}">
          <span class="text-[13px] font-bold ${tone.textClass} uppercase whitespace-nowrap">${escapeHtml(label)} ${dimension.score}%</span>
        </div>
        ${renderRadarDot(tone, layout.dotVariant)}
      </div>
    `;
  }).join("");
}

function renderHistoryDelta(currentScore, previousScore) {
  const diff = currentScore - previousScore;
  if (diff === 0) {
    return {
      value: "0%",
      className: "text-on-surface"
    };
  }
  if (diff > 0) {
    return {
      value: `↑${diff}%`,
      className: "text-primary"
    };
  }
  return {
    value: `↓${Math.abs(diff)}%`,
    className: "text-success"
  };
}

function renderSummaryCards(derived, historySnapshots) {
  const previousSnapshot = historySnapshots.length > 1 ? historySnapshots[historySnapshots.length - 2] : historySnapshots[historySnapshots.length - 1];
  const previousScore = previousSnapshot?.overallScore ?? derived.overallScore;
  const delta = renderHistoryDelta(derived.overallScore, previousScore);
  const peakSnapshot = historySnapshots.reduce((best, snapshot) => {
    return !best || snapshot.overallScore > best.overallScore ? snapshot : best;
  }, null);
  const lowSnapshot = historySnapshots.reduce((best, snapshot) => {
    return !best || snapshot.overallScore < best.overallScore ? snapshot : best;
  }, null);
  const peakTone = getTone(peakSnapshot?.historyTone || peakSnapshot?.overallTone || derived.overallTone);
  const lowTone = getTone(lowSnapshot?.historyTone || lowSnapshot?.overallTone || derived.overallTone);

  return [
    {
      label: "24小时变化",
      value: delta.value,
      helper: previousSnapshot ? `${formatMonthDay(previousSnapshot.date)} ${previousScore}%` : `当前 ${derived.overallScore}%`,
      className: delta.className
    },
    {
      label: "历史峰值",
      value: `${peakSnapshot?.overallScore ?? derived.overallScore}%`,
      helper: peakSnapshot ? formatMonthDay(peakSnapshot.date) : "当前",
      className: peakTone.textClass
    },
    {
      label: "历史低点",
      value: `${lowSnapshot?.overallScore ?? derived.overallScore}%`,
      helper: lowSnapshot ? formatMonthDay(lowSnapshot.date) : "当前",
      className: lowTone.textClass
    }
  ].map((card) => `
    <div class="panel-glass p-3 rounded flex flex-col justify-center text-center">
      <span class="text-[10px] text-on-surface-variant font-bold mb-1 tracking-widest">${escapeHtml(card.label)}</span>
      <span class="text-3xl font-black font-headline ${card.className} leading-none">${escapeHtml(card.value)}</span>
      <span class="text-[9px] text-on-surface-variant mt-1.5">${escapeHtml(card.helper)}</span>
    </div>
  `).join("");
}

function renderTimelineItems(items) {
  return (items || []).map((item) => `
    <div class="p-2 bg-surface-container-lowest/50 border border-outline-variant/10 rounded">
      <div class="flex justify-between items-center mb-1">
        <p class="text-[10px] font-bold text-primary">${escapeHtml(item.date)}</p>
        <span class="text-[9px] border border-outline-variant/30 px-1 rounded text-on-surface-variant">${escapeHtml(item.tag)}</span>
      </div>
      <p class="text-[10px] text-on-surface-variant/90 leading-relaxed">${escapeHtml(item.text)}</p>
    </div>
  `).join("");
}

function renderWatchlistItems(items) {
  return (items || []).map((item) => {
    const tone = getTone(item.tone);
    return `
      <div class="border-l-2 ${tone.leftBorderClass.replace("border-l-", "border-")} pl-2 py-0.5">
        <div class="flex justify-between items-center mb-1.5">
          <p class="text-[10px] font-bold ${tone.textClass} uppercase tracking-widest">${escapeHtml(item.tag)}</p>
        </div>
        <p class="text-[10px] leading-relaxed text-on-surface-variant">${escapeHtml(item.text)}</p>
      </div>
    `;
  }).join("");
}

function gaugeOffset(score) {
  return (SEMI_GAUGE_LENGTH * (1 - clampScore(score) / 100)).toFixed(1);
}

function extractEvidenceLabel(evidence) {
  const match = String(evidence || "").match(/[:：]\s*(.+)$/);
  return match ? match[1] : String(evidence || "");
}

function renderIndicatorCards(dimensions) {
  return (dimensions || []).map((dimension, index) => {
    const tone = getTone(dimension.tone);
    const evidence = extractEvidenceLabel(dimension.evidence);
    const bullets = (dimension.bullets || []).map((bullet) => `
      <li class="flex items-start gap-2"><span class="${tone.textClass} mt-0.5">•</span><span>${escapeHtml(bullet)}</span></li>
    `).join("");

    return `
      <div class="panel-glass p-5 rounded-lg border-l-4 ${tone.leftBorderClass} scroll-mt-6" id="indicator-${escapeHtml(dimension.id)}">
        <div class="flex justify-between items-start mb-4">
          <div class="flex flex-col gap-1.5">
            <div class="text-[11px] font-mono opacity-60 uppercase tracking-widest">指标 ${index + 1}</div>
            <div class="flex items-center gap-3">
              <div class="text-[20px] font-bold">${escapeHtml(dimension.title)}</div>
              <span class="px-2.5 py-1 ${tone.badgeClass} rounded text-[11px] font-black uppercase">${escapeHtml(dimension.riskLabel)}</span>
            </div>
          </div>
          <div class="gauge-container flex items-center justify-center">
            <svg class="absolute inset-0" viewBox="0 0 44 26">
              <path class="gauge-background" d="M 4,22 A 18,18 0 0,1 40,22"></path>
              <path class="gauge-value" d="M 4,22 A 18,18 0 0,1 40,22" style="stroke: ${tone.hex}; stroke-dashoffset: ${gaugeOffset(dimension.score)};"></path>
            </svg>
            <span class="text-[13px] font-black ${tone.textClass} leading-none pt-2.5">${dimension.score}%</span>
          </div>
        </div>
        <div class="space-y-3">
          <p class="text-[13px] text-on-surface-variant leading-relaxed">${escapeHtml(dimension.summary)}</p>
          <ul class="text-[13px] text-on-surface-variant/90 space-y-2">${bullets}</ul>
          <div class="inline-block mt-2 px-2 py-0.5 bg-surface-container border border-outline-variant/30 rounded text-[10px] font-bold text-on-surface-variant">
            <span class="${tone.textClass} opacity-70 mr-1">证据强度:</span><span class="${tone.textClass}">${escapeHtml(evidence)}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderHeatmapCell(snapshot, isVisible) {
  const tone = getTone(snapshot.historyTone || snapshot.overallTone);
  const hiddenClass = isVisible ? "" : "hidden past-day";
  return `
    <button
      type="button"
      data-history-date="${escapeHtml(snapshot.date)}"
      class="flex items-center justify-center aspect-square ${tone.heatClass} rounded-[2px] cursor-pointer hover:ring-2 hover:ring-white transition-all shadow-inner ${hiddenClass}"
      title="历史存档: ${escapeHtml(formatMonthDay(snapshot.date))}"
    >
      <div class="flex flex-col items-center justify-center gap-[1px]">
        <span class="text-[8px] text-white/80 font-medium leading-none">${escapeHtml(formatHeatmapDate(snapshot.date))}</span>
        <span class="text-[11px] font-bold text-white drop-shadow-md leading-none">${snapshot.overallScore}%</span>
      </div>
    </button>
  `;
}

function syncHeatmapToggle(totalDays) {
  const button = document.getElementById("heatmap-toggle");
  if (!button) {
    return;
  }
  if (totalDays <= 7) {
    button.classList.add("hidden");
    return;
  }
  button.classList.remove("hidden");
  button.textContent = APP_STATE.heatmapExpanded ? "收起历史记录" : `展开全部 ${totalDays} 天`;
}

function renderHeatmap(historySnapshots) {
  const reversedSnapshots = [...historySnapshots].reverse();
  setHtml("heatmap-grid", reversedSnapshots.map((snapshot, index) => renderHeatmapCell(snapshot, index < 7 || APP_STATE.heatmapExpanded)).join(""));
  syncHeatmapToggle(reversedSnapshots.length);
}

function showLoadError(message) {
  const errorBox = document.getElementById("loadError");
  const mainApp = document.getElementById("mainApp");
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }
  if (mainApp) {
    mainApp.classList.add("hidden");
  }
}

function updateHeader(data, derived) {
  document.title = data.meta?.pageTitle || document.title;
  setText("brand-title", "美伊红线雷达");
  setText("brand-subtitle", data.hero?.eyebrow || "48小时升级风险雷达");
  setText("radar-date-display", formatSnapshotDisplay(data.meta?.snapshot_time_bjt));
  setText("hero-score", `${derived.overallScore}%`);
  renderAlertBadge(data, derived.overallScore);
}

function renderDashboard(data, derived, historySnapshots) {
  updateHeader(data, derived);
  setHtml("radar-blips", renderRadarBlips(derived.dimensions));
  setHtml("summaryCards", renderSummaryCards(derived, historySnapshots));
  setHtml("timeline-items", renderTimelineItems(data.timeline?.items));
  setHtml("watchlist-items", renderWatchlistItems(data.watchlist?.items));
  setText("history-title", data.history?.archiveTitle || "过去41天战争历史指数");
  renderHeatmap(historySnapshots);
  setHtml("core-indicators", renderIndicatorCards(derived.dimensions));
}

function updateModalMetric(id, score, toneName) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  const tone = getTone(toneName);
  el.textContent = `${score}%`;
  el.style.color = tone.hex;
}

function openModal(date) {
  const snapshot = APP_STATE.historySnapshots.find((item) => item.date === date);
  const modal = document.getElementById("history-modal");
  const content = document.getElementById("history-modal-content");
  if (!snapshot || !modal || !content) {
    return;
  }

  const tone = getTone(snapshot.historyTone || snapshot.overallTone);
  setText("modal-title", formatMonthDay(snapshot.date));
  setText("modal-index", `${snapshot.overallScore}%`);
  document.getElementById("modal-index").style.color = tone.hex;
  document.getElementById("modal-color").style.backgroundColor = tone.hex;

  const detailText = [snapshot.headline, snapshot.summary].filter(Boolean).join(" ");
  setText("modal-details", detailText || "暂无补充说明。");

  const dimensionsById = new Map((snapshot.dimensions || []).map((dimension) => [dimension.id, dimension]));
  Object.entries(MODAL_METRIC_IDS).forEach(([dimensionId, elementId]) => {
    const dimension = dimensionsById.get(dimensionId);
    if (!dimension) {
      return;
    }
    updateModalMetric(elementId, dimension.score, dimension.tone);
  });

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    content.classList.remove("scale-95");
  });
  document.body.classList.add("overflow-hidden");
  document.documentElement.classList.add("overflow-hidden");
}

function closeModal() {
  const modal = document.getElementById("history-modal");
  const content = document.getElementById("history-modal-content");
  if (!modal || !content || modal.classList.contains("hidden")) {
    return;
  }

  modal.classList.add("opacity-0");
  content.classList.add("scale-95");
  window.setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
  document.body.classList.remove("overflow-hidden");
  document.documentElement.classList.remove("overflow-hidden");
}

function bindInteractions() {
  if (window.__radarBindingsReady) {
    return;
  }

  document.getElementById("heatmap-toggle")?.addEventListener("click", () => {
    APP_STATE.heatmapExpanded = !APP_STATE.heatmapExpanded;
    renderHeatmap(APP_STATE.historySnapshots);
  });

  document.getElementById("heatmap-grid")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-date]");
    if (!button) {
      return;
    }
    openModal(button.dataset.historyDate);
  });

  document.getElementById("history-modal-close")?.addEventListener("click", closeModal);
  document.getElementById("history-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "history-modal") {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  window.__radarBindingsReady = true;
}

function buildDataCandidates() {
  const base = window.location.origin;
  const path = window.location.pathname;
  const pathDir = path.endsWith("/") ? path : `${path.substring(0, path.lastIndexOf("/") + 1)}`;
  const repoRoot = path.startsWith("/Radar") ? "/Radar/" : "/";
  return [
    new URL("radar-data.json", `${base}${pathDir}`).toString(),
    new URL("radar-data.json", `${base}${repoRoot}`).toString(),
    new URL("./radar-data.json", window.location.href.endsWith("/") ? window.location.href : `${window.location.href}/`).toString()
  ].filter((value, index, list) => list.indexOf(value) === index);
}

async function fetchRadarData() {
  const candidates = buildDataCandidates();
  let lastError;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} @ ${candidate}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      console.warn("radar-data fetch failed", candidate, error);
    }
  }
  throw lastError || new Error("radar-data fetch failed");
}

async function loadRadarData() {
  try {
    const data = await fetchRadarData();
    const derived = computeDerived(data);
    const historySnapshots = computeHistorySnapshots(data);

    APP_STATE.data = data;
    APP_STATE.derived = derived;
    APP_STATE.historySnapshots = historySnapshots;
    APP_STATE.sourceMap = buildSourceMap(data.sources);

    renderDashboard(data, derived, historySnapshots);
    bindInteractions();
  } catch (error) {
    console.error(error);
    showLoadError("数据加载失败。请刷新页面重试；若仍失败，请重新打开预览链接。");
  }
}

loadRadarData();
