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

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spin-btn");
const modal = document.getElementById("result-modal");
const resultTitle = document.getElementById("result-title");
const againBtn = document.getElementById("again-btn");

const TWO_PI = Math.PI * 2;
const segmentAngle = TWO_PI / FOODS.length;
/** Top pointer in canvas space (0 = east, clockwise positive). */
const POINTER_ANGLE = -Math.PI / 2;

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

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function normalizeAngle(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function drawWheel() {
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = width / 2 - 4;

  ctx.clearRect(0, 0, width, height);
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

function getIndexAtPointer(currentRotation) {
  const local = normalizeAngle(POINTER_ANGLE - currentRotation);
  return Math.floor(local / segmentAngle) % FOODS.length;
}

function rotationForIndex(index) {
  const segmentCenter = index * segmentAngle + segmentAngle / 2;
  return normalizeAngle(POINTER_ANGLE - segmentCenter);
}

function openResult(food) {
  resultTitle.textContent = food.name;
  resultTitle.style.color = food.color;
  modal.hidden = false;
  againBtn.focus();
}

function closeResult() {
  modal.hidden = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");
  drawWheel();
  spinBtn.focus();
}

function spin() {
  if (isSpinning) return;

  modal.hidden = true;
  isSpinning = true;
  spinBtn.disabled = true;
  highlightedIndex = -1;
  canvas.classList.remove("is-highlight");

  const targetIndex = Math.floor(Math.random() * FOODS.length);
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
    isSpinning = false;
    spinBtn.disabled = false;
    openResult(FOODS[highlightedIndex]);
  }

  requestAnimationFrame(frame);
}

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

drawWheel();
