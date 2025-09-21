// board.js — canvas & tools
import { swarm } from "./app.js";
import b4a from "b4a";

let _squelchSend = false;
let _replayingRemote = false;

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("board")
);
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const colorInput = /** @type {HTMLInputElement} */ (
  document.getElementById("color")
);
const sizeInput = /** @type {HTMLInputElement} */ (
  document.getElementById("size")
);
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const clearBtn = document.getElementById("clear");
const saveBtn = document.getElementById("save");

let tool = "pen";
let drawing = false;
let last = null;
let strokeColor = colorInput?.value || "#111111";
let strokeSize = Number(sizeInput?.value || 6);

const history = [];
const future = [];

function snapshot() {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.push(img);
  if (history.length > 50) history.shift();
  future.length = 0;
}

function restore(img) {
  if (!img) return;
  ctx.putImageData(img, 0, 0);
}

const sendStroke = (type, data) => {
  if (_squelchSend) return;
  const msgString = b4a.from(JSON.stringify({ type, data }));

  const peers = [...swarm.connections];
  for (const peer of peers) peer.write(msgString);
};

// ---------- Local drawing ----------
function beginStroke(x, y, opt = {}) {
  console.log("OPT Line 55 : ", opt);
  drawing = true;
  last = { x, y };
  strokeColor = opt?.color ?? strokeColor;
  strokeSize = opt?.size ?? strokeSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : strokeColor;
  ctx.lineWidth = strokeSize;
  ctx.beginPath();
  ctx.moveTo(x, y);

  if (!_replayingRemote) {
    sendStroke("begin", {
      x,
      y,
      strokeColor: strokeColor,
      strokeSize: strokeSize,
      tool: tool,
    });
  }
}

function continueStroke(x, y) {
  if (!drawing) return;
  ctx.lineTo(x, y);
  ctx.stroke();
  last = { x, y };
  if (!_replayingRemote) {
    sendStroke("draw", { x, y });
  }
}

function endStroke(x, y) {
  if (!drawing) return;
  continueStroke(x, y);
  ctx.closePath();
  drawing = false;
  if (!_replayingRemote) {
    sendStroke("end", { x, y });
  }
}

// ---------- Remote strokes ----------

export function onRemoteStroke(type, data) {
  _squelchSend = true;
  _replayingRemote = true;

  const prevColor =
    typeof strokeColor !== "undefined" ? strokeColor : undefined;
  const prevSize = typeof strokeSize !== "undefined" ? strokeSize : undefined;
  const prevTool = typeof tool !== "undefined" ? tool : undefined;

  try {
    if (type === "begin") {
      if (typeof data?.color !== "undefined") strokeColor = data.color;
      if (typeof data?.size !== "undefined") strokeSize = data.size;
      if (typeof data?.tool !== "undefined") tool = data.tool;

      const opt = { color: data.color, size: data.size, tool: data.tool };
      if (data.tool === "eraser") console.log("Eraser");
      console.log("OPT Line 110 : ", opt);
      beginStroke(data.x, data.y, opt);
    } else if (type === "draw") {
      continueStroke(data.x, data.y);
    } else if (type === "end") {
      endStroke(data.x, data.y);
    }
  } finally {
    if (typeof prevColor !== "undefined") strokeColor = prevColor;
    if (typeof prevSize !== "undefined") strokeSize = prevSize;
    if (typeof prevTool !== "undefined") tool = prevTool;

    _squelchSend = false;
  }
}

// ---------- Input handling ----------
function posFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
    };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function localBegin(e) {
  e.preventDefault();
  const { x, y } = posFromEvent(e);
  snapshot();
  beginStroke(x, y, { color: strokeColor, size: strokeSize, tool: tool });
  sendStroke("begin", {
    x,
    y,
    color: strokeColor,
    size: strokeSize,
    tool: tool,
  });
}

function localMove(e) {
  if (!drawing) return;
  const { x, y } = posFromEvent(e);
  continueStroke(x, y);
  sendStroke("draw", { x, y });
}

function localEnd(e) {
  if (!drawing) return;
  const { x, y } = posFromEvent(e);
  endStroke(x, y);
  sendStroke("end", { x, y });
}

canvas.addEventListener("mousedown", localBegin);
canvas.addEventListener("mousemove", localMove);
window.addEventListener("mouseup", localEnd);

canvas.addEventListener("touchstart", localBegin, { passive: false });
canvas.addEventListener("touchmove", localMove, { passive: false });
window.addEventListener("touchend", localEnd);

// tools
document.getElementById("tools")?.addEventListener("click", (e) => {
  const btn = /** @type {HTMLElement} */ (e.target.closest("[data-tool]"));
  if (!btn) return;
  tool = btn.getAttribute("data-tool");
  document
    .querySelectorAll("#tools .btn")
    .forEach((b) => b.classList.toggle("active", b === btn));
});

// color/size
colorInput?.addEventListener("input", (e) => {
  strokeColor = e.target.value;
});
sizeInput?.addEventListener("input", (e) => {
  strokeSize = Number(e.target.value);
});

// undo/redo/clear/save
undoBtn?.addEventListener("click", () => {
  const img = history.pop();
  if (!img) return;
  future.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  restore(img);
});
redoBtn?.addEventListener("click", () => {
  const img = future.pop();
  if (!img) return;
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  restore(img);
});
clearBtn?.addEventListener("click", () => {
  snapshot();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
saveBtn?.addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "whiteboard.png";
  a.click();
});

// basic resize handling
function resizeCanvasToDisplaySize() {
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== width || canvas.height !== height) {
    const prev = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = Math.max(640, Math.floor(width));
    canvas.height = Math.max(360, Math.floor(height));
    ctx.putImageData(prev, 0, 0);
  }
}
new ResizeObserver(resizeCanvasToDisplaySize).observe(canvas);

// keyboard shortcuts
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.shiftKey ? redoBtn?.click() : undoBtn?.click();
  }
});
