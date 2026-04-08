const RING_CIRCUMFERENCE = 282.7;

const TONE_MAP = {
  red: {
    tactical: "tactical-border-red",
    leftBorder: "border-primary",
    label: "text-primary",
    chipBg: "bg-primary/10",
    chipText: "text-primary",
    chipBorder: "border-primary/30",
    bullet: "bg-primary",
    ringBg: "rgba(255,59,48,0.1)",
    ringStroke: "#FF3B30",
    blipDot: "bg-primary",
    blipText: "text-primary",
    blipBorder: "border-primary/50",
    blipShadow: "shadow-[0_0_10px_#FF3B30]",
    blipGlow: "shadow-[0_0_15px_#FF3B30]",
    statusBadge: "bg-primary text-on-primary",
    scoreBar: "bg-primary"
  },
  yellow: {
    tactical: "tactical-border-yellow",
    leftBorder: "border-tertiary",
    label: "text-tertiary",
    chipBg: "bg-tertiary/10",
    chipText: "text-tertiary",
    chipBorder: "border-tertiary/30",
    bullet: "bg-tertiary",
    ringBg: "rgba(252,196,25,0.1)",
    ringStroke: "#fcc419",
    blipDot: "bg-tertiary",
    blipText: "text-tertiary",
    blipBorder: "border-tertiary/50",
    blipShadow: "shadow-[0_0_10px_#fcc419]",
    blipGlow: "shadow-[0_0_15px_#fcc419]",
    statusBadge: "bg-tertiary text-black",
    scoreBar: "bg-tertiary"
  },
  green: {
    tactical: "tactical-border-green",
    leftBorder: "border-emerald-400",
    label: "text-emerald-300",
    chipBg: "bg-emerald-400/10",
    chipText: "text-emerald-300",
    chipBorder: "border-emerald-400/30",
    bullet: "bg-emerald-400",
    ringBg: "rgba(52,211,153,0.1)",
    ringStroke: "#34d399",
    blipDot: "bg-emerald-400",
    blipText: "text-emerald-300",
    blipBorder: "border-emerald-400/50",
    blipShadow: "shadow-[0_0_10px_#34d399]",
    blipGlow: "shadow-[0_0_15px_#34d399]",
    statusBadge: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30",
    scoreBar: "bg-emerald-400"
  }
};

const DOT_SIZE_MAP = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3"
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

function toggleHidden(id, shouldHide) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle("hidden", shouldHide);
  }
}

function roundScore(value) {
  return Math.round(Number(value) || 0);
}

function ringOffset(score) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  return (RING_CIRCUMFERENCE * (1 - normalized / 100)).toFixed(1);
}

