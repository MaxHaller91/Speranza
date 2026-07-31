// ─── gameData.js ─────────────────────────────────────────────────────────────
// All pure data, constants, and stateless helpers for Speranza.
// No React, no hooks, no side effects.

import { BACKSTORIES, QUIRKS, EXPEDITION_FLAVOR } from "../speranza-lore.js";

import powerCellSprite  from "./Assets/Buildings/Power Cell.png";
import waterPumpSprite  from "./Assets/Buildings/Water Pump.png";
import hydroponicsSprite from "./Assets/Buildings/Hydroponics.png";
import barracksSprite   from "./Assets/Buildings/Barracks.png";
import armorySprite     from "./Assets/Buildings/Armory.png";
import hospitalSprite   from "./Assets/Buildings/Hospital.png";
import earthTexture     from "./Assets/Buildings/Earth Texture.png";

export { earthTexture };

// ─── Constants ────────────────────────────────────────────────────────────────
export const GRID_COLS = 7;
export const GRID_ROWS = 4;
export const TICK_MS   = 4000;
export const MAX_RES   = 300;

// ─── Heat System ──────────────────────────────────────────────────────────────
// Heat is the pacing driver: it climbs as the colony grows, raids fire off it,
// and surviving one buys time. The intended rhythm is a sawtooth — build, get
// noticed, get hit, get a breather — with each cycle arriving sooner than the
// last because the colony is bigger.
export const HEAT_MAX              = 1000;
export const HEAT_BASE_GAIN        = 0.6;
export const HEAT_GAIN_PER_ROOM    = 0.35;
export const HEAT_DECAY_PER_TICK   = 0.3;
export const HEAT_RAID_GAIN        = 15;

// Sentries mitigate a PERCENTAGE of heat gain rather than a flat amount.
// A flat -5/worker meant one fully-staffed Sentry Post (-10/tick) out-ran the
// maximum possible gain from a completely full 28-cell grid, so building one
// switched the raid system off for the rest of the run.
export const HEAT_SENTRY_MITIGATION = 0.18; // per assigned sentry
export const HEAT_SENTRY_MITIGATION_CAP = 0.60; // never fully suppressed

// Raids roll every RAID_ROLL_EVERY ticks instead of only at midnight. Six
// checks a day means the cadence responds to heat instead of being one binary
// coin-flip per day that could leave 20 real minutes between raids.
export const RAID_ROLL_EVERY       = 8;
export const HEAT_RAID_PROB_BASE   = 0.05;  // ~1 raid / 3.3 days when unnoticed
export const HEAT_RAID_PROB_SCALE  = 0.16;  // ~1 raid / 0.8 days when MARKED

// Minimum ticks between raids, and the grace period on a fresh colony.
// Weathering a bigger assault buys proportionally more quiet.
export const RAID_COOLDOWN_TICKS   = 36;
export const RAID_GRACE_TICKS      = 60;
export const RAID_COOLDOWN_BY_SIZE = { small: 30, medium: 42, large: 60 };
export const raidCooldownFor = (sizeKey) => RAID_COOLDOWN_BY_SIZE[sizeKey] ?? RAID_COOLDOWN_TICKS;

// Fraction of current heat shed by surviving a raid / a barricade block. This
// is what turns heat from a bar that pins at max forever into a real cycle.
export const HEAT_RELIEF_RAID_SURVIVED = 0.35;
export const HEAT_RELIEF_BARRICADE     = 0.15;

/** Net heat change for one tick. Pure, so the tick loop stays testable. */
export function calcHeatDelta({ builtRooms, sentryWorkers, threatMult = 1, suppressed = false, heatGainMult = 1 }) {
  if (suppressed) return -HEAT_DECAY_PER_TICK;
  const gross = (HEAT_BASE_GAIN + builtRooms * HEAT_GAIN_PER_ROOM) * threatMult * heatGainMult;
  const mitigation = Math.min(
    HEAT_SENTRY_MITIGATION_CAP,
    sentryWorkers * HEAT_SENTRY_MITIGATION,
  );
  return gross * (1 - mitigation) - HEAT_DECAY_PER_TICK;
}

/** Chance of a raid opening on a single roll at this heat level. */
export function calcRaidChance(heat) {
  return HEAT_RAID_PROB_BASE + (heat / HEAT_MAX) * HEAT_RAID_PROB_SCALE;
}

export const HEAT_STATES = [
  { min: 0,   max: 199,  label: "UNDETECTED", color: "#7ed321" },
  { min: 200, max: 399,  label: "SCANNING",   color: "#ffcc00" },
  { min: 400, max: 599,  label: "TARGETED",   color: "#ff8800" },
  { min: 600, max: 799,  label: "HUNTED",     color: "#ff4444" },
  { min: 800, max: 1000, label: "MARKED",     color: "#ff0000" },
];

export const getHeatState = (h) => HEAT_STATES.find(s => h >= s.min && h <= s.max) ?? HEAT_STATES[0];

export const INJURY_TICKS_BASE = 40;
export const HEAL_RATE_NURSE   = 4;

// ─── Raid Sizes ───────────────────────────────────────────────────────────────
// `waves` is how many waves the surface-defense minigame runs for this size.
// It lives here so the minigame and the colony agree on one definition —
// surface_defense.jsx used to keep its own separate RAID_SIZES table.
export const RAID_SIZES = {
  small:  { label: "SMALL",  targets: 1, icon: "⚡", duration: 20, strikeEvery: 10, waves: 3 },
  medium: { label: "MEDIUM", targets: 2, icon: "🔥", duration: 30, strikeEvery: 10, waves: 5 },
  large:  { label: "LARGE",  targets: 3, icon: "💀", duration: 60, strikeEvery: 10, waves: 8 },
};
export const RAID_SIZE_ORDER  = ["small", "medium", "large"];
export const RAID_LAUNCH_CHANCE = 0.60;

