import { useState, useEffect, useCallback, useRef } from "react";
import {
  startMusic, setMuted, getMuted,
  playBuild, playRaid, playInjury, playKill,
  playSuccess, playAlert, playExpedition,
  duckMusic, unduckMusic, playTickAlarm,
} from "./sounds.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID_COLS = 7;
const GRID_ROWS = 4;
const TICK_MS = 4000;
const MAX_RES = 300;
const THREAT_PER_TICK = 1.2;
const THREAT_RAID_THRESHOLD = 500;
const INJURY_TICKS_BASE = 40;   // ticks to heal without a nurse
const HEAL_RATE_NURSE   = 4;    // ticks removed per tick with a nurse (1 nurse heals up to 3 patients)

// ─── Raid Sizes ───────────────────────────────────────────────────────────────
const RAID_SIZES = {
  small:  { label: "SMALL",  targets: 1, icon: "⚡", duration: 20, strikeEvery: 10 },
  medium: { label: "MEDIUM", targets: 2, icon: "🔥", duration: 30, strikeEvery: 10 },
  large:  { label: "LARGE",  targets: 3, icon: "💀", duration: 60, strikeEvery: 10 },
};
const RAID_SIZE_ORDER = ["small", "medium", "large"];
// Chance per tick that a pending raid actually launches (60%)
// If it doesn't launch, escalations++ and size bumps up
const RAID_LAUNCH_CHANCE = 0.60;

// ─── T2 Tech Tree ─────────────────────────────────────────────────────────────
const T2_TECHS = {
  barricades: {
    label: "Barricades Lvl 1", icon: "🛡", cost: 50,
    desc: "40% chance to fully block an incoming raid. Costs 15 scrap to repair after a successful block.",
  },
  sentryPost: {
    label: "Sentry Post", icon: "🪖", cost: 75,
    desc: "Unlocks the Sentry Post building. Each assigned colonist reduces Arc threat by 5/tick.",
  },
  radioTower: {
    label: "Radio Tower", icon: "📡", cost: 75,
    desc: "Unlocks the Radio Tower building. Reveals incoming raid size when the raid window opens.",
  },
  shelter: {
    label: "Shelter", icon: "🏠", cost: 100,
    desc: "Unlocks the Shelter building. Sound the alarm to protect colonists — sheltered colonists are immune to raids.",
  },
};

// ─── Colonist Traits ──────────────────────────────────────────────────────────
const TRAITS = {
  veteran:   { label: "VETERAN",    icon: "🎖", color: "#f5a623", desc: "Never flees during raids." },
  ironLungs: { label: "IRON LUNGS", icon: "💪", color: "#ff6b9d", desc: "Heals 2× faster when injured." },
  scavenger: { label: "SCAVENGER",  icon: "🎒", color: "#bd10e0", desc: "+50% scrap from expeditions." },
  ghost:     { label: "GHOST",      icon: "👻", color: "#4ab3f4", desc: "50% less likely to be targeted in raids." },
  hardened:  { label: "HARDENED",   icon: "🛡", color: "#7ed321", desc: "Injury chance reduced — 20% instead of 30%." },
};
const TRAIT_KEYS = Object.keys(TRAITS);

// ─── Name Pool (Arc Raiders style) ───────────────────────────────────────────
const NAME_POOL = [
  "VASQUEZ","CHEN","OKAFOR","REYES","TAKEDA","MORROW","SOLÍS","BOREK",
  "WADE","KIRA","DANSEN","VOLT","PATCH","ECHO","GRIM","SLATE","ROOK",
  "YEVA","BRAND","CROSS","PIKE","SABLE","HOLT","DRAY","MACE","LUNE",
  "TANNER","FROST","IBARRA","ZHEN","ORLOV","MARSH","CADE","WREN","JUNO",
];
let nameIdx = 0;
function nextName() {
  const name = NAME_POOL[nameIdx % NAME_POOL.length];
  nameIdx++;
  return name;
}

// colonist statuses
// idle        — free, can be assigned
// working     — assigned to a room
// onExpedition — away on a surface mission
// (injured comes next pass)
const COLONIST_BASE = () => ({
  xp: 0, level: 0, traits: [], dutyTicks: 0, ticksAlive: 0, pendingTraitPick: false,
});
function makeColonist() {
  return { id: `c${Date.now()}-${Math.random()}`, name: nextName(), status: "idle", ...COLONIST_BASE() };
}

// ─── Room Definitions ─────────────────────────────────────────────────────────
const ROOM_TYPES = {
  power: {
    label: "Power Cell",     icon: "⚡", color: "#f5a623", bg: "#1a1200", border: "#f5a623",
    cost: { scrap: 10 },    produces: { energy: 4 }, consumes: {}, cap: 2,
    desc: "Generates energy to power the colony",
  },
  water: {
    label: "Water Recycler", icon: "💧", color: "#4a90e2", bg: "#00101f", border: "#4a90e2",
    cost: { scrap: 15 },    produces: { water: 3 }, consumes: { energy: 1 }, cap: 2,
    desc: "Recycles water, needs energy",
  },
  hydro: {
    label: "Hydroponics",    icon: "🌱", color: "#7ed321", bg: "#0a1a00", border: "#7ed321",
    cost: { scrap: 20 },    produces: { food: 2 }, consumes: { energy: 1, water: 1 }, cap: 2,
    desc: "Grows food, needs energy + water",
  },
  workshop: {
    label: "Workshop",       icon: "🔧", color: "#bd10e0", bg: "#10001a", border: "#bd10e0",
    cost: { scrap: 0 },     produces: { scrap: 2 }, consumes: { energy: 1 }, cap: 2,
    desc: "Makes scrap for construction",
  },
  barracks: {
    label: "Barracks",       icon: "🛏", color: "#e0b84a", bg: "#1a1200", border: "#e0b84a",
    cost: { scrap: 25 },    produces: {}, consumes: {}, cap: 0,
    popBonus: 2,
    desc: "Houses colonists (+2 pop cap)",
    special: "barracks",
  },
  armory: {
    label: "Armory",         icon: "⚔️", color: "#ff4444", bg: "#1a0000", border: "#ff4444",
    cost: { scrap: 40 },    produces: {}, consumes: { energy: 1 }, cap: 1,
    desc: "Enables surface expeditions. Needs 1 armorer assigned.",
    special: "armory",
  },
  hospital: {
    label: "Hospital",       icon: "🏥", color: "#ff6b9d", bg: "#1a0010", border: "#ff6b9d",
    cost: { scrap: 35 },    produces: {}, consumes: { energy: 1 }, cap: 2,
    desc: "Heals injured colonists. 1 nurse treats up to 3 patients. Without nurses, healing is 4× slower.",
    special: "hospital",
  },
  researchLab: {
    label: "Research Lab",   icon: "🔬", color: "#00e5ff", bg: "#001a1f", border: "#00e5ff",
    cost: { scrap: 45 },    produces: { rp: 1 }, consumes: { energy: 1 }, cap: 2,
    desc: "Generates research points to unlock T2 technologies. Assign researchers to accelerate progress.",
    special: "researchLab",
  },
  sentryPost: {
    label: "Sentry Post",    icon: "🪖", color: "#e8d44d", bg: "#1a1500", border: "#e8d44d",
    cost: { scrap: 30 },    produces: {}, consumes: {}, cap: 2,
    desc: "Each assigned sentry reduces Arc threat by 5/tick. Sentries can be targeted in raids.",
    special: "sentryPost", requiresTech: "sentryPost",
  },
  radioTower: {
    label: "Radio Tower",    icon: "📡", color: "#4ab3f4", bg: "#001020", border: "#4ab3f4",
    cost: { scrap: 40 },    produces: {}, consumes: { energy: 1 }, cap: 0,
    desc: "Reveals incoming raid size when a raid window opens. Without it, raid size is unknown until it strikes.",
    special: "radioTower", requiresTech: "radioTower",
  },
  shelter: {
    label: "Shelter",        icon: "🏠", color: "#7ecfb4", bg: "#001a12", border: "#7ecfb4",
    cost: { scrap: 50 },    produces: {}, consumes: {}, cap: 0,
    desc: "Sound the alarm to shelter colonists. Sheltered colonists are immune to Arc strikes.",
    special: "shelter", requiresTech: "shelter",
  },
};

