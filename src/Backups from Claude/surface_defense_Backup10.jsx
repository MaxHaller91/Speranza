import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const W = 800;
const H = 180; // surface area height
const GROUND_Y = 130; // where feet touch
const HATCH_X = W / 2;
const HATCH_W = 40;

const DEFENSE_TYPES = {
  turret: {
    label: "TURRET",
    cost: 30,
    hp: 60, maxHp: 60,
    range: 140,
    damage: 12,
    fireRate: 40, // ticks between shots
    color: "#4ab3f4",
    width: 18, height: 32,
  },
  barricade: {
    label: "BARRICADE",
    cost: 15,
    hp: 120, maxHp: 120,
    range: 0,
    damage: 0,
    fireRate: 999,
    color: "#8b7355",
    width: 14, height: 28,
  },
  missile: {
    label: "MISSILE",
    cost: 50,
    hp: 40, maxHp: 40,
    range: 220,
    damage: 35,
    fireRate: 90,
    color: "#e85d04",
    width: 14, height: 40,
  },
};

const ENEMY_TYPES = {
  grunt: { hp: 40, maxHp: 40, speed: 0.5, damage: 8, reward: 10, w: 12, color: "#cc2200" },
  heavy: { hp: 120, maxHp: 120, speed: 0.25, damage: 20, reward: 25, w: 18, color: "#880000" },
  runner: { hp: 20, maxHp: 20, speed: 1.1, damage: 5, reward: 8, w: 10, color: "#ff4400" },
};


// Raid sizes: small=3 waves, medium=5 waves, large=8 waves
const RAID_SIZES = { small: 3, medium: 5, large: 8 };

function generateWave(waveIdx) {
  const w = waveIdx;
  const groups = [];
  const gruntCount = 2 + Math.floor(w * 1.5);
  groups.push({ type: "grunt", side: "right", count: gruntCount, interval: Math.max(20, 55 - w * 4) });
  if (w >= 1) groups.push({ type: "grunt", side: "left", count: Math.ceil(gruntCount * 0.6), interval: Math.max(25, 60 - w * 4) });
  if (w >= 2) groups.push({ type: "runner", side: w % 2 === 0 ? "right" : "left", count: 1 + Math.floor((w - 1) * 0.8), interval: Math.max(18, 40 - w * 3) });
  if (w >= 3) { const h = Math.floor((w - 2) * 0.6); if (h > 0) groups.push({ type: "heavy", side: "right", count: h, interval: Math.max(60, 100 - w * 5) }); }
  if (w >= 5) groups.push({ type: "heavy", side: "left", count: 1 + Math.floor((w - 4) * 0.4), interval: 80 });
  if (w >= 7) {
    groups.push({ type: "runner", side: "left", count: 3 + Math.floor((w - 6) * 0.5), interval: 15 });
    groups.push({ type: "runner", side: "right", count: 3 + Math.floor((w - 6) * 0.5), interval: 15 });
  }
  return groups;
}

let eid = 0;
let bid = 0;
let pid = 0;

function makeEnemy(side, type = "grunt") {
  const def = ENEMY_TYPES[type];
  return {
    id: eid++, type,
    x: side === "left" ? -20 : W + 20,
    y: GROUND_Y,
    dir: side === "left" ? 1 : -1,
    hp: def.hp, maxHp: def.maxHp,
    speed: def.speed, damage: def.damage, reward: def.reward, w: def.w,
    color: def.color,
    attackCooldown: 0,
    hatchCooldown: 0,
    dead: false,
  };
}

function makeDefense(x, type) {
  const def = DEFENSE_TYPES[type];
  return {
    id: bid++, type, x,
    y: GROUND_Y,
    hp: def.hp, maxHp: def.maxHp,
    range: def.range, damage: def.damage,
    fireRate: def.fireRate, fireCooldown: 0,
    color: def.color,
    width: def.width, height: def.height,
    dead: false,
  };
}

function makeProjectile(sx, sy, tx, ty, damage, color) {
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = 5;
  return {
    id: pid++, x: sx, y: sy,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    damage, color,
    dead: false,
  };
}