// ─── Difficulty ───────────────────────────────────────────────────────────────
// Parameter plumbing over existing pure levers, not a redesign. heatMult and
// raidMult scale into calcHeatDelta/calcRaidChance's threatMult-style inputs,
// waveMult scales waveBudget()'s output, graceMult scales RAID_GRACE_TICKS and
// raidCooldownFor()'s cooldowns, and moraleDrainMult scales every *negative*
// morale delta (passive crowding/adjacency drain and event-driven losses) —
// the soak test found morale collapse, not resource starvation, kills an
// early unmanaged colony, so it gets its own lever alongside heat/raids.
export const DIFFICULTIES = {
  settler:   { label: "SETTLER",   desc: "Fewer, smaller raids and a colony that holds its nerve. For learning the systems.",
               heatMult: 0.7, raidMult: 0.7,  waveMult: 0.75, graceMult: 1.5, moraleDrainMult: 0.6 },
  survivor:  { label: "SURVIVOR",  desc: "The intended experience. The Arc find you eventually, and morale is a real cost.",
               heatMult: 1.0, raidMult: 1.0,  waveMult: 1.0,  graceMult: 1.0, moraleDrainMult: 1.0 },
  condemned: { label: "CONDEMNED", desc: "Relentless raids, little recovery time, and despair spreads fast. Expect to lose colonies.",
               heatMult: 1.3, raidMult: 1.35, waveMult: 1.3,  graceMult: 0.6, moraleDrainMult: 1.3 },
};
export const DIFFICULTY_ORDER = ["settler", "survivor", "condemned"];
export const DEFAULT_DIFFICULTY = "survivor";

// ─── Resolve & Talents (meta-progression) ────────────────────────────────────
// Surviving a raid used to pay nothing. The raid economy fix removed a broken
// reward that paid 685-1289 scrap win *or lose*, which was right, but it left a
// clean win netting about -15 scrap — you paid for turrets and got a thank-you.
//
// Resolve is deliberately NOT scrap. Scrap is run currency and more of it just
// inflates the economy; Resolve is meta-progression, spent on permanent talents
// that persist across colonies. Losing a colony keeps what you earned, which is
// the point — a failed run still moves you forward.
//
// Named "Resolve" rather than anything Arc-derived: see the IP note in
// plans/roadmap/README.md.
export const RESOLVE_PER_WAVE = 1;
export const RESOLVE_INTACT_BONUS = 3;   // hatch above 90%
export const RESOLVE_HELD_BONUS   = 1;   // hatch above 50%

/** Resolve earned for winning a raid. Pure so it can be unit-tested. */
export function resolveEarned({ waves = 0, hatchHp = 0 } = {}) {
  const base = Math.max(0, Math.round(waves)) * RESOLVE_PER_WAVE;
  const bonus = hatchHp >= 90 ? RESOLVE_INTACT_BONUS
              : hatchHp >= 50 ? RESOLVE_HELD_BONUS
              : 0;
  return base + bonus;
}

// Each talent modifies a value that already exists and is already isolated in a
// pure helper. Nothing here introduces a new system.
export const TALENTS = {
  deepSilence: {
    label: "Deep Silence", icon: "🔇", cost: 6,
    desc: "Arc heat accumulates 15% more slowly.",
    effect: "heatGainMult", value: 0.85,
  },
  rationing: {
    label: "Rationing Discipline", icon: "🥫", cost: 8,
    desc: "+4 ticks of empty stores before colonists start collapsing.",
    effect: "collapseTicksBonus", value: 4,
  },
  fieldMedicine: {
    label: "Field Medicine", icon: "⚕", cost: 6,
    desc: "Infirmary staff heal 50% faster.",
    effect: "healRateMult", value: 1.5,
  },
  standingReserve: {
    label: "Standing Reserve", icon: "🔧", cost: 7,
    desc: "+40 scrap of defense budget at the start of every raid.",
    effect: "defenseBudgetBonus", value: 40,
  },
  integratedDesign: {
    label: "Integrated Design", icon: "⚙", cost: 9,
    desc: "Room adjacency bonuses are 60% stronger.",
    effect: "adjacencyMult", value: 1.6,
  },
  hardenedHatch: {
    label: "Hardened Hatch", icon: "🛡", cost: 8,
    desc: "The surface hatch starts every raid with 130 HP instead of 100.",
    effect: "hatchHpBonus", value: 30,
  },
  steadyHands: {
    label: "Steady Hands", icon: "🧭", cost: 7,
    desc: "Morale losses are reduced by 20%.",
    effect: "moraleDrainMult", value: 0.8,
  },
  deepStores: {
    label: "Deep Stores", icon: "📦", cost: 10,
    desc: "A new colony begins with 60 extra scrap and food.",
    effect: "startingStockBonus", value: 60,
  },
};
export const TALENT_ORDER = [
  "deepSilence", "rationing", "fieldMedicine", "standingReserve",
  "integratedDesign", "hardenedHatch", "steadyHands", "deepStores",
];

/**
 * Collapse a list of unlocked talent keys into the multipliers/bonuses the game
 * reads. Returns neutral values when nothing is unlocked, so callers never need
 * to special-case an empty list.
 */
export function talentEffects(unlocked = []) {
  const e = {
    heatGainMult: 1, collapseTicksBonus: 0, healRateMult: 1,
    defenseBudgetBonus: 0, adjacencyMult: 1, hatchHpBonus: 0,
    moraleDrainMult: 1, startingStockBonus: 0,
  };
  for (const key of unlocked) {
    const t = TALENTS[key];
    if (!t) continue;
    // Multipliers compound; bonuses add. Only one talent touches each field
    // today, but this keeps a second one from silently overwriting the first.
    if (t.effect.endsWith("Mult")) e[t.effect] *= t.value;
    else e[t.effect] += t.value;
  }
  return e;
}

