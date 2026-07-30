// ColonistLayer.jsx — animated colonist sprites walking the colony
//
// Renders one little pixel person per colonist on a canvas laid over the grid.
// Each one walks to whatever their status says they should be doing: their
// assigned room, the hospital when hurt, the dig face when excavating, the
// barracks when idle. Vertical travel goes through the depth column on the
// left, which doubles as the colony's access shaft.
//
// Why canvas + RAF instead of divs + React state: sprites move at 60fps and the
// sim only ticks every 4s. Driving positions through React would re-render the
// whole app 60 times a second. This component re-renders only when the colonist
// roster or the grid actually changes; motion happens entirely inside the loop.
//
// The canvas is pointerEvents:"none" so clicks fall through to the grid cells
// underneath. Hover is still supported by reading the already-global mousePos
// and hit-testing inside the loop.
//
// Props: colonists, grid, unlockedRows, excavations, gridMetrics, mousePos,
//        onHoverColonist
import { useEffect, useRef } from "react";
import { ROOM_TYPES, STATUS_COLOR, isOnPost } from "../gameData.js";

const COLS = 7;
const ROWS = 4;

// Movement, in pixels per second at 1× game speed.
const WALK_SPEED  = 55;
const CLIMB_SPEED = 38;
// Sprite motion scales with the timescale so a reassignment always takes about
// the same number of ticks — but capped, or 10× turns into a teleport.
const MAX_SPEED_MULT = 5;
// How close counts as arrived.
const ARRIVE_EPS  = 0.75;

// ─── Per-colonist visual identity ────────────────────────────────────────────
// Derived from the colonist id so the same person always looks the same, across
// reloads and saves, without storing anything extra on the colonist.
// Suits are deliberately mid-to-light: these figures sit on top of detailed
// room art, so a dark palette would vanish into it.
const SUITS = [
  "#6b93cf", "#b0762f", "#5fa87a", "#b06a86", "#8383bd",
  "#c69a45", "#4f97b8", "#a4566b", "#7fae4a", "#b3ad5c",
];
const SKINS = ["#e0b183", "#bc8253", "#96633d", "#f0d3ac", "#7a4a2e", "#d0a072"];
const OUTLINE = "#07090e";

