const RING_CIRCUMFERENCE = 282.7;

const APP_STATE = {
  data: null,
  derived: null,
  historySnapshots: [],
  sourceMap: new Map()
};

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
    scoreBar: "bg-primary",
    historyFill: "bg-primary/18",
    historyOutline: "border-primary/30",
    historyText: "text-primary",
    historyBadge: "bg-primary/10 text-primary border border-primary/30"
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
    scoreBar: "bg-tertiary",
    historyFill: "bg-tertiary/18",
    historyOutline: "border-tertiary/30",
    historyText: "text-tertiary",
    historyBadge: "bg-tertiary/10 text-tertiary border border-tertiary/30"
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
    scoreBar: "bg-emerald-400",
    historyFill: "bg-emerald-400/18",
    historyOutline: "border-emerald-400/30",
    historyText: "text-emerald-300",
    historyBadge: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/30"
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

function setDisplay(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = value;
  }
}

function formatBeijingNow() {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`
  };
}

function startHeroClock() {
  const tick = () => {
    const now = formatBeijingNow();
    setText("heroClockDate", now.date);
    setText("heroClockTime", now.time);
  };
  tick();
  window.clearInterval(window.__radarClockTimer);
  window.__radarClockTimer = window.setInterval(tick, 1000);
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

function clampScore(score) {
  return Math.max(0, Math.min(100, roundScore(score)));
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
    const appliedAdjustment = getSnapshotAdjustment(snapshot);
    const adjustedOverallScore = clampScore(derived.overallScore + appliedAdjustment);
    return {
      ...snapshot,
      baseOverallScore: derived.overallScore,
      overallScore: adjustedOverallScore,
      overallTone: lookupTone(adjustedOverallScore, data.bands.ui_tones),
      historyTone: lookupHistoryTone(adjustedOverallScore, data),
      overallLabel: lookupRiskLabel(adjustedOverallScore, data.bands.risk_labels),
      appliedAdjustment,
      dimensions: derived.dimensions
    };
  });
}

function buildSourceMap(sources) {
  return new Map((sources || []).map((source) => [source.id, source]));
}

function splitDateParts(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map((value) => Number(value));
  return {
    year,
    month,
    day
  };
}

function formatChineseDate(dateString) {
  const { year, month, day } = splitDateParts(dateString);
  return `${year}年${month}月${day}日`;
}

function formatMonthDay(dateString) {
  const { month, day } = splitDateParts(dateString);
  return `${month}月${day}日`;
}

function formatMonthHeader(monthKey) {
  const [, month] = String(monthKey || "").split("-");
  return `${Number(month)}月`;
}

function formatDayNumber(dateString) {
  const { day } = splitDateParts(dateString);
  return String(day).padStart(2, "0");
}

function formatWarDay(dayNumber) {
  return `第 ${dayNumber} 天`;
}

function formatSourceDate(dateString) {
  const { month, day } = splitDateParts(dateString);
  return `${month}/${String(day).padStart(2, "0")}`;
}

function renderScoreBars(score, tone) {
  const activeBars = Math.max(1, Math.round(score / 20));
  const activeClass = getTone(tone).scoreBar;
  return Array.from({ length: 5 }, (_, index) => {
    const className = index < activeBars ? activeClass : "bg-primary/20";
    return `<div class="h-1.5 flex-1 ${className}"></div>`;
  }).join("");
}

function renderHistoryDelta(currentScore, previous24hScore) {
  const diff = currentScore - previous24hScore;
  if (diff === 0) {
    return { text: "0", className: "text-on-surface/70" };
  }
  if (diff < 0) {
    return { text: `↓ ${Math.abs(diff)}`, className: "text-emerald-400" };
  }
  return { text: `↑ ${diff}`, className: "text-primary" };
}

function renderOverlayRight(items) {
  return (items || []).map((item) => `<div>${escapeHtml(item)}</div>`).join("");
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

function renderHeroMetrics(historySnapshots, derived) {
  const previousSnapshot = historySnapshots.length > 1 ? historySnapshots[historySnapshots.length - 2] : null;
  const previousScore = previousSnapshot?.overallScore ?? derived.overallScore;
  const delta = renderHistoryDelta(derived.overallScore, previousScore);
  const peakSnapshot = historySnapshots.reduce((best, snapshot) => {
    if (!best || snapshot.overallScore > best.overallScore) {
      return snapshot;
    }
    return best;
  }, null);
  const lowSnapshot = historySnapshots.reduce((best, snapshot) => {
    if (!best || snapshot.overallScore < best.overallScore) {
      return snapshot;
    }
    return best;
  }, null);

  const cards = [
    {
      label: "24h变化",
      value: delta.text,
      helper: `对比前一日 ${previousScore}`,
      className: delta.className
    },
    {
      label: "历史峰值",
      value: String(peakSnapshot?.overallScore ?? derived.overallScore),
      helper: peakSnapshot ? formatMonthDay(peakSnapshot.date) : "当前",
      className: getTone(peakSnapshot?.historyTone || peakSnapshot?.overallTone || derived.overallTone).historyText
    },
    {
      label: "历史低点",
      value: String(lowSnapshot?.overallScore ?? derived.overallScore),
      helper: lowSnapshot ? formatMonthDay(lowSnapshot.date) : "当前",
      className: getTone(lowSnapshot?.historyTone || lowSnapshot?.overallTone || derived.overallTone).historyText
    }
  ];

  return cards.map((card) => `
    <div class="bg-surface-container-low/80 border border-outline-variant/15 px-3 py-3 min-h-[86px] flex flex-col justify-between">
      <div class="text-[10px] font-label tracking-[0.22em] uppercase text-on-surface-variant">${escapeHtml(card.label)}</div>
      <div class="text-2xl font-black font-headline ${card.className}">${escapeHtml(card.value)}</div>
      <div class="text-[10px] text-on-surface-variant font-label">${escapeHtml(card.helper)}</div>
    </div>
  `).join("");
}

function renderHistoryLegend(items) {
  return (items || []).map((item) => {
    const tone = getTone(item.tone);
    return `
      <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/10">
        <span class="w-2.5 h-2.5 rounded-full ${tone.blipDot}"></span>
        <span class="text-[11px] font-label text-on-surface-variant tracking-[0.16em]">${escapeHtml(item.label)}</span>
      </div>
    `;
  }).join("");
}

function renderHistoryMonthDivider(monthKey, count, isFirst) {
  return `
    <div class="col-span-full flex items-center gap-4 ${isFirst ? "" : "pt-5"}">
      <div class="text-2xl font-black font-headline text-primary">${escapeHtml(formatMonthHeader(monthKey))}</div>
      <div class="h-px flex-1 bg-primary/15"></div>
      <div class="text-[11px] font-label tracking-[0.2em] text-on-surface-variant">${count}天</div>
    </div>
  `;
}

function renderHistoryDay(snapshot, warDay, latestDate) {
  const tone = getTone(snapshot.historyTone || snapshot.overallTone);
  const fillHeight = Math.max(22, Math.min(100, snapshot.overallScore));
  const latestBadge = snapshot.date === latestDate
    ? `<span class="text-[10px] font-label ${tone.historyText}">最新</span>`
    : `<span class="w-2 h-2 rounded-full ${tone.blipDot} ${snapshot.overallScore >= 80 ? tone.blipGlow : tone.blipShadow}"></span>`;

  return `
    <button type="button" data-history-date="${escapeHtml(snapshot.date)}" class="group relative min-h-[110px] overflow-hidden bg-surface-container-lowest border ${tone.historyOutline} p-3 text-left transition-all duration-200 hover:-translate-y-1 hover:bg-surface-container-highest hover:border-primary/45">
      <div class="absolute inset-x-0 bottom-0 ${tone.historyFill}" style="height:${fillHeight}%"></div>
      <div class="relative z-10 flex h-full flex-col justify-between">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[10px] font-label tracking-[0.2em] text-on-surface-variant">${escapeHtml(formatWarDay(warDay))}</div>
            <div class="mt-1 text-sm font-bold text-on-surface">${escapeHtml(formatDayNumber(snapshot.date))}日</div>
          </div>
          ${latestBadge}
        </div>
        <div>
          <div class="text-3xl font-black font-headline ${tone.historyText} leading-none">${snapshot.overallScore}</div>
          <div class="mt-2 text-[11px] text-on-surface-variant">${escapeHtml(snapshot.tag || snapshot.overallLabel)}</div>
        </div>
      </div>
    </button>
  `;
}

function renderHistoryArchive(data, historySnapshots) {
  setText("historyArchiveTitle", data.history?.archiveTitle || "过去41天战争历史指数");
  setText("historyArchiveSubtitle", data.history?.archiveSubtitle || "点击任一天，查看当日五条红线的结构。");
  setHtml("historyArchiveLegend", renderHistoryLegend(data.history?.legend || []));

  const monthCounts = historySnapshots.reduce((map, snapshot) => {
    const key = snapshot.date.slice(0, 7);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  let currentMonth = "";
  const latestDate = historySnapshots[historySnapshots.length - 1]?.date;
  const gridHtml = historySnapshots.map((snapshot, index) => {
    const monthKey = snapshot.date.slice(0, 7);
    const divider = monthKey !== currentMonth
      ? renderHistoryMonthDivider(monthKey, monthCounts.get(monthKey), currentMonth === "")
      : "";
    currentMonth = monthKey;
    return `${divider}${renderHistoryDay(snapshot, index + 1, latestDate)}`;
  }).join("");

  setHtml("historyArchiveGrid", gridHtml);
}

function renderModalRadarBlips(dimensions) {
  return (dimensions || []).map((dimension) => {
    const tone = getTone(dimension.tone);
    const size = DOT_SIZE_MAP[dimension.display?.size] || DOT_SIZE_MAP.md;
    const ping = dimension.score >= 80 ? `<div class="${size} ${tone.blipDot} rounded-full animate-ping absolute inset-0 opacity-40"></div>` : "";
    return `
      <div class="absolute z-20" style="${positionStyle(dimension.display?.position)}">
        <div class="relative">
          ${ping}
          <div class="${size} ${tone.blipDot} rounded-full ${dimension.score >= 80 ? tone.blipGlow : tone.blipShadow}"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderModalDimensionCards(dimensions) {
  return (dimensions || []).map((dimension) => {
    const tone = getTone(dimension.tone);
    return `
      <div class="bg-surface-container-lowest border ${tone.historyOutline} p-3 space-y-2">
        <div class="text-[11px] font-label text-on-surface-variant tracking-[0.14em]">${escapeHtml(dimension.title)}</div>
        <div class="flex items-end justify-between gap-3">
          <span class="text-2xl font-black font-headline ${tone.historyText}">${dimension.score}</span>
          <span class="text-[10px] ${tone.historyText} font-bold">${escapeHtml(dimension.riskLabel)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderDriverList(dimensions) {
  return [...(dimensions || [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((dimension) => {
      const tone = getTone(dimension.tone);
      return `
        <div class="flex items-center justify-between gap-4 text-sm">
          <div class="flex items-center gap-2 text-on-surface">
            <span class="w-2 h-2 rounded-full ${tone.blipDot}"></span>
            <span>${escapeHtml(dimension.title)}</span>
          </div>
          <span class="font-black font-headline ${tone.historyText}">${dimension.score}</span>
        </div>
      `;
    }).join("");
}

function renderSourceLinks(sourceMap, sourceIds) {
  return (sourceIds || []).map((id) => sourceMap.get(id)).filter(Boolean).map((source) => `
    <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer noopener" class="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-outline-variant/15 text-[11px] text-on-surface-variant hover:border-primary/35 hover:text-on-surface transition-colors">
      <span>${escapeHtml(source.publisher)}</span>
      <span>${escapeHtml(formatSourceDate(source.date))}</span>
    </a>
  `).join("");
}

function renderHistoryModal(snapshot, sourceMap, warDay, data) {
  const tone = getTone(snapshot.overallTone);
  const sourceLinks = renderSourceLinks(sourceMap, snapshot.source_ids);
  const driverList = renderDriverList(snapshot.dimensions);

  return `
    <div class="bg-surface-container-low tactical-border-red p-6 md:p-8 lg:p-10 shadow-2xl max-h-[88vh] overflow-y-auto">
      <div class="flex items-start justify-between gap-6">
        <div class="space-y-3 max-w-[680px]">
          <div class="flex flex-wrap items-center gap-3 text-[11px] font-label tracking-[0.2em]">
            <span class="px-3 py-1 ${tone.historyBadge}">${escapeHtml(snapshot.tag || "历史快照")}</span>
            <span class="text-on-surface-variant">${escapeHtml(formatChineseDate(snapshot.date))}</span>
            <span class="text-on-surface-variant">${escapeHtml(formatWarDay(warDay))}</span>
          </div>
          <h3 class="text-3xl md:text-4xl font-black font-headline tracking-tight text-on-surface">${escapeHtml(snapshot.headline || formatChineseDate(snapshot.date))}</h3>
          <p class="text-sm md:text-base text-on-surface-variant leading-relaxed">${escapeHtml(snapshot.summary || "")}</p>
        </div>
        <div class="flex items-start gap-4 flex-shrink-0">
          <div class="text-right">
            <div class="text-[11px] font-label tracking-[0.24em] text-on-surface-variant uppercase">${escapeHtml(data.history?.modalTitle || "当日红线雷达")}</div>
            <div class="text-7xl md:text-8xl font-black font-headline ${tone.historyText} leading-none">${snapshot.overallScore}</div>
            <div class="text-sm ${tone.historyText} font-bold mt-1">${escapeHtml(snapshot.overallLabel)}</div>
          </div>
          <button type="button" data-history-close class="w-10 h-10 flex items-center justify-center border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:border-primary/40 transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div class="mt-8 grid lg:grid-cols-[320px_1fr] gap-8 items-start">
        <div class="space-y-4">
          <div class="bg-surface-container-lowest border border-outline-variant/10 p-4 space-y-2">
            <div class="text-[11px] font-label tracking-[0.22em] uppercase text-on-surface-variant">当日状态</div>
            <div class="text-xl font-black font-headline text-on-surface">${snapshot.overallScore} / 100</div>
            <div class="text-sm text-on-surface-variant">北京时间 ${escapeHtml(snapshot.snapshot_time_bjt)}</div>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/10 p-4 space-y-3">
            <div class="text-[11px] font-label tracking-[0.22em] uppercase text-on-surface-variant">主导因子</div>
            ${driverList}
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/10 p-4 space-y-3">
            <div class="text-[11px] font-label tracking-[0.22em] uppercase text-on-surface-variant">公开来源</div>
            <div class="flex flex-wrap gap-2">
              ${sourceLinks || `<span class="text-sm text-on-surface-variant">暂无来源条目</span>`}
            </div>
          </div>
        </div>

        <div class="space-y-5">
          <div class="bg-[#060000] tactical-border-red p-4 md:p-6 overflow-hidden">
            <div class="relative h-[340px] md:h-[420px]">
              <svg class="absolute inset-0 w-full h-full" viewBox="0 0 600 600">
                <circle class="radar-grid-line" cx="300" cy="300" fill="none" r="280"></circle>
                <circle class="radar-grid-line" cx="300" cy="300" fill="none" r="210"></circle>
                <circle class="radar-grid-line" cx="300" cy="300" fill="none" r="140"></circle>
                <circle class="radar-grid-line" cx="300" cy="300" fill="none" r="70"></circle>
                <line class="radar-grid-line" x1="300" x2="300" y1="20" y2="580"></line>
                <line class="radar-grid-line" x1="20" x2="580" y1="300" y2="300"></line>
                <line class="radar-grid-line" x1="102" x2="498" y1="102" y2="498"></line>
                <line class="radar-grid-line" x1="102" x2="498" y1="498" y2="102"></line>
              </svg>
              <div class="absolute inset-0 radar-sweep rounded-full opacity-35"></div>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                <div class="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_12px_#FF3B30] mb-2"></div>
                <span class="text-[11px] text-primary/70 font-label tracking-tighter uppercase">总雷达分</span>
                <span class="text-6xl md:text-7xl font-black font-headline text-on-surface leading-none">${snapshot.overallScore}</span>
              </div>
              ${renderModalRadarBlips(snapshot.dimensions)}
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            ${renderModalDimensionCards(snapshot.dimensions)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function openHistoryModal(date) {
  const modal = document.getElementById("historyModal");
  const panel = document.getElementById("historyModalPanel");
  if (!modal || !panel) {
    return;
  }
  const index = APP_STATE.historySnapshots.findIndex((snapshot) => snapshot.date === date);
  if (index === -1) {
    return;
  }
  const snapshot = APP_STATE.historySnapshots[index];
  panel.innerHTML = renderHistoryModal(snapshot, APP_STATE.sourceMap, index + 1, APP_STATE.data);
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  document.documentElement.classList.add("overflow-hidden");
}

function closeHistoryModal() {
  const modal = document.getElementById("historyModal");
  const panel = document.getElementById("historyModalPanel");
  if (!modal || !panel) {
    return;
  }
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  panel.innerHTML = "";
  document.body.classList.remove("overflow-hidden");
  document.documentElement.classList.remove("overflow-hidden");
}

function bindHistoryInteractions() {
  if (window.__historyBindingsReady) {
    return;
  }
  const grid = document.getElementById("historyArchiveGrid");
  const modal = document.getElementById("historyModal");
  const backdrop = document.getElementById("historyModalBackdrop");

  grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-date]");
    if (!button) {
      return;
    }
    openHistoryModal(button.dataset.historyDate);
  });

  backdrop?.addEventListener("click", closeHistoryModal);

  modal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-history-close]")) {
      closeHistoryModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHistoryModal();
    }
  });

  window.__historyBindingsReady = true;
}