// ─── T2 Tech Tree ─────────────────────────────────────────────────────────────
export const T2_TECHS = {
  barricades: {
    label: "Barricades Lvl 1", icon: "🛡", cost: 50,
    desc: "40% chance to fully block an incoming raid. Costs 15 scrap to repair after a successful block.",
  },
  sentryPost: {
    label: "Sentry Post", icon: "🪖", cost: 75,
    desc: "Unlocks the Sentry Post building. Each assigned sentry cuts Arc heat gain by 18% (up to 60%). Sentries can never hide you completely.",
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
export const TRAITS = {
  veteran:   { label: "VETERAN",    icon: "🎖", color: "#f5a623", desc: "Never flees during raids." },
  ironLungs: { label: "IRON LUNGS", icon: "💪", color: "#ff6b9d", desc: "Heals 2× faster when injured." },
  scavenger: { label: "SCAVENGER",  icon: "🎒", color: "#bd10e0", desc: "+50% scrap from expeditions." },
  ghost:     { label: "GHOST",      icon: "👻", color: "#4ab3f4", desc: "50% less likely to be targeted in raids." },
  hardened:  { label: "HARDENED",   icon: "🛡", color: "#7ed321", desc: "Injury chance reduced — 20% instead of 30%." },
};
export const TRAIT_KEYS = Object.keys(TRAITS);

// ─── Name Pool ────────────────────────────────────────────────────────────────
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

// Called by handleRestart — initColonists also resets internally, but export
// this so Speranza.jsx never touches the module-level variable directly.
export function resetNameIdx() { nameIdx = 0; }

// ─── Colonist Factory ─────────────────────────────────────────────────────────
export const COLONIST_BASE = () => ({
  xp: 0, level: 0, traits: [], dutyTicks: 0, ticksAlive: 0, pendingTraitPick: false,
  joinTick: 0, expeditionsCompleted: 0, raidsSurvived: 0,
  // Which room this colonist is posted to, or null. Grid worker counts are
  // DERIVED from this — see reconcileAssignments(). Never edit cell.workers directly.
  assignedRoom: null,
  // Remembers the last post so shelter/injury recovery can send them back.
  previousRoom: null,
});

export function makeColonist(joinTick = 0) {
  const quirk     = QUIRKS[Math.floor(Math.random() * QUIRKS.length)];
  const backstory = BACKSTORIES[Math.floor(Math.random() * BACKSTORIES.length)];
  return {
    id: `c${Date.now()}-${Math.random()}`,
    name: nextName(),
    status: "idle",
    backstory,
    quirk,
    injuryCount: 0,
    joinTick,
    ...COLONIST_BASE(),
  };
}

// ─── Room Definitions ─────────────────────────────────────────────────────────
export const ROOM_TYPES = {
  power: {
    label: "Power Cell",     icon: "⚡", sprite: powerCellSprite, color: "#f5a623", bg: "#1a1200", border: "#f5a623",
    tag: "power",
    cost: { scrap: 10 },    produces: { energy: 4 }, consumes: {}, cap: 2,
    desc: "Generates energy to power the colony",
  },
  water: {
    label: "Water Recycler", icon: "💧", sprite: waterPumpSprite, color: "#4a90e2", bg: "#00101f", border: "#4a90e2",
    tag: "lifeSupport",
    cost: { scrap: 15 },    produces: { water: 3 }, consumes: { energy: 1 }, cap: 2,
    desc: "Recycles water, needs energy",
  },
  hydro: {
    label: "Hydroponics",    icon: "🌱", sprite: hydroponicsSprite, color: "#7ed321", bg: "#0a1a00", border: "#7ed321",
    tag: "lifeSupport",
    cost: { scrap: 20 },    produces: { food: 2 }, consumes: { energy: 1, water: 1 }, cap: 2,
    desc: "Grows food, needs energy + water",
  },
  workshop: {
    label: "Workshop",       icon: "🔧", color: "#bd10e0", bg: "#10001a", border: "#bd10e0",
    tag: "industry",
    cost: { scrap: 0 },     produces: { scrap: 2 }, consumes: { energy: 1 }, cap: 2,
    desc: "Makes scrap for construction",
  },
  barracks: {
    label: "Barracks",       icon: "🛏", sprite: barracksSprite, color: "#e0b84a", bg: "#1a1200", border: "#e0b84a",
    tag: "living",
    cost: { scrap: 25 },    produces: {}, consumes: {}, cap: 0,
    popBonus: 2,
    desc: "Houses colonists (+2 pop cap)",
    special: "barracks",
  },
  armory: {
    label: "Armory",         icon: "⚔️", sprite: armorySprite, color: "#ff4444", bg: "#1a0000", border: "#ff4444",
    tag: "industry",
    cost: { scrap: 40 },    produces: {}, consumes: { energy: 1 }, cap: 5,
    desc: "Enables surface expeditions. Needs 1 armorer assigned.",
    special: "armory",
  },
  hospital: {
    label: "Hospital",       icon: "🏥", sprite: hospitalSprite, color: "#ff6b9d", bg: "#1a0010", border: "#ff6b9d",
    tag: "care",
    cost: { scrap: 35 },    produces: {}, consumes: { energy: 1 }, cap: 2,
    desc: "Heals injured colonists. 1 nurse treats up to 3 patients. Without nurses, healing is 4× slower.",
    special: "hospital",
  },
  researchLab: {
    label: "Research Lab",   icon: "🔬", color: "#00e5ff", bg: "#001a1f", border: "#00e5ff",
    tag: "industry",
    cost: { scrap: 45 },    produces: { rp: 1 }, consumes: { energy: 1 }, cap: 2,
    desc: "Generates research points to unlock T2 technologies. Assign researchers to accelerate progress.",
    special: "researchLab",
  },
  sentryPost: {
    label: "Sentry Post",    icon: "🪖", color: "#e8d44d", bg: "#1a1500", border: "#e8d44d",
    tag: "defense",
    cost: { scrap: 30 },    produces: {}, consumes: {}, cap: 2,
    desc: "Each assigned sentry cuts Arc heat gain by 18%, up to a 60% cap. Sentries man the surface bunker and are exposed during raids.",
    special: "sentryPost", requiresTech: "sentryPost",
  },
  radioTower: {
    label: "Radio Tower",    icon: "📡", color: "#4ab3f4", bg: "#001020", border: "#4ab3f4",
    tag: "defense",
    cost: { scrap: 40 },    produces: {}, consumes: { energy: 1 }, cap: 0,
    desc: "Reveals incoming raid size when a raid window opens. Without it, raid size is unknown until it strikes.",
    special: "radioTower", requiresTech: "radioTower",
  },
  shelter: {
    label: "Shelter",        icon: "🏠", color: "#7ecfb4", bg: "#001a12", border: "#7ecfb4",
    tag: "defense",
    cost: { scrap: 50 },    produces: {}, consumes: {}, cap: 0,
    desc: "Sound the alarm to shelter colonists. Sheltered colonists are immune to Arc strikes.",
    special: "shelter", requiresTech: "shelter",
  },
  tavern: {
    label: "Tavern",         icon: "🍺", color: "#d4a843", bg: "#1a1000", border: "#d4a843",
    tag: "living",
    cost: { scrap: 40 },    produces: {}, consumes: { water: 1, energy: 1 }, cap: 2,
    desc: "Boosts colony morale. Each bartender generates +1.5 morale/tick. Requires water + energy.",
    special: "tavern",
  },
  diningHall: {
    label: "Dining Hall",    icon: "🍽", color: "#e8855a", bg: "#1a0a00", border: "#e8855a",
    tag: "living",
    cost: { scrap: 35 },    produces: {}, consumes: { food: 2, energy: 1 }, cap: 2,
    desc: "Boosts colony morale. Each cook generates +1.5 morale/tick. Requires food + energy.",
    special: "diningHall",
  },
  arcTurret: {
    label: "Arc Turret",     icon: "🔫", color: "#ff6622", bg: "#1a0800", border: "#ff6622",
    tag: "defense",
    cost: { scrap: 60, salvage: 8, arcTech: 3 }, produces: {}, consumes: { energy: 2 }, cap: 0,
    desc: "Automated defense. 30% chance per strike to eliminate 1 incoming Arc unit. Drains 2 energy/tick.",
    special: "arcTurret", requiresSchematic: "turretSchematics",
  },
  empArray: {
    label: "EMP Array",      icon: "⚡🔲", color: "#bb44ff", bg: "#10001a", border: "#bb44ff",
    tag: "defense",
    cost: { scrap: 80, salvage: 10, arcTech: 5 }, produces: {}, consumes: { energy: 3 }, cap: 1,
    desc: "50% to reduce raid by 1 target. Delays next strike +3 ticks. Requires 1 operator.",
    special: "empArray", requiresSchematic: "empSchematics",
  },
  blastDoors: {
    label: "Blast Doors",    icon: "🛡", color: "#aaaaaa", bg: "#111114", border: "#aaaaaa",
    tag: "defense",
    cost: { scrap: 50, salvage: 6, arcTech: 2 }, produces: {}, consumes: {}, cap: 0,
    desc: "Passive. 40% chance to absorb building damage targeting row 0 per strike.",
    special: "blastDoors", requiresSchematic: "fortSchematics",
  },
  geothermal: {
    label: "Geothermal Gen", icon: "🌋", color: "#ff8800", bg: "#1a0800", border: "#ff8800",
    tag: "power",
    cost: { scrap: 70, salvage: 12, arcTech: 4 }, produces: { energy: 6 }, consumes: {}, cap: 0,
    desc: "Passive +6 energy/tick. No workers needed. Unlocked by -40m excavation.",
    special: "geothermal", requiresSchematic: "geoSchematics",
  },
  memorial: {
    label: "Memorial Hall",  icon: "🕯", color: "#9988bb", bg: "#0a0814", border: "#9988bb",
    tag: "care",
    cost: { scrap: 30 },    produces: {}, consumes: {}, cap: 0,
    desc: "A place to grieve. Death morale penalty −40%. Raid morale loss −2/strike.",
    special: "memorial",
  },
};

// ─── Room Adjacency ───────────────────────────────────────────────────────────
// Before this, only a room's ROW mattered (raid targeting weights by depth) —
// columns did nothing at all, so five of every six placement decisions were
// meaningless and building felt like filling in a form.
//
// Rules operate on room TAGS, not on pairs of specific rooms. Four tag rules
// cover all 18 room types, and any room added later inherits the behaviour for
// free. A pairwise table would have been ~150 combinations to author and tune.
//
// The four rules deliberately pull against each other: cluster life support,
// but spread power out to touch consumers; keep industry away from the
// barracks, but pull the hospital toward them. On a 7-wide row that is a real
// layout problem with no single right answer.
export const ADJACENCY_RULES = [
  {
    id: "plumbing", self: "lifeSupport", other: "lifeSupport",
    label: "shared plumbing", good: true,
    outputMult: 0.15,
    desc: "Life-support rooms side by side share feed lines. +15% output each.",
  },
  {
    id: "gridTap", self: "*consumer", other: "power",
    label: "direct power tap", good: true,
    energyDelta: -1,
    desc: "Sitting next to a generator saves a unit of transmission loss. -1 energy upkeep.",
  },
  {
    id: "noise", self: "industry", other: "living",
    label: "machine noise", good: false,
    moraleDelta: -0.4,
    desc: "Nobody sleeps next to a workshop. -0.4 morale per tick.",
  },
  {
    id: "bedside", self: "care", other: "living",
    label: "bedside manner", good: true,
    healMult: 0.25,
    desc: "Care rooms beside quarters mean shorter trips for the wounded. +25% healing.",
  },
];

/** Horizontal neighbours only — the row is the layout puzzle. */
export function neighboursOf(grid, r, c) {
  const out = [];
  [[r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
    const cell = grid[nr]?.[nc];
    if (cell?.type) out.push({ r: nr, c: nc, cell, def: ROOM_TYPES[cell.type] });
  });
  return out;
}

/**
 * Adjacency effects for one cell. Pure — feed it the grid and a position.
 * Returns multipliers/deltas plus readable notes for the tooltip.
 */
export function calcAdjacency(grid, r, c, adjacencyMult = 1) {
  const cell = grid[r]?.[c];
  const result = { outputMult: 1, energyDelta: 0, moraleDelta: 0, healMult: 1, notes: [] };
  if (!cell?.type) return result;
  const def = ROOM_TYPES[cell.type];
  if (!def) return result;

  const isConsumer = (def.consumes?.energy ?? 0) > 0;

  neighboursOf(grid, r, c).forEach(({ def: nDef }) => {
    ADJACENCY_RULES.forEach(rule => {
      const selfMatches = rule.self === "*consumer" ? isConsumer : def.tag === rule.self;
      // Rules are symmetric: a Hospital beside Barracks and Barracks beside a
      // Hospital both benefit, so check the pairing in both directions.
      const forward  = selfMatches && nDef.tag === rule.other;
      const backward = def.tag === rule.other &&
        (rule.self === "*consumer" ? (nDef.consumes?.energy ?? 0) > 0 : nDef.tag === rule.self);
      if (!forward && !backward) return;

      // The Integrated Design talent scales how much each rule is worth. It
      // scales penalties too — a stronger layout effect cuts both ways.
      if (rule.outputMult)  result.outputMult += rule.outputMult * adjacencyMult;
      if (rule.energyDelta) result.energyDelta += rule.energyDelta * adjacencyMult;
      if (rule.moraleDelta) result.moraleDelta += rule.moraleDelta * adjacencyMult;
      if (rule.healMult)    result.healMult += rule.healMult * adjacencyMult;
      result.notes.push({
        ruleId: rule.id,
        good: rule.good,
        text: `${rule.label} — ${nDef.label}`,
      });
    });
  });
  return result;
}

/** Total per-tick morale change from every room's adjacency. */
export function calcAdjacencyMorale(grid) {
  let total = 0;
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell.type) return;
    total += calcAdjacency(grid, r, c).moraleDelta;
  }));
  // Each noisy pair is counted from both sides; halve so a pair costs its rule.
  return total / 2;
}

