// spritePreview.jsx — dev-only harness for the colonist sprite art.
//
// Renders every activity/status combination side by side, both idle and walking,
// at a magnified scale, so art changes can be judged without driving the live
// game into each state first. Entry point is /sprites.html; nothing here is
// imported by the game.
import { drawColonist, identityFor } from "./components/ColonistLayer.jsx";

const SCALE = 6;
const CELL_W = 34;
const CELL_H = 40;

// One column per pose; two rows (standing / walking).
const POSES = [
  { act: "idle",   status: "idle",         label: "IDLE" },
  { act: "work",   status: "working",      label: "WORKING" },
  { act: "guard",  status: "onSentry",     label: "SENTRY" },
  { act: "dig",    status: "excavating",   label: "DIGGING" },
  { act: "bed",    status: "injured",      label: "INJURED" },
  { act: "crouch", status: "sheltered",    label: "SHELTERED" },
  { act: "walk",   status: "working",      label: "IN TRANSIT" },
];

// A spread of ids so the palette/height/hat variation is visible.
const IDS = ["c0", "c1", "c2", "c7", "c11", "c19", "c23", "c31"];

const root = document.getElementById("root");
const canvas = document.createElement("canvas");
const cols = POSES.length;
const rows = IDS.length;
canvas.width  = (cols * CELL_W) * SCALE;
canvas.height = (rows * CELL_H + 14) * SCALE;
canvas.style.width  = `${cols * CELL_W * 2}px`;
canvas.style.imageRendering = "pixelated";
root.appendChild(canvas);

const info = document.createElement("div");
info.style.padding = "8px 12px";
info.textContent =
  "colonist sprite sheet — columns: " + POSES.map(p => p.label).join(" · ") +
  "   |   rows: distinct colonist ids (palette / height / hat variation)";
root.appendChild(info);

const ctx = canvas.getContext("2d");

function frame(now) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  // Column headers.
  ctx.font = "bold 5px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#4a6a8a";
  POSES.forEach((p, i) => {
    ctx.fillText(p.label, i * CELL_W + CELL_W / 2, 8);
  });

  // Cell backgrounds + floor lines, so feet placement is checkable.
  IDS.forEach((_, r) => {
    POSES.forEach((_, c) => {
      const x = c * CELL_W;
      const y = 14 + r * CELL_H;
      ctx.fillStyle = (r + c) % 2 ? "rgba(255,255,255,0.022)" : "rgba(255,255,255,0.045)";
      ctx.fillRect(x, y, CELL_W, CELL_H);
      ctx.strokeStyle = "rgba(120,160,200,0.22)";
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y + CELL_H - 8);
      ctx.lineTo(x + CELL_W, y + CELL_H - 8);
      ctx.stroke();
    });
  });

  IDS.forEach((id, r) => {
    POSES.forEach((pose, c) => {
      const agent = {
        id, name: id.toUpperCase(),
        x: c * CELL_W + CELL_W / 2,
        y: 14 + r * CELL_H + CELL_H - 8,
        facing: c % 2 === 0 ? 1 : -1,
        moving: pose.act === "walk",
        act: pose.act,
        status: pose.status,
        route: [],
        ident: identityFor(id),
      };
      drawColonist(ctx, agent, t);
    });
  });

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
