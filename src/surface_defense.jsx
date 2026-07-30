import { useState, useEffect, useRef, useCallback } from "react";
import { RAID_SIZES as COLONY_RAID_SIZES } from "./gameData.js";

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
    upgrade: { cost: 35, damage: 8, hp: 30, range: 25, fireRate: -4 },
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
    upgrade: { cost: 18, damage: 0, hp: 90, range: 0, fireRate: 0 },
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
    upgrade: { cost: 55, damage: 22, hp: 20, range: 35, fireRate: -10 },
  },
};

// Non-building tools. Placement was the only verb the minigame had; these give
// the player something to do with scrap other than spam new towers, and make a
// damaged emplacement worth saving instead of writing off.
const MAX_LEVEL = 2;               // level 0 -> 2, so two upgrades per emplacement
const SELL_REFUND = 0.5;
const REPAIR_COST_PER_HP = 0.35;

// Combat-phase ability. Before this, combat was entirely passive — the player
// placed towers in prep and then watched. One button with real timing is enough
// to make the fight something you play rather than something you observe.
const EMP_CHARGES_PER_RAID = 2;
const EMP_STUN_FRAMES = 150;       // ~2.5s at 60fps
const EMP_RADIUS = 260;

// The minigame's scrap used to BE colony scrap — every kill reward and wave
// bonus was forwarded straight into the colony treasury. A medium raid paid out
// ~685 scrap (7 worker-days of Workshop output) and a large one ~1289, whether
// you won or lost, which made raids the most profitable activity in the game.
//
// Now the colony commits a fixed DEFENSE BUDGET up front. Kills and wave
// bonuses refill that budget only, so the "kills fund more turrets" loop inside
// the raid survives intact, and the colony gets a bounded salvage payout per
// wave actually cleared. A clean win is roughly cost-neutral; a loss is not.
const DEFENSE_BUDGET = { small: 90, medium: 140, large: 200 };
const SALVAGE_PER_WAVE_CLEARED = 25;

const ENEMY_TYPES = {
  grunt: { hp: 40, maxHp: 40, speed: 0.5, damage: 8, reward: 10, w: 12, color: "#cc2200" },
  heavy: { hp: 120, maxHp: 120, speed: 0.25, damage: 20, reward: 25, w: 18, color: "#880000" },
  runner: { hp: 20, maxHp: 20, speed: 1.1, damage: 5, reward: 8, w: 10, color: "#ff4400" },
  drone: {
    hp: 25, maxHp: 25,
    speed: 0.9,
    damage: 6,
    reward: 12,
    w: 10,
    color: "#ff6600",
    flying: true,
    altitude: 55,
    burstCount: 3,
    burstInterval: 8,
  },
  gunship: {
    hp: 180, maxHp: 180,
    speed: 0.22,
    damage: 45,
    reward: 40,
    w: 28,
    color: "#cc2200",
    flying: true,
    altitude: 28,
    splashRadius: 55,
    rocketSpeed: 2.5,
  },
};


// Raid sizes come from gameData so the colony and the minigame can't disagree.
const RAID_SIZES = Object.fromEntries(
  Object.entries(COLONY_RAID_SIZES).map(([k, v]) => [k, v.waves])
);

// ─── Wave generation ─────────────────────────────────────────────────────────
// Waves are built by spending a threat budget rather than by an if-ladder of
// hand-written counts. The old version jumped from 2 grunts on a small raid's
// first wave to 35+ units with gunships on a large raid's last one — a cliff,
// not a curve. A budget gives a smooth ramp, keeps every raid size using the
// same tuning, and makes "how hard is this wave" a single readable number.
const UNIT_COST = { runner: 7, grunt: 10, drone: 15, heavy: 30, gunship: 65 };

// Budget at the first and last wave of a raid. Everything else interpolates.
const BUDGET_START = 20;
const BUDGET_END   = 210;

/** Threat budget for a wave. Exported shape is pure and easy to eyeball. */
export function waveBudget(waveIdx, totalWaves, wealthBracket = 0) {
  const progress = totalWaves <= 1 ? 1 : waveIdx / (totalWaves - 1);
  // Shorter raids don't reach the full ceiling — a 3-wave skirmish should never
  // hit the same intensity as the last wave of an 8-wave assault.
  const reach = 0.45 + 0.55 * ((totalWaves - 3) / 5);
  const base  = BUDGET_START + (BUDGET_END - BUDGET_START) * progress * Math.min(1, reach);
  return Math.round(base * (1 + wealthBracket * 0.22));
}

/** Which unit types are available this deep into a raid. */
function unlockedUnits(waveIdx, totalWaves) {
  const progress = totalWaves <= 1 ? 1 : waveIdx / (totalWaves - 1);
  const pool = ["grunt"];
  if (progress >= 0.20) pool.push("runner");
  if (progress >= 0.40) pool.push("drone");
  if (progress >= 0.45) pool.push("heavy");
  if (progress >= 0.75 && totalWaves >= 8) pool.push("gunship");
  return pool;
}