// ─── Excavation Definitions ───────────────────────────────────────────────────
export const EXCAVATION_DEFS = {
  1: { scrap: 40,  workers: 1, ticks: 15, label: "-20m", discovery: "Old utility tunnels. Power Cell costs 5 less scrap on this level." },
  2: { scrap: 80,  workers: 2, ticks: 25, label: "-30m", discovery: "Pre-Arc storage vaults. +60 scrap found in the rubble." },
  3: { scrap: 150, workers: 2, ticks: 40, label: "-40m", discovery: "Deep geothermal vents detected. Geothermal Generator unlocked." },
};

// ─── Expedition Definitions ───────────────────────────────────────────────────
export const EXPEDITION_TYPES = {
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

// ─── Expedition Roll Tables ───────────────────────────────────────────────────
export function randBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

export const EXPEDITION_ROLL_TABLES = {
  scav: [
    { id: "scrap_cache", weight: 35, type: "good",    label: "Found a scrap cache",         apply: () => ({ scrap: randBetween(15, 30) }) },
    { id: "salvage",     weight: 25, type: "good",    label: "Recovered salvage",            apply: () => ({ salvage: randBetween(2, 4) }) },
    { id: "survivor",    weight: 8,  type: "good",    label: "Encountered a survivor",       apply: () => ({ survivor: true }) },
    { id: "nothing",     weight: 20, type: "neutral", label: "Nothing found — kept moving",  apply: () => ({}) },
    { id: "injured",     weight: 8,  type: "bad",     label: "took a hit",                   apply: () => "injure" },
    { id: "killed",      weight: 4,  type: "bad",     label: "was killed",                   apply: () => "kill" },
  ],
  strike: [
    { id: "arc_tech",    weight: 30, type: "good",    label: "Salvaged Arc Tech components", apply: () => ({ arcTech: randBetween(1, 2) }) },
    { id: "salvage",     weight: 25, type: "good",    label: "Recovered salvage haul",       apply: () => ({ salvage: randBetween(3, 6) }) },
    { id: "schematic",   weight: 5,  type: "good",    label: "Found a schematic",            apply: () => ({ schematic: true }) },
    { id: "ambush",      weight: 15, type: "neutral", label: "Ambushed — retreated empty",   apply: () => ({}) },
    { id: "injured",     weight: 15, type: "bad",     label: "took a hit",                   apply: () => "injure" },
    { id: "killed",      weight: 10, type: "bad",     label: "was killed",                   apply: () => "kill" },
  ],
};

// ─── Expedition advancement (pure) ───────────────────────────────────────────
// The whole expedition system used to live inside
// `setExpeditions(prev => prev.map(...))`, rolling Math.random and calling
// setColonists / addLog / addToast / playKill from inside the updater. Under
// StrictMode that ran twice per tick with *different* random outcomes, so loot,
// injuries and deaths were resolved twice and only one result survived.
//
// This is the pure half: given a snapshot it returns the next expedition list
// plus a list of declarative intents. The caller applies each intent exactly
// once, outside every updater. RNG is injected so this is testable.

/** Weighted pick from a roll table. */
function pickWeighted(table, rng) {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const entry of table) { r -= entry.weight; if (r <= 0) return entry; }
  return table[table.length - 1];
}

