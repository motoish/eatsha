const DEFAULT_FOODS = [
  { name: "タイ", color: "#E85A3A" },
  { name: "とりき", color: "#F0A830" },
  { name: "マック", color: "#D62828" },
  { name: "KFC", color: "#8B5E3C" },
  { name: "モスバーガー", color: "#5AA05A" },
  { name: "餃子", color: "#C43C4E" },
  { name: "中華", color: "#E0A21B" },
  { name: "スーパー弁当", color: "#2F9E9E" },
  { name: "インスタントラーメン", color: "#F07820" },
  { name: "自炊", color: "#6B8F3C" },
  { name: "居酒屋", color: "#3D6B9A" },
];

const COLOR_PALETTE = [
  "#E85A3A",
  "#F0A830",
  "#D62828",
  "#8B5E3C",
  "#5AA05A",
  "#C43C4E",
  "#E0A21B",
  "#2F9E9E",
  "#F07820",
  "#6B8F3C",
  "#3D6B9A",
  "#B85C38",
  "#4A7C59",
  "#C45C26",
  "#6B4F3A",
];

const STORAGE_KEY = "eatsha-custom-foods";
const MAX_TRIALS = 9999;
const DEFAULT_TRIALS = 1000;
const MIN_FOODS = 2;
const MAX_FOODS = 24;
const TWO_PI = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;

const screens = {
  home: document.getElementById("screen-home"),
  edit: document.getElementById("screen-edit"),
  wheel: document.getElementById("screen-wheel"),
};

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const pieCanvas = document.getElementById("pie-chart");
const pieCtx = pieCanvas.getContext("2d");
const spinBtn = document.getElementById("spin-btn");
const modal = document.getElementById("result-modal");
const resultEyebrow = document.getElementById("result-eyebrow");
const resultTitle = document.getElementById("result-title");
const againBtn = document.getElementById("again-btn");
const statsBlock = document.getElementById("stats-block");
const statsLegend = document.getElementById("stats-legend");
const trialsField = document.getElementById("trials-field");
const trialsInput = document.getElementById("trials-input");
const trialsHint = document.getElementById("trials-hint");
const spinModeButtons = document.querySelectorAll("[data-spin-mode]");
const foodListEl = document.getElementById("food-list");
const foodCountEl = document.getElementById("food-count");
const editHint = document.getElementById("edit-hint");
const wheelTagline = document.getElementById("wheel-tagline");
const wheelEditBtn = document.getElementById("wheel-edit");

let catalogMode = "fixed";
let spinMode = "normal";
let foods = cloneDefaultFoods();
let draftNames = defaultNames();
let rotation = 0;
let isSpinning = false;
let highlightedIndex = -1;
let prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", (event) => {
    prefersReducedMotion = event.matches;
  });

function cloneDefaultFoods() {
  return DEFAULT_FOODS.map((food) => ({ ...food }));
}

function defaultNames() {
  return DEFAULT_FOODS.map((food) => food.name);
}

function getMinTrials() {
  return foods.length + 1;
}

function getSegmentAngle() {
  return TWO_PI / Math.max(foods.length, 1);
}

function colorForIndex(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function foodsFromNames(names) {
  return names.map((name, index) => ({
    name,
    color: colorForIndex(index),
  }));
}

function normalizeNames(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_FOODS);
}

function sameNames(a, b) {
  if (a.length !== b.length) return false;
  return a.every((name, index) => name === b[index]);
}

function loadCustomNames() {
  const currentDefaults = defaultNames();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return currentDefaults;

    const parsed = JSON.parse(raw);

    // Legacy format: bare string[]
    if (Array.isArray(parsed)) {
      // Old caches were usually just the previous defaults — refresh to current defaults.
      saveCustomNames(currentDefaults);
      return currentDefaults;
    }

    const names = normalizeNames(parsed?.names);
    const baseline = normalizeNames(parsed?.baselineDefaults);

    if (names.length < MIN_FOODS) return currentDefaults;

    // Saved list was still the then-current defaults, and code defaults changed → sync.
    if (baseline.length > 0 && sameNames(names, baseline) && !sameNames(baseline, currentDefaults)) {
      saveCustomNames(currentDefaults);
      return currentDefaults;
    }

    return names;
  } catch {
    return currentDefaults;
  }
}

function saveCustomNames(names) {
  const cleaned = normalizeNames(names);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      names: cleaned,
      baselineDefaults: defaultNames(),
    }),
  );
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    const isActive = key === name;
    el.hidden = !isActive;
    el.classList.toggle("is-active", isActive);
  });
}

function setEditHint(message, isError = false) {
  if (!message) {
    editHint.hidden = true;
    editHint.textContent = "";
    editHint.classList.remove("is-error");
    return;
  }
  editHint.hidden = false;
  editHint.textContent = message;
  editHint.classList.toggle("is-error", isError);
}