// Share of the budget each type gets, renormalised over whatever is unlocked.
// Spending greedily from the most expensive unit down instead produced waves of
// almost pure drones — and since turrets take a 50% penalty against air, those
// were both the hardest and the most monotonous waves in the game.
const MIX = { grunt: 0.42, runner: 0.16, drone: 0.18, heavy: 0.24 };

export function generateWave(waveIdx, totalWaves, wealthBracket = 0) {
  let budget = waveBudget(waveIdx, totalWaves, wealthBracket);
  const pool = unlockedUnits(waveIdx, totalWaves);
  const counts = {};

  // Gunships are a set-piece, not a budget line — one shows up to headline the
  // closing waves of a large raid. Budgeting them made them never appear.
  if (pool.includes("gunship")) {
    counts.gunship = 1;
    budget -= UNIT_COST.gunship;
  }

  const spendPool = pool.filter(t => t !== "gunship");
  const totalWeight = spendPool.reduce((s, t) => s + MIX[t], 0);
  spendPool.forEach(type => {
    const n = Math.floor((budget * (MIX[type] / totalWeight)) / UNIT_COST[type]);
    if (n > 0) counts[type] = (counts[type] ?? 0) + n;
  });

  // Whatever rounding left behind becomes grunts, so the budget is fully used.
  const spent = Object.entries(counts).reduce((s, [t, n]) => s + n * UNIT_COST[t], 0);
  const leftover = Math.floor((waveBudget(waveIdx, totalWaves, wealthBracket) - spent) / UNIT_COST.grunt);
  if (leftover > 0) counts.grunt = (counts.grunt ?? 0) + leftover;

  // Split each type across both approaches; alternate which side leads.
  const groups = [];
  Object.entries(counts).forEach(([type, total], i) => {
    const leadRight = (waveIdx + i) % 2 === 0;
    const right = Math.ceil(total / 2);
    const left  = total - right;
    // Faster raids arrive in tighter formation.
    const interval = Math.max(14, Math.round((type === "gunship" ? 170 : type === "heavy" ? 85 : 46) - waveIdx * 3));
    if (right > 0) groups.push({ type, side: leadRight ? "right" : "left", count: right, interval });
    if (left  > 0) groups.push({ type, side: leadRight ? "left" : "right", count: left,  interval });
  });
  return groups;
}

/** Flat {type: count} for the wave, used by the pre-wave briefing. */
export function waveComposition(waveIdx, totalWaves, wealthBracket = 0) {
  const counts = {};
  generateWave(waveIdx, totalWaves, wealthBracket)
    .forEach(g => { counts[g.type] = (counts[g.type] ?? 0) + g.count; });
  return counts;
}

let eid = 0;
let bid = 0;
let pid = 0;

function makeEnemy(side, type = "grunt") {
  const def = ENEMY_TYPES[type];
  const flying = def.flying ?? false;
  return {
    id: eid++, type,
    x: side === "left" ? -20 : W + 20,
    y: flying ? def.altitude : GROUND_Y,
    dir: side === "left" ? 1 : -1,
    hp: def.hp, maxHp: def.maxHp,
    speed: def.speed, damage: def.damage, reward: def.reward, w: def.w,
    color: def.color,
    flying,
    altitude: def.altitude ?? GROUND_Y,
    originalSide: side,
    attackCooldown: 0,
    hatchCooldown: 0,
    burstCount: def.burstCount ?? 0,
    burstInterval: def.burstInterval ?? 0,
    burstRemaining: 0,
    burstTimer: 0,
    attackPhase: "approach",
    stunned: 0,
    loopTimer: 0,
    splashRadius: def.splashRadius ?? 0,
    rocketSpeed: def.rocketSpeed ?? 5,
    targetX: null,
    targetY: null,
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
    level: 0,
    invested: def.cost,   // tracks total scrap in this emplacement, for refunds
    dead: false,
  };
}

/** Apply one upgrade tier in place. Caller checks cost and level cap. */
function upgradeDefense(d) {
  const up = DEFENSE_TYPES[d.type].upgrade;
  d.level  += 1;
  d.maxHp  += up.hp;
  d.hp     += up.hp;
  d.damage += up.damage;
  d.range  += up.range;
  d.fireRate = Math.max(8, d.fireRate + up.fireRate);
  d.invested += upgradeCost(d.type, d.level - 1);
}

/** Upgrades get pricier each tier. */
function upgradeCost(type, currentLevel) {
  return Math.round(DEFENSE_TYPES[type].upgrade.cost * (1 + currentLevel * 0.6));
}

function repairCost(d) {
  return Math.max(1, Math.ceil((d.maxHp - d.hp) * REPAIR_COST_PER_HP));
}

/** Nearest defense to an x position, within a grab radius. */
function defenseAt(defenses, x, radius = 26) {
  let best = null, bestD = radius;
  defenses.forEach(d => {
    if (d.dead) return;
    const dist = Math.abs(d.x - x);
    if (dist < bestD) { bestD = dist; best = d; }
  });
  return best;
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

function makeRocket(sx, sy, tx, ty, damage, color, splashRadius, speed, targetType = "defense") {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    id: pid++, x: sx, y: sy,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    damage, color,
    splash: true,
    splashRadius,
    targetX: tx,
    targetY: ty,
    targetType,
    dead: false,
  };
}