/** Build the outcome table for one expedition, with all modifiers applied. */
function buildRollTable(exp, crew, condEffects) {
  let table = applyMoraleModifier([...EXPEDITION_ROLL_TABLES[exp.type]], exp.moraleSnapshot);
  const goodMult = condEffects?.expedGoodMult ?? 1.0;
  const badMult  = condEffects?.expedBadMult ?? 1.0;
  const scale = (t, mult) => { table = table.map(e => e.type === t ? { ...e, weight: e.weight * mult } : e); };
  scale("good", goodMult);
  scale("bad", badMult);
  crew.forEach(col => {
    if (col.traits?.includes("scavenger") && exp.type === "scav") scale("good", 1.15);
    if (col.traits?.includes("ghost")) scale("bad", 0.9);
  });
  if (exp.quirkBonuses?.surfaceBorn) scale("good", 1.2);
  // Destination danger. SURFACE_LOCATIONS has carried rollMods since it was
  // written but nothing ever read them, so every destination played identically.
  const loc = exp.locationMods ?? {};
  if (loc.badMult) scale("bad", loc.badMult);
  return table;
}

const ALL_SCHEMATICS = ["turretSchematics", "empSchematics", "fortSchematics", "geoSchematics", "researchSchematics"];

/** Award an unclaimed schematic, if any remain. Mutates loot + claimed list. */
function grantSchematic(updated, loot, claimed, rng, tickLabel, intents) {
  const available = ALL_SCHEMATICS.filter(s => !claimed.includes(s));
  if (available.length === 0) return;
  const found = available[Math.floor(rng() * available.length)];
  claimed.push(found);
  loot.schematicFound = found;
  updated.eventLog.push(`${tickLabel} 📋 SCHEMATIC FOUND — ${found}!`);
  intents.push({ type: "toast", message: `📋 SCHEMATIC RECOVERED\n${found}\nCheck the build menu.`, kind: "success" });
}

