const DATA_URL = "./radar-data.json";
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
    statusBadge: "bg-primary text-on-primary"
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
    statusBadge: "bg-tertiary text-black"
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
    statusBadge: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
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
  if (el) el.textContent = value ?? "";
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function toggleHidden(id, shouldHide) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", shouldHide);
}

function formatScore(value) {
  return Number(value).toFixed(1);
}

function ringOffset(score) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  return (RING_CIRCUMFERENCE * (1 - normalized / 100)).toFixed(1);
}

function scoreBarClass(tone) {
  switch (tone) {
    case "red":
      return "bg-primary";
    case "yellow":
      return "bg-tertiary/40";
    case "green":
      return "bg-emerald-400/50";
    default:
      return "bg-primary/20";
  }
}

function positionStyle(position) {
  return Object.entries(position || {}).map(([key, value]) => `${key}: ${value}`).join("; ");
}

function renderScoreBars(bars) {
  return (bars || []).map((tone) => `<div class="h-1.5 flex-1 ${scoreBarClass(tone)}"></div>`).join("");
}

function renderOverlayLeft(items) {
  return (items || []).map((item) => {
    if (item.dot) {
      return `<div class="flex items-center gap-2"><span class="w-1.5 h-1.5 bg-primary rounded-full"></span>${escapeHtml(item.text)}</div>`;
    }
    return `<div>${escapeHtml(item.text)}</div>`;
  }).join("");
}

function renderOverlayRight(items) {
  return (items || []).map((item) => `<div>${escapeHtml(item)}</div>`).join("");
}

function renderBlips(blips) {
  return (blips || []).map((blip) => {
    const tone = getTone(blip.tone);
    const size = DOT_SIZE_MAP[blip.size] || DOT_SIZE_MAP.md;
    const pulseNode = blip.pulse === "ping"
      ? `<div class="${size} ${tone.blipDot} rounded-full animate-ping absolute inset-0 opacity-50"></div>`
      : "";
    const dotAnimation = blip.pulse === "pulse" ? "animate-pulse" : "";
    return `
      <div class="absolute group z-30" style="${positionStyle(blip.position)}">
        <div class="relative">
          ${pulseNode}
          <div class="${size} ${tone.blipDot} rounded-full ${dotAnimation} ${blip.pulse === "ping" ? tone.blipGlow : tone.blipShadow}"></div>
        </div>
        <div class="mt-2 absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div class="bg-black/90 border ${tone.blipBorder} px-2 py-1">
            <span class="text-[12px] font-bold ${tone.blipText} font-label">${escapeHtml(blip.title)} ${escapeHtml(blip.score)}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderIndicatorCards(cards) {
  return (cards || []).map((card, index) => {
    const tone = getTone(card.tone);
    const target = card.target || `TARGET ${String(index + 1).padStart(2, "0")}`;
    const bullets = (card.bullets || []).map((bullet) => `
      <li class="flex gap-2">
        <span class="mt-1.5 w-1.5 h-1.5 rounded-full ${tone.bullet} flex-shrink-0"></span>
        ${escapeHtml(bullet)}
      </li>
    `).join("");

    return `
      <div class="bg-surface-container-low p-6 ${tone.tactical} space-y-5 flex flex-col min-h-[480px]">
        <div class="flex justify-between items-start gap-4">
          <div>
            <span class="text-[12px] font-label tracking-widest uppercase opacity-70">${escapeHtml(target)}</span>
            <h3 class="text-2xl font-bold font-headline mt-1">${escapeHtml(card.title)}</h3>
            <p class="text-[14px] mt-1 text-on-surface-variant">${escapeHtml(card.summary)}</p>
          </div>
          <div class="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
            <svg class="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="${tone.ringBg}" stroke-width="8"></circle>
              <circle cx="50" cy="50" fill="none" r="45" stroke="${tone.ringStroke}" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${ringOffset(card.score)}" stroke-width="8"></circle>
            </svg>
            <div class="flex flex-col items-center leading-none">
              <span class="text-xl font-black font-headline">${escapeHtml(card.score)}</span>
              <span class="text-[9px] font-bold ${tone.label} uppercase">${escapeHtml(card.stateLabel)}</span>
            </div>
          </div>
        </div>
        <ul class="space-y-4 text-[15px] text-on-surface leading-relaxed pb-4">${bullets}</ul>
        <div class="mt-auto pt-4 border-t border-outline-variant/10 flex gap-2">
          <span class="text-[11px] ${tone.chipBg} ${tone.chipText} border ${tone.chipBorder} px-2 py-0.5 font-bold">${escapeHtml(card.evidence)}</span>
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

function renderHero(hero, meta) {
  document.title = meta.pageTitle || document.title;
  setText("brandTitle", meta.brandTitle || "美伊红线雷达");
  setText("heroEyebrow", hero.eyebrow || "");
  toggleHidden("heroEyebrow", !hero.eyebrow);
  setText("streamLabel", hero.streamLabel);
  setText("streamContext", hero.streamContext);
  setText("scoreLabel", hero.scoreLabel);
  setText("heroScoreValue", formatScore(hero.scoreValue));
  setText("heroScoreMax", `/ ${formatScore(hero.scoreMax)}`);
  setText("dataKey", hero.dataKey ? `DATA_KEY: ${hero.dataKey}` : "");
  setText("scanningRegion", hero.scanningRegion ? `SCANNING REGION: ${hero.scanningRegion}` : "");
  toggleHidden("dataKey", !hero.dataKey);
  toggleHidden("scanningRegion", !hero.scanningRegion);
  toggleHidden("heroFooter", !hero.dataKey && !hero.scanningRegion);
  setHtml("scoreBars", renderScoreBars(hero.scoreBars));

  const statusTone = getTone(hero.statusTone);
  setHtml("statusBadge", `<span class="material-symbols-outlined text-sm">${escapeHtml(hero.statusIcon || "shield")}</span><span>${escapeHtml(hero.statusText)}</span>`);
  const badge = document.getElementById("statusBadge");
  badge.className = `text-[12px] font-label font-black px-5 py-2 tracking-[0.25em] uppercase flex items-center gap-2 ${statusTone.statusBadge}`;
}

function renderRadar(radar) {
  setHtml("overlayLeft", renderOverlayLeft(radar.leftMeta));
  setHtml("overlayRight", renderOverlayRight(radar.rightMeta));
  toggleHidden("overlayLeft", !radar.leftMeta || radar.leftMeta.length === 0);
  toggleHidden("overlayRight", !radar.rightMeta || radar.rightMeta.length === 0);
  setText("radarCenterLabel", radar.centerLabel);
  setText("radarCenterScore", radar.centerScore);
  setHtml("radarBlips", renderBlips(radar.blips));
}

function renderSections(data) {
  setText("indicatorsTitle", data.indicators.title);
  setHtml("indicatorCards", renderIndicatorCards(data.indicators.cards));
  setText("watchlistTitle", data.watchlist.title);
  setHtml("watchItems", renderWatchItems(data.watchlist.items));
  setText("timelineTitle", data.timeline.title);
  setText("timelineMeta", data.timeline.meta || "");
  setHtml("timelineItems", renderTimelineItems(data.timeline.items));
}

function showLoadError(message) {
  const errorBox = document.getElementById("loadError");
  const appRoot = document.getElementById("appRoot");
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  appRoot.classList.add("hidden");
}

async function loadRadarData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    renderHero(data.hero, data.meta);
    renderRadar(data.radar);
    renderSections(data);
  } catch (error) {
    console.error(error);
    showLoadError("数据加载失败。请确认 radar-data.json 可访问。");
  }
}

loadRadarData();