const WAVES = [
  [{ type: "grunt", side: "right", count: 4, interval: 60 }],
  [{ type: "grunt", side: "right", count: 3, interval: 50 }, { type: "grunt", side: "left", count: 2, interval: 80 }],
  [{ type: "grunt", side: "right", count: 3, interval: 40 }, { type: "runner", side: "left", count: 3, interval: 45 }, { type: "heavy", side: "right", count: 1, interval: 120 }],
  [{ type: "heavy", side: "left", count: 2, interval: 100 }, { type: "runner", side: "right", count: 5, interval: 30 }, { type: "grunt", side: "left", count: 4, interval: 50 }],
];

export default function SurfaceDefense({ scrap: initialScrap = 80, onScrapChange, raidSize: initialRaidSize = "medium", dLost }) {
  const [phase, setPhase] = useState("prep"); // prep | combat | won | lost
  const [scrap, setScrap] = useState(initialScrap);
  const [hatchHp, setHatchHp] = useState(100);
  const [selectedTool, setSelectedTool] = useState("turret");
  const [waveIdx, setWaveIdx] = useState(0);
  const [raidSize, setRaidSize] = useState(initialRaidSize);
  const [message, setMessage] = useState(null);

  // Wave label helper
  const getWaveLabel = (idx, total) => {
    if (idx === 0) return "FIRST CONTACT";
    if (idx === total - 1) return "FINAL WAVE";
    if (idx >= total * 0.7) return "HEAVY ASSAULT";
    if (idx >= total * 0.4) return "ESCALATING";
    return "INCOMING";
  };

  const canvasRef = useRef(null);
  const stateRef = useRef({
    enemies: [],
    defenses: [],
    projectiles: [],
    scrap: 80,
    hatchHp: 100,
    phase: "prep",
    waveIdx: 0,
    totalWaves: RAID_SIZES["medium"],
    spawnQueue: [],
    spawnTimer: 0,
    tick: 0,
  });
  const rafRef = useRef(null);
  const selectedToolRef = useRef("turret");

  // sync selectedTool to ref
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);

  const showMessage = (msg, ms = 1800) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), ms);
  };

  const startWave = useCallback((idx) => {
    const s = stateRef.current;
    s.phase = "combat";
    s.waveIdx = idx;
    setPhase("combat");
    setWaveIdx(idx);

    // Build spawn queue from generated wave
    const wave = generateWave(idx);
    const queue = [];
    wave.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, side: group.side, delay: group.interval * i + (group.side === "left" ? 30 : 0) });
      }
    });
    queue.sort((a, b) => a.delay - b.delay);
    s.spawnQueue = queue;
    s.spawnTimer = 0;
    showMessage(`WAVE ${idx + 1} — ${getWaveLabel(idx, s.totalWaves)}`, 2000);
  }, []);

  const handleCanvasClick = useCallback((e) => {
    const s = stateRef.current;
    if (s.phase !== "prep") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const x = (e.clientX - rect.left) * scaleX;

    const tool = selectedToolRef.current;
    const def = DEFENSE_TYPES[tool];

    if (s.scrap < def.cost) { showMessage("NOT ENOUGH SCRAP"); return; }

    // Don't place on hatch
    if (Math.abs(x - HATCH_X) < HATCH_W) { showMessage("HATCH BLOCKED"); return; }
    // Don't stack
    const tooClose = s.defenses.some(d => Math.abs(d.x - x) < 30);
    if (tooClose) { showMessage("TOO CLOSE"); return; }

    s.defenses.push(makeDefense(x, tool));
    s.scrap -= def.cost;
    setScrap(s.scrap);
    if (onScrapChange) onScrapChange(s.scrap - initialScrap);
  }, []);

  // ─── GAME LOOP ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const loop = () => = "combat") {
      spawnTsEs ten.dedr // Check if blocked by barricade or other enemy
        const blocking = s.defenses.find(d =>
          !d.dead && d.type === "barricade" &&
          Math.abs(d.x - en.x) < 20 && Math.sign(d.x - en.x) === en.dir
        );

        if (blocking) {
          // Attack barricade
          en.attackCooldown--;
          if (en.attackCooldown <= 0) {
            blocking.hp -= en.damage;
            if (blocking.hp <= 0) blocking.dead = true;
            en.attackCooldown = 60;
          }
        } else {
          // Only move if not yet at the hatch
          const distToHatch = (HATCH_X - en.x) * en.dir;
          const stopDist = HATCH_W / 2 + en.w / 2;
          if (distToHatch > stopDist) {
            en.x += en.speed * en.dir;
          }
        }

        // Attack hatch — separate cooldown from barricade attacks
        if (Math.abs(en.x - HATCH_X) <= HATCH_W / 2 + en.w / 2 + 2) {
          en.hatchCooldown--;
          if (en.hatchCooldown <= 0) {
            s.hatchHp -= en.damage;
            setHatchHp(Math.max(0, s.hatchHp));
            en.hatchCooldown = 45;
            if (s.hatchHp <= 0) {
              s.phase = "lost";
              if (onRaidLost) setTimeout(onRaidLost, 1500);
              setPhase("lost");
            }
          }
        }
      });

      // ── DEFENSES fire ──
      s.defenses.forEach(def => {
        if (def.dead || def.range === 0) return;
        def.fireCooldown--;
        if (def.fireCooldown > 0) return;

        // Find nearest enemy in range
        const target = s.enemies
          .filter(en => !en.dead && Math.abs(en.x - def.x) <= def.range)
          .sort((a, b) => Math.abs(a.x - def.x) - Math.abs(b.x - def.x))[0];

        if (target) {
          s.projectiles.push(makeProjectile(
            def.x, def.y - def.height + 4,
            target.x, target.y - 10,
            def.damage, def.color
          ));
          def.fireCooldown = def.fireRate;
        }
      });

      // ── PROJECTILES move + hit ──
      s.projectiles.forEach(p => {
        if (p.dead) return;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) { p.dead = true; return; }

        const hit = s.enemies.find(en => !en.dead && Math.abs(en.x - p.x) < 10 && Math.abs(en.y - p.y) < 20);
        if (hit) {
          hit.hp -= p.damage;
          p.dead = true;
          if (hit.hp <= 0) {
            hit.dead = true;
            s.scrap += hit.reward;
            setScrap(s.scrap);
            if (onScrapChange) onScrapChange(s.scrap - initialScrap);
          }
        }
      });

      // ── CLEANUP ──
      s.enemies = s.enemies.filter(e => !e.dead);
      s.projectiles = s.projectiles.filter(p => !p.dead);
      s.defenses = s.defenses.filter(d => !d.dead);

      // ── CHECK WIN ──
      if (s.phase === "combat") {
        const allSpawned = s.spawnQueue.every(q => q.spawned);
        if (allSpawned && s.enemies.length === 0) {
          // Wave-end scrap bonus — scales with hatch health (perfect defense = max reward)
          const bonus = Math.round(20 + (s.hatchHp / 100) * 40);
          s.scrap += bonus;
          setScrap(s.scrap);
          if (s.waveIdx >= s.totalWaves - 1) {
            s.phase = "won";
            if (onRaidWon) setTimeout(onRaidWon, 2000);
            setPhase("won");
            showMessage(`RAID REPELLED — +${bonus} SCRAP SALVAGED`, 3000);
          } else {
            s.waveIdx += 1;
            setWaveIdx(s.waveIdx);
            s.phase = "prep";
            setPhase("prep");
            showMessage(`WAVE ${s.waveIdx} CLEARED — +${bonus} SCRAP BONUS`, 2500);
          }
        }
      }

      // ─── RENDER ───────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Sky
      const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      grad.addColorStop(0, "#0a0f1a");
      grad.addColorStop(1, "#1a2535");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, GROUND_Y);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      [40, 120, 200, 350, 500, 620, 720, 90, 460, 580].forEach((x, i) => {
        const y = [15, 30, 8, 22, 12, 35, 18, 45, 28, 5][i];
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ground
      const ggrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      ggrad.addColorStop(0, "#1a1208");
      ggrad.addColorStop(1, "#0a0804");
      ctx.fillStyle = ggrad;
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

      // Ground surface line
      ctx.strokeStyle = "#2a1e10";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(W, GROUND_Y);
      ctx.stroke();

      // ── Hatch ──
      const hatchPulse = s.hatchHp < 40 ? 0.5 + 0.5 * Math.sin(s.tick * 0.2) : 1;
      ctx.fillStyle = `rgba(${s.hatchHp < 40 ? "200,50,20" : "40,80,60"},${hatchPulse})`;
      ctx.fillRect(HATCH_X - HATCH_W / 2, GROUND_Y - 6, HATCH_W, 8);
      // Hatch outline
      ctx.strokeStyle = s.hatchHp < 40 ? "#ff3300" : "#4ab3f4";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(HATCH_X - HATCH_W / 2, GROUND_Y - 6, HATCH_W, 8);
      // Hatch label
      ctx.fillStyle = "#4ab3f480";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("▼ HATCH", HATCH_X, GROUND_Y - 9);

      // Hatch HP bar
      const hpRatio = s.hatchHp / 100;
      ctx.fillStyle = "#050a05";
      ctx.fillRect(HATCH_X - 25, GROUND_Y - 20, 50, 5);
      ctx.fillStyle = hpRatio > 0.5 ? "#22cc44" : hpRatio > 0.25 ? "#cc8800" : "#cc2200";
      ctx.fillRect(HATCH_X - 25, GROUND_Y - 20, 50 * hpRatio, 5);

      // ── Defense range preview (prep mode) ──
      if (s.phase === "prep") {
        s.defenses.forEach(d => {
          if (d.range === 0) return;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.range, 0, Math.PI * 2);
          ctx.strokeStyle = `${d.color}22`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `${d.color}08`;
          ctx.fill();
        });
      }

      // ── Defenses ──
      s.defenses.forEach(d => {
        const x = d.x, y = d.y;
        ctx.fillStyle = "#000000";

        if (d.type === "turret") {
          // Base
          ctx.fillRect(x - 9, y - 8, 18, 8);
          // Barrel mount
          ctx.fillRect(x - 5, y - 20, 10, 14);
          // Barrel (angled slightly)
          ctx.save();
          ctx.translate(x, y - 18);
          ctx.rotate(-0.3);
          ctx.fillRect(-2, -14, 4, 14);
          ctx.restore();
        } else if (d.type === "barricade") {
          // Simple wall
          ctx.fillRect(x - 7, y - d.height, 14, d.height);
          // Top spikes
          for (let i = -5; i <= 5; i += 5) {
            ctx.beginPath();
            ctx.moveTo(x + i - 2, y - d.height);
            ctx.lineTo(x + i, y - d.height - 6);
            ctx.lineTo(x + i + 2, y - d.height);
            ctx.fill();
          }
        } else if (d.type === "missile") {
          // Launcher base
          ctx.fillRect(x - 7, y - 6, 14, 6);
          // Tube
          ctx.fillRect(x - 3, y - d.height, 6, d.height - 6);
          // Warhead
          ctx.beginPath();
          ctx.moveTo(x - 4, y - d.height + 2);
          ctx.lineTo(x, y - d.height - 6);
          ctx.lineTo(x + 4, y - d.height + 2);
          ctx.fill();
        }

        // HP bar
        const hpr = d.hp / d.maxHp;
        ctx.fillStyle = "#111";
        ctx.fillRect(x - 12, y - d.height - 8, 24, 3);
        ctx.fillStyle = hpr > 0.5 ? "#22cc44" : "#cc4400";
        ctx.fillRect(x - 12, y - d.height - 8, 24 * hpr, 3);
      });

      // ── Enemies ──
      s.enemies.forEach(en => {
        const x = en.x, y = en.y;
        // Silhouette human figure
        ctx.fillStyle = "#000000";
        const w = en.w;
        // Body
        ctx.fillRect(x - w / 2, y - 28, w, 16);
        // Head
        ctx.beginPath();
        ctx.arc(x, y - 32, w / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        const legPhase = Math.sin(s.tick * 0.25 * en.speed * en.dir * 3);
        ctx.save();
        ctx.translate(x, y - 12);
        ctx.fillRect(-w / 2, 0, w / 2 - 1, 10 + legPhase * 3);
        ctx.fillRect(1, 0, w / 2 - 1, 10 - legPhase * 3);
        ctx.restore();
        // Weapon
        ctx.fillRect(x + (en.dir > 0 ? w / 2 : -w / 2 - 8), y - 24, 8, 2);

        // HP bar
        const hpr = en.hp / en.maxHp;
        ctx.fillStyle = "#300";
        ctx.fillRect(x - 10, y - 42, 20, 3);
        ctx.fillStyle = "#cc2200";
        ctx.fillRect(x - 10, y - 42, 20 * hpr, 3);
      });

      // ── Projectiles ──
      s.projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.vx > 3 ? 2 : 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        // Trail
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.strokeStyle = `${p.color}66`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // ── Phase overlay ──
      if (s.phase === "won" || s.phase === "lost") {
        ctx.fillStyle = s.phase === "won" ? "rgba(0,40,20,0.7)" : "rgba(40,0,0,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = s.phase === "won" ? "#22cc44" : "#cc2200";
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillText(s.phase === "won" ? "RAID REPELLED" : "BREACH — RAID INCOMING", W / 2, H / 2);
        ctx.font = "11px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(s.phase === "won" ? "colony secured" : "underground taking damage", W / 2, H / 2 + 20);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const resetGame = (size) => {
    const s = stateRef.current;
    const sz = size || raidSize;
    s.enemies = []; s.defenses = []; s.projectiles = [];
    s.scrap = 80; s.hatchHp = 100; s.phase = "prep"; s.waveIdx = 0;
    s.totalWaves = RAID_SIZES[sz];
    s.spawnQueue = []; s.spawnTimer = 0; s.tick = 0;
    setScrap(80); setHatchHp(100); setPhase("prep"); setWaveIdx(0); setMessage(null);
    if (size) setRaidSize(size);
  };

  return (
    <div style={{
      background: "#030609",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      fontFamily: "monospace",
    }}>
      {/* Canvas — sky at top, ground at bottom */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleCanvasClick}
        style={{
          display: "block",
          cursor: phase === "prep" ? "crosshair" : "default",
          width: "100%",
          maxWidth: W,
          border: "1px solid #1a1208",
          borderBottom: "none",
        }}
      />

      {/* Surface bar — sits at the BOTTOM like Speranza, colony is below */}
      <div style={{
        width: W,
        background: "linear-gradient(to right, #0a1a0a, #0d200d)",
        border: "1px solid #1a3a1a",
        borderTop: "2px solid #1a3a1a",
        borderBottom: "none",
        padding: "5px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ color: "#2a5a2a", fontSize: 9, letterSpacing: 3 }}>
          ▲ SURFACE — ARC CONTROLLED ZONE
        </span>
        <span style={{ color: "#4ab3f4", fontSize: 9, letterSpacing: 2 }}>
          {phase === "prep" ? `WAVE ${waveIdx + 1} — PLACE DEFENSES` :
           phase === "combat" ? `WAVE ${waveIdx + 1} — COMBAT` :
           phase === "won" ? "RAID REPELLED" : "BREACH"}
        </span>
      </div>

      {/* Controls bar */}
      <div style={{
        width: W,
        background: "#080604",
        border: "1px solid #1a1208",
        borderTop: "1px solid #222",
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        {/* Scrap */}
        <div style={{ color: "#a855f7", fontSize: 10, letterSpacing: 1, minWidth: 80 }}>
          🔧 SCRAP: {scrap}
        </di
iv style={{ color: hatchHp < 40 ? "#cc2200" : "#22cc44", fontSize: 10, letterSpacing: 1, minWidth: 100 }}>
      ▼ HATCH: {hatchHp}%
    </div>

       {Wave progress */}
     <di style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: stateRef.current.totalWaves }).map((_, i) => (
        <div key={i} style={{
          width: 8, height: 8,
          borderRadius: 1,
          background: i < waveIdx ? "#22cc4488"
            : i === waveIdx ? "#ff4422"
            : "#1a1208",
          border: `1px solid ${i === waveIdx ? "#ff4422" : "#222"}`,
          transition: "background 0.3s",
        }} />
        }
        </div>

      <d style={{ width: 1, height: 20, background: "#222" }} />

    {/* Defense picker */}
        {phase === "prep" && Object.entries(DEFENSE_TYPES).map(([key, def]) => (
        utton key={key} onClick={() => setSelectedTool(key)} style={{
        fontFamily: "monospace", fontSize: 8, letterSpacing: 1,
          dding: "4px 8px",
         bacground: selectedTool === key ? `${def.color}22` : "rgba(255,255,255,0.03)",
          bord: `1px solid ${selectedTool === key ? def.color : "#222"}`,
           col selectedTool === key ? def.color : "#445",
          curs: "pointer",
         borderRdius: 2,
      }}>
            {dabel} ({def.cost}⚙)
         </but>
      ))}

    <div style={{ flex: 1 }} />

        Action button */}
        {phase === "prep" && (
        utton onClick={() => startWave(stateRef.current.waveIdx)} style={{
        fontFamily: "monospace", fontSize: 9, letterSpacing: 2,
        padding: "5px 16px",
            ground: "rgba(200,50,20,0.15)",
           ber: "1px solid #cc3311",
         colr: "#ff4422",
        cursor: "pointer",
            erRadius: 2,
         }}>
          ▶ ND WAVE {waveIdx + 1}
      </button>
        )}
       {(pe === "won" || phase === "lost") && (
        utton onClick={resetGame} style={{
            fontFamily: "monospace", fontSize: 9, letterSpacing: 2,
        padding: "5px 16px",
            background: "rgba(74,179,244,0.1)",
        border: "1px solid #4ab3f4",
        color: "#4ab3f4",
          rsor: "pointer",
          boerRadius: 2,
       }}>
          ↺ START
         </bon>
      )}
     {phase == "combat" && (
      <span style={{ color: "#cc3311", fontSize: 9, letterSpacing: 2, animation: "pulse 1s infinite" }}>
          RAID IN PROGRESS
         </s>
      )}

    {phase === "prep" && (
           style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <sn style={{ color: "#334", fontSize: 8, letterSpacing: 1 }}>RAID:</span>
         {["mall","medium","large"].map(sz => (
          <button key={sz} onClick={() => resetGame(sz)} style={{
            fontFamily: "monospace", fontSize: 8, letterSpacing: 1,
            padding: "3px 8px",
            background: raidSize === sz ? "rgba(200,50,20,0.15)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${raidSize === sz ? "#cc3311" : "#1a1208"}`,
            color: raidSize === sz ? "#ff4422" : "#334",
            cursor: "pointer", borderRadius: 2,
            textTransform: "uppercase",
          }}>
            {sz} ({RAID_SIZES[sz]}W)
          </button>
           )
        </v>
     )}
      </div>

      {/* ructions */}
     <div st={{ width: W, padding: "6px 12px", background: "#050403", border: "1px solid #111", borderTop: "none" }}>
      <div sle={{ color: "#223", fontSize: 8, letterSpacing: 1 }}>
      {phase === "prep"
            ? "C SURFACE TO PLACE DEFENSES · TURRETS AUTO-FIRE · BARRICADES BLOCK · MISSILES LONG RANGE"
           : pha=== "combat" ? "DEFEND THE HATCH · EARN SCRAP FROM KILLS"
          : phas=== "won" ? "ALL THREATS NEUTRALIZED — COLONY SECURE"
         : "HATC BREACHED — COLONY TAKING RAID DAMAGE"}
    </div>
      </div>

    {/* Floati message */}
   {message && (
      <div sty={{
         poson: "fixed",
        to "50%", left: "50%",
       tansform: "translate(-50%, -50%)",
      background: "rgba(0,0,0,0.85)",
          border: "1px solid #cc3311",
      color: "#ff4422",
      fontFamily: "monospace",
        ntSize: 13, letterSpacing: 3,
       pading: "10px 24px",
      pointerEvents: "none",
          zI: 100,
      }}>
       {messge}
    </div>
      tyle>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  );
}