function positionStyle(position) {
  return Object.entries(position || {}).map(([key, value]) => `${key}: ${value}`).join("; ");
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

function renderScoreBars(score, tone) {
  const activeBars = Math.max(1, Math.round(score / 20));
  const activeClass = getTone(tone).scoreBar;
  return Array.from({ length: 5 }, (_, index) => {
    const className = index < activeBars ? activeClass : "bg-primary/20";
    return `<div class="h-1.5 flex-1 ${className}"></div>`;
  }).join("");
}

function renderOverlayRight(snapshotTime, items) {
  const values = [`快照时间: 北京时间 ${snapshotTime}`, ...(items || [])];
  return values.map((item) => `<div>${escapeHtml(item)}</div>`).join("");
}

function renderBlips(dimensions) {
  return (dimensions || []).map((dimension) => {
    const tone = getTone(dimension.tone);
    const size = DOT_SIZE_MAP[dimension.display?.size] || DOT_SIZE_MAP.md;
    const pulseNode = dimension.display?.pulse === "ping"
      ? `<div class="${size} ${tone.blipDot} rounded-full animate-ping absolute inset-0 opacity-50"></div>`
      : "";
    const dotAnimation = dimension.display?.pulse === "pulse" ? "animate-pulse" : "";
    return `
      <div class="absolute group z-30" style="${positionStyle(dimension.display?.position)}">
        <div class="relative">
          ${pulseNode}
          <div class="${size} ${tone.blipDot} rounded-full ${dotAnimation} ${dimension.display?.pulse === "ping" ? tone.blipGlow : tone.blipShadow}"></div>
        </div>
        <div class="mt-2 absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div class="bg-black/90 border ${tone.blipBorder} px-2 py-1">
            <span class="text-[12px] font-bold ${tone.blipText} font-label">${escapeHtml(dimension.title)} ${dimension.score}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderIndicatorCards(dimensions) {
  return (dimensions || []).map((dimension) => {
    const tone = getTone(dimension.tone);
    const bullets = (dimension.bullets || []).map((bullet) => `
      <li class="flex gap-2">
        <span class="mt-1.5 w-1.5 h-1.5 rounded-full ${tone.bullet} flex-shrink-0"></span>
        ${escapeHtml(bullet)}
      </li>
    `).join("");

    return `
      <div class="bg-surface-container-low p-6 ${tone.tactical} space-y-5 flex flex-col min-h-[480px]">
        <div class="flex justify-between items-start gap-4">
          <div>
            <span class="text-[12px] font-label tracking-widest uppercase opacity-70">${escapeHtml(dimension.target)}</span>
            <h3 class="text-2xl font-bold font-headline mt-1">${escapeHtml(dimension.title)}</h3>
            <p class="text-[14px] mt-1 text-on-surface-variant">${escapeHtml(dimension.summary)}</p>
          </div>
          <div class="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
            <svg class="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="${tone.ringBg}" stroke-width="8"></circle>
              <circle cx="50" cy="50" fill="none" r="45" stroke="${tone.ringStroke}" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${ringOffset(dimension.score)}" stroke-width="8"></circle>
            </svg>
            <div class="flex flex-col items-center leading-none">
              <span class="text-xl font-black font-headline">${dimension.score}</span>
              <span class="text-[9px] font-bold ${tone.label} uppercase">${escapeHtml(dimension.riskLabel)}</span>
            </div>
          </div>
        </div>
        <ul class="space-y-4 text-[15px] text-on-surface leading-relaxed pb-4">${bullets}</ul>
        <div class="mt-auto pt-4 border-t border-outline-variant/10 flex gap-2">
          <span class="text-[11px] ${tone.chipBg} ${tone.chipText} border ${tone.chipBorder} px-2 py-0.5 font-bold">${escapeHtml(dimension.evidence)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderWatchItems(items) {
  return (items || []).map((item, index) => {
    const tone = getTone(item.tone);
    const label = item.label || `WATCH ${String(index + 1).padStart(2, "0")}`;
    return `
      <div class="bg-surface-container-lowest p-6 border-l-4 ${tone.leftBorder} hover:bg-surface-container-highest transition-colors cursor-pointer ${tone.tactical}">
        <div class="flex justify-between items-start mb-4">
          <span class="text-[13px] font-label ${tone.label} uppercase font-bold tracking-[0.2em]">${escapeHtml(label)}</span>
          <span class="text-[12px] font-label opacity-70">${escapeHtml(item.tag)}</span>
        </div>
        <p class="text-[15px] text-on-surface font-body leading-relaxed">${escapeHtml(item.text)}</p>
      </div>
    `;
  }).join("");
}

function renderTimelineItems(items) {
  return (items || []).map((item) => {
    const tone = getTone(item.tone);
    return `
      <div class="p-5 bg-surface-container-lowest border border-outline-variant/10 hover:border-primary/30 transition-all group">
        <div class="flex justify-between items-center mb-2 gap-4">
          <span class="text-[14px] font-label text-primary font-bold">${escapeHtml(item.date)}</span>
          <span class="text-[10px] font-label ${tone.chipText} border ${tone.chipBorder} px-3 py-0.5 font-bold uppercase">${escapeHtml(item.tag)}</span>
        </div>
        <p class="text-[14px] font-medium text-on-surface">${escapeHtml(item.text)}</p>
      </div>
    `;
  }).join("");
}

function renderHero(data, derived) {
  document.title = data.meta.pageTitle || document.title;
  setText("brandTitle", data.meta.brandTitle || "美伊红线指数");
  setText("heroEyebrow", data.hero.eyebrow || "");
  toggleHidden("heroEyebrow", !data.hero.eyebrow);
  setText("streamLabel", data.hero.streamLabel || "");
  setText("streamContext", data.hero.streamContext || "");
  setText("scoreLabel", data.hero.scoreLabel || "");
  setText("heroScoreValue", String(derived.overallScore));
  setText("heroScoreMax", `/ ${data.hero.scoreMax || 100}`);
  toggleHidden("dataKey", true);
  toggleHidden("scanningRegion", true);
  toggleHidden("heroFooter", true);
  setHtml("scoreBars", renderScoreBars(derived.overallScore, derived.overallTone));

  const statusTone = getTone(derived.overallTone);
  const statusText = `${data.hero.statusPrefix || ""}${derived.overallLabel}`;
  setHtml("statusBadge", `<span class="material-symbols-outlined text-sm">${escapeHtml(data.hero.statusIcon || "shield")}</span><span>${escapeHtml(statusText)}</span>`);
  const badge = document.getElementById("statusBadge");
  badge.className = `text-[12px] font-label font-black px-5 py-2 tracking-[0.25em] uppercase flex items-center gap-2 ${statusTone.statusBadge}`;
}

function renderRadar(data, derived) {
  setHtml("overlayLeft", "");
  setHtml("overlayRight", renderOverlayRight(data.meta.snapshot_time_bjt, data.radar.rightMeta));
  toggleHidden("overlayLeft", true);
  toggleHidden("overlayRight", false);
  setText("radarCenterLabel", data.radar.centerLabel || "总雷达分");
  setText("radarCenterScore", String(derived.overallScore));
  setHtml("radarBlips", renderBlips(derived.dimensions));
}

function renderSections(data, derived) {
  setText("indicatorsTitle", "5 条红线核心指标");
  setHtml("indicatorCards", renderIndicatorCards(derived.dimensions));
  setText("watchlistTitle", data.watchlist.title || "");
  setHtml("watchItems", renderWatchItems(data.watchlist.items));
  setText("timelineTitle", data.timeline.title || "");
  setText("timelineMeta", `显示 ${data.timeline.items.length} 个最新公开节点`);
  setHtml("timelineItems", renderTimelineItems(data.timeline.items));
}

function showLoadError(message) {
  const errorBox = document.getElementById("loadError");
  const appRoot = document.getElementById("appRoot");
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  appRoot.classList.add("hidden");
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
    renderHero(data, derived);
    renderRadar(data, derived);
    renderSections(data, derived);
  } catch (error) {
    console.error(error);
    showLoadError("数据加载失败。请刷新页面重试；若仍失败，请重新打开预览链接。");
  }
}

loadRadarData();
