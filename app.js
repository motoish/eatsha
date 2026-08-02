const FOODS = [
  { name: "泰国菜", color: "#E85A3A" },
  { name: "とりき", color: "#F0A830" },
  { name: "麦麦", color: "#D62828" },
  { name: "卡夫西", color: "#8B5E3C" },
  { name: "モスバーガー", color: "#5AA05A" },
  { name: "満州", color: "#C43C4E" },
  { name: "池袋中餐", color: "#E0A21B" },
  { name: "超市便当", color: "#2F9E9E" },
  { name: "泡面", color: "#F07820" },
  { name: "自己做", color: "#6B8F3C" },
  { name: "居酒屋", color: "#3D6B9A" },
];

const MIN_TRIALS = FOODS.length + 1;
const MAX_TRIALS = 9999;
const DEFAULT_TRIALS = 1000;

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
const modeButtons = document.querySelectorAll(".mode-btn");

const TWO_PI = Math.PI * 2;
const segmentAngle = TWO_PI / FOODS.length;
const POINTER_ANGLE = -Math.PI / 2;

let mode = "normal";
let rotation = 0;
let isSpinning = false;
let highlightedIndex = -1;
let lastStats = null;
let prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", (event) => {
    prefersReducedMotion = event.matches;
  });

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function normalizeAngle(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function drawWheel() {
  const { width } = canvas;
  const cx = width / 2;
  const cy = width / 2;
  const radius = width / 2 - 4;

  ctx.clearRect(0, 0, width, width);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  FOODS.forEach((food, index) => {
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
      ctx.strokeStyle = "#fff8f1";
      ctx.stroke();
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(26, 18, 12, 0.35)";
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(mid);
    const screenAngle = normalizeAngle(mid + rotation);
    const isFlipped = screenAngle > Math.PI / 2 && screenAngle < (Math.PI * 3) / 2;
    if (isFlipped) {
      ctx.rotate(Math.PI);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff8f1";
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 4;

    const labelRadius = isFlipped ? -radius * 0.62 : radius * 0.62;
    const maxWidth = radius * segmentAngle * 0.72;
    fitAndFillText(food.name, labelRadius, 0, maxWidth);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.14, 0, TWO_PI);
  ctx.fillStyle = "#1a120c";
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
  const segmentCenter = index * segmentAngle + segmentAngle / 2;
  return normalizeAngle(POINTER_ANGLE - segmentCenter);
}

function setMode(nextMode) {
  mode = nextMode;
  const isProbability = mode === "probability";

  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  trialsField.hidden = !isProbability;
  if (isProbability) {
    trialsInput.focus();
  }
}

function parseTrials() {
  const raw = trialsInput.value.trim();
  const value = Number.parseInt(raw, 10);

  if (!Number.isFinite(value) || value < MIN_TRIALS || value > MAX_TRIALS) {
    trialsInput.classList.add("is-invalid");
    return null;
  }

  trialsInput.classList.remove("is-invalid");
  trialsInput.value = String(value);
  return value;
}

function runSimulation(trials) {
  const counts = Array(FOODS.length).fill(0);

  for (let i = 0; i < trials; i += 1) {
    const index = Math.floor(Math.random() * FOODS.length);
    counts[index] += 1;
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

    if (count === maxCount) {
      winners.push(index);
    }
  });

  const winnerIndex = winners[Math.floor(Math.random() * winners.length)];

  return {
    trials,
    counts,
    winnerIndex,
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

  FOODS.forEach((food, index) => {
    const count = stats.counts[index];
    if (count <= 0) return;

    const slice = (count / stats.trials) * TWO_PI;
    pieCtx.beginPath();
    pieCtx.moveTo(cx, cy);
    pieCtx.arc(cx, cy, radius, angle, angle + slice);
    pieCtx.closePath();
    pieCtx.fillStyle = food.color;
    pieCtx.fill();
    pieCtx.strokeStyle = "rgba(26, 18, 12, 0.35)";
    pieCtx.lineWidth = 2;
    pieCtx.stroke();
    angle += slice;
  });

  pieCtx.beginPath();
  pieCtx.arc(cx, cy, radius * 0.42, 0, TWO_PI);
  pieCtx.fillStyle = "#2a1a12";
  pieCtx.fill();

  pieCtx.fillStyle = "#fff8f1";
  pieCtx.font = `700 ${Math.round(width * 0.09)}px Fredoka, "Noto Sans SC", sans-serif`;
  pieCtx.textAlign = "center";
  pieCtx.textBaseline = "middle";
  pieCtx.fillText(`${stats.trials}`, cx, cy - width * 0.035);
  pieCtx.font = `500 ${Math.round(width * 0.055)}px "Noto Sans SC", sans-serif`;
  pieCtx.fillStyle = "rgba(255, 248, 241, 0.72)";
  pieCtx.fillText("次", cx, cy + width * 0.055);
}

function renderStats(stats) {
  const ranked = FOODS.map((food, index) => ({
    food,
    index,
    count: stats.counts[index],
  })).sort((a, b) => b.count - a.count || a.index - b.index);

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

function openResult(food, stats) {
  lastStats = stats;

  if (stats) {
    resultEyebrow.textContent = stats.isTie
      ? `${stats.trials} 次并列最多，随机选中`
      : `${stats.trials} 次里出现最多`;
    statsBlock.hidden = false;
    renderStats(stats);
  } else {
    resultEyebrow.textContent = "今天就吃";
    statsBlock.hidden = true;
    statsLegend.innerHTML = "";
  }

  resultTitle.textContent = food.name;
  resultTitle.style.color = food.color;
  modal.hidden = false;
  againBtn.focus();
}

function closeResult() {
  modal.hidden = true;
  highlightedIndex = -1;
  lastStats = null;
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

function spin() {
  if (isSpinning) return;

  let stats = null;
  let targetIndex;

  if (mode === "probability") {
    const trials = parseTrials();
    if (trials === null) {
      trialsInput.focus();
      return;
    }
    stats = runSimulation(trials);
    targetIndex = stats.winnerIndex;
  } else {
    targetIndex = Math.floor(Math.random() * FOODS.length);
  }

  modal.hidden = true;
  isSpinning = true;
  spinBtn.disabled = true;
  modeButtons.forEach((button) => {
    button.disabled = true;
  });
  trialsInput.disabled = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");

  animateToIndex(targetIndex, () => {
    isSpinning = false;
    spinBtn.disabled = false;
    modeButtons.forEach((button) => {
      button.disabled = false;
    });
    trialsInput.disabled = false;
    openResult(FOODS[targetIndex], stats);
  });
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isSpinning) return;
    setMode(button.dataset.mode);
  });
});

trialsInput.addEventListener("input", () => {
  trialsInput.classList.remove("is-invalid");
});

spinBtn.addEventListener("click", spin);
againBtn.addEventListener("click", () => {
  modal.hidden = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");
  drawWheel();
  spin();
});

modal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close]")) {
    closeResult();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeResult();
  }
});

trialsInput.min = String(MIN_TRIALS);
trialsInput.value = String(Math.max(DEFAULT_TRIALS, MIN_TRIALS));
drawWheel();