function collectDraftNames() {
  return Array.from(foodListEl.querySelectorAll(".food-item__input")).map(
    (input) => input.value.trim(),
  );
}

function renderEditor(names) {
  draftNames = names.slice(0, MAX_FOODS);
  foodCountEl.textContent = `共 ${draftNames.length} 道菜`;
  foodListEl.innerHTML = draftNames
    .map(
      (name, index) => `
      <li class="food-item">
        <span class="food-item__index" aria-hidden="true">${index + 1}</span>
        <span class="food-item__swatch" style="background:${colorForIndex(index)}"></span>
        <input
          class="food-item__input"
          type="text"
          maxlength="20"
          value="${escapeAttr(name)}"
          aria-label="菜品 ${index + 1}"
        />
        <button type="button" class="food-item__remove" data-index="${index}" aria-label="删除第 ${index + 1} 道">
          删
        </button>
      </li>
    `,
    )
    .join("");
  setEditHint("");
}

function escapeAttr(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function normalizeAngle(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function drawWheel() {
  if (foods.length === 0) return;

  const { width } = canvas;
  const cx = width / 2;
  const cy = width / 2;
  const radius = width / 2 - 4;
  const segmentAngle = getSegmentAngle();

  ctx.clearRect(0, 0, width, width);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  foods.forEach((food, index) => {
    const start = index * segmentAngle;
    const end = start + segmentAngle;
    const mid = start + segmentAngle / 2;
    const isHighlighted = index === highlightedIndex;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = food.color;
    ctx.fill();

    if (isHighlighted) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#f0faf6";
      ctx.stroke();
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(10, 28, 24, 0.35)";
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(mid);
    const screenAngle = normalizeAngle(mid + rotation);
    const isFlipped = screenAngle > Math.PI / 2 && screenAngle < (Math.PI * 3) / 2;
    if (isFlipped) ctx.rotate(Math.PI);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f0faf6";
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 4;

    const labelRadius = isFlipped ? -radius * 0.62 : radius * 0.62;
    const maxWidth = radius * segmentAngle * 0.72;
    fitAndFillText(food.name, labelRadius, 0, maxWidth);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.14, 0, TWO_PI);
  ctx.fillStyle = "#0a1614";
  ctx.fill();
  ctx.restore();
}

function fitAndFillText(text, x, y, maxWidth) {
  let fontSize = Math.round(canvas.width * 0.042);
  ctx.font = `700 ${fontSize}px "Noto Sans SC", "Noto Sans JP", sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 16) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px "Noto Sans SC", "Noto Sans JP", sans-serif`;
  }
  ctx.fillText(text, x, y);
}

function rotationForIndex(index) {
  const segmentAngle = getSegmentAngle();
  const segmentCenter = index * segmentAngle + segmentAngle / 2;
  return normalizeAngle(POINTER_ANGLE - segmentCenter);
}

function setSpinMode(nextMode) {
  spinMode = nextMode;
  const isProbability = spinMode === "probability";

  spinModeButtons.forEach((button) => {
    const isActive = button.dataset.spinMode === spinMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  trialsField.hidden = !isProbability;
  syncTrialsBounds();
  if (isProbability) trialsInput.focus();
}

function setTrialsHint(message, isError = false) {
  trialsHint.textContent = message;
  trialsHint.classList.toggle("is-error", isError);
}

function syncTrialsBounds() {
  const minTrials = getMinTrials();
  trialsInput.min = String(minTrials);
  trialsInput.max = String(MAX_TRIALS);
  const current = Number.parseInt(trialsInput.value, 10);
  if (!Number.isFinite(current) || current < minTrials) {
    trialsInput.value = String(Math.max(DEFAULT_TRIALS, minTrials));
  }
  updateTrialsHint();
}

function updateTrialsHint() {
  const minTrials = getMinTrials();
  const raw = trialsInput.value.trim();
  const value = Number.parseInt(raw, 10);

  if (raw !== "" && Number.isFinite(value) && value < minTrials) {
    setTrialsHint(`最小次数${minTrials}次`, true);
    trialsInput.classList.add("is-invalid");
    return;
  }

  if (raw !== "" && Number.isFinite(value) && value > MAX_TRIALS) {
    setTrialsHint(`最大次数${MAX_TRIALS}次`, true);
    trialsInput.classList.add("is-invalid");
    return;
  }

  trialsInput.classList.remove("is-invalid");
  setTrialsHint(`最大次数${MAX_TRIALS}次`, false);
}

function parseTrials() {
  const minTrials = getMinTrials();
  const raw = trialsInput.value.trim();
  const value = Number.parseInt(raw, 10);

  if (!Number.isFinite(value) || value < minTrials || value > MAX_TRIALS) {
    updateTrialsHint();
    if (!Number.isFinite(value) || raw === "") {
      setTrialsHint(`最小次数${minTrials}次`, true);
      trialsInput.classList.add("is-invalid");
    }
    return null;
  }

  trialsInput.classList.remove("is-invalid");
  trialsInput.value = String(value);
  setTrialsHint(`最大次数${MAX_TRIALS}次`, false);
  return value;
}

function runSimulation(trials) {
  const counts = Array(foods.length).fill(0);

  for (let i = 0; i < trials; i += 1) {
    counts[Math.floor(Math.random() * foods.length)] += 1;
  }

  let maxCount = -1;
  const winners = [];
  counts.forEach((count, index) => {
    if (count > maxCount) {
      maxCount = count;
      winners.length = 0;
      winners.push(index);
      return;
    }
    if (count === maxCount) winners.push(index);
  });

  return {
    trials,
    counts,
    winnerIndex: winners[Math.floor(Math.random() * winners.length)],
    isTie: winners.length > 1,
  };
}

function formatPercent(count, trials) {
  return `${((count / trials) * 100).toFixed(1)}%`;
}

function drawPieChart(stats) {
  const { width } = pieCanvas;
  const cx = width / 2;
  const cy = width / 2;
  const radius = width / 2 - 8;
  let angle = -Math.PI / 2;

  pieCtx.clearRect(0, 0, width, width);

  foods.forEach((food, index) => {
    const count = stats.counts[index];
    if (count <= 0) return;
    const slice = (count / stats.trials) * TWO_PI;
    pieCtx.beginPath();
    pieCtx.moveTo(cx, cy);
    pieCtx.arc(cx, cy, radius, angle, angle + slice);
    pieCtx.closePath();
    pieCtx.fillStyle = food.color;
    pieCtx.fill();
    pieCtx.strokeStyle = "rgba(10, 28, 24, 0.35)";
    pieCtx.lineWidth = 2;
    pieCtx.stroke();
    angle += slice;
  });

  pieCtx.beginPath();
  pieCtx.arc(cx, cy, radius * 0.42, 0, TWO_PI);
  pieCtx.fillStyle = "#122824";
  pieCtx.fill();
  pieCtx.fillStyle = "#f0faf6";
  pieCtx.font = `700 ${Math.round(width * 0.09)}px Fredoka, "Noto Sans SC", sans-serif`;
  pieCtx.textAlign = "center";
  pieCtx.textBaseline = "middle";
  pieCtx.fillText(`${stats.trials}`, cx, cy - width * 0.035);
  pieCtx.font = `500 ${Math.round(width * 0.055)}px "Noto Sans SC", sans-serif`;
  pieCtx.fillStyle = "rgba(255, 248, 241, 0.72)";
  pieCtx.fillText("次", cx, cy + width * 0.055);
}

function renderStats(stats) {
  const ranked = foods
    .map((food, index) => ({ food, index, count: stats.counts[index] }))
    .sort((a, b) => b.count - a.count || a.index - b.index);

  statsLegend.innerHTML = ranked
    .map(({ food, index, count }) => {
      const isWinner = index === stats.winnerIndex;
      return `
        <li class="${isWinner ? "is-winner" : ""}">
          <span class="stats__swatch" style="background:${food.color}"></span>
          <span>${food.name}${isWinner ? " · 最多" : ""}</span>
          <span class="stats__count">${count}次</span>
          <span class="stats__pct">${formatPercent(count, stats.trials)}</span>
        </li>
      `;
    })
    .join("");

  drawPieChart(stats);
}

function fitResultTitle() {
  resultTitle.style.fontSize = "";
  const maxSize = Number.parseFloat(getComputedStyle(resultTitle).fontSize);
  let size = maxSize;

  while (resultTitle.scrollWidth > resultTitle.clientWidth && size > 14) {
    size -= 1;
    resultTitle.style.fontSize = `${size}px`;
  }
}

function openResult(food, stats) {
  if (stats) {
    resultEyebrow.textContent = stats.isTie
      ? `${stats.trials} 次并列最多，随机选中`
      : `${stats.trials} 次里出现最多`;
    statsBlock.hidden = false;
    renderStats(stats);
  } else {
    resultEyebrow.textContent = "这顿就吃";
    statsBlock.hidden = true;
    statsLegend.innerHTML = "";
  }

  resultTitle.textContent = food.name;
  resultTitle.style.color = food.color;
  modal.hidden = false;
  requestAnimationFrame(fitResultTitle);
  againBtn.focus();
}

function closeResult() {
  modal.hidden = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");
  drawWheel();
  spinBtn.focus();
}

function animateToIndex(targetIndex, onDone) {
  const current = normalizeAngle(rotation);
  const desired = rotationForIndex(targetIndex);
  const extraTurns = (4 + Math.floor(Math.random() * 3)) * TWO_PI;
  const delta = normalizeAngle(desired - current);
  const totalDelta = extraTurns + delta;
  const duration = prefersReducedMotion ? 400 : 4200;
  const startRotation = rotation;
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = prefersReducedMotion ? progress : easeOutCubic(progress);
    rotation = startRotation + totalDelta * eased;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    rotation = startRotation + totalDelta;
    highlightedIndex = targetIndex;
    canvas.classList.add("is-highlight");
    drawWheel();
    onDone();
  }

  requestAnimationFrame(frame);
}

function openWheel(nextFoods, options = {}) {
  foods = nextFoods;
  catalogMode = options.catalogMode ?? catalogMode;
  rotation = 0;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");
  modal.hidden = true;
  wheelEditBtn.hidden = catalogMode !== "custom";
  wheelTagline.textContent =
    catalogMode === "custom"
      ? `自定义 ${foods.length} 道菜 · 选模式后开转`
      : "固定菜单 · 选模式后开转";
  setSpinMode("normal");
  syncTrialsBounds();
  drawWheel();
  showScreen("wheel");
}

function spin() {
  if (isSpinning || foods.length < MIN_FOODS) return;

  let stats = null;
  let targetIndex;

  if (spinMode === "probability") {
    const trials = parseTrials();
    if (trials === null) {
      trialsInput.focus();
      return;
    }
    stats = runSimulation(trials);
    targetIndex = stats.winnerIndex;
  } else {
    targetIndex = Math.floor(Math.random() * foods.length);
  }

  modal.hidden = true;
  isSpinning = true;
  spinBtn.disabled = true;
  spinModeButtons.forEach((button) => {
    button.disabled = true;
  });
  trialsInput.disabled = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");

  animateToIndex(targetIndex, () => {
    isSpinning = false;
    spinBtn.disabled = false;
    spinModeButtons.forEach((button) => {
      button.disabled = false;
    });
    trialsInput.disabled = false;
    openResult(foods[targetIndex], stats);
  });
}

function composeWheel() {
  const names = collectDraftNames().filter(Boolean);
  if (names.length < MIN_FOODS) {
    setEditHint(`至少需要 ${MIN_FOODS} 道菜`, true);
    return;
  }
  if (names.length > MAX_FOODS) {
    setEditHint(`最多 ${MAX_FOODS} 道菜`, true);
    return;
  }

  saveCustomNames(names);
  openWheel(foodsFromNames(names), { catalogMode: "custom" });
}

document.getElementById("logo-home").addEventListener("click", () => {
  if (isSpinning) return;
  modal.hidden = true;
  showScreen("home");
});

document.getElementById("enter-fixed").addEventListener("click", () => {
  openWheel(cloneDefaultFoods(), { catalogMode: "fixed" });
});

document.getElementById("enter-custom").addEventListener("click", () => {
  catalogMode = "custom";
  renderEditor(loadCustomNames());
  showScreen("edit");
});

document.getElementById("edit-back-home").addEventListener("click", () => {
  showScreen("home");
});

document.getElementById("wheel-back-home").addEventListener("click", () => {
  if (isSpinning) return;
  modal.hidden = true;
  showScreen("home");
});

document.getElementById("wheel-edit").addEventListener("click", () => {
  if (isSpinning) return;
  modal.hidden = true;
  renderEditor(foods.map((food) => food.name));
  showScreen("edit");
});

document.getElementById("add-food").addEventListener("click", () => {
  const names = collectDraftNames();
  if (names.length >= MAX_FOODS) {
    setEditHint(`最多 ${MAX_FOODS} 道菜`, true);
    return;
  }
  names.push("");
  renderEditor(names);
  const inputs = foodListEl.querySelectorAll(".food-item__input");
  inputs[inputs.length - 1]?.focus();
});

document.getElementById("reset-foods").addEventListener("click", () => {
  const names = defaultNames();
  saveCustomNames(names);
  renderEditor(names);
  setEditHint("已恢复默认菜单");
});

document.getElementById("compose-btn").addEventListener("click", composeWheel);

foodListEl.addEventListener("click", (event) => {
  const button = event.target.closest(".food-item__remove");
  if (!button) return;
  const names = collectDraftNames();
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) return;
  names.splice(index, 1);
  renderEditor(names.length ? names : [""]);
});

foodListEl.addEventListener("input", () => {
  setEditHint("");
});

spinModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isSpinning) return;
    setSpinMode(button.dataset.spinMode);
  });
});

trialsInput.addEventListener("input", updateTrialsHint);
spinBtn.addEventListener("click", spin);
againBtn.addEventListener("click", () => {
  modal.hidden = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");
  drawWheel();
  spin();
});

modal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close]")) closeResult();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeResult();
});

showScreen("home");