/**
 * Advance every expedition by one tick.
 * @returns {{ nextExpeditions: object[], intents: object[] }}
 */
export function advanceExpeditions(expeditions, ctx, rng = Math.random) {
  const { colonists, ownedSchematics = [], condEffects = {}, tick = 0, memorialHall = false } = ctx;
  const intents = [];
  // Two expeditions can resolve in the same tick; track schematics claimed
  // during this call so they can't both find the same one.
  const claimedSchematics = [...ownedSchematics];
  // A colonist killed by one expedition must not also be hit by another.
  const removedIds = new Set();
  let changed = false;

  const next = expeditions.map(exp => {
    const updated = {
      ...exp,
      ticksLeft: exp.ticksLeft - 1,
      rollCountdown: exp.rollCountdown - 1,
      eventLog: [...exp.eventLog],
      lootAccumulated: { ...exp.lootAccumulated },
    };
    changed = true;

    const crew = colonists.filter(c => exp.colonistIds.includes(c.id) && !removedIds.has(c.id));
    const tickLabel = `[T${tick}]`;
    const chatter = (outcomeType) => {
      if (condEffects.expedSilent) return "";
      const pool = EXPEDITION_FLAVOR[exp.type]?.[outcomeType];
      if (!pool || pool.length === 0) return "";
      return pool[Math.floor(rng() * pool.length)] + " ";
    };

    // ── Periodic outcome roll ──
    if (updated.rollCountdown <= 0 && updated.ticksLeft > 0) {
      const picked = pickWeighted(buildRollTable(exp, crew, condEffects), rng);
      const result = picked.apply(exp);

      if (result === "injure" || result === "kill") {
        const target = crew.length > 0 ? crew[Math.floor(rng() * crew.length)] : null;
        if (target) {
          updated.eventLog.push(`${tickLabel} ${chatter("bad")}${target.name} ${picked.label}.`);
          if (result === "injure") {
            intents.push({ type: "injureColonist", colonistId: target.id });
            intents.push({ type: "morale", delta: -10, reason: "colonist injured on expedition" });
            intents.push({ type: "sound", name: "injury" });
          } else {
            removedIds.add(target.id);
            updated.colonistIds = updated.colonistIds.filter(id => id !== target.id);
            intents.push({ type: "killColonist", colonist: target });
            intents.push({ type: "morale", delta: memorialHall ? -12 : -20, reason: "colonist killed on expedition" });
            intents.push({ type: "sound", name: "kill" });
          }
        }
      } else if (typeof result === "object") {
        const loot = updated.lootAccumulated;
        const loc  = exp.locationMods ?? {};
        const mult = (v, m) => Math.max(1, Math.round(v * (m ?? 1)));
        if (result.scrap)   loot.scrap   = (loot.scrap   || 0) + mult(result.scrap,   loc.scrapMult)   + (exp.quirkBonuses?.packRat ? 1 : 0);
        if (result.salvage) loot.salvage = (loot.salvage || 0) + mult(result.salvage, loc.salvageMult) + (exp.quirkBonuses?.packRat ? 1 : 0);
        if (result.arcTech) loot.arcTech = (loot.arcTech || 0) + mult(result.arcTech, loc.arcTechMult);
        // The Greenhouse is the one place that grows anything — worth a run of
        // its own now that running out of food actually kills people.
        if (loc.foodBonus && result.scrap) loot.food = (loot.food || 0) + Math.round(result.scrap * 0.9);
        if (result.survivor) loot.survivor = true;
        if (result.schematic) grantSchematic(updated, loot, claimedSchematics, rng, tickLabel, intents);
        updated.eventLog.push(`${tickLabel} ${chatter(picked.type)}${picked.label}.`);
      }

      // Destination-specific extra chances, rolled once per outcome roll.
      {
        const loc = exp.locationMods ?? {};
        const loot = updated.lootAccumulated;
        if (loc.survivorChance && !loot.survivor && rng() < loc.survivorChance) {
          loot.survivor = true;
          updated.eventLog.push(`${tickLabel} 🧍 Someone is out here. Alive.`);
        }
        if (loc.schematicBonus && !loot.schematicFound && rng() < loc.schematicBonus) {
          grantSchematic(updated, loot, claimedSchematics, rng, tickLabel, intents);
        }
      }
      updated.rollCountdown = exp.rollEvery;
    }

    // ── Return ──
    if (updated.ticksLeft <= 0) {
      const loot = updated.lootAccumulated;
      const hasGoodLoot = (loot.scrap || 0) > 0 || (loot.salvage || 0) > 0
                       || (loot.arcTech || 0) > 0 || (loot.food || 0) > 0;
      intents.push({ type: "trace", event: "expedition_returned", detail: updated.type });
      intents.push({ type: "collectLoot", loot });
      if (loot.survivor) intents.push({ type: "survivor" });
      // Only colonists still alive come home.
      intents.push({ type: "returnCrew", colonistIds: updated.colonistIds.filter(id => !removedIds.has(id)) });
      const haul = [
        loot.scrap   && `+${loot.scrap} scrap`,
        loot.food    && `+${loot.food} food`,
        loot.salvage && `+${loot.salvage} salvage`,
        loot.arcTech && `+${loot.arcTech} arcTech`,
      ].filter(Boolean).join(" · ");
      intents.push({
        type: "log",
        text: `✅ ${updated.locationLabel ?? "Expedition"} run returned. ${hasGoodLoot ? haul : "Empty-handed."}`,
      });
      intents.push({
        type: "toast",
        message: `✅ EXPEDITION COMPLETE\n${hasGoodLoot ? "Resources recovered." : "They came back empty-handed."}`,
        kind: hasGoodLoot ? "success" : "info",
      });
      intents.push({
        type: "morale",
        delta: (hasGoodLoot ? 8 : -5) + ((updated.quirkBonuses?.loudmouth && hasGoodLoot) ? 5 : 0),
        reason: hasGoodLoot ? "expedition success" : "expedition failed",
      });
      intents.push({ type: "expeditionComplete" });
      intents.push({ type: "sound", name: "success" });
      return null;
    }
    return updated;
  }).filter(Boolean);

  return { nextExpeditions: changed ? next : expeditions, intents };
}