const WAVES = [
  [{ type: "grunt", side: "right", count: 4, interval: 60 }],
  [{ type: "grunt", side: "right", count: 3, interval: 50 }, { type: "grunt", side: "left", count: 2, interval: 80 }],
  [{ type: "grunt", side: "right", count: 3, interval: 40 }, { type: "runner", side: "left", count: 3, interval: 45 }, { type: "heavy", side: "right", count: 1, interval: 120 }],
  [{ type: "heavy", side: "left", count: 2, interval: 100 }, { type: "runner", side: "right", count: 5, interval: 30 }, { type: "grunt", side: "left", count: 4, interval: 50 }],
];

export default function SurfaceDefense({ active = true, scrap: initialScrap = 80, onScrapChange, raidSize: initialRaidSize = "medium", wealthBracket = 0, sentryWorkers = 0, onRaidWon, onRaidLost, onBunkerDestroyed }) {
  const [phase, setPhase] = useState("prep"); // prep | intermission | combat | won | lost
  const [scrap, setScrap] = useState(initialScrap);
  const [countdown, setCountdown] = useState(10); // inter-wave countdown (seconds)
  const [hatchHp, setHatchHp] = useState(100);
  const [selectedTool, setSelectedTool] = useState("turret");
  const [waveIdx, setWaveIdx] = useState(0);
  const [raidSize, setRaidSize] = useState(initialRaidSize);
  const [message, setMessage] = useState(null);
  const [empCharges, setEmpCharges] = useState(EMP_CHARGES_PER_RAID);

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
    wealthBracket: 0,
    bunker: null,
    spawnQueue: [],
    spawnTimer: 0,
    tick: 0,
    intermissionTick: 0,
    lastCountdown: 10,
    empCharges: EMP_CHARGES_PER_RAID,
    empFlash: 0,
  });
  const rafRef = useRef(null);
  const selectedToolRef = useRef("turret");
  const bunkerDestroyedTriggeredRef = useRef(false);
  const budgetCommittedRef = useRef(false);

  // sync selectedTool to ref
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  const raidLostTriggeredRef = useRef(false);
  const winLostTimeoutsRef = useRef([]);

  // Keep refs to initialScrap/raidSize so the reset effect can read them
  // without depending on them (avoids re-triggering reset on every scrap tick)
  const initialScrapRef    = useRef(initialScrap);
  const initialRaidSizeRef = useRef(initialRaidSize);
  useEffect(() => { initialScrapRef.current    = initialScrap;   }, [initialScrap]);
  useEffect(() => { initialRaidSizeRef.current = initialRaidSize; }, [initialRaidSize]);

  // Reset ONLY when active transitions to true, not on every scrap change
  useEffect(() => {
    // Raid over — allow the next one to draw a fresh budget.
    if (!active) { budgetCommittedRef.current = false; return; }
    const startScrap    = initialScrapRef.current;
    const startRaidSize = initialRaidSizeRef.current;
    const s = stateRef.current;
    s.enemies = []; s.defenses = []; s.projectiles = [];
    s.hatchHp = 100; s.phase = "prep";
    s.waveIdx = 0; s.totalWaves = RAID_SIZES[startRaidSize] ?? 5;
    s.wealthBracket = wealthBracket;
    s.bunker = sentryWorkers > 0 ? {
      x: HATCH_X - 120,
      hp: sentryWorkers * 60,
      maxHp: sentryWorkers * 60,
      slots: sentryWorkers,
      fireCooldown: 0,
      damage: 4,
      fireRate: 20,
      range: 140,
    } : null;
    s.spawnQueue = []; s.spawnTimer = 0; s.tick = 0;
    s.intermissionTick = 0; s.lastCountdown = 10;
    s.empCharges = EMP_CHARGES_PER_RAID; s.empFlash = 0;
    setEmpCharges(EMP_CHARGES_PER_RAID);
    // Draw the budget from colony scrap exactly once per raid.
    const committed = Math.round(Math.min(startScrap, DEFENSE_BUDGET[startRaidSize] ?? 140));
    s.scrap = committed;
    if (!budgetCommittedRef.current) {
      budgetCommittedRef.current = true;
      if (onScrapChange) onScrapChange(-committed);
    }
    setScrap(committed);
    raidLostTriggeredRef.current = false;
    bunkerDestroyedTriggeredRef.current = false;
    winLostTimeoutsRef.current.forEach(clearTimeout);
    winLostTimeoutsRef.current = [];
    setHatchHp(100); setPhase("prep");
    setWaveIdx(0); setMessage(null); setRaidSize(startRaidSize);
  }, [active, wealthBracket, sentryWorkers]);

  useEffect(() => () => {
    winLostTimeoutsRef.current.forEach(clearTimeout);
    winLostTimeoutsRef.current = [];
  }, []);

  const showMessage = (msg, ms = 1800) => {
    setMessage(msg);
    const timeoutId = setTimeout(() => {
      setMessage(null);
      winLostTimeoutsRef.current = winLostTimeoutsRef.current.filter(id => id !== timeoutId);
    }, ms);
    winLostTimeoutsRef.current.push(timeoutId);
  };

  const startWave = useCallback((idx) => {
    const s = stateRef.current;
    s.phase = "combat";
    s.waveIdx = idx;
    setPhase("combat");
    setWaveIdx(idx);

    // Build spawn queue from generated wave
    const wave = generateWave(idx, s.totalWaves, s.wealthBracket);
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
    if (s.phase !== "prep" && s.phase !== "intermission") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const x = (e.clientX - rect.left) * scaleX;

    const tool = selectedToolRef.current;
    // Budget-internal only — the colony already paid its commitment up front.
    const spend  = (n) => { s.scrap -= n; setScrap(s.scrap); };
    const refund = (n) => { s.scrap += n; setScrap(s.scrap); };

    // ── Maintenance tools act on an existing emplacement ──
    if (tool === "repair" || tool === "sell" || tool === "upgrade") {
      const d = defenseAt(s.defenses, x);
      if (!d) { showMessage("NOTHING THERE"); return; }

      if (tool === "sell") {
        refund(Math.round(d.invested * SELL_REFUND));
        d.dead = true;
        showMessage(`SOLD — +${Math.round(d.invested * SELL_REFUND)} SCRAP`);
        return;
      }
      if (tool === "repair") {
        if (d.hp >= d.maxHp) { showMessage("ALREADY INTACT"); return; }
        const cost = repairCost(d);
        if (s.scrap < cost) { showMessage("NOT ENOUGH SCRAP"); return; }
        spend(cost);
        d.hp = d.maxHp;
        showMessage(`REPAIRED — -${cost} SCRAP`);
        return;
      }
      // upgrade
      if (d.level >= MAX_LEVEL) { showMessage("MAX LEVEL"); return; }
      const cost = upgradeCost(d.type, d.level);
      if (s.scrap < cost) { showMessage("NOT ENOUGH SCRAP"); return; }
      spend(cost);
      upgradeDefense(d);
      showMessage(`UPGRADED TO Lv${d.level} — -${cost} SCRAP`);
      return;
    }

    // ── Build tools place a new emplacement ──
    const def = DEFENSE_TYPES[tool];
    if (!def) return;
    if (s.scrap < def.cost) { showMessage("NOT ENOUGH SCRAP"); return; }
    // Don't place on hatch
    if (Math.abs(x - HATCH_X) < HATCH_W) { showMessage("HATCH BLOCKED"); return; }
    // Don't stack
    const tooClose = s.defenses.some(d => !d.dead && Math.abs(d.x - x) < 30);
    if (tooClose) { showMessage("TOO CLOSE"); return; }

    s.defenses.push(makeDefense(x, tool));
    spend(def.cost);
  }, [onScrapChange]);

  /** Combat ability: stun every ground unit near the hatch. */
  const fireEmp = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "combat") { showMessage("ONLY DURING COMBAT"); return; }
    if (s.empCharges <= 0) { showMessage("NO EMP CHARGES"); return; }
    s.empCharges -= 1;
    setEmpCharges(s.empCharges);
    s.empFlash = 18;
    let hit = 0;
    s.enemies.forEach(en => {
      if (en.dead || en.flying) return;           // ground units only
      if (Math.abs(en.x - HATCH_X) > EMP_RADIUS) return;
      en.stunned = EMP_STUN_FRAMES;
      hit++;
    });
    showMessage(hit > 0 ? `EMP BURST — ${hit} UNIT${hit > 1 ? "S" : ""} STUNNED` : "EMP BURST — NOTHING IN RANGE");
  }, []);

  // ─── GAME LOOP ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      return undefined;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      const s = stateRef.current;
      s.tick++;

      // ── INTERMISSION COUNTDOWN ──
      if (s.phase === "intermission") {
        s.intermissionTick++;
        const INTERMISSION_FRAMES = 600; // 10 seconds at ~60fps
        const secsLeft = Math.max(1, Math.ceil((INTERMISSION_FRAMES - s.intermissionTick) / 60));
        if (secsLeft !== s.lastCountdown) {
          s.lastCountdown = secsLeft;
          setCountdown(secsLeft);
        }
        if (s.intermissionTick >= INTERMISSION_FRAMES) {
          // Auto-start next wave
          const idx = s.waveIdx;
          s.phase = "combat";
          setPhase("combat");
          const wave = generateWave(idx, s.totalWaves, s.wealthBracket);
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
        }
      }

      // ── SPAWN ──
      if (s.phase === "combat") {
        s.spawnTimer++;
        const toSpawn = s.spawnQueue.filter(q => q.delay <= s.spawnTimer && !q.spawned);
        toSpawn.forEach(q => {
          s.enemies.push(makeEnemy(q.side, q.type));
          q.spawned = true;
        });
      }

      // ── ENEMIES move + attack ──
      if (s.empFlash > 0) s.empFlash--;

      s.enemies.forEach(en => {
        if (en.dead) return;

        // EMP'd units hold still — they can still be shot, which is the point.
        if (en.stunned > 0) { en.stunned--; return; }

        // Check if blocked by barricade or other enemy
        const blocking = !en.flying && s.defenses.find(d =>
          !d.dead && d.type === "barricade" &&
          Math.abs(d.x - en.x) < 20 && Math.sign(d.x - en.x) === en.dir
        );

        if (en.type === "drone") {
          en.y = en.altitude + Math.sin((s.tick + en.id * 7) * 0.2) * 6;
          const distToHatch = Math.abs(en.x - HATCH_X);
          if (en.attackPhase === "approach") {
            en.x += en.speed * en.dir;
            if (distToHatch <= 80) {
              en.attackPhase = "burst";
              en.burstRemaining = en.burstCount;
              en.burstTimer = 0;
            }
          } else if (en.attackPhase === "burst") {
            en.burstTimer--;
            if (en.burstRemaining > 0 && en.burstTimer <= 0) {
              s.projectiles.push(makeProjectile(en.x, en.y, HATCH_X, GROUND_Y - 3, en.damage, en.color));
              en.burstRemaining -= 1;
              en.burstTimer = en.burstInterval;
            }
            if (en.burstRemaining <= 0) en.attackPhase = "retreat";
          } else if (en.attackPhase === "retreat") {
            en.x -= en.dir * en.speed * 1.2;
            if (en.x < -40 || en.x > W + 40) {
              en.attackPhase = "loop";
              en.loopTimer = 90;
            }
          } else if (en.attackPhase === "loop") {
            en.loopTimer -= 1;
            if (en.loopTimer <= 0) {
              en.x = en.originalSide === "left" ? -30 : W + 30;
              en.dir = en.originalSide === "left" ? 1 : -1;
              en.attackPhase = "approach";
            }
          }
          return;
        }

        if (en.type === "gunship") {
          en.y = en.altitude;
          const stopX = en.originalSide === "left" ? W * 0.3 : W * 0.7;
          if (en.attackPhase === "approach") {
            en.x += en.speed * en.dir;
            if ((en.dir > 0 && en.x >= stopX) || (en.dir < 0 && en.x <= stopX)) {
              en.attackPhase = "burst";
              en.attackCooldown = 90;
            }
          } else if (en.attackPhase === "burst") {
            en.attackCooldown--;
            if (en.attackCooldown <= 0) {
              const target = s.defenses
                .filter(d => !d.dead && Math.abs(d.x - en.x) <= 200)
                .sort((a, b) => a.hp - b.hp)[0]
                ?? s.defenses.filter(d => !d.dead).sort((a, b) => Math.abs(a.x - en.x) - Math.abs(b.x - en.x))[0];

              if (target) {
                s.projectiles.push(makeRocket(en.x, en.y, target.x, target.y - target.height / 2, en.damage, en.color, en.splashRadius, en.rocketSpeed));
              } else {
                s.projectiles.push(makeRocket(en.x, en.y, HATCH_X, GROUND_Y - 3, en.damage, en.color, en.splashRadius, en.rocketSpeed, "hatch"));
              }
              en.attackPhase = "retreat";
            }
          } else if (en.attackPhase === "retreat") {
            en.x += en.speed * en.dir;
            if (en.x < -50 || en.x > W + 50) en.dead = true;
          }
          return;
        }

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
            if (s.hatchHp <= 0 && !raidLostTriggeredRef.current) {
              raidLostTriggeredRef.current = true;
              s.phase = "lost";
              // Partial salvage — you only recover from waves you actually held.
              if (onScrapChange) onScrapChange(SALVAGE_PER_WAVE_CLEARED * s.waveIdx);
              if (onRaidLost) {
                const timeoutId = setTimeout(() => {
                  onRaidLost();
                  winLostTimeoutsRef.current = winLostTimeoutsRef.current.filter(id => id !== timeoutId);
                }, 1500);
                winLostTimeoutsRef.current.push(timeoutId);
              }
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
          const damage = def.type === "turret" && target.flying ? def.damage * 0.5 : def.damage;
          s.projectiles.push(makeProjectile(
            def.x, def.y - def.height + 4,
            target.x, target.y - 10,
            damage, def.color
          ));
          def.fireCooldown = def.fireRate;
        }
      });

      // ── BUNKER ──
      if (s.bunker && s.bunker.hp > 0) {
        const bk = s.bunker;
        bk.fireCooldown--;
        if (bk.fireCooldown <= 0) {
          const targets = s.enemies
            .filter(en => !en.dead && Math.abs(en.x - bk.x) <= bk.range)
            .sort((a, b) => Math.abs(a.x - bk.x) - Math.abs(b.x - bk.x))
            .slice(0, bk.slots);
          targets.forEach(t => {
            s.projectiles.push(makeProjectile(bk.x, GROUND_Y - 20, t.x, t.y - 10, bk.damage, "#ffcc00"));
          });
          if (targets.length > 0) bk.fireCooldown = bk.fireRate;
        }
      }

      // ── PROJECTILES move + hit ──
      s.projectiles.forEach(p => {
        if (p.dead) return;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) { p.dead = true; return; }

        if (p.splash) {
          const distToTarget = Math.sqrt((p.x - p.targetX) ** 2 + (p.y - p.targetY) ** 2);
          if (distToTarget <= Math.max(6, Math.abs(p.vx) + Math.abs(p.vy))) {
            s.defenses.forEach(d => {
              if (!d.dead) {
                const dist = Math.sqrt((d.x - p.x) ** 2 + ((d.y - d.height / 2) - p.y) ** 2);
                if (dist <= p.splashRadius) {
                  d.hp -= p.damage;
                  if (d.hp <= 0) d.dead = true;
                }
              }
            });
            if (p.targetType === "hatch") {
              const hatchDist = Math.sqrt((HATCH_X - p.x) ** 2 + ((GROUND_Y - 3) - p.y) ** 2);
              if (hatchDist <= p.splashRadius) {
                s.hatchHp -= Math.round(p.damage * 0.5);
                setHatchHp(Math.max(0, s.hatchHp));
                if (s.hatchHp <= 0 && !raidLostTriggeredRef.current) {
                  raidLostTriggeredRef.current = true;
                  s.phase = "lost";
                  if (onRaidLost) {
                    const timeoutId = setTimeout(() => {
                      onRaidLost();
                      winLostTimeoutsRef.current = winLostTimeoutsRef.current.filter(id => id !== timeoutId);
                    }, 1500);
                    winLostTimeoutsRef.current.push(timeoutId);
                  }
                  setPhase("lost");
                }
              }
            }
            p.dead = true;
            return;
          }
        }

        const hit = s.enemies.find(en => !en.dead && Math.abs(en.x - p.x) < 10 && Math.abs(en.y - p.y) < 20);
        if (hit) {
          hit.hp -= p.damage;
          p.dead = true;
          if (hit.hp <= 0) {
            hit.dead = true;
            s.scrap += hit.reward;
            setScrap(s.scrap);
          }
        }
      });

      s.enemies.forEach(en => {
        if (!en.dead && en.stunned > 0) return;   // stunned units can't hit the bunker
        if (!en.dead && s.bunker && s.bunker.hp > 0 && !en.flying) {
          const dist = Math.abs(en.x - s.bunker.x);
          if (dist < 25) {
            en.attackCooldown--;
            if (en.attackCooldown <= 0) {
              s.bunker.hp -= en.damage;
              en.attackCooldown = 60;
              if (s.bunker.hp <= 0) {
                s.bunker.hp = 0;
                if (!bunkerDestroyedTriggeredRef.current && onBunkerDestroyed) {
                  bunkerDestroyedTriggeredRef.current = true;
                  onBunkerDestroyed();
                }
              }
            }
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
            const salvage = SALVAGE_PER_WAVE_CLEARED * s.totalWaves;
            if (onScrapChange) onScrapChange(salvage);
            if (onRaidWon) {
              const timeoutId = setTimeout(() => {
                onRaidWon();
                winLostTimeoutsRef.current = winLostTimeoutsRef.current.filter(id => id !== timeoutId);
              }, 2000);
              winLostTimeoutsRef.current.push(timeoutId);
            }
            setPhase("won");
            showMessage(`RAID REPELLED — +${bonus} SCRAP SALVAGED`, 3000);
          } else {
            s.waveIdx += 1;
            setWaveIdx(s.waveIdx);
            s.phase = "intermission";
            s.intermissionTick = 0;
            s.lastCountdown = 10;
            setCountdown(10);
            setPhase("intermission");
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

      // ── Defense range preview (prep + intermission mode) ──
      if (s.phase === "prep" || s.phase === "intermission") {
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

      // ── Flying enemies ──
      s.enemies.filter(en => en.flying).forEach(en => {
        const x = en.x;
        const y = en.y;
        const hpr = en.hp / en.maxHp;

        if (en.type === "drone") {
          ctx.save();
          ctx.translate(x, y - 10);
          ctx.rotate(Math.sin((s.tick + en.id) * 0.15) * 0.2);
          ctx.fillStyle = en.color;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(6, 0);
          ctx.lineTo(0, 6);
          ctx.lineTo(-6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#ffaa66";
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(9, 0);
          ctx.stroke();
          ctx.fillStyle = "#ff2222";
          ctx.beginPath();
          ctx.arc(0, -4, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (en.type === "gunship") {
          ctx.fillStyle = en.color;
          ctx.beginPath();
          ctx.moveTo(x - 14, y - 10);
          ctx.lineTo(x + 10, y - 10);
          ctx.lineTo(x + 16, y - 4);
          ctx.lineTo(x + 10, y + 4);
          ctx.lineTo(x - 14, y + 4);
          ctx.lineTo(x - 18, y - 2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#ee8844";
          ctx.beginPath();
          ctx.arc(x - 12, y - 3, 2.5, 0, Math.PI * 2);
          ctx.arc(x - 12, y + 1, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#772200";
          ctx.beginPath();
          ctx.moveTo(x - 2, y - 8);
          ctx.lineTo(x - 18, y - 14);
          ctx.moveTo(x - 2, y + 2);
          ctx.lineTo(x - 18, y + 8);
          ctx.stroke();
        }

        ctx.fillStyle = "#300";
        ctx.fillRect(x - 10, y - 22, 20, 3);
        ctx.fillStyle = en.type === "gunship" ? "#cc5500" : "#ff6600";
        ctx.fillRect(x - 10, y - 22, 20 * hpr, 3);
      });

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

        // Upgrade pips, so the player can read investment at a glance.
        for (let i = 0; i < d.level; i++) {
          ctx.fillStyle = "#ffcc33";
          ctx.fillRect(x - 10 + i * 5, y - d.height - 13, 3.5, 3.5);
        }
        // Flag anything worth repairing during a build phase.
        if ((s.phase === "prep" || s.phase === "intermission") && d.hp < d.maxHp) {
          ctx.fillStyle = "#ff8800";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("🔧", x, y - d.height - 17);
        }
      });

      // ── Bunker ──
      if (s.bunker) {
        const bk = s.bunker;
        const hpr = bk.maxHp > 0 ? bk.hp / bk.maxHp : 0;
        ctx.fillStyle = bk.hp > 0 ? "#2a2a2a" : "#1a1210";
        ctx.fillRect(bk.x - 20, GROUND_Y - 20, 40, 20);

        if (bk.hp > 0) {
          ctx.fillStyle = "#8b7355";
          [-12, 0, 12].forEach(ox => {
            ctx.beginPath();
            ctx.ellipse(bk.x + ox, GROUND_Y - 20, 9, 6, 0, 0, Math.PI * 2);
            ctx.fill();
          });
          for (let i = 0; i < bk.slots; i++) {
            const px = bk.x - 15 + (i * (30 / Math.max(bk.slots, 1)));
            ctx.fillStyle = "#111";
            ctx.fillRect(px, GROUND_Y - 14, 6, 4);
            if (bk.fireCooldown < 3) {
              ctx.fillStyle = "#ffcc0088";
              ctx.beginPath();
              ctx.arc(px + 3, GROUND_Y - 12, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        ctx.fillStyle = "#300";
        ctx.fillRect(bk.x - 25, GROUND_Y - 32, 50, 4);
        ctx.fillStyle = hpr > 0.5 ? "#ffcc00" : "#ff4400";
        ctx.fillRect(bk.x - 25, GROUND_Y - 32, 50 * hpr, 4);
        ctx.fillStyle = "#ffcc0088";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`SENTRY ×${bk.slots}`, bk.x, GROUND_Y - 36);
      }

      // ── Ground enemies ──
      s.enemies.filter(en => !en.flying).forEach(en => {
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

        // Stunned marker — crackling arcs over the head.
        if (en.stunned > 0) {
          ctx.strokeStyle = `rgba(120,200,255,${0.5 + 0.5 * Math.sin(s.tick * 0.6)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x - 6, y - 46);
          ctx.lineTo(x - 2, y - 41);
          ctx.lineTo(x + 2, y - 46);
          ctx.lineTo(x + 6, y - 41);
          ctx.stroke();
        }
      });

      // EMP shockwave
      if (s.empFlash > 0) {
        const t = 1 - s.empFlash / 18;
        ctx.strokeStyle = `rgba(120,200,255,${1 - t})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(HATCH_X, GROUND_Y - 6, EMP_RADIUS * t, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Projectiles ──
      s.projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.splash ? 4 : (p.vx > 3 ? 2 : 3), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.strokeStyle = `${p.color}66`;
        ctx.lineWidth = p.splash ? 2.5 : 1.5;
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
  }, [active]);

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
      background: "transparent",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
      fontFamily: "monospace",
    }}>
      {/* When inactive: just show the surface label bar */}
      {!active && (
        <div className="surface-bar" style={{ width: "100%", background: "#0a1a0a", borderBottom: "1px dashed #2a4a2a", padding: "4px 10px", fontSize: 9, color: "#3a5a3a", letterSpacing: 2 }}>
          ▲ SURFACE — ARC CONTROLLED ZONE
        </div>
      )}

      {/* Canvas — always mounted for RAF loop, hidden when inactive */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleCanvasClick}
        style={{
          display: active ? "block" : "none",
          cursor: (phase === "prep" || phase === "intermission") ? "crosshair" : "default",
          width: "100%",
          maxWidth: W,
          border: "1px solid #1a1208",
          borderBottom: "none",
        }}
      />

      {/* When active: combat controls */}
      {active && (<>

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
           phase === "intermission" ? `WAVE ${waveIdx + 1} — NEXT WAVE IN ${countdown}s` :
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
          🔧 BUDGET: {Math.round(scrap)}
        </div>

        {/* Hatch HP */}
        <div style={{ color: hatchHp < 40 ? "#cc2200" : "#22cc44", fontSize: 10, letterSpacing: 1, minWidth: 100 }}>
          ▼ HATCH: {hatchHp}%
        </div>

        {/* Wave progress */}
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
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
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "#222" }} />

        {/* Build + maintenance tools — available in prep AND between waves, so
            a wave you barely survived can be patched up before the next one. */}
        {(phase === "prep" || phase === "intermission") && <>
          {Object.entries(DEFENSE_TYPES).map(([key, def]) => (
            <button key={key} onClick={() => setSelectedTool(key)} style={{
              fontFamily: "monospace", fontSize: 8, letterSpacing: 1,
              padding: "4px 8px",
              background: selectedTool === key ? `${def.color}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedTool === key ? def.color : "#222"}`,
              color: selectedTool === key ? def.color : "#445",
              cursor: "pointer",
              borderRadius: 2,
            }}>
              {def.label} ({def.cost}⚙)
            </button>
          ))}
          {[
            { key: "upgrade", label: "▲ UPGRADE", color: "#ffcc33" },
            { key: "repair",  label: "🔧 REPAIR",  color: "#22cc66" },
            { key: "sell",    label: "✕ SELL",     color: "#aa5544" },
          ].map(t => (
            <button key={t.key} onClick={() => setSelectedTool(t.key)} style={{
              fontFamily: "monospace", fontSize: 8, letterSpacing: 1,
              padding: "4px 8px",
              background: selectedTool === t.key ? `${t.color}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedTool === t.key ? t.color : "#222"}`,
              color: selectedTool === t.key ? t.color : "#445",
              cursor: "pointer", borderRadius: 2,
            }}>{t.label}</button>
          ))}
        </>}

        {/* Combat ability — the only thing the player can do mid-fight. */}
        {phase === "combat" && (
          <button onClick={fireEmp} disabled={empCharges <= 0} style={{
            fontFamily: "monospace", fontSize: 9, letterSpacing: 1,
            padding: "4px 10px",
            background: empCharges > 0 ? "rgba(80,180,255,0.14)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${empCharges > 0 ? "#4ab3f4" : "#222"}`,
            color: empCharges > 0 ? "#7fd0ff" : "#334",
            cursor: empCharges > 0 ? "pointer" : "not-allowed",
            borderRadius: 2,
          }}>
            ⚡ EMP BURST ({empCharges})
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Action button */}
        {phase === "prep" && (
          <button onClick={() => startWave(stateRef.current.waveIdx)} style={{
            fontFamily: "monospace", fontSize: 9, letterSpacing: 2,
            padding: "5px 16px",
            background: "rgba(200,50,20,0.15)",
            border: "1px solid #cc3311",
            color: "#ff4422",
            cursor: "pointer",
            borderRadius: 2,
          }}>
            ▶ {waveIdx === 0 ? "START RAID" : `SEND WAVE ${waveIdx + 1}`}
          </button>
        )}
        {phase === "intermission" && (
          <span style={{ color: "#ff8800", fontSize: 9, letterSpacing: 2 }}>
            ⏱ NEXT WAVE IN {countdown}s — PLACE DEFENSES
          </span>
        )}
        {phase === "combat" && (
          <span style={{ color: "#cc3311", fontSize: 9, letterSpacing: 2, animation: "pulse 1s infinite" }}>
            ● RAID IN PROGRESS
          </span>
        )}

      </div>

      {/* Wave briefing + instructions */}
      <div style={{ width: W, padding: "6px 12px", background: "#050403", border: "1px solid #111", borderTop: "none" }}>
        {(phase === "prep" || phase === "intermission") && (() => {
          // Telegraph the incoming wave so placement is a decision, not a guess.
          const comp = waveComposition(waveIdx, stateRef.current.totalWaves, stateRef.current.wealthBracket);
          const ICONS = { grunt: "🚶", runner: "🏃", heavy: "🛡", drone: "🛸", gunship: "🚁" };
          const air = (comp.drone ?? 0) + (comp.gunship ?? 0);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ color: "#8a6a2a", fontSize: 8, letterSpacing: 1 }}>INCOMING WAVE {waveIdx + 1}:</span>
              {Object.entries(comp).map(([type, n]) => (
                <span key={type} style={{ color: type === "gunship" ? "#ff5522" : type === "heavy" ? "#cc6644" : "#7a8a9a", fontSize: 9, fontFamily: "monospace" }}>
                  {ICONS[type] ?? "•"} {n}× {type}
                </span>
              ))}
              {air > 0 && (
                <span style={{ color: "#ff8844", fontSize: 8, letterSpacing: 1 }}>
                  ⚠ {air} AIR — turrets do half damage
                </span>
              )}
            </div>
          );
        })()}
        <div style={{ color: "#223", fontSize: 8, letterSpacing: 1 }}>
          {(phase === "prep" || phase === "intermission")
            ? "CLICK TO BUILD · UPGRADE / REPAIR / SELL EXISTING EMPLACEMENTS · TURRETS AUTO-FIRE · MISSILES LONG RANGE"
            : phase === "combat" ? "DEFEND THE HATCH · EARN SCRAP FROM KILLS · EMP BURST STUNS GROUND UNITS"
            : phase === "won" ? "ALL THREATS NEUTRALIZED — COLONY SECURE"
            : "HATCH BREACHED — COLONY TAKING RAID DAMAGE"}
        </div>
      </div>

      {/* Floating message */}
      {message && (
        <div style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,0.85)",
          border: "1px solid #cc3311",
          color: "#ff4422",
          fontFamily: "monospace",
          fontSize: 13, letterSpacing: 3,
          padding: "10px 24px",
          pointerEvents: "none",
          zIndex: 100,
        }}>
          {message}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
      </>)}
    </div>
  );
}