/** Darken a #rrggbb by `f` (0–1), used for arms/shading so they read. */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r},${g},${b})`;
}

function hashId(id) {
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function identityFor(id) {
  const h = hashId(id);
  return {
    suit:   SUITS[h % SUITS.length],
    skin:   SKINS[(h >> 4) % SKINS.length],
    hat:    ((h >> 8) % 3) === 0,
    tall:   ((h >> 10) % 2) === 0 ? 1 : 0,
    // Desynchronises walk cycles and idle fidgets between colonists.
    phase:  (h % 628) / 100,
  };
}

// ─── Geometry ────────────────────────────────────────────────────────────────
function makeGeom(m) {
  const cellW = m.cellW || 96;
  const cellH = m.cellH || 78;
  const depth = m.depthCol || 28;
  return {
    cellW, cellH, depth,
    width:  depth + COLS * cellW,
    height: ROWS * cellH,
    shaftX: depth / 2,
    // Feet sit a little above the cell's bottom border.
    floorY: (r) => r * cellH + cellH - 8,
    cellCX: (c) => depth + c * cellW + cellW / 2,
  };
}

/** Spread `count` figures across the middle of a cell so they don't stack. */
function slotX(geom, c, idx, count) {
  const cx = geom.cellCX(c);
  if (count <= 1) return cx;
  const span = geom.cellW * 0.56;
  return cx - span / 2 + (span * idx) / (count - 1);
}

function findRoom(grid, type) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c].type === type && !grid[r][c].damaged) return { r, c };
    }
  }
  return null;
}

/**
 * Where should this colonist be standing, and doing what?
 * Returns null for colonists who aren't in the colony right now.
 */
function resolveDestination(col, ctxData, idx, count) {
  const { grid, geom, excavations, unlockedRows } = ctxData;

  if (col.status === "onExpedition") return null; // topside, off-map

  if (isOnPost(col.status) && col.assignedRoom) {
    const { r, c } = col.assignedRoom;
    const cell = grid[r]?.[c];
    if (cell?.type) {
      return {
        x: slotX(geom, c, idx, count),
        y: geom.floorY(r),
        act: col.status === "onSentry" ? "guard" : "work",
        roomType: cell.type,
      };
    }
  }

  if (col.status === "injured") {
    const hosp = findRoom(grid, "hospital");
    if (hosp) {
      return { x: slotX(geom, hosp.c, idx, count), y: geom.floorY(hosp.r), act: "bed" };
    }
    const bunk = findRoom(grid, "barracks");
    if (bunk) {
      return { x: slotX(geom, bunk.c, idx, count), y: geom.floorY(bunk.r), act: "bed" };
    }
    return { x: geom.shaftX, y: geom.floorY(0), act: "bed" };
  }

  if (col.status === "sheltered") {
    const sh = findRoom(grid, "shelter") ?? findRoom(grid, "barracks");
    if (sh) {
      return { x: slotX(geom, sh.c, idx, count), y: geom.floorY(sh.r), act: "crouch" };
    }
    return { x: geom.shaftX, y: geom.floorY(0), act: "crouch" };
  }

  if (col.status === "excavating") {
    // Work the face of whichever row is being dug out.
    const digRow = Object.keys(excavations)
      .map(Number)
      .sort((a, b) => a - b)
      .find(r => excavations[r]);
    const r = digRow ?? Math.min(ROWS - 1, unlockedRows.length);
    // Dig outward from the access shaft, so the face is the column nearest it.
    // (Putting it mid-row made diggers cross the whole colony and back.)
    return {
      x: slotX(geom, 0, idx, count),
      y: geom.floorY(r),
      act: "dig",
    };
  }

  // Idle: hang around the barracks if there is one, otherwise loiter at the
  // foot of the shaft.
  const bunk = findRoom(grid, "barracks");
  if (bunk) {
    return { x: slotX(geom, bunk.c, idx, count), y: geom.floorY(bunk.r), act: "idle" };
  }
  const deepest = Math.max(0, ...unlockedRows);
  return {
    x: geom.shaftX,
    y: geom.floorY(Math.min(deepest, idx)),
    act: "idle",
  };
}

/**
 * Waypoints from where the agent is to where it needs to be. Horizontal travel
 * happens on a floor; vertical travel happens in the shaft.
 */
function routeTo(agent, dest, geom) {
  const curRow = Math.round((agent.y - geom.cellH + 8) / geom.cellH);
  const dstRow = Math.round((dest.y - geom.cellH + 8) / geom.cellH);
  if (curRow === dstRow) return [{ x: dest.x, y: dest.y }];
  return [
    { x: geom.shaftX, y: agent.y },  // walk to the shaft
    { x: geom.shaftX, y: dest.y },   // climb to the target floor
    { x: dest.x,      y: dest.y },   // walk to the spot
  ];
}

// ─── Sprite drawing ──────────────────────────────────────────────────────────
// Built as a parts list so the whole figure can be stroked once as a silhouette
// before anything is filled. Without that outline these read as coloured smudges
// on top of the pixel-art room interiors.
export function drawColonist(ctx, a, t) {
  const { ident } = a;
  const bodyH  = 11 + ident.tall;
  const legH   = 6;
  const walking = a.moving;
  const cycle = walking ? Math.sin(t * 9 + ident.phase) : 0;
  const bob   = walking ? Math.abs(Math.sin(t * 9 + ident.phase)) * 0.9
                        : Math.sin(t * 1.6 + ident.phase) * 0.45;
  const face  = a.facing; // 1 = right, -1 = left

  const suit   = ident.suit;
  const sleeve = shade(suit, 0.32);   // arms, so they separate from the torso
  const trouser = "#4a5364";          // mid-tone: legs must not vanish into the dark
  const boot    = "#2b313c";

  ctx.save();
  ctx.translate(a.x, a.y - bob);

  // Status ring on the floor — the fastest read of what someone is doing.
  const ring = STATUS_COLOR[a.status] ?? "#8899aa";
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 7, 2.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = `${ring}40`;
  ctx.fill();
  ctx.strokeStyle = `${ring}99`;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  if (a.act === "bed") {
    // Dedicated lying pose. Rotating the standing figure made it sprawl out of
    // its cell and overlap the neighbours, so this is drawn flat and compact,
    // sized to stay inside one room.
    const breathe = Math.sin(t * 1.3 + ident.phase) * 0.35;
    const bodyW = 9.5;
    const headX = face > 0 ? bodyW * 0.5 + 2.6 : -bodyW * 0.5 - 2.6;

    ctx.fillStyle = OUTLINE;                              // cot
    ctx.fillRect(-bodyW - 3.4, -5.4, bodyW * 2 + 6.8, 5.6);
    ctx.fillStyle = "#20262f";
    ctx.fillRect(-bodyW - 2.8, -4.9, bodyW * 2 + 5.6, 4.6);

    ctx.fillStyle = OUTLINE;                              // torso under blanket
    ctx.fillRect(-bodyW - 0.9, -4.6 - breathe, bodyW * 2 + 1.8, 3.6);
    ctx.fillStyle = shade(suit, 0.15);
    ctx.fillRect(-bodyW, -4.2 - breathe, bodyW * 2, 2.9);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(-bodyW, -4.2 - breathe, bodyW * 2, 0.9);

    ctx.fillStyle = OUTLINE;                              // head on the pillow
    ctx.beginPath();
    ctx.arc(headX, -5.0, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ident.skin;
    ctx.beginPath();
    ctx.arc(headX, -5.0, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#ff5555";                            // casualty marker
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("✚", a.x, a.y - 13);
    return;
  }

  if (a.act === "crouch") {
    ctx.translate(0, 4);
    ctx.scale(1, 0.72);
  }

  const legSwing = cycle * 2.4;
  const armSwing = a.act === "work" ? Math.sin(t * 7 + ident.phase) * 2.6
                 : a.act === "dig"  ? Math.sin(t * 5 + ident.phase) * 3.4
                 : -cycle * 2.2;
  const headCY = -legH - bodyH - 3.6;

  // Back-to-front parts list. Arms first so the torso overlaps them.
  const parts = [
    { c: sleeve,  x: -5.2, y: -legH - bodyH + 2 + armSwing * 0.35, w: 2.1, h: 6.4 },
    { c: sleeve,  x:  3.1, y: -legH - bodyH + 2 - armSwing * 0.35, w: 2.1, h: 6.4 },
    { c: trouser, x: -3.0, y: -legH,     w: 2.5, h: legH + legSwing * 0.35 },
    { c: trouser, x:  0.5, y: -legH,     w: 2.5, h: legH - legSwing * 0.35 },
    { c: boot,    x: -3.2 + (walking ? legSwing * 0.5 : 0), y: -1.5, w: 2.9, h: 1.6 },
    { c: boot,    x:  0.3 - (walking ? legSwing * 0.5 : 0), y: -1.5, w: 2.9, h: 1.6 },
    { c: suit,    x: -3.6, y: -legH - bodyH, w: 7.2, h: bodyH },
  ];

  // Silhouette pass — every part inflated by ~0.9px in near-black.
  ctx.fillStyle = OUTLINE;
  parts.forEach(p => ctx.fillRect(p.x - 0.9, p.y - 0.9, p.w + 1.8, p.h + 1.8));
  ctx.beginPath();
  ctx.arc(0, headCY, 4.1, 0, Math.PI * 2);
  ctx.fill();

  // Fill pass.
  parts.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.w, p.h); });

  // Collar + belt, so the torso isn't a flat slab.
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(-3.6, -legH - bodyH, 7.2, 1.6);
  ctx.fillStyle = shade(suit, 0.45);
  ctx.fillRect(-3.6, -legH - 2.2, 7.2, 1.5);

  // Head
  ctx.fillStyle = ident.skin;
  ctx.beginPath();
  ctx.arc(0, headCY, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // Eye — small, but it's what makes the facing direction legible.
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(face > 0 ? 0.7 : -2.0, headCY - 0.9, 1.3, 1.4);

  if (ident.hat) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(-4.4, headCY - 5.0, 8.8, 2.9);
    ctx.fillStyle = shade(suit, 0.55);
    ctx.fillRect(-3.8, headCY - 4.6, 7.6, 2.1);
    ctx.fillRect(face > 0 ? 0 : -4.2, headCY - 2.9, 4.2, 1.0);
  }

  // Tools and per-activity flourishes.
  if (a.act === "dig") {
    const sw = Math.sin(t * 5 + ident.phase) * 0.9;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(face * 4.0, headCY + 6);
    ctx.lineTo(face * (10 + sw * 2), headCY + 9 + sw * 4);
    ctx.stroke();
    ctx.strokeStyle = "#c98a3a";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (a.act === "guard") {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(face > 0 ? 3.4 : -10.4, headCY + 4.2, 7, 2.6);
    ctx.fillStyle = "#5b6472";
    ctx.fillRect(face > 0 ? 3.8 : -10.0, headCY + 4.6, 6.2, 1.7);
  } else if (a.act === "work") {
    // A spark at the workstation on the up-beat of the arm swing.
    if (Math.sin(t * 7 + ident.phase) > 0.8) {
      ctx.fillStyle = "rgba(255,225,140,0.9)";
      ctx.beginPath();
      ctx.arc(face * 6.2, headCY + 7, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // Injured colonists get an unmissable marker.
  if (a.status === "injured") {
    ctx.fillStyle = "#ff5555";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("✚", a.x, a.y - bodyH - legH - 10);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ColonistLayer({
  colonists, grid, unlockedRows, excavations, gridMetrics,
  mousePos, onHoverColonist, hoveredColonist, timescale,
}) {
  const canvasRef = useRef(null);
  const timescaleRef = useRef(timescale);
  const agentsRef = useRef(new Map());   // id → agent
  const destRef   = useRef(new Map());   // id → destination (recomputed on data change)
  const geomRef   = useRef(makeGeom(gridMetrics));
  const mouseRef  = useRef(mousePos);
  const hoverRef  = useRef(hoveredColonist);
  const hoverCbRef = useRef(onHoverColonist);

  // Mirror fast-changing props into refs so the loop can read them without
  // being re-created (and without putting mousePos in an effect dep array).
  useEffect(() => { mouseRef.current   = mousePos;        }, [mousePos]);
  useEffect(() => { hoverRef.current   = hoveredColonist; }, [hoveredColonist]);
  useEffect(() => { hoverCbRef.current = onHoverColonist; }, [onHoverColonist]);
  useEffect(() => { geomRef.current    = makeGeom(gridMetrics); }, [gridMetrics]);
  useEffect(() => { timescaleRef.current = timescale;           }, [timescale]);

  // Recompute destinations whenever the sim state that decides them changes.
  useEffect(() => {
    const geom = geomRef.current;
    const ctxData = { grid, geom, excavations, unlockedRows };

    // Group colonists by where they're headed so co-located figures get
    // distinct slots instead of standing inside each other.
    const groups = new Map();
    colonists.forEach(col => {
      const key = isOnPost(col.status) && col.assignedRoom
        ? `room:${col.assignedRoom.r}-${col.assignedRoom.c}`
        : `status:${col.status}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(col);
    });

    const dests = new Map();
    groups.forEach(members => {
      members.forEach((col, i) => {
        const d = resolveDestination(col, ctxData, i, members.length);
        if (d) dests.set(col.id, { ...d, status: col.status, name: col.name });
      });
    });
    destRef.current = dests;

    // Spawn agents for new colonists directly at their post, so nobody slides
    // in from the corner on load. Drop agents for colonists who are gone.
    const agents = agentsRef.current;
    dests.forEach((d, id) => {
      if (!agents.has(id)) {
        agents.set(id, {
          id, x: d.x, y: d.y, facing: 1, moving: false,
          act: d.act, status: d.status, name: d.name,
          route: [], ident: identityFor(id),
        });
      }
    });
    [...agents.keys()].forEach(id => { if (!dests.has(id)) agents.delete(id); });
  }, [colonists, grid, unlockedRows, excavations]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let dprApplied = 0;

    // Match the backing store to the display density, otherwise these small
    // figures turn to mush on a HiDPI screen. Re-checked each frame because the
    // window can move between monitors.
    const syncResolution = (geom) => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (dprApplied === dpr && canvas.width === Math.round(geom.width * dpr)) return;
      dprApplied = dpr;
      canvas.width  = Math.round(geom.width  * dpr);
      canvas.height = Math.round(geom.height * dpr);
      canvas.style.width  = `${geom.width}px`;
      canvas.style.height = `${geom.height}px`;
    };

    const loop = (now) => {
      const realDt = Math.min(0.05, (now - last) / 1000); // clamp tab-switch jumps
      last = now;
      // Paused game → frozen colony. Faster game → faster colonists, so a walk
      // still costs roughly the same number of ticks at any timescale.
      const speedMult = Math.min(MAX_SPEED_MULT, timescaleRef.current);
      const dt = realDt * speedMult;
      const t = now / 1000;
      const geom = geomRef.current;
      const agents = agentsRef.current;
      const dests = destRef.current;

      syncResolution(geom);
      ctx.setTransform(dprApplied, 0, 0, dprApplied, 0, 0);
      ctx.clearRect(0, 0, geom.width, geom.height);

      // Shaft backdrop — rungs, so the depth column reads as a real ladder the
      // colonists are climbing rather than a label strip.
      ctx.strokeStyle = "rgba(90,120,150,0.16)";
      ctx.lineWidth = 1;
      for (let y = 6; y < geom.height; y += 7) {
        ctx.beginPath();
        ctx.moveTo(geom.shaftX - 6, y);
        ctx.lineTo(geom.shaftX + 6, y);
        ctx.stroke();
      }

      agents.forEach(agent => {
        const dest = dests.get(agent.id);
        if (!dest) return;
        agent.status = dest.status;
        agent.name   = dest.name;

        // Re-route when the destination has moved.
        const target = agent.route.length ? agent.route[agent.route.length - 1] : null;
        if (!target || Math.abs(target.x - dest.x) > 0.5 || Math.abs(target.y - dest.y) > 0.5) {
          agent.route = routeTo(agent, dest, geom);
        }

        if (agent.route.length) {
          const wp = agent.route[0];
          const dx = wp.x - agent.x;
          const dy = wp.y - agent.y;
          // Climbing legs of the route are vertical; everything else is a walk.
          const vertical = Math.abs(dy) > Math.abs(dx);
          const speed = vertical ? CLIMB_SPEED : WALK_SPEED;
          const dist = Math.hypot(dx, dy);
          if (dist <= ARRIVE_EPS) {
            agent.x = wp.x; agent.y = wp.y;
            agent.route.shift();
            agent.moving = agent.route.length > 0;
          } else {
            const step = Math.min(dist, speed * dt);
            agent.x += (dx / dist) * step;
            agent.y += (dy / dist) * step;
            agent.moving = true;
            if (Math.abs(dx) > 0.3) agent.facing = dx > 0 ? 1 : -1;
          }
          // While travelling, show the walk pose rather than the destination's.
          agent.act = agent.route.length ? "walk" : dest.act;
        } else {
          agent.moving = false;
          agent.act = dest.act;
        }

        drawColonist(ctx, agent, t);
      });

      // ── Hover hit-test ──
      // Read the shared mouse position rather than taking pointer events, so
      // clicks continue to reach the grid cells beneath this canvas.
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width ? geom.width / rect.width : 1;
      const mx = (mouseRef.current.x - rect.left) * scale;
      const my = (mouseRef.current.y - rect.top) * scale;
      let hit = null;
      if (mx >= 0 && my >= 0 && mx <= geom.width && my <= geom.height) {
        let best = 13; // px, in canvas space
        agents.forEach(a => {
          const d = Math.hypot(a.x - mx, (a.y - 9) - my);
          if (d < best) { best = d; hit = a.id; }
        });
      }
      if (hit !== hoverRef.current && hoverCbRef.current) {
        // Only claim/release hover for sprites; never clobber a roster hover.
        if (hit || agentsRef.current.has(hoverRef.current)) {
          hoverRef.current = hit;
          hoverCbRef.current(hit);
        }
      }

      // Name tag for whoever is hovered.
      if (hoverRef.current) {
        const a = agents.get(hoverRef.current);
        if (a) {
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          const w = ctx.measureText(a.name).width + 6;
          ctx.fillStyle = "rgba(6,10,18,0.9)";
          ctx.fillRect(a.x - w / 2, a.y - 30, w, 9);
          ctx.strokeStyle = `${STATUS_COLOR[a.status] ?? "#889"}88`;
          ctx.lineWidth = 0.7;
          ctx.strokeRect(a.x - w / 2, a.y - 30, w, 9);
          ctx.fillStyle = "#c8d0d8";
          ctx.fillText(a.name, a.x, a.y - 23);
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const geom = makeGeom(gridMetrics);
  return (
    // Backing-store size is owned by syncResolution() in the loop, so it isn't
    // set here — a React re-render would otherwise wipe the HiDPI scaling.
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", top: 0, left: 0,
        width: geom.width, height: geom.height,
        zIndex: 6,
        pointerEvents: "none", // clicks belong to the grid cells underneath
      }}
    />
  );
}