export function applyMoraleModifier(table, moraleSnapshot) {
  const modifier = moraleSnapshot > 75 ? 1.15 : moraleSnapshot > 25 ? 1.0 : moraleSnapshot > 0 ? 0.9 : 0.8;
  return table.map(entry => ({
    ...entry,
    weight: entry.type === "good" ? entry.weight * modifier
          : entry.type === "bad"  ? entry.weight / modifier
          : entry.weight,
  }));
}

// ─── Deprivation (starvation / dehydration) ──────────────────────────────────
// Running out of food or water used to end the run instantly — one tick the
// colony was fine, the next it was over, with no chance to react. It is now a
// visible, escalating process: warning, then collapses, then deaths, and the
// run only ends when the last colonist is gone.
export const DEPRIVE_COLLAPSE_TICKS = 6;    // people start dropping
export const DEPRIVE_DEATH_TICKS    = 16;   // people start dying
export const DEPRIVE_COLLAPSE_CHANCE = 0.09;
export const DEPRIVE_DEATH_CHANCE    = 0.07;
export const DEPRIVE_MORALE_PER_TICK = -3;

/** Ticks until a stock hits zero at this net rate. null when it isn't falling. */
export function ticksToEmpty(amount, netPerTick) {
  if (!(netPerTick < 0)) return null;
  return Math.max(0, Math.ceil(amount / -netPerTick));
}

/** How dire things are, for both UI and tick-loop effects. */
export function deprivationStage(deprivedTicks, collapseTicksBonus = 0) {
  if (deprivedTicks <= 0) return "none";
  if (deprivedTicks < DEPRIVE_COLLAPSE_TICKS + collapseTicksBonus) return "warning";
  if (deprivedTicks < DEPRIVE_DEATH_TICKS + collapseTicksBonus) return "collapsing";
  return "dying";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const DRAIN_PER_COL = { food: 0.4, water: 0.4, energy: 0.2 };
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export const EMPTY_STAT_BREAKDOWN = { plus: [], minus: [], net: 0 };

// Save safety helper: disable save/load actions during volatile raid phases
export function isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize }) {
  return !!(raidWindow || activeRaid || surfaceDefenseActive || pendingRaidSize);
}

export function calcColonyWealth(res, grid, colonists) {
  const resourceWealth = (res?.scrap ?? 0) + (res?.energy ?? 0) + (res?.food ?? 0) + (res?.water ?? 0);
  let builtRooms = 0;
  grid?.forEach(row => row?.forEach(cell => { if (cell?.type) builtRooms += 1; }));
  const roomWealth = builtRooms * 40;
  const popWealth = (colonists?.length ?? 0) * 15;
  return resourceWealth + roomWealth + popWealth;
}

export function getWealthBracket(wealth) {
  if (wealth < 300) return 0;
  if (wealth < 600) return 1;
  if (wealth < 1000) return 2;
  return 3;
}

// ─── Assignment ↔ Grid Reconciliation ────────────────────────────────────────
// `cell.workers` is a DERIVED mirror of how many colonists are posted to that
// cell. Assignment lives on the colonist (`assignedRoom`); this pair of helpers
// keeps the mirror honest. Both return the input reference unchanged when there
// is nothing to fix, so they are safe to call from an effect without looping.

const ROOM_KEY = (r, c) => `${r}-${c}`;

/** True when this status means the colonist is actively manning their post. */
export function isOnPost(status) {
  return status === "working" || status === "onSentry";
}