function renderHero(data, derived, historySnapshots) {
  document.title = data.meta.pageTitle || document.title;
  setText("brandTitle", data.meta.brandTitle || "美伊红线指数");
  setText("heroEyebrow", data.hero.eyebrow || "");
  toggleHidden("heroEyebrow", !data.hero.eyebrow);
  setText("heroScoreValue", String(derived.overallScore));
  setText("heroScoreMax", `/ ${data.hero.scoreMax || 100}`);
  toggleHidden("dataKey", true);
  toggleHidden("scanningRegion", true);
  toggleHidden("heroFooter", true);
  setHtml("scoreBars", renderScoreBars(derived.overallScore, derived.overallTone));
  setHtml("heroMetricsBox", renderHeroMetrics(historySnapshots, derived));
  startHeroClock();

  const statusTone = getTone(derived.overallTone);
  const statusText = `${data.hero.statusPrefix || ""}${derived.overallLabel}`;
  setHtml("statusBadge", `<span class="material-symbols-outlined text-sm">${escapeHtml(data.hero.statusIcon || "shield")}</span><span>${escapeHtml(statusText)}</span>`);
  const badge = document.getElementById("statusBadge");
  badge.className = `text-[12px] font-label font-black px-5 py-2 tracking-[0.25em] uppercase flex items-center gap-2 ${statusTone.statusBadge}`;
}

function renderRadar(data, derived) {
  setHtml("overlayLeft", "");
  const rightMeta = data.radar.rightMeta || [];
  setHtml("overlayRight", renderOverlayRight(rightMeta));
  toggleHidden("overlayLeft", true);
  toggleHidden("overlayRight", rightMeta.length === 0);
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
    const historySnapshots = computeHistorySnapshots(data);

    APP_STATE.data = data;
    APP_STATE.derived = derived;
    APP_STATE.historySnapshots = historySnapshots;
    APP_STATE.sourceMap = buildSourceMap(data.sources);

    renderHero(data, derived, historySnapshots);
    renderHistoryArchive(data, historySnapshots);
    renderRadar(data, derived);
    renderSections(data, derived);
    bindHistoryInteractions();
  } catch (error) {
    console.error(error);
    showLoadError("数据加载失败。请刷新页面重试；若仍失败，请重新打开预览链接。");
  }
}

loadRadarData();