// ─── Expedition Definitions ───────────────────────────────────────────────────
const EXPEDITION_TYPES = {
  scav: {
    label: "Scavenge Run", icon: "🏃", color: "#bd10e0",
    desc: "Safe surface scavenge. Low risk, low reward.",
    duration: 5, colonistsRequired: 1, threatDelta: 2, failChance: 0.1,
    reward: { scrap: 25 },
    failMsg: "returned empty-handed — close call.",
  },
  strike: {
    label: "Arc Strike", icon: "💥", color: "#ff4444",
    desc: "Attack an Arc outpost. High risk, high reward.",
    duration: 8, colonistsRequired: 2, threatDelta: 18, failChance: 0.3,
    reward: { scrap: 60, energy: 30 },
    failMsg: "ambushed by Arc forces.",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DRAIN_PER_COL = { food: 0.4, water: 0.4, energy: 0.2 };
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeGrid() {
  return Array.from({ length: GRID_ROWS }, (_, r) =>
    Array.from({ length: GRID_COLS }, (_, c) => ({ id: `${r}-${c}`, type: null, workers: 0, damaged: false }))
  );
}

function initColonists() {
  nameIdx = 0;
  return [
    { id: "c0", name: nextName(), status: "working", ...COLONIST_BASE() },
    { id: "c1", name: nextName(), status: "working", ...COLONIST_BASE() },
    { id: "c2", name: nextName(), status: "idle",    ...COLONIST_BASE() },
  ];
}

function initGrid() {
  const g = makeGrid();
  g[3][0] = { id: "3-0", type: "workshop", workers: 1, damaged: false };
  g[3][1] = { id: "3-1", type: "power",    workers: 1, damaged: false };
  g[3][2] = { id: "3-2", type: "barracks", workers: 0, damaged: false };
  return g;
}

const INIT_RES = { energy: 80, food: 60, water: 60, scrap: 50, rp: 0 };

const STATUS_COLOR = {
  idle:          "#7ed321",
  working:       "#4ab3f4",
  onExpedition:  "#f5a623",
  injured:       "#ff4444",
  onSentry:      "#e8d44d",
  sheltered:     "#7ecfb4",
};
const STATUS_LABEL = {
  idle:          "IDLE",
  working:       "ON DUTY",
  onExpedition:  "DEPLOYED",
  injured:       "INJURED",
  onSentry:      "ON SENTRY",
  sheltered:     "SHELTERED",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Speranza() {
  const [grid,       setGrid]       = useState(initGrid);
  const [res,        setRes]        = useState(INIT_RES);
  const [colonists,  setColonists]  = useState(initColonists); // array of colonist objects
  const [threat,     setThreat]     = useState(15);
  const [expedition, setExpedition] = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [buildMenu,  setBuildMenu]  = useState(false);
  const [netFlow,    setNetFlow]    = useState({ energy: 0, food: 0, water: 0, scrap: 0 });
  const [rosterOpen, setRosterOpen] = useState(true);
  const [log,        setLog]        = useState([
    "Speranza colony initialized.",
    "Workshop and Power Cell online.",
    "Arc threat detected on surface.",
  ]);
  const [tick,       setTick]       = useState(0);
  const [gameOver,   setGameOver]   = useState(null);
  const [raidFlash,  setRaidFlash]  = useState(false);
  const [toasts,     setToasts]     = useState([]);
  // raidWindow: null | { sizeIdx: 0|1|2, escalations: number }
  // sizeIdx indexes into RAID_SIZE_ORDER
  const [raidWindow,    setRaidWindow]    = useState(null);
  const [unlockedTechs, setUnlockedTechs] = useState([]);
  // 0 = paused, otherwise multiplier applied to TICK_MS
  const TIMESCALES = [0, 0.5, 1, 2, 4, 10];
  const [timescale,   setTimescale]   = useState(1);
  const [isMuted,     setIsMuted]     = useState(false);
  // activeRaid: null | { sizeKey, ticksLeft, strikeCountdown }
  const [activeRaid,  setActiveRaid]  = useState(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  // These are computed from colonists array — no separate state needed
  const idleColonists  = colonists.filter(c => c.status === "idle");
  const unassigned     = idleColonists.length;
  const totalColonists = colonists.length;

  const calcPopCap = (g) => {
    let cap = 3;
    g.forEach(row => row.forEach(cell => { if (cell.type === "barracks") cap += 2; }));
    return cap;
  };
  const popCap = calcPopCap(grid);

  // ── Refs — tick loop reads these ──────────────────────────────────────────
  const gridRef           = useRef(grid);
  const colonistsRef      = useRef(colonists);
  const expedRef          = useRef(expedition);
  const gameOverRef       = useRef(gameOver);
  const raidWindowRef     = useRef(raidWindow);
  const unlockedTechsRef  = useRef(unlockedTechs);
  const timescaleRef      = useRef(timescale);
  const tickRef           = useRef(tick);
  useEffect(() => { gridRef.current          = grid;          }, [grid]);
  useEffect(() => { colonistsRef.current     = colonists;     }, [colonists]);
  useEffect(() => { expedRef.current         = expedition;    }, [expedition]);
  useEffect(() => { gameOverRef.current      = gameOver;      }, [gameOver]);
  useEffect(() => { raidWindowRef.current    = raidWindow;    }, [raidWindow]);
  useEffect(() => { unlockedTechsRef.current = unlockedTechs; }, [unlockedTechs]);
  const activeRaidRef     = useRef(activeRaid);
  useEffect(() => { timescaleRef.current     = timescale;     }, [timescale]);
  useEffect(() => { tickRef.current          = tick;          }, [tick]);
  useEffect(() => { activeRaidRef.current    = activeRaid;    }, [activeRaid]);

  // ── Audio: start music on first interaction ───────────────────────────────
  const handleFirstInteraction = useCallback(() => {
    startMusic();
  }, []);

  const toggleMute = useCallback(() => {
    const next = !getMuted();
    setMuted(next);
    setIsMuted(next);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [`[T${tickRef.current}] ${msg}`, ...prev.slice(0, 29)]);
  }, []);

  const addToast = useCallback((message, type = "info") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  // ── Main tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timescale === 0) return; // paused — no interval
    const interval = setInterval(() => {
      if (gameOverRef.current) return;

      const g    = gridRef.current;
      const cols = colonistsRef.current;
      const exp  = expedRef.current;
      const totalCol = cols.length;

      // 1. Resource production ───────────────────────────────────────────────
      setRes(prev => {
        const next = { ...prev };
        const flow = { energy: 0, food: 0, water: 0, scrap: 0, rp: 0 };

        g.forEach(row => row.forEach(cell => {
          if (!cell.type || !cell.workers) return;
          const def = ROOM_TYPES[cell.type];
          if (def.special === "barracks" || def.special === "armory") return;
          if (cell.damaged) return; // damaged rooms don't produce

          let canRun = true;
          for (const [r, amt] of Object.entries(def.consumes)) {
            if (next[r] < amt * cell.workers) { canRun = false; break; }
          }
          if (!canRun) return;

          for (const [r, amt] of Object.entries(def.consumes)) {
            next[r] = clamp(next[r] - amt * cell.workers, 0, MAX_RES);
            flow[r] -= amt * cell.workers;
          }
          for (const [r, amt] of Object.entries(def.produces)) {
            next[r] = clamp(next[r] + amt * cell.workers, 0, MAX_RES);
            flow[r] += amt * cell.workers;
          }
        }));

        // Armory energy drain
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "armory" && cell.workers > 0) {
            next.energy = clamp(next.energy - 1, 0, MAX_RES);
            flow.energy -= 1;
          }
        }));

        // Colonist upkeep — based on total headcount
        for (const [r, amt] of Object.entries(DRAIN_PER_COL)) {
          const drain = amt * totalCol;
          next[r]  = clamp(next[r] - drain, 0, MAX_RES);
          flow[r] -= drain;
        }

        setNetFlow(flow);
        if (next.food <= 0 && next.water <= 0) {
          setGameOver("💀 Colony lost — no food or water. Survivors scattered.");
        }
        return next;
      });

      // 2. Threat buildup + raid window ─────────────────────────────────────
      const builtRooms     = g.flatMap(row => row).filter(cell => cell.type).length;
      const threatThisTick = THREAT_PER_TICK + builtRooms * 0.8;
      const rw             = raidWindowRef.current;
      const ar             = activeRaidRef.current;

      if (rw) {
        // ── Raid window is open — roll each tick to launch or escalate ──────
        if (Math.random() < RAID_LAUNCH_CHANCE) {
          // Fire the raid at current size
          const sizeKey  = RAID_SIZE_ORDER[rw.sizeIdx];
          const sizeDef  = RAID_SIZES[sizeKey];

          // ── Barricade block check (if unlocked) ───────────────────────────
          const barricadesActive = unlockedTechsRef.current.includes("barricades");
          const blockChance = { small: 0.75, medium: 0.30, large: 0.10 }[sizeKey] ?? 0;
          if (barricadesActive && Math.random() < blockChance) {
            // Raid blocked — costs scrap to repair barricades
            const repairCost = 15;
            addLog(`🛡 BARRICADES HELD — ${sizeDef.label} raid repelled! (${repairCost} scrap to repair)`);
            addToast(`🛡 BARRICADES HELD\n${sizeDef.label} raid repelled.\n-${repairCost} scrap for repairs.`, "success");
            setRes(prev => ({ ...prev, scrap: Math.max(0, prev.scrap - repairCost) }));
            setRaidFlash(true);
            setTimeout(() => setRaidFlash(false), 500);
            setRaidWindow(null);
            setThreat(25);
          } else {
            // ── Begin active raid phase ──────────────────────────────────────
            setActiveRaid({ sizeKey, ticksLeft: sizeDef.duration, strikeCountdown: sizeDef.strikeEvery });
            setRaidWindow(null);
            duckMusic();
            playRaid();
            setRaidFlash(true);
            setTimeout(() => setRaidFlash(false), 800);
            addLog(`⚔ ${sizeDef.icon} ${sizeDef.label} RAID UNDERWAY — ${sizeDef.duration} ticks! First strike in ${sizeDef.strikeEvery}.`);
            addToast(`⚔ ${sizeDef.label} RAID IN PROGRESS\nArc forces breaching the perimeter.\nFirst strike in ${sizeDef.strikeEvery} ticks.`, "raid");
          } // end barricade else

        } else {
          // Raid delayed — escalate size for next roll
          const nextSizeIdx = Math.min(rw.sizeIdx + 1, RAID_SIZE_ORDER.length - 1);
          const escalated   = nextSizeIdx > rw.sizeIdx;
          if (escalated) {
            const newLabel = RAID_SIZES[RAID_SIZE_ORDER[nextSizeIdx]].label;
            addLog(`⚠ Arc forces regrouping — raid escalated to ${newLabel}!`);
            addToast(`⚠ RAID ESCALATING\nArc forces regrouped.\nIncoming raid is now ${newLabel}.`, "injury");
          }
          setRaidWindow({ sizeIdx: nextSizeIdx, escalations: rw.escalations + 1 });
        }

      } else if (!ar) {
        // ── No active raid window or active raid — build threat normally ─────
        let sentryCount = 0;
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "sentryPost") sentryCount += cell.workers;
        }));
        setThreat(prev => {
          const next = clamp(prev + threatThisTick - sentryCount * 5, 0, THREAT_RAID_THRESHOLD);
          if (next >= THREAT_RAID_THRESHOLD) {
            // Open a raid window starting at small
            setRaidWindow({ sizeIdx: 0, escalations: 0 });
            addLog("☢ Arc threat critical — raid window opened! Attack incoming...");
            addToast("☢ ARC THREAT CRITICAL\nRaid incoming — size unknown.\nStay alert.", "injury");
            return THREAT_RAID_THRESHOLD; // hold at max while window is open
          }
          return next;
        });
      }

      // 2b. Active raid countdown + periodic strikes ────────────────────────
      const arNow = activeRaidRef.current;
      if (arNow) {
        const sizeDef          = RAID_SIZES[arNow.sizeKey];
        const newStrikeCD      = arNow.strikeCountdown - 1;
        const newTicksLeft     = arNow.ticksLeft - 1;

        // Pre-strike tick sound (5 ticks before strike)
        if (newStrikeCD === 5) playTickAlarm();

        // Strike fires this tick
        if (newStrikeCD <= 0 && newTicksLeft > 0) {
          const atRisk = cols.filter(c => c.status === "working" || c.status === "onSentry" || c.status === "idle");
          const targets = atRisk.slice(0, sizeDef.targets);
          if (targets.length === 0) {
            addLog(`💢 ${sizeDef.icon} ARC STRIKE — no exposed workers. Colony holds!`);
            addToast(`💢 ${sizeDef.label} STRIKE\nNo workers exposed — held the line.`, "raid");
          } else {
            addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${targets.length} colonist(s) hit!`);
            targets.forEach(target => {
              setGrid(prev => {
                const ng = prev.map(row => row.map(c => ({ ...c })));
                const staffed = [];
                ng.forEach((row, r) => row.forEach((cell, c) => {
                  if (cell.type && cell.workers > 0) staffed.push({ r, c });
                }));
                if (staffed.length > 0) {
                  const room = staffed[Math.floor(Math.random() * staffed.length)];
                  ng[room.r][room.c].workers = Math.max(0, ng[room.r][room.c].workers - 1);
                }
                return ng;
              });
              const roll = Math.random();
              if (roll < 0.50) {
                setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "idle" } : c));
                addLog(`  → ${target.name} fled their post!`);
                addToast(`💢 ${sizeDef.label} STRIKE\n${target.name} fled — shaken but alive.`, "raid");
              } else if (roll < 0.80) {
                setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "injured", injuryTicksLeft: INJURY_TICKS_BASE } : c));
                addLog(`  → ${target.name} was INJURED!`);
                addToast(`💢 ${sizeDef.label} STRIKE — CASUALTY\n${target.name} is injured.`, "injury");
                playInjury();
              } else {
                setColonists(prev => prev.filter(c => c.id !== target.id));
                addLog(`  → ${target.name} was KILLED.`);
                addToast(`💢 ${sizeDef.label} STRIKE — KIA\n${target.name} did not make it.`, "raid");
                playKill();
              }
            });
          }
          // Building damage chance per strike
          const dmgChance = { small: 0, medium: 0.10, large: 0.25 }[arNow.sizeKey] ?? 0;
          if (dmgChance > 0 && Math.random() < dmgChance) {
            const undamaged = [];
            g.forEach((row, ri) => row.forEach((cell, ci) => {
              if (cell.type && !cell.damaged) undamaged.push({ r: ri, c: ci, type: cell.type });
            }));
            if (undamaged.length > 0) {
              const dmgTarget = undamaged[Math.floor(Math.random() * undamaged.length)];
              setGrid(prev => {
                const ng = prev.map(row => row.map(c => ({ ...c })));
                ng[dmgTarget.r][dmgTarget.c].damaged = true;
                return ng;
              });
              addLog(`💥 ${ROOM_TYPES[dmgTarget.type].label} took structural damage!`);
              addToast(`💥 STRUCTURAL DAMAGE\n${ROOM_TYPES[dmgTarget.type].label} damaged.\nRepair costs 20 scrap.`, "injury");
            }
          }
          setRaidFlash(true);
          setTimeout(() => setRaidFlash(false), 500);
        }

        // End raid or continue
        if (newTicksLeft <= 0) {
          setActiveRaid(null);
          setThreat(25);
          unduckMusic();
          addLog(`✅ ${sizeDef.label} raid repelled — Arc forces withdrew.`);
          addToast(`✅ RAID OVER\n${sizeDef.label} Arc forces withdrew.\nThreat level reset.`, "success");
          playSuccess();
        } else {
          setActiveRaid({
            ...arNow,
            ticksLeft: newTicksLeft,
            strikeCountdown: newStrikeCD <= 0 ? sizeDef.strikeEvery : newStrikeCD,
          });
        }
      }

      // 3. Expedition countdown ──────────────────────────────────────────────
      if (exp) {
        if (exp.ticksLeft <= 1) {
          const def    = EXPEDITION_TYPES[exp.type];
          const failed = Math.random() < def.failChance;
          const names  = exp.colonistIds.map(id => {
            const c = cols.find(c => c.id === id);
            return c ? c.name : "Unknown";
          }).join(", ");

          if (failed) {
            addLog(`⚠ ${def.icon} ${names} — ${def.failMsg}`);
            addToast(`${def.icon} EXPEDITION FAILED\n${names} — ${def.failMsg}`, "injury");
          } else {
            const rewardStr = Object.entries(def.reward).map(([r, a]) => `+${a} ${r}`).join("  ");
            addLog(`✅ ${def.icon} ${names} returned! ${Object.entries(def.reward).map(([r, a]) => `+${a} ${r}`).join(", ")}`);
            addToast(`${def.icon} MISSION COMPLETE\n${names} returned safe.\n${rewardStr}`, "success");
            setRes(prev => {
              const next = { ...prev };
              for (const [r, amt] of Object.entries(def.reward)) next[r] = clamp(next[r] + amt, 0, MAX_RES);
              return next;
            });
          }

          // Return all expedition colonists to idle (injury system comes next)
          setColonists(prev =>
            prev.map(c => exp.colonistIds.includes(c.id) ? { ...c, status: "idle" } : c)
          );
          setExpedition(null);
        } else {
          setExpedition(prev => ({ ...prev, ticksLeft: prev.ticksLeft - 1 }));
        }
      }

      // 4. Heal injured colonists ───────────────────────────────────────────
      // Count available nurses in the hospital
      let nursesAvailable = 0;
      g.forEach(row => row.forEach(cell => {
        if (cell.type === "hospital") nursesAvailable += cell.workers;
      }));

      setColonists(prev => {
        let nurseCapacity = nursesAvailable * 3; // each nurse handles up to 3 patients
        return prev.map(col => {
          if (col.status !== "injured") return col;
          const healRate = nurseCapacity > 0 ? (nurseCapacity--, HEAL_RATE_NURSE) : 1;
          const newTicks = (col.injuryTicksLeft ?? INJURY_TICKS_BASE) - healRate;
          if (newTicks <= 0) {
            addLog(`💊 ${col.name} has recovered and returned to duty.`);
            addToast(`💊 RECOVERED\n${col.name} is back on their feet.`, "success");
            playSuccess();
      return { ...col, status: "idle", injuryTicksLeft: 0 };
          }
          return { ...col, injuryTicksLeft: newTicks };
        });
      });

      // 5. XP accumulation ─────────────────────────────────────────────────
      // All living colonists age. On-duty colonists earn 1 XP per 10 duty ticks.
      // Level up every 20 XP → pendingTraitPick flag set.
      setColonists(prev => prev.map(col => {
        const onDuty   = col.status === "working" || col.status === "onSentry";
        const newAlive = (col.ticksAlive ?? 0) + 1;
        const newDuty  = (col.dutyTicks  ?? 0) + (onDuty ? 1 : 0);
        const newXp    = (col.xp ?? 0) + (onDuty && newDuty % 10 === 0 ? 1 : 0);
        const newLevel = Math.floor(newXp / 20);
        const leveled  = newLevel > (col.level ?? 0);
        if (leveled) {
          addLog(`⭐ ${col.name} reached Level ${newLevel}! Trait selection available.`);
        }
        return {
          ...col,
          ticksAlive:       newAlive,
          dutyTicks:        newDuty,
          xp:               newXp,
          level:            newLevel,
          pendingTraitPick: leveled ? true : col.pendingTraitPick,
        };
      }));

      setTick(t => t + 1);
    }, TICK_MS / timescale);

    return () => clearInterval(interval);
  }, [timescale]); // restart interval when timescale changes

  // ── Warnings — edge-triggered (only log on false→true transition) ─────────
  const prevWarn = useRef({ food: false, water: false, energy: false, threat: false });
  useEffect(() => {
    if (tick === 0) return;
    const cur = {
      food:   res.food   < 20,
      water:  res.water  < 20,
      energy: res.energy < 20,
      threat: threat > 350,   // 70% of THREAT_RAID_THRESHOLD (500)
    };
    if (cur.food   && !prevWarn.current.food)   { addLog("⚠ FOOD CRITICAL");             playAlert(); }
    if (cur.water  && !prevWarn.current.water)  { addLog("⚠ WATER CRITICAL");            playAlert(); }
    if (cur.energy && !prevWarn.current.energy) { addLog("⚠ ENERGY CRITICAL");           playAlert(); }
    if (cur.threat && !prevWarn.current.threat) { addLog("🚨 HIGH THREAT — Arc raid imminent!"); }
    prevWarn.current = cur;
  }, [tick]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCellClick = (r, c) => {
    if (gameOver) return;
    setSelected({ r, c });
    setBuildMenu(!grid[r][c].type);
  };

  const handleBuild = (type) => {
    if (!selected) return;
    const { r, c } = selected;
    const def = ROOM_TYPES[type];
    for (const [resource, amt] of Object.entries(def.cost)) {
      if (res[resource] < amt) { addLog(`❌ Need ${amt} ${resource} for ${def.label}`); return; }
    }
    setRes(prev => {
      const next = { ...prev };
      for (const [resource, amt] of Object.entries(def.cost)) next[resource] -= amt;
      return next;
    });
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[r][c] = { id: `${r}-${c}`, type, workers: 0, damaged: false };
      return next;
    });
        addLog(`🏗 Built ${def.label} at sector [${r + 1}-${c + 1}]`);
        playBuild();
    setBuildMenu(false);
    setSelected(null);
  };

  const handleAssign = (r, c, delta) => {
    const cell = grid[r][c];
    if (!cell.type) return;
    const def = ROOM_TYPES[cell.type];
    if (def.special === "barracks") return;

    if (delta > 0) {
      // Assign: find first idle colonist (not injured)
      const idle = colonists.filter(co => co.status === "idle");
      if (idle.length === 0) { addLog("⚠ No free colonists available"); return; }
      if (cell.workers >= def.cap) { addLog("⚠ Room is at capacity"); return; }
      const pick = idle[0];
      const newStatus = cell.type === "sentryPost" ? "onSentry" : "working";
      setColonists(prev => prev.map(co => co.id === pick.id ? { ...co, status: newStatus } : co));
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })));
        next[r][c].workers += 1;
        return next;
      });
      addLog(`👤 ${pick.name} assigned to ${def.label}`);
    } else {
      // Unassign: find a colonist with the right status for this room
      if (cell.workers === 0) return;
      const statusFilter = cell.type === "sentryPost" ? "onSentry" : "working";
      const available = colonists.filter(co => co.status === statusFilter);
      if (available.length === 0) return;
      const pick = available[0];
      setColonists(prev => prev.map(co => co.id === pick.id ? { ...co, status: "idle" } : co));
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })));
        next[r][c].workers = Math.max(0, next[r][c].workers - 1);
        return next;
      });
      addLog(`👤 ${pick.name} stood down from ${def.label}`);
    }
  };

  const handleDemolish = (r, c) => {
    const cell = grid[r][c];
    if (!cell.type) return;
    // Free all workers assigned to this room
    let freed = 0;
    setColonists(prev => {
      let toFree = cell.workers;
      return prev.map(co => {
        if (toFree > 0 && (co.status === "working" || co.status === "onSentry")) { toFree--; freed++; return { ...co, status: "idle" }; }
        return co;
      });
    });
    setRes(prev => ({ ...prev, scrap: Math.min(MAX_RES, prev.scrap + 5) }));
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[r][c] = { id: `${r}-${c}`, type: null, workers: 0 };
      return next;
    });
    addLog(`💥 Demolished ${ROOM_TYPES[cell.type].label} at [${r + 1}-${c + 1}] (+5 scrap)`);
    setSelected(null);
    setBuildMenu(false);
  };

  const handleRepair = (r, c) => {
    const cell = grid[r][c];
    if (!cell.type || !cell.damaged) return;
    if (res.scrap < 20) { addLog("⚠ Need 20 scrap to repair"); return; }
    setRes(prev => ({ ...prev, scrap: prev.scrap - 20 }));
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[r][c] = { ...next[r][c], damaged: false };
      return next;
    });
    addLog(`🔧 ${ROOM_TYPES[cell.type].label} at [${r + 1}-${c + 1}] repaired. (-20 scrap)`);
  };

  const handleRecruit = () => {
    if (totalColonists >= popCap) { addLog("⚠ Pop cap reached — build more Barracks"); return; }
    if (res.food < 15 || res.water < 15) { addLog("⚠ Need 15 food + 15 water to recruit"); return; }
    setRes(prev => ({ ...prev, food: prev.food - 15, water: prev.water - 15 }));
    const newCol = makeColonist();
    setColonists(prev => [...prev, newCol]);
    addLog(`🧍 ${newCol.name} joined from surface survivors!`);
  };

  const handleUnlockTech = (techKey) => {
    const tech = T2_TECHS[techKey];
    if (!tech) return;
    if (unlockedTechs.includes(techKey)) { addLog(`⚠ ${tech.label} already unlocked`); return; }
    if (res.rp < tech.cost) { addLog(`⚠ Need ${tech.cost} RP to unlock ${tech.label} (have ${Math.floor(res.rp)})`); return; }
    setRes(prev => ({ ...prev, rp: prev.rp - tech.cost }));
    setUnlockedTechs(prev => [...prev, techKey]);
    addLog(`🔬 ${tech.icon} ${tech.label} unlocked!`);
    addToast(`🔬 RESEARCH COMPLETE\n${tech.icon} ${tech.label} unlocked.`, "success");
    playSuccess();
  };

  const handlePickTrait = (colonistId, traitKey) => {
    const trait = TRAITS[traitKey];
    if (!trait) return;
    setColonists(prev => prev.map(col => {
      if (col.id !== colonistId) return col;
      if (col.traits.includes(traitKey)) return col;
      const newTraits = [...col.traits, traitKey];
      addLog(`${trait.icon} ${col.name} gained trait: ${trait.label}`);
      addToast(`${trait.icon} TRAIT ACQUIRED\n${col.name} — ${trait.label}\n${trait.desc}`, "success");
      return { ...col, traits: newTraits, pendingTraitPick: false };
    }));
  };

  const handleLaunchExpedition = (type) => {
    if (expedition) { addLog("⚠ Expedition already in progress"); return; }
    const def = EXPEDITION_TYPES[type];
    const idle = colonists.filter(c => c.status === "idle");
    if (idle.length < def.colonistsRequired) {
      addLog(`⚠ Need ${def.colonistsRequired} free colonist(s) — only ${idle.length} available`);
      return;
    }
    // Pick the first N idle colonists
    const picked = idle.slice(0, def.colonistsRequired);
    const names  = picked.map(c => c.name).join(" & ");
    setColonists(prev =>
      prev.map(c => picked.find(p => p.id === c.id) ? { ...c, status: "onExpedition" } : c)
    );
    setThreat(t => clamp(t + def.threatDelta, 0, THREAT_RAID_THRESHOLD));
    setExpedition({ type, ticksLeft: def.duration, colonistIds: picked.map(c => c.id) });
    addLog(`${def.icon} ${names} deployed on ${def.label}. Returns in ${def.duration} ticks.`);
    playExpedition();
  };

  const handleSoundAlarm = () => {
    // Shelter idle and working colonists; unassign them from rooms
    setColonists(prev => prev.map(c =>
      (c.status === "idle" || c.status === "working") ? { ...c, status: "sheltered" } : c
    ));
    setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, workers: 0 }))));
    addLog("🏠 ALARM SOUNDED — colonists sheltering. Production halted.");
    addToast("🏠 ALARM SOUNDED\nColonists are sheltering.\nThey are immune to Arc strikes.", "info");
  };

  const handleBackToWork = () => {
    setColonists(prev => prev.map(c =>
      c.status === "sheltered" ? { ...c, status: "idle" } : c
    ));
    addLog("🏠 All clear — colonists returned to idle. Reassign them to rooms.");
    addToast("🏠 ALL CLEAR\nColonists returning from shelter.\nReassign them to restore production.", "success");
  };

  const handleRestart = () => {
    nameIdx = 0;
    setGrid(initGrid());
    setRes(INIT_RES);
    setColonists(initColonists());
    setThreat(15);
    setExpedition(null);
    setRaidWindow(null);
    setActiveRaid(null);
    setUnlockedTechs([]);
    setSelected(null);
    setBuildMenu(false);
    setTick(0);
    setGameOver(null);
    setLog(["Colony restarted."]);
  };

  // ── Derived UI ────────────────────────────────────────────────────────────
  const selCell      = selected ? grid[selected.r][selected.c] : null;
  const armoryArmed  = grid.flatMap(r => r).some(c => c.type === "armory" && c.workers > 0);
  const hasRadioTower = grid.flatMap(r => r).some(c => c.type === "radioTower");
  const threatPct    = threat / THREAT_RAID_THRESHOLD * 100;
  const threatColor = raidWindow ? "#ff4444" : threatPct < 40 ? "#7ed321" : threatPct < 70 ? "#f5a623" : "#ff4444";
  const threatLabel = threatPct < 40 ? "LOW" : threatPct < 70 ? "ELEVATED" : threatPct < 90 ? "HIGH" : "CRITICAL";

  // ── Render helpers ────────────────────────────────────────────────────────
  const ResBar = ({ k, icon, label, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f", border: `1px solid ${color}33`, borderRadius: 6, padding: "5px 10px", minWidth: 105 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div>
        <div style={{ color: "#888", fontSize: 9, letterSpacing: 1 }}>{label}</div>
        <div style={{ color, fontSize: 14, fontWeight: "bold", fontFamily: "monospace" }}>{Math.floor(res[k])}</div>
      </div>
      <div style={{ width: 4, height: 28, background: "#1a1a2e", borderRadius: 2, marginLeft: "auto", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
        <div style={{ width: "100%", height: `${(res[k] / MAX_RES) * 100}%`, background: color, transition: "height 0.5s" }} />
      </div>
    </div>
  );

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div onClick={handleFirstInteraction} style={{
      minHeight: "100vh", background: "#050508", color: "#c8d0d8",
      fontFamily: "'Courier New', monospace",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "14px 8px",
      backgroundImage: "radial-gradient(ellipse at 50% 0%, #0d1520 0%, #050508 60%)",
      outline: raidFlash ? "3px solid #ff4444" : "3px solid transparent",
      transition: "outline 0.15s",
    }}>

      {/* ── HEADER ── */}
      <div style={{ width: "100%", maxWidth: 920, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1e3a5f", paddingBottom: 8, marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#4ab3f4", letterSpacing: 3 }}>⛩ SPERANZA</div>
            <div style={{ fontSize: 9, color: "#2a4a6a", letterSpacing: 2 }}>UNDERGROUND COLONY · TICK {tick}</div>
            {/* Timescale controls */}
            <div style={{ display: "flex", gap: 3, marginTop: 5, alignItems: "center" }}>
              {[{ v: 0, label: "⏸" }, { v: 0.5, label: ".5×" }, { v: 1, label: "1×" }, { v: 2, label: "2×" }, { v: 4, label: "4×" }, { v: 10, label: "10×" }].map(({ v, label }) => (
                <button key={v} onClick={() => setTimescale(v)} style={{
                  background: timescale === v ? "#1a3a5a" : "#0a0c14",
                  border: `1px solid ${timescale === v ? "#4ab3f4" : "#1a2535"}`,
                  borderRadius: 3, color: timescale === v ? "#4ab3f4" : "#2a4a6a",
                  padding: "2px 6px", cursor: "pointer", fontSize: 9, fontFamily: "monospace",
                  fontWeight: timescale === v ? "bold" : "normal",
                }}>{label}</button>
              ))}
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} style={{
                background: "#0a0c14",
                border: `1px solid ${isMuted ? "#5a2a2a" : "#1a2535"}`,
                borderRadius: 3, color: isMuted ? "#884444" : "#4ab3f4",
                padding: "2px 6px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
                marginLeft: 4,
              }}>{isMuted ? "🔇" : "🔊"}</button>
              {timescale === 0 && (
                <span style={{ color: "#f5a623", fontSize: 8, marginLeft: 3, letterSpacing: 1 }}>PAUSED</span>
              )}
            </div>
          </div>

          {/* Threat meter */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 180 }}>
            <div style={{ fontSize: 9, color: threatColor, letterSpacing: 2, fontWeight: "bold" }}>
              ☢ ARC THREAT: {raidWindow ? `⚠ RAID WINDOW OPEN` : `${threatLabel} (${Math.floor(threat / THREAT_RAID_THRESHOLD * 100)}%)`}
            </div>
            <div style={{ width: "100%", height: 10, background: "#0d1020", borderRadius: 5, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: raidWindow ? "100%" : `${(threat / THREAT_RAID_THRESHOLD) * 100}%`,
                background: raidWindow
                  ? `repeating-linear-gradient(90deg, #ff2222 0px, #ff4444 8px, #880000 8px, #880000 16px)`
                  : `linear-gradient(90deg, #1a5a1a, ${threatColor})`,
                boxShadow: (raidWindow || threat / THREAT_RAID_THRESHOLD > 0.7) ? `0 0 10px #ff4444` : "none",
                transition: raidWindow ? "none" : "width 0.5s, background 0.5s",
              }} />
            </div>
            {raidWindow ? (
              <div style={{ fontSize: 8, color: "#ff4444", letterSpacing: 1, fontWeight: "bold" }}>
                {hasRadioTower
                  ? `${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].icon} ${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].label} RAID INCOMING — rolling each tick`
                  : "❓ UNKNOWN RAID INCOMING — rolling each tick"}
                {hasRadioTower && unlockedTechs.includes("barricades") && ` · 🛡 ${Math.round({ small:75, medium:30, large:10 }[RAID_SIZE_ORDER[raidWindow.sizeIdx]])}% block`}
              </div>
            ) : (
              <div style={{ fontSize: 8, color: "#2a4a6a" }}>
                Each building +0.8 threat/tick · raids scale with colony size
                {unlockedTechs.includes("barricades") && " · 🛡 Barricades active"}
              </div>
            )}
          </div>

          {/* Colonists summary */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ background: "#0a1520", border: "1px solid #1e3a5f", borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
              <div style={{ color: "#888", fontSize: 9, letterSpacing: 1 }}>COLONISTS</div>
              <div style={{ color: "#4ab3f4", fontSize: 14, fontWeight: "bold" }}>👤 {totalColonists}/{popCap}</div>
              <div style={{ color: "#456", fontSize: 9 }}>FREE: {unassigned}</div>
            </div>
            <button onClick={handleRecruit} style={{
              background: "#0a2a1a", border: "1px solid #2a7a4a", borderRadius: 6,
              color: "#7ed321", padding: "8px 12px", cursor: "pointer", fontSize: 10, letterSpacing: 1,
            }}>+ RECRUIT</button>
          </div>
        </div>

        {/* Resources */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ResBar k="energy" icon="⚡" label="Energy" color="#f5a623" />
          <ResBar k="food"   icon="🌱" label="Food"   color="#7ed321" />
          <ResBar k="water"  icon="💧" label="Water"  color="#4a90e2" />
          <ResBar k="scrap"  icon="🔧" label="Scrap"  color="#bd10e0" />
          {/* RP shown only if a research lab exists */}
          {grid.flatMap(r => r).some(c => c.type === "researchLab") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f", border: "1px solid #00e5ff33", borderRadius: 6, padding: "5px 10px", minWidth: 105 }}>
              <span style={{ fontSize: 15 }}>🔬</span>
              <div>
                <div style={{ color: "#888", fontSize: 9, letterSpacing: 1 }}>RESEARCH</div>
                <div style={{ color: "#00e5ff", fontSize: 14, fontWeight: "bold", fontFamily: "monospace" }}>{Math.floor(res.rp)} RP</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTIVE RAID / RAID WINDOW BANNER ── */}
      {(raidWindow || activeRaid) && (
        <div style={{
          width: "100%", maxWidth: 920, marginBottom: 10,
          background: activeRaid ? "#140000" : "#0e0000",
          border: `2px solid ${activeRaid ? "#ff4444" : "#ff2200"}`,
          borderRadius: 6, padding: "10px 16px",
          boxShadow: "0 0 24px #ff444444",
          animation: "raidPulse 1.2s ease-in-out infinite",
        }}>
          {activeRaid ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ color: "#ff4444", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>
                  {RAID_SIZES[activeRaid.sizeKey].icon} {RAID_SIZES[activeRaid.sizeKey].label} RAID IN PROGRESS
                </div>
                <div style={{ color: "#884444", fontSize: 9, marginTop: 3, letterSpacing: 1 }}>
                  Arc forces are breaching the perimeter — production is at risk
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#ff6666", fontSize: 18, fontWeight: "bold", fontFamily: "monospace" }}>{activeRaid.ticksLeft}</div>
                  <div style={{ color: "#5a2a2a", fontSize: 8, letterSpacing: 1 }}>TICKS LEFT</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: activeRaid.strikeCountdown <= 5 ? "#ff4444" : "#f5a623", fontSize: 18, fontWeight: "bold", fontFamily: "monospace" }}>
                    {activeRaid.strikeCountdown}
                  </div>
                  <div style={{ color: "#5a2a2a", fontSize: 8, letterSpacing: 1 }}>NEXT STRIKE</div>
                </div>
                <div style={{ width: 80, height: 8, background: "#200000", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${(activeRaid.ticksLeft / RAID_SIZES[activeRaid.sizeKey].duration) * 100}%`,
                    background: "repeating-linear-gradient(90deg, #ff2222 0px, #ff4444 6px, #880000 6px, #880000 12px)",
                    transition: "width 0.4s",
                  }} />
                </div>
              </div>
            </div>
          ) : raidWindow && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ color: "#ff6622", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>
                  {hasRadioTower
                    ? `${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].icon} ${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].label} RAID INCOMING`
                    : "❓ UNKNOWN RAID INCOMING"}
                </div>
                <div style={{ color: "#7a3a1a", fontSize: 9, marginTop: 3, letterSpacing: 1 }}>
                  Arc forces mobilizing — {Math.round(RAID_LAUNCH_CHANCE * 100)}% strike chance each tick
                  {raidWindow.escalations > 0 && ` · escalated ${raidWindow.escalations}×`}
                  {!hasRadioTower && " · 📡 build Radio Tower to identify"}
                </div>
              </div>
              {hasRadioTower && unlockedTechs.includes("barricades") && (
                <div style={{ color: "#4a8a4a", fontSize: 9, letterSpacing: 1 }}>
                  🛡 {Math.round({ small: 75, medium: 30, large: 10 }[RAID_SIZE_ORDER[raidWindow.sizeIdx]])}% block chance
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TRAIT PICKER MODAL ── */}
      {colonists.filter(c => c.pendingTraitPick).map(col => (
        <div key={col.id} style={{
          width: "100%", maxWidth: 920, marginBottom: 10,
          background: "#120d00", border: "2px solid #f5a623",
          borderRadius: 8, padding: "12px 16px",
          boxShadow: "0 0 30px #f5a62344",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 16 }}>⭐</div>
            <div>
              <div style={{ color: "#f5a623", fontSize: 12, fontWeight: "bold", letterSpacing: 2 }}>
                {col.name} — LEVEL {col.level} REACHED
              </div>
              <div style={{ color: "#7a5a20", fontSize: 8, letterSpacing: 1, marginTop: 2 }}>
                Choose a trait. This is permanent.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TRAIT_KEYS.filter(k => !col.traits.includes(k)).map(traitKey => {
              const trait = TRAITS[traitKey];
              return (
                <button key={traitKey} onClick={() => handlePickTrait(col.id, traitKey)} style={{
                  flex: "1 1 140px", background: "#0d0900", border: `1px solid ${trait.color}66`,
                  borderRadius: 6, padding: "8px 10px", cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ color: trait.color, fontSize: 11, fontWeight: "bold", marginBottom: 3 }}>
                    {trait.icon} {trait.label}
                  </div>
                  <div style={{ color: "#5a5040", fontSize: 8, lineHeight: 1.4 }}>{trait.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── GAME OVER ── */}
      {gameOver && (
        <div style={{ background: "#1a0000", border: "2px solid #ff3333", borderRadius: 8, padding: 24, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>💀</div>
          <div style={{ color: "#ff5555", marginBottom: 12 }}>{gameOver}</div>
          <button onClick={handleRestart} style={{ background: "#3a0000", border: "1px solid #ff3333", borderRadius: 4, color: "#ff9999", padding: "8px 20px", cursor: "pointer" }}>RESTART</button>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 920 }}>

        {/* Grid column */}
        <div style={{ flex: 1, minWidth: 0 }}>

          <div style={{ background: "#0a1a0a", border: "1px dashed #2a4a2a", borderRadius: "6px 6px 0 0", padding: "4px 10px", fontSize: 9, color: "#3a5a3a", letterSpacing: 2 }}>
            ▲ SURFACE — ARC CONTROLLED ZONE
          </div>

          <div style={{ border: "1px solid #1a2a3a", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden", background: "#060810" }}>
            {grid.map((row, r) => (
              <div key={r} style={{ display: "flex" }}>
                <div style={{ width: 28, background: "#07090f", borderRight: "1px solid #0d1020", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#1e3040", flexShrink: 0 }}>
                  -{(r + 1) * 10}m
                </div>
                {row.map((cell, c) => {
                  const def   = cell.type ? ROOM_TYPES[cell.type] : null;
                  const isSel = selected?.r === r && selected?.c === c;
                  return (
                    <div key={c} onClick={() => handleCellClick(r, c)} style={{
                      flex: 1, height: 78,
                      border: isSel ? "2px solid #4ab3f4" : `1px solid ${def ? def.border + "33" : "#0d1020"}`,
                      background: def ? def.bg : (r % 2 === 0 ? "#07090f" : "#060810"),
                      cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      position: "relative", transition: "border-color 0.1s",
                      boxShadow: def ? `inset 0 0 18px ${def.color}0d` : "none",
                    }}>
                      {def ? (
                        <>
                          <div style={{ fontSize: 18 }}>{def.icon}</div>
                          <div style={{ fontSize: 7, color: def.color, letterSpacing: 0.5, marginTop: 2, textAlign: "center" }}>
                            {def.label.toUpperCase()}
                          </div>
                          {def.cap > 0 && (
                            <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                              {[...Array(def.cap)].map((_, i) => (
                                <div key={i} style={{
                                  width: 7, height: 7, borderRadius: "50%",
                                  background: i < cell.workers ? def.color : "#1a1a2e",
                                  border: `1px solid ${def.color}55`,
                                }} />
                              ))}
                            </div>
                          )}
                          {cell.damaged && (
                            <div style={{
                              position: "absolute", inset: 0, background: "#ff000018",
                              border: "2px solid #ff4444", pointerEvents: "none",
                              display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                              padding: 3,
                            }}>
                              <span style={{ fontSize: 10 }}>⚠</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ color: "#151e2a", fontSize: 16 }}>+</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Supply / Demand ── */}
          <div style={{ marginTop: 8, background: "#060810", border: "1px solid #1a2030", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>SUPPLY / DEMAND — NET FLOW PER TICK</div>
            {[
              { key: "energy", icon: "⚡", label: "Energy", color: "#f5a623" },
              { key: "food",   icon: "🌱", label: "Food",   color: "#7ed321" },
              { key: "water",  icon: "💧", label: "Water",  color: "#4a90e2" },
              { key: "scrap",  icon: "🔧", label: "Scrap",  color: "#bd10e0" },
            ].map(({ key, icon, label, color }) => {
              const val    = netFlow[key] || 0;
              const pct    = Math.min(Math.abs(val) / 12, 1) * 50;
              const surplus = val >= 0;
              const crit   = val < -5;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 58, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11 }}>{icon}</span>
                    <span style={{ fontSize: 9, color: "#3a5060" }}>{label}</span>
                  </div>
                  <div style={{ flex: 1, height: 12, background: "#0d1020", borderRadius: 6, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#1a2535", zIndex: 2 }} />
                    {val !== 0 && (
                      <div style={{
                        position: "absolute", top: 1, bottom: 1, borderRadius: 4,
                        left: surplus ? "50%" : `calc(50% - ${pct}%)`,
                        width: `${pct}%`,
                        background: crit ? "#c0392b" : surplus ? color : "#c0392b",
                        boxShadow: surplus ? `0 0 5px ${color}77` : "0 0 5px #c0392b77",
                        transition: "width 0.4s, left 0.4s",
                      }} />
                    )}
                  </div>
                  <div style={{ width: 36, textAlign: "right", fontSize: 10, fontFamily: "monospace", flexShrink: 0, fontWeight: "bold", color: crit ? "#ff4444" : surplus ? color : "#ff7755" }}>
                    {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Colonist Roster ── */}
          <div style={{ marginTop: 8, background: "#060810", border: "1px solid #1a2030", borderRadius: 6, overflow: "hidden" }}>
            <div
              onClick={() => setRosterOpen(o => !o)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2 }}>
                COLONIST ROSTER — {totalColonists} PERSONNEL
              </div>
              <div style={{ color: "#2a4a6a", fontSize: 10 }}>{rosterOpen ? "▲" : "▼"}</div>
            </div>

            {rosterOpen && (
              <div style={{ padding: "0 12px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {colonists.map(col => {
                  const xpInLevel  = (col.xp ?? 0) % 20;
                  const hasPending = col.pendingTraitPick;
                  const borderColor = hasPending ? "#f5a623" : STATUS_COLOR[col.status];
                  return (
                    <div key={col.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 6,
                      background: hasPending ? "#1a1000" : "#0a0c14",
                      border: `1px solid ${borderColor}${hasPending ? "" : "33"}`,
                      borderRadius: 5, padding: "4px 8px", minWidth: 130,
                      boxShadow: hasPending ? `0 0 8px #f5a62366` : "none",
                    }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                        background: STATUS_COLOR[col.status],
                        boxShadow: `0 0 4px ${STATUS_COLOR[col.status]}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ color: "#c8d0d8", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>
                            {col.name}
                          </div>
                          {(col.level ?? 0) > 0 && (
                            <div style={{ color: "#f5a623", fontSize: 7, background: "#1a1000", border: "1px solid #f5a62344", borderRadius: 3, padding: "0px 3px" }}>
                              Lv{col.level}
                            </div>
                          )}
                          {hasPending && <div style={{ color: "#f5a623", fontSize: 9 }}>⭐</div>}
                        </div>
                        {/* Status */}
                        <div style={{ color: STATUS_COLOR[col.status], fontSize: 7, letterSpacing: 1 }}>
                          {STATUS_LABEL[col.status]}
                        </div>
                        {/* Injury countdown */}
                        {col.status === "injured" && col.injuryTicksLeft > 0 && (
                          <div style={{ color: "#ff6b6b", fontSize: 7, letterSpacing: 0.5, marginTop: 1 }}>
                            ⚕ {col.injuryTicksLeft} tick{col.injuryTicksLeft !== 1 ? "s" : ""} to recover
                          </div>
                        )}
                        {/* XP bar */}
                        <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ flex: 1, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 2,
                              width: `${(xpInLevel / 20) * 100}%`,
                              background: hasPending ? "#f5a623" : "#2a5a8a",
                              transition: "width 0.4s",
                            }} />
                          </div>
                          <div style={{ color: "#2a4a6a", fontSize: 6, fontFamily: "monospace", flexShrink: 0 }}>
                            {xpInLevel}/20
                          </div>
                        </div>
                        {/* Trait pips */}
                        {col.traits && col.traits.length > 0 && (
                          <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                            {col.traits.map(t => (
                              <div key={t} title={TRAITS[t]?.desc} style={{
                                fontSize: 8, background: "#0a0a14",
                                border: `1px solid ${TRAITS[t]?.color ?? "#333"}44`,
                                borderRadius: 3, padding: "0 3px",
                                color: TRAITS[t]?.color ?? "#888",
                              }}>
                                {TRAITS[t]?.icon} {TRAITS[t]?.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 5, fontSize: 8, color: "#1a2535", letterSpacing: 1 }}>
            CLICK EMPTY CELL TO BUILD · CLICK ROOM TO MANAGE WORKERS
          </div>
        </div>

        {/* ── SIDE PANEL ── */}
        <div style={{ width: 205, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>

          {/* Build menu */}
          {buildMenu && selCell && !selCell.type && (
            <div style={{ background: "#080b14", border: "1px solid #1e3a5f", borderRadius: 8, padding: 10 }}>
              <div style={{ color: "#4ab3f4", fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>BUILD ROOM</div>
              {Object.entries(ROOM_TYPES).map(([key, def]) => {
                if (def.requiresTech && !unlockedTechs.includes(def.requiresTech)) return null;
                const costStr   = Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(", ");
                const canAfford = Object.entries(def.cost).every(([r, a]) => res[r] >= a);
                return (
                  <button key={key} onClick={() => handleBuild(key)} disabled={!canAfford} style={{
                    display: "block", width: "100%", marginBottom: 5,
                    background: canAfford ? def.bg : "#0a0a0a",
                    border: `1px solid ${canAfford ? def.border : "#1a1a1a"}`,
                    borderRadius: 5, padding: "6px 8px",
                    cursor: canAfford ? "pointer" : "not-allowed",
                    textAlign: "left", color: canAfford ? def.color : "#2a2a2a",
                  }}>
                    <div style={{ fontSize: 12 }}>{def.icon} {def.label}</div>
                    <div style={{ fontSize: 8, color: canAfford ? "#556" : "#1a1a1a", marginTop: 2 }}>
                      {costStr || "Free"} — {def.desc}
                    </div>
                  </button>
                );
              })}
              <button onClick={() => { setBuildMenu(false); setSelected(null); }} style={{
                width: "100%", background: "none", border: "1px solid #1e2a3a",
                borderRadius: 4, color: "#445", padding: 4, cursor: "pointer", fontSize: 9, marginTop: 3,
              }}>CANCEL</button>
            </div>
          )}

          {/* Room panel */}
          {selCell?.type && !buildMenu && (
            <div style={{ background: "#080b14", border: `1px solid ${ROOM_TYPES[selCell.type].border}44`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: ROOM_TYPES[selCell.type].color, fontSize: 11, letterSpacing: 1, marginBottom: 3 }}>
                {ROOM_TYPES[selCell.type].icon} {ROOM_TYPES[selCell.type].label.toUpperCase()}
              </div>
              <div style={{ color: "#445", fontSize: 8, marginBottom: selCell.damaged ? 6 : 8 }}>{ROOM_TYPES[selCell.type].desc}</div>

              {selCell.damaged && (
                <div style={{ background: "#1a0000", border: "1px solid #ff4444", borderRadius: 4, padding: "5px 7px", marginBottom: 8 }}>
                  <div style={{ color: "#ff4444", fontSize: 8, fontWeight: "bold" }}>⚠ STRUCTURAL DAMAGE</div>
                  <div style={{ color: "#884444", fontSize: 7, marginTop: 2 }}>Room offline — not producing. Repair to restore.</div>
                </div>
              )}

              {ROOM_TYPES[selCell.type].cap > 0 && (
                <>
                  <div style={{ color: "#667", fontSize: 9, marginBottom: 4 }}>
                    WORKERS: {selCell.workers}/{ROOM_TYPES[selCell.type].cap}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleAssign(selected.r, selected.c, -1)} style={{ flex: 1, background: "#1a0a0a", border: "1px solid #5a2a2a", borderRadius: 4, color: "#c44", padding: 4, cursor: "pointer", fontSize: 14 }}>−</button>
                    <button onClick={() => handleAssign(selected.r, selected.c,  1)} style={{ flex: 1, background: "#0a1a0a", border: "1px solid #2a5a2a", borderRadius: 4, color: "#4c4", padding: 4, cursor: "pointer", fontSize: 14 }}>+</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 8 }}>
                    {Object.entries(ROOM_TYPES[selCell.type].produces).map(([r, a]) =>
                      <div key={r} style={{ color: "#4a7a4a" }}>+{a * selCell.workers}/tick {r}</div>
                    )}
                    {Object.entries(ROOM_TYPES[selCell.type].consumes).map(([r, a]) =>
                      <div key={r} style={{ color: "#7a4a4a" }}>-{a * selCell.workers}/tick {r}</div>
                    )}
                  </div>
                </>
              )}

              {/* Armory expedition UI */}
              {selCell.type === "armory" && (
                <div style={{ marginTop: 10 }}>
                  {!armoryArmed ? (
                    <div style={{ fontSize: 9, color: "#5a3a3a", border: "1px solid #3a1a1a", borderRadius: 4, padding: "6px 8px", textAlign: "center" }}>
                      Assign 1 armorer above to unlock expeditions
                    </div>
                  ) : expedition ? (
                    <div style={{ background: "#0d0008", border: "1px solid #ff444433", borderRadius: 6, padding: 8 }}>
                      <div style={{ color: "#ff8888", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>EXPEDITION IN PROGRESS</div>
                      <div style={{ fontSize: 13, marginBottom: 3 }}>
                        {EXPEDITION_TYPES[expedition.type].icon} {EXPEDITION_TYPES[expedition.type].label}
                      </div>
                      <div style={{ fontSize: 8, color: "#888", marginBottom: 4 }}>
                        {expedition.colonistIds.map(id => colonists.find(c => c.id === id)?.name ?? "?").join(", ")}
                      </div>
                      <div style={{ height: 6, background: "#0d1020", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${(expedition.ticksLeft / EXPEDITION_TYPES[expedition.type].duration) * 100}%`,
                          background: "#ff4444", transition: "width 0.4s",
                        }} />
                      </div>
                      <div style={{ fontSize: 8, color: "#5a3a3a", marginTop: 3 }}>
                        {expedition.ticksLeft} tick{expedition.ticksLeft !== 1 ? "s" : ""} remaining
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>LAUNCH EXPEDITION</div>
                      {Object.entries(EXPEDITION_TYPES).map(([key, def]) => {
                        const canSend = unassigned >= def.colonistsRequired;
                        return (
                          <button key={key} onClick={() => handleLaunchExpedition(key)} disabled={!canSend} style={{
                            display: "block", width: "100%", marginBottom: 6,
                            background: canSend ? "#100008" : "#0a0a0a",
                            border: `1px solid ${canSend ? def.color : "#1a1a1a"}`,
                            borderRadius: 5, padding: "7px 8px",
                            cursor: canSend ? "pointer" : "not-allowed", textAlign: "left",
                          }}>
                            <div style={{ fontSize: 11, color: canSend ? def.color : "#333" }}>{def.icon} {def.label}</div>
                            <div style={{ fontSize: 7, color: canSend ? "#556" : "#222", marginTop: 2, lineHeight: 1.4 }}>{def.desc}</div>
                            <div style={{ fontSize: 7, color: canSend ? "#883333" : "#222", marginTop: 3 }}>
                              {def.colonistsRequired} colonist · {def.duration} ticks · threat +{def.threatDelta} · {Math.round(def.failChance * 100)}% fail
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Hospital patient list */}
              {selCell.type === "hospital" && (() => {
                const injured = colonists.filter(c => c.status === "injured");
                const nurseCount = selCell.workers;
                const capacity   = nurseCount * 3;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "#ff6b9d", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
                      PATIENTS — {injured.length} in recovery
                    </div>
                    {nurseCount === 0 && injured.length > 0 && (
                      <div style={{ fontSize: 8, color: "#7a4a4a", background: "#1a0008", border: "1px solid #5a2030", borderRadius: 4, padding: "5px 7px", marginBottom: 6 }}>
                        ⚠ No nurses assigned — healing at 25% speed
                      </div>
                    )}
                    {nurseCount > 0 && (
                      <div style={{ fontSize: 8, color: "#556", marginBottom: 6 }}>
                        {nurseCount} nurse{nurseCount > 1 ? "s" : ""} · treating up to {capacity} patients
                      </div>
                    )}
                    {injured.length === 0 ? (
                      <div style={{ fontSize: 8, color: "#334", fontStyle: "italic" }}>No patients currently.</div>
                    ) : (
                      injured.map(col => (
                        <div key={col.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#100008", border: "1px solid #ff6b9d33", borderRadius: 4, padding: "4px 7px", marginBottom: 4 }}>
                          <div style={{ color: "#c8d0d8", fontSize: 9 }}>{col.name}</div>
                          <div style={{ color: "#ff6b9d", fontSize: 8, fontFamily: "monospace" }}>
                            ⚕ {col.injuryTicksLeft ?? 0}t
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}

              {/* Research Lab tech tree */}
              {selCell.type === "researchLab" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ color: "#00e5ff", fontSize: 9, letterSpacing: 1 }}>T2 TECHNOLOGIES</div>
                    <div style={{ color: "#00e5ff", fontSize: 9, fontFamily: "monospace" }}>{Math.floor(res.rp)} RP</div>
                  </div>
                  {Object.entries(T2_TECHS).map(([key, tech]) => {
                    const unlocked   = unlockedTechs.includes(key);
                    const canAfford  = res.rp >= tech.cost;
                    return (
                      <div key={key} style={{
                        marginBottom: 6, background: unlocked ? "#001a10" : "#0a0c14",
                        border: `1px solid ${unlocked ? "#00e5ff" : canAfford ? "#00e5ff44" : "#1a2030"}`,
                        borderRadius: 5, padding: "6px 8px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <div style={{ color: unlocked ? "#00e5ff" : canAfford ? "#aaa" : "#445", fontSize: 10 }}>
                            {tech.icon} {tech.label}
                          </div>
                          {unlocked ? (
                            <div style={{ color: "#00e5ff", fontSize: 8 }}>✓ DONE</div>
                          ) : (
                            <button onClick={() => handleUnlockTech(key)} disabled={!canAfford} style={{
                              background: canAfford ? "#003a4a" : "#0a0a0a",
                              border: `1px solid ${canAfford ? "#00e5ff" : "#1a2030"}`,
                              borderRadius: 3, color: canAfford ? "#00e5ff" : "#334",
                              padding: "2px 6px", cursor: canAfford ? "pointer" : "not-allowed", fontSize: 8,
                            }}>{tech.cost} RP</button>
                          )}
                        </div>
                        <div style={{ color: "#334", fontSize: 7, lineHeight: 1.4 }}>{tech.desc}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shelter panel */}
              {selCell.type === "shelter" && (() => {
                const sheltered = colonists.filter(c => c.status === "sheltered");
                const alarmOn   = sheltered.length > 0;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "#7ecfb4", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
                      SHELTER STATUS — {sheltered.length} sheltering
                    </div>
                    {alarmOn ? (
                      <>
                        <div style={{ background: "#001a0f", border: "1px solid #7ecfb433", borderRadius: 4, padding: "6px 8px", marginBottom: 8 }}>
                          {sheltered.map(col => (
                            <div key={col.id} style={{ color: "#7ecfb4", fontSize: 9, paddingBottom: 2 }}>🏠 {col.name}</div>
                          ))}
                        </div>
                        <button onClick={handleBackToWork} style={{ width: "100%", background: "#001a0f", border: "1px solid #7ecfb4", borderRadius: 4, color: "#7ecfb4", padding: "6px 8px", cursor: "pointer", fontSize: 9, letterSpacing: 1 }}>
                          🏠 BACK TO WORK
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 8, color: "#446655", marginBottom: 6 }}>
                          Sounds the alarm and pulls all idle/working colonists into shelter. Production stops but they cannot be targeted by Arc strikes.
                        </div>
                        <button onClick={handleSoundAlarm} style={{ width: "100%", background: "#1a0808", border: "1px solid #ff4444", borderRadius: 4, color: "#ff6666", padding: "6px 8px", cursor: "pointer", fontSize: 9, letterSpacing: 1 }}>
                          🚨 SOUND ALARM
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Sentry Post status */}
              {selCell.type === "sentryPost" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: "#e8d44d", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>SENTRY STATUS</div>
                  <div style={{ background: "#0d0f00", border: "1px solid #e8d44d33", borderRadius: 4, padding: "6px 8px" }}>
                    {selCell.workers === 0 ? (
                      <div style={{ color: "#5a5020", fontSize: 8 }}>No sentries assigned.</div>
                    ) : (
                      <>
                        <div style={{ color: "#c8d0d8", fontSize: 9 }}>🪖 {selCell.workers} sentry{selCell.workers > 1 ? "ies" : ""} active</div>
                        <div style={{ color: "#e8d44d", fontSize: 8, marginTop: 3 }}>-{selCell.workers * 5} threat/tick</div>
                        <div style={{ color: "#5a5020", fontSize: 7, marginTop: 2 }}>Sentries are exposed during raids.</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => { setSelected(null); setBuildMenu(false); }} style={{ flex: 1, background: "none", border: "1px solid #1e2a3a", borderRadius: 4, color: "#445", padding: 4, cursor: "pointer", fontSize: 9 }}>CLOSE</button>
                {selCell.damaged && (
                  <button onClick={() => handleRepair(selected.r, selected.c)} style={{ flex: 1, background: "#001a0a", border: "1px solid #20a040", borderRadius: 4, color: "#4ca060", padding: 4, cursor: "pointer", fontSize: 9 }}>🔧 REPAIR (20 scrap)</button>
                )}
                <button onClick={() => handleDemolish(selected.r, selected.c)} style={{ flex: 1, background: "#1a0000", border: "1px solid #5a2020", borderRadius: 4, color: "#844", padding: 4, cursor: "pointer", fontSize: 9 }}>DEMOLISH</button>
              </div>
            </div>
          )}

          {/* Default: legend */}
          {!selected && (
            <div style={{ background: "#080b14", border: "1px solid #1a2030", borderRadius: 8, padding: 10 }}>
              <div style={{ color: "#4ab3f4", fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>ROOM TYPES</div>
              {Object.entries(ROOM_TYPES).map(([, def]) => (
                <div key={def.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 11 }}>{def.icon}</span>
                  <div>
                    <div style={{ color: def.color, fontSize: 9 }}>{def.label}</div>
                    <div style={{ color: "#334", fontSize: 7 }}>
                      {def.special === "armory" ? "launches expeditions" :
                       Object.entries(def.produces).map(([r, a]) => `+${a} ${r}`).join(" ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Log */}
          <div style={{ background: "#050710", border: "1px solid #0d1520", borderRadius: 8, padding: 10, flex: 1 }}>
            <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>COLONY LOG</div>
            <div style={{ fontSize: 8, lineHeight: 1.9, maxHeight: 220, overflowY: "auto" }}>
              {log.map((entry, i) => (
                <div key={i} style={{ color: i === 0 ? "#5a8ab0" : "#2a4060", borderBottom: "1px solid #0d1520", paddingBottom: 2, marginBottom: 2 }}>
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 920, width: "100%", marginTop: 6, fontSize: 8, color: "#1a2535", letterSpacing: 1, textAlign: "center" }}>
        BUILD ARMORY + ASSIGN ARMORER → LAUNCH EXPEDITIONS · HIGH THREAT = ARC RAIDS · WORKSHOP IS YOUR LIFELINE
      </div>

      {/* ── TOAST NOTIFICATIONS ── */}
      <div style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        pointerEvents: "none", zIndex: 1000,
      }}>
        {toasts.map(toast => {
          const styles = {
            raid:    { bg: "#1a0000", border: "#ff4444", title: "#ff4444", icon: "🚨" },
            injury:  { bg: "#1a0a00", border: "#f5a623", title: "#f5a623", icon: "⚠️" },
            success: { bg: "#001a08", border: "#7ed321", title: "#7ed321", icon: "✅" },
            info:    { bg: "#00101a", border: "#4ab3f4", title: "#4ab3f4", icon: "ℹ️" },
          }[toast.type] || { bg: "#0a0a14", border: "#4ab3f4", title: "#4ab3f4" };

          const lines = toast.message.split("\n");
          const titleLine = lines[0];
          const bodyLines = lines.slice(1);

          return (
            <div key={toast.id} style={{
              background: styles.bg,
              border: `1px solid ${styles.border}`,
              borderLeft: `3px solid ${styles.border}`,
              borderRadius: 6,
              padding: "10px 16px",
              minWidth: 260, maxWidth: 360,
              boxShadow: `0 0 20px ${styles.border}44`,
              animation: "toastIn 0.2s ease-out",
            }}>
              <div style={{ color: styles.title, fontSize: 11, fontWeight: "bold", letterSpacing: 1.5, marginBottom: bodyLines.length ? 4 : 0 }}>
                {titleLine}
              </div>
              {bodyLines.map((line, i) => (
                <div key={i} style={{ color: "#8a9aaa", fontSize: 10, lineHeight: 1.6 }}>{line}</div>
              ))}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes raidPulse {
          0%, 100% { box-shadow: 0 0 24px #ff444444; }
          50%       { box-shadow: 0 0 40px #ff4444aa; }
        }
      `}</style>
    </div>
  );
}