/** Map of "r-c" → number of colonists currently manning that cell. */
export function computeWorkerCounts(colonists) {
  const counts = new Map();
  colonists.forEach(col => {
    if (!col.assignedRoom || !isOnPost(col.status)) return;
    const key = ROOM_KEY(col.assignedRoom.r, col.assignedRoom.c);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

/**
 * Clear assignments that point at a room which no longer exists (demolished,
 * or over capacity after a rebuild). Returns the same array if all are valid.
 */
export function pruneInvalidAssignments(colonists, grid) {
  const seatsUsed = new Map();
  let changed = false;
  const next = colonists.map(col => {
    if (!col.assignedRoom) return col;
    const { r, c } = col.assignedRoom;
    const cell = grid[r]?.[c];
    const def  = cell?.type ? ROOM_TYPES[cell.type] : null;
    const key  = ROOM_KEY(r, c);
    const used = seatsUsed.get(key) ?? 0;
    const valid = !!def && def.cap > 0 && used < def.cap;
    if (valid) {
      if (isOnPost(col.status)) seatsUsed.set(key, used + 1);
      return col;
    }
    changed = true;
    return {
      ...col,
      assignedRoom: null,
      status: isOnPost(col.status) ? "idle" : col.status,
    };
  });
  return changed ? next : colonists;
}

/** Rewrite every cell's `workers` to match the colonist assignments. */
export function reconcileGridWorkers(grid, colonists) {
  const counts = computeWorkerCounts(colonists);
  let changed = false;
  const next = grid.map((row, r) => row.map((cell, c) => {
    const want = cell.type ? (counts.get(ROOM_KEY(r, c)) ?? 0) : 0;
    if (cell.workers === want) return cell;
    changed = true;
    return { ...cell, workers: want };
  }));
  return changed ? next : grid;
}

/** The status a colonist takes when posted to this room type. */
export function postStatusFor(roomType) {
  return roomType === "sentryPost" ? "onSentry" : "working";
}

/** Map of "r-c" → seats currently filled. Mutate as you hand out more. */
export function occupiedSeats(colonists) {
  const seats = new Map();
  colonists.forEach(col => {
    if (!col.assignedRoom || !isOnPost(col.status)) return;
    const key = ROOM_KEY(col.assignedRoom.r, col.assignedRoom.c);
    seats.set(key, (seats.get(key) ?? 0) + 1);
  });
  return seats;
}

/**
 * Send a colonist coming off shelter/injury/expedition/excavation back to the
 * post they left, if that room still exists and still has a free seat.
 * Claims the seat in `seats` on success. Returns a patch to spread onto the
 * colonist, plus `room` (the ROOM_TYPES def) so callers can log it.
 */
export function reclaimPost(col, grid, seats) {
  const home = col.previousRoom;
  const cell = home ? grid[home.r]?.[home.c] : null;
  const def  = cell?.type ? ROOM_TYPES[cell.type] : null;
  if (!def || def.cap <= 0) return { status: "idle", assignedRoom: null, room: null };
  const key = ROOM_KEY(home.r, home.c);
  if ((seats.get(key) ?? 0) >= def.cap) return { status: "idle", assignedRoom: null, room: null };
  seats.set(key, (seats.get(key) ?? 0) + 1);
  return { status: postStatusFor(cell.type), assignedRoom: { ...home }, room: def };
}

// ─── Row-Based Raid Targeting ─────────────────────────────────────────────────
export function weightedTargetPick(colonists, grid, sizeDef) {
  // Surface-adjacent rows are far more exposed than deep ones.
  const rowWeights = [4, 3, 2, 1];
  const weighted = colonists.map(col => {
    let rowIdx;
    if (col.status === "excavating")      rowIdx = 3;   // deepest, digging
    else if (col.status === "onSentry")   rowIdx = 0;   // manning the surface bunker
    else if (col.assignedRoom)           rowIdx = col.assignedRoom.r;
    else                                  rowIdx = 1;   // idle in the commons
    let weight = rowWeights[rowIdx] ?? 1;
    if (col.traits?.includes("ghost")) weight *= 0.5;
    return { col, weight };
  });
  const targets = [];
  const pool = [...weighted];
  for (let i = 0; i < sizeDef.targets && pool.length > 0; i++) {
    const total = pool.reduce((s, w) => s + w.weight, 0);
    let rand = Math.random() * total;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].weight;
      if (rand <= 0) { targets.push(pool[j].col); pool.splice(j, 1); break; }
    }
  }
  return targets;
}

// ─── Grid Factory ─────────────────────────────────────────────────────────────
export function makeGrid() {
  return Array.from({ length: GRID_ROWS }, (_, r) =>
    Array.from({ length: GRID_COLS }, (_, c) => ({ id: `${r}-${c}`, type: null, workers: 0, damaged: false }))
  );
}

export function initColonists() {
  nameIdx = 0; // reset name counter for fresh colony
  // The two starters are posted to the Workshop and Power Cell laid down by
  // initGrid(); their assignedRoom is what makes those cells read as staffed.
  return [
    { id: "c0", name: nextName(), status: "working", backstory: BACKSTORIES[0], quirk: QUIRKS[0], injuryCount: 0, ...COLONIST_BASE(), assignedRoom: { r: 0, c: 0 } },
    { id: "c1", name: nextName(), status: "working", backstory: BACKSTORIES[1], quirk: QUIRKS[1], injuryCount: 0, ...COLONIST_BASE(), assignedRoom: { r: 0, c: 1 } },
    { id: "c2", name: nextName(), status: "idle",    backstory: BACKSTORIES[2], quirk: QUIRKS[2], injuryCount: 0, ...COLONIST_BASE() },
  ];
}

export function initGrid() {
  const g = makeGrid();
  g[0][0] = { id: "0-0", type: "workshop", workers: 1, damaged: false };
  g[0][1] = { id: "0-1", type: "power",    workers: 1, damaged: false };
  g[0][2] = { id: "0-2", type: "barracks", workers: 0, damaged: false };
  return g;
}

export const INIT_RES = { energy: 80, food: 60, water: 60, scrap: 50, rp: 0 };

// ─── Status display maps ──────────────────────────────────────────────────────
export const STATUS_COLOR = {
  idle:         "#7ed321",
  working:      "#4ab3f4",
  onExpedition: "#f5a623",
  injured:      "#ff4444",
  onSentry:     "#e8d44d",
  sheltered:    "#7ecfb4",
  excavating:   "#a0522d",
};
export const STATUS_LABEL = {
  idle:         "IDLE",
  working:      "ON DUTY",
  onExpedition: "DEPLOYED",
  injured:      "INJURED",
  onSentry:     "ON SENTRY",
  sheltered:    "SHELTERED",
  excavating:   "EXCAVATING",
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
export function tickToDayHour(t) {
  const day = Math.floor(t / 48) + 1;
  const halfHours = t % 48;
  const hour = String(Math.floor(halfHours / 2)).padStart(2, "0");
  const min  = halfHours % 2 === 1 ? "30" : "00";
  return `DAY ${day} · ${hour}:${min}`;
}

// ─── Milestone trigger checker ────────────────────────────────────────────────
export function checkMilestoneTrigger(trigger, snap) {
  if (trigger.raidsRepelled        !== undefined && snap.raidsRepelled        < trigger.raidsRepelled)        return false;
  if (trigger.totalDeaths          !== undefined && snap.totalDeaths          < trigger.totalDeaths)          return false;
  if (trigger.expeditionsCompleted !== undefined && snap.expeditionsCompleted < trigger.expeditionsCompleted) return false;
  if (trigger.population           !== undefined && snap.population           < trigger.population)           return false;
  if (trigger.day                  !== undefined && snap.day                  < trigger.day)                  return false;
  if (trigger.schematics           !== undefined && snap.schematics           < trigger.schematics)           return false;
  if (trigger.t3Built              !== undefined && snap.t3Built              < trigger.t3Built)              return false;
  if (trigger.morale               !== undefined && snap.morale               < trigger.morale)               return false;
  if (trigger.moraleLow            !== undefined && snap.morale               > trigger.moraleLow)            return false;
  if (trigger.largeRaidsRepelled   !== undefined && snap.largeRaidsRepelled   < trigger.largeRaidsRepelled)   return false;
  if (trigger.commandersKilled     !== undefined && (snap.commandersKilled  ?? 0) < trigger.commandersKilled) return false;
  if (trigger.harvestersDestroyed  !== undefined && (snap.harvestersDestroyed ?? 0) < trigger.harvestersDestroyed) return false;
  if (trigger.tradersVisited       !== undefined && (snap.tradersVisited    ?? 0) < trigger.tradersVisited)   return false;
  if (trigger.level5Colonists      !== undefined && (snap.level5Colonists   ?? 0) < trigger.level5Colonists)  return false;
  if (trigger.artifacts            !== undefined && (snap.artifacts         ?? 0) < trigger.artifacts)        return false;
  if (trigger.directivesActive     !== undefined && (snap.directivesActive  ?? 0) < trigger.directivesActive) return false;
  return true;
}
