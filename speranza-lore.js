// ═══════════════════════════════════════════════════════════════════════════════
// speranza-lore.js — Pure content. No game logic. No imports.
// Imported by Speranza.jsx. All flavor text, narrative, and content lives here.
//
// EXPORTS:
//   BACKSTORIES           — assigned randomly at colonist spawn
//   QUIRKS                — assigned randomly at colonist spawn, id used in tick loop
//   SURFACE_CONDITIONS    — rotate every 80-120 ticks, snapshot into expeditions at launch
//   SURFACE_LOCATIONS     — expedition destinations, each with loot roll modifiers
//   DILEMMA_EVENTS        — fire ~every 50 ticks (40% chance), require player choice
//   EXPEDITION_FLAVOR     — radio chatter prefixed to expedition log entries
//   ARTIFACT_TEMPLATES    — Level 5 colonist creates a named artifact from these
//   ARTIFACT_ITEMS        — item pool for artifact name generation
//   COMMANDER_NAMES       — named Arc Commander boss event designations
//   COMMANDER_WEAKNESSES  — one assigned per commander
//   COMMANDER_STRENGTHS   — one assigned per commander
//   TRADERS               — periodic visitor pool for high-rep colonies
//   DIRECTIVES            — colony law flavor text (mechanics in Speranza.jsx constants)
//   MILESTONES            — fire once per run at specific trigger conditions
//   EPITAPHS              — memorial flavor lines generated on colonist death
// ═══════════════════════════════════════════════════════════════════════════════


// ─── COLONIST BACKSTORIES ─────────────────────────────────────────────────────
// One assigned randomly at colonist spawn.
// Shown only in the colonist detail window. Keep them grounded and specific.
// Reference the world: the Collapse, the First Wave, the Second Wave, the surface.

export const BACKSTORIES = [
  "Former Arc logistics worker. Knew their supply routes before defecting. Hasn't stopped being useful since.",
  "Lost everyone in the Second Wave. Doesn't talk about before. Works like they're trying not to remember.",
  "Field medic before the surface became uninhabitable. Hands still shake in enclosed spaces. Never misses a patient.",
  "Grew up entirely underground. Has never seen the surface in full daylight. Goes up anyway.",
  "Survived the fall of a settlement two tunnels over. One of four who made it out. Doesn't sleep well.",
  "Claims to be one of the original founders of this colony. Nobody can confirm it. Nobody argues.",
  "Found wandering the outer tunnels with no memory of before. Doesn't seem troubled by it.",
  "Electrical engineer. Built half this colony's infrastructure from salvaged parts and stubbornness.",
  "Escaped an Arc processing facility three years ago. Still has the mark on their left arm. Doesn't hide it.",
  "Former raider who changed sides after the machines took their crew. Carries it quietly.",
  "Botanist. Keeps a small unauthorized garden somewhere in the lower levels. Nobody asks where.",
  "Arc comms technician who cracked their encryption and ran before they noticed. Hasn't stopped moving since.",
  "Seventeen years old, probably. Lied about their age to get in. Pulls their weight. Nobody says anything.",
  "Ran a surface black market for two years before settling here. Still has contacts nobody knows about.",
  "Soldier from before the Second Wave. The Arc broke their unit. Couldn't break them.",
  "More hours topside than anyone else here by a significant margin. Still volunteers every time.",
  "Real doctor — trained before everything fell apart. Has been patching people up for food ever since.",
  "Former Arc researcher who destroyed her own work before fleeing. Won't say what the project was.",
  "Came down with a group of nineteen. Won't say what happened to the other eighteen.",
  "Mechanic. Fixates obsessively on machines when stressed. The colony runs better for it.",
  "Knows six languages including two Arc operational dialects. Invaluable and visibly nervous.",
  "Lost a hand topside two years ago. The salvaged prosthetic works. They manage.",
  "Born underground. Never registered with any settlement. Technically doesn't exist on any record.",
  "Intelligence background. Which side? Stopped answering that question some time ago.",
  "Veteran of the First Wave resistance — old enough to remember when humans held the surface.",
  "Has been in seven settlements. This is the longest any of them have lasted. Refuses to jinx it.",
  "Arc Probe technician who figured out what the Probes were actually mapping. Left immediately.",
  "Teaches the colony's youngest to read. Still finds time to work a full shift. Nobody asked them to.",
  "Former supply convoy driver. Knows every patrol route and depot location in the sector.",
  "Quiet. Has never explained where they came from. Does the worst jobs without complaint.",
];


// ─── COLONIST QUIRKS ──────────────────────────────────────────────────────────
// One assigned randomly at spawn.
// `id` is the key referenced in Speranza.jsx tick loop and raid logic.
// Keep `mechanical` in sync with actual implementation.

export const QUIRKS = [
  {
    id:         "lightSleeper",
    label:      "Light Sleeper",
    icon:       "👁",
    desc:       "Always the first to notice something wrong. Passive +0.1 morale/tick while alive.",
    mechanical: "passive +0.1 morale per tick this colonist is alive and not injured",
  },
  {
    id:         "claustrophobic",
    label:      "Claustrophobic",
    icon:       "😰",
    desc:       "Manages. Barely. -0.1 morale/tick from being underground. Goes topside anyway.",
    mechanical: "-0.1 morale drain per tick. On strained morale state, 10% chance per tick of panic dilemma event.",
  },
  {
    id:         "arcSensitive",
    label:      "Arc-Sensitive",
    icon:       "🔮",
    desc:       "Something in them responds to Arc presence. 20% chance to give 1 tick of early raid warning.",
    mechanical: "when raid window opens, 20% chance to fire a warning log entry the previous tick",
  },
  {
    id:         "workaholic",
    label:      "Workaholic",
    icon:       "⚙️",
    desc:       "Earns XP 25% faster. Heals 25% slower. Doesn't know when to stop.",
    mechanical: "XP threshold: 10→8 ticks. healRate ×0.75.",
  },
  {
    id:         "paranoid",
    label:      "Paranoid",
    icon:       "🧠",
    desc:       "Too stubborn to show fear. Never flees raids, regardless of outcome roll.",
    mechanical: "flee roll always treated as hold/injury regardless of result",
  },
  {
    id:         "ironStomach",
    label:      "Iron Stomach",
    icon:       "🥫",
    desc:       "Eats less, drinks less, complains about neither. 30% less food and water consumption.",
    mechanical: "this colonist's per-tick drain contribution ×0.70 for food and water",
  },
  {
    id:         "loudmouth",
    label:      "Loudmouth",
    icon:       "📢",
    desc:       "When they come back from topside, the whole colony hears about it. +5 morale on safe expedition return.",
    mechanical: "on expedition return alive: changeMorale(+5, colonist name + ' is back')",
  },
  {
    id:         "tunnelBlind",
    label:      "Tunnel-Blind",
    icon:       "🕶",
    desc:       "Useless in full daylight. Cannot be assigned to expeditions. Exceptional underground.",
    mechanical: "filtered from expedition candidate list entirely",
  },
  {
    id:         "steadyHands",
    label:      "Steady Hands",
    icon:       "🖐",
    desc:       "Everything lands one step lighter. Kills become injuries. Injuries become close calls.",
    mechanical: "raid outcome rolls: kill threshold (>0.80) → injury, injury threshold (0.50-0.80) → flee instead",
  },
  {
    id:         "surfaceBorn",
    label:      "Surface-Born",
    icon:       "🌅",
    desc:       "Knows topside like a second home. +20% good expedition roll probability on any run.",
    mechanical: "good event weights ×1.20 on all expeditions this colonist participates in",
  },
  {
    id:         "packRat",
    label:      "Pack Rat",
    icon:       "🎒",
    desc:       "Always comes back with more than expected. +1 bonus to scrap and salvage expedition rolls.",
    mechanical: "scrapGained and salvageGained from expedition results each +1",
  },
  {
    id:         "insomniac",
    label:      "Insomniac",
    icon:       "🌙",
    desc:       "Never fully rests. Accumulates duty experience constantly. But injuries take longer to heal.",
    mechanical: "dutyTicks increments every tick regardless of assigned status. healRate ×0.85.",
  },
];


// ─── SURFACE CONDITIONS ───────────────────────────────────────────────────────
// One active at a time, rotating every 80-120 ticks.
// Snapshotted into expedition state at launch time.
// `weight` controls frequency — Clear should dominate (roughly 35% of time).
// All `effects` keys are read directly by Speranza.jsx — keep in sync.

export const SURFACE_CONDITIONS = [
  {
    id:      "clear",
    label:   "CLEAR",
    icon:    "☀️",
    color:   "#7ed321",
    desc:    "Surface conditions nominal. Standard operating window.",
    flavor:  "Scouts report quiet topside. Standard visibility. Arc activity within expected range.",
    weight:  35,
    effects: {
      threatMult:     1.0,
      expedGoodMult:  1.0,
      expedBadMult:   1.0,
      expedBlocked:   false,
      raidFreqMult:   1.0,
      foodDrainMult:  1.0,
      radioOffline:   false,
      expedSilent:    false,
      raidSizeBonus:  0,
    },
  },
  {
    id:      "nightRaid",
    label:   "NIGHT RAID",
    icon:    "🌑",
    color:   "#8844ff",
    desc:    "Arc forces move under cover of darkness. Raids more frequent. Size unknown until they hit.",
    flavor:  "No light topside. Arc movement detected across multiple sectors. Stay sharp.",
    weight:  15,
    effects: {
      threatMult:     1.4,
      expedGoodMult:  0.9,
      expedBadMult:   1.2,
      expedBlocked:   false,
      raidFreqMult:   1.35,
      foodDrainMult:  1.0,
      radioOffline:   true,
      expedSilent:    false,
      raidSizeBonus:  0,
    },
  },
  {
    id:      "coldSnap",
    label:   "COLD SNAP",
    icon:    "🌨️",
    color:   "#4ab3f4",
    desc:    "Temperature has dropped sharply. Food consumption up. Expeditions are harder.",
    flavor:  "Temperature well below survivable without protection. Gear up before going topside.",
    weight:  12,
    effects: {
      threatMult:     1.0,
      expedGoodMult:  0.85,
      expedBadMult:   1.25,
      expedBlocked:   false,
      raidFreqMult:   0.85,
      foodDrainMult:  1.6,
      radioOffline:   false,
      expedSilent:    false,
      raidSizeBonus:  0,
    },
  },
  {
    id:      "dustStorm",
    label:   "DUST STORM",
    icon:    "🌪️",
    color:   "#d4a843",
    desc:    "Zero visibility topside. Expeditions impossible. Arc movement also severely reduced.",
    flavor:  "Complete whiteout above. Nothing moves up there. Not us. Not them.",
    weight:  10,
    effects: {
      threatMult:     0.55,
      expedGoodMult:  1.0,
      expedBadMult:   1.0,
      expedBlocked:   true,
      raidFreqMult:   0.4,
      foodDrainMult:  1.0,
      radioOffline:   false,
      expedSilent:    false,
      raidSizeBonus:  0,
    },
  },
  {
    id:      "heavySweep",
    label:   "HEAVY SWEEP",
    icon:    "☢️",
    color:   "#ff4444",
    desc:    "Large-scale Arc operation in sector. Threat builds fast. Rich pickings for the bold.",
    flavor:  "Multiple Arc signatures moving in formation. Something big is happening up there.",
    weight:  8,
    effects: {
      threatMult:     2.0,
      expedGoodMult:  1.35,
      expedBadMult:   1.45,
      expedBlocked:   false,
      raidFreqMult:   1.6,
      foodDrainMult:  1.0,
      radioOffline:   false,
      expedSilent:    false,
      raidSizeBonus:  1,
    },
  },
  {
    id:      "emStorm",
    label:   "EM STORM",
    icon:    "⚡",
    color:   "#ffcc00",
    desc:    "Electromagnetic storm topside. Comms blackout. Lightning fries Arc and equipment alike.",
    flavor:  "Static on all frequencies. Lightning detected across the surface. Anything electronic is at risk.",
    weight:  8,
    effects: {
      threatMult:     1.1,
      expedGoodMult:  1.1,
      expedBadMult:   1.15,
      expedBlocked:   false,
      raidFreqMult:   0.8,
      foodDrainMult:  1.0,
      radioOffline:   true,
      expedSilent:    true,
      raidSizeBonus:  0,
    },
  },
  {
    id:      "salvageWindow",
    label:   "SALVAGE WINDOW",
    icon:    "🟢",
    color:   "#7ed321",
    desc:    "Old Arc supply line collapsed. Surface rich with abandoned material. Arc presence reduced.",
    flavor:  "Scouts reporting abandoned Arc equipment across multiple grid sectors. Move fast.",
    weight:  7,
    effects: {
      threatMult:     0.7,
      expedGoodMult:  1.55,
      expedBadMult:   0.75,
      expedBlocked:   false,
      raidFreqMult:   0.65,
      foodDrainMult:  1.0,
      radioOffline:   false,
      expedSilent:    false,
      raidSizeBonus:  0,
    },
  },
  {
    id:      "huskField",
    label:   "HUSK FIELD",
    icon:    "🤖",
    color:   "#888888",
    desc:    "Old battlefield wreckage litters the surface. Dense salvage — and things that nest in the ruins.",
    flavor:  "Surface covered in old Arc wreckage. Salvage everywhere. So are the things that live in it.",
    weight:  5,
    effects: {
      threatMult:     1.2,
      expedGoodMult:  1.4,
      expedBadMult:   1.3,
      expedBlocked:   false,
      raidFreqMult:   1.1,
      foodDrainMult:  1.0,
      radioOffline:   false,
      expedSilent:    false,
      raidSizeBonus:  0,
    },
  },
];


// ─── SURFACE LOCATIONS ────────────────────────────────────────────────────────
// Player selects destination before launching an expedition.
// `rollMods` modifies the base expedition roll table weights — applied multiplicatively.
// `risk` label shown in expedition UI.

export const SURFACE_LOCATIONS = [
  {
    id:       "oldRoad",
    label:    "THE OLD ROAD",
    icon:     "🛣️",
    color:    "#888877",
    flavor:   "Pre-collapse highway running east. Arc patrols it constantly. The scrap hauls are worth the risk.",
    risk:     "HIGH",
    rollMods: { scrapMult: 1.4, salvageMult: 0.8, arcTechMult: 0.7, badMult: 1.3, survivorChance: 0.04 },
  },
  {
    id:       "relayStation",
    label:    "EASTERN RELAY",
    icon:     "📡",
    color:    "#4ab3f4",
    flavor:   "Decommissioned Arc comms infrastructure. Whatever they used it for, the components are valuable.",
    risk:     "MEDIUM",
    rollMods: { scrapMult: 0.8, salvageMult: 1.1, arcTechMult: 1.8, badMult: 1.1, schematicBonus: 0.08 },
  },
  {
    id:       "settlementRuins",
    label:    "THE RUINS",
    icon:     "🏚️",
    color:    "#cc8844",
    flavor:   "Where another colony used to be. Nobody talks about what happened. Rich with salvage.",
    risk:     "MEDIUM",
    rollMods: { scrapMult: 1.1, salvageMult: 1.5, arcTechMult: 0.6, badMult: 1.0, survivorChance: 0.12 },
  },
  {
    id:       "quietZone",
    label:    "THE QUIET ZONE",
    icon:     "🌫️",
    color:    "#aaaaaa",
    flavor:   "No Arc activity detected. Ever. The scouts don't know why. Neither do we.",
    risk:     "UNKNOWN",
    rollMods: { scrapMult: 1.2, salvageMult: 1.2, arcTechMult: 1.2, badMult: 0.7, mysteryEventChance: 0.15 },
  },
  {
    id:       "forwardPosition",
    label:    "FORWARD POSITION",
    icon:     "🔴",
    color:    "#ff4444",
    flavor:   "Active Arc operation area. The risk is extreme. So is the potential haul.",
    risk:     "EXTREME",
    rollMods: { scrapMult: 1.0, salvageMult: 1.3, arcTechMult: 2.5, badMult: 1.7, schematicBonus: 0.12 },
  },
  {
    id:       "greenhouse",
    label:    "THE GREENHOUSE",
    icon:     "🌿",
    color:    "#7ed321",
    flavor:   "Pre-Arc agricultural facility, partially intact. Arc doesn't care about food. We do.",
    risk:     "LOW",
    rollMods: { scrapMult: 0.6, salvageMult: 0.7, arcTechMult: 0.3, badMult: 0.65, foodBonus: true, survivorChance: 0.10 },
  },
  {
    id:       "transitHub",
    label:    "TRANSIT HUB",
    icon:     "🚇",
    color:    "#bb44ff",
    flavor:   "Old underground transit infrastructure that surfaces here. Multiple tunnel connections.",
    risk:     "MEDIUM",
    rollMods: { scrapMult: 1.2, salvageMult: 1.0, arcTechMult: 1.0, badMult: 0.9, survivorChance: 0.08 },
  },
  {
    id:       "crashSite",
    label:    "THE CRASH SITE",
    icon:     "✈️",
    color:    "#ff8800",
    flavor:   "Something large came down here before the Second Wave. Arc origin. Still smoldering.",
    risk:     "HIGH",
    rollMods: { scrapMult: 0.8, salvageMult: 1.6, arcTechMult: 2.0, badMult: 1.4, schematicBonus: 0.10 },
  },
];


// ─── COLONY DILEMMA EVENTS ────────────────────────────────────────────────────
// Fire roughly every 50 ticks (40% chance per check).
// One active at a time — blocks the side panel until resolved.
// `condition` (optional) — only fires during a specific surface condition id.
// `minTick` — earliest this event can fire.
// `minPop` — minimum population required.
//
// `apply` keys (resolved in Speranza.jsx dilemma handler):
//   morale: number           — changeMorale(value)
//   scrap / food / water / arcTech / salvage: number
//   heatDelta: number        — changeHeat(value)
//   recruitFree: bool        — add a free colonist
//   removeRandomColonist: bool
//   injureRandom: bool
//   schematicRandom: bool
//   expeditionCasualty: bool — mark one active expedition as having a casualty
//   suppressHeatTicks: number — temporarily reduce heat buildup

export const DILEMMA_EVENTS = [

  // ── EARLY GAME ──────────────────────────────────────────────────────────────

  {
    id:      "stranger_at_door",
    minTick: 10,
    text:    "Someone is pounding on the entrance hatch. Alone. Badly wounded. They're begging to be let in. They don't look like a threat. You've been wrong about that before.",
    choices: [
      {
        label:   "Let them in",
        outcome: "They collapse and sleep for hours. When they wake, they get to work without being asked.",
        apply:   { recruitFree: true, morale: +5 },
      },
      {
        label:   "Turn them away",
        outcome: "They don't argue. Just look at you and leave. The colony has a long memory for moments like this.",
        apply:   { morale: -12 },
      },
    ],
  },

  {
    id:      "the_fight",
    minTick: 8,
    text:    "Two colonists came to blows in the workshop. One has a broken nose. The other is refusing to work alongside them. They both think they're right.",
    choices: [
      {
        label:   "Separate their assignments",
        outcome: "Workable. Awkward. They avoid each other. The colony moves on.",
        apply:   { morale: -5 },
      },
      {
        label:   "Make them work it out together",
        outcome: "Takes a tick of lost productivity. They're not friends but they're functional.",
        apply:   { morale: +8 },
      },
      {
        label:   "Assign both to excavation duty",
        outcome: "Nobody argues with you for a while. The dig goes faster.",
        apply:   { morale: -8 },
      },
    ],
  },

  {
    id:      "sealed_cache",
    minTick: 8,
    text:    "Excavation cracked open a sealed pre-collapse cache. Opening it might trigger a locator ping. Might not.",
    choices: [
      {
        label:   "Open it — take the risk",
        outcome: "Medical supplies and tools. Nothing pings. You got lucky this time.",
        apply:   { scrap: +50, food: +25, heatDelta: +15 },
      },
      {
        label:   "Scan first — take the extra time",
        outcome: "Clean. You get everything inside. Nothing follows.",
        apply:   { scrap: +35, food: +20 },
      },
      {
        label:   "Seal it back up",
        outcome: "Better safe. The workers who found it are frustrated.",
        apply:   { morale: -10 },
      },
    ],
  },

  {
    id:      "water_contamination",
    minTick: 20,
    text:    "The water recycler output smells wrong. Could be a filter. Could be surface contamination seeping down.",
    choices: [
      {
        label:   "Pause production — run diagnostics",
        outcome: "Filter blockage. One tick of reduced water output. No lasting damage.",
        apply:   { water: -15 },
      },
      {
        label:   "Keep running — probably nothing",
        outcome: "Three colonists feel ill for several ticks. Definitely not nothing.",
        apply:   { morale: -10, injureRandom: true },
      },
    ],
  },

  {
    id:      "arc_probe_incursion",
    minTick: 25,
    text:    "An Arc Probe has landed forty meters from the entrance. Scanning. It hasn't detected you yet. The window is narrow.",
    choices: [
      {
        label:   "Loot it fast",
        outcome: "You get the components. The signal goes out before you finish. Something will come.",
        apply:   { arcTech: +3, salvage: +4, heatDelta: +60 },
      },
      {
        label:   "Kill the signal first, then loot",
        outcome: "Slower. You get less. Nothing comes.",
        apply:   { arcTech: +1, salvage: +2 },
      },
      {
        label:   "Leave it alone",
        outcome: "It launches and leaves. You feel good about this for about three ticks.",
        apply:   { morale: +2 },
      },
    ],
  },

  // ── MID GAME ────────────────────────────────────────────────────────────────

  {
    id:      "the_informant",
    minTick: 30,
    minPop:  5,
    text:    "A colonist pulls you aside. Another has been leaving small marks near the entrance — deliberate, like signals. Could be habit from their old life. Could be something worse.",
    choices: [
      {
        label:   "Confront them quietly",
        outcome: "They deny it. The marks stop. The tension doesn't.",
        apply:   { morale: -8, heatDelta: -20 },
      },
      {
        label:   "Expel them immediately",
        outcome: "They're gone before dark. If they were innocent you'll never know.",
        apply:   { removeRandomColonist: true, morale: -15 },
      },
      {
        label:   "Watch and wait",
        outcome: "Three ticks later the marks appear again. And a rough map of your water recycler scratched into the tunnel wall.",
        apply:   { removeRandomColonist: true, morale: +5, heatDelta: -40 },
      },
    ],
  },

  {
    id:      "the_vote",
    minTick: 40,
    minPop:  5,
    text:    "Colonists want a say in resource allocation. They think too much scrap goes to construction and not enough to food stores. They're asking for a colony vote. You don't have to honor it.",
    choices: [
      {
        label:   "Hold the vote and honor it",
        outcome: "They vote to redirect. Morale improves significantly — they feel heard.",
        apply:   { morale: +15, scrap: -30 },
      },
      {
        label:   "Decline — explain your reasoning",
        outcome: "Most accept it. Some don't.",
        apply:   { morale: -8 },
      },
      {
        label:   "Ignore it entirely",
        outcome: "The grumbling gets louder. Two colonists stop pulling full weight.",
        apply:   { morale: -20 },
      },
    ],
  },

  {
    id:      "black_market",
    minTick: 50,
    minPop:  4,
    text:    "A surface trader is offering Arc Tech in exchange for three of your colonists as convoy protection. Two days topside. They might come back.",
    choices: [
      {
        label:   "Send three colonists",
        outcome: "Two come back carrying more Arc Tech than you've seen in weeks.",
        apply:   { arcTech: +6, expeditionCasualty: true, morale: -5 },
      },
      {
        label:   "Decline",
        outcome: "The trader goes quiet. You might hear from them again.",
        apply:   { morale: -3 },
      },
      {
        label:   "Counter — offer information instead",
        outcome: "A small supply drop appears near the entrance three ticks later.",
        apply:   { salvage: +4, scrap: +20 },
      },
    ],
  },

  {
    id:      "arc_prisoner",
    minTick: 45,
    minPop:  4,
    text:    "Your expedition returned with a damaged Arc unit — bound, inert but not dead. Still processing. The colonists are divided between those who want it destroyed and those who want to learn from it.",
    choices: [
      {
        label:   "Extract its memory core",
        outcome: "Patrol routes. Raid timing. Outdated maybe. Useful definitely. Then it goes dark permanently.",
        apply:   { heatDelta: -60, morale: -5, arcTech: +2 },
      },
      {
        label:   "Study it intact",
        outcome: "Three ticks of research. Then it's gone — no sign of how. The cell was still locked.",
        apply:   { morale: -12, heatDelta: +25 },
      },
      {
        label:   "Destroy it immediately",
        outcome: "Clean. Fast. The colonists who wanted to study it are disappointed.",
        apply:   { morale: -5 },
      },
    ],
  },

  {
    id:      "downed_unit",
    minTick: 30,
    text:    "A solo Arc unit went down near the entrance — malfunction, not your doing. Still active but immobile. It's transmitting a distress signal. You have five ticks before retrieval arrives.",
    choices: [
      {
        label:   "Strip it fast",
        outcome: "Good haul. The signal went out before you finished. They'll come.",
        apply:   { arcTech: +3, salvage: +5, heatDelta: +55 },
      },
      {
        label:   "Kill the signal first, then strip it",
        outcome: "Slower. Quieter. You get less. Nobody comes.",
        apply:   { arcTech: +1, salvage: +3 },
      },
      {
        label:   "Leave it entirely",
        outcome: "It gets retrieved. Nothing happens. You sleep fine about it.",
        apply:   { morale: +2 },
      },
    ],
  },

  {
    id:      "arc_defector",
    minTick: 60,
    text:    "A former Arc operations worker found your entrance. Has real schematics — patrol schedules, facility layouts. Also has a tracking implant that may or may not be disabled. They claim it's disabled. They would say that.",
    choices: [
      {
        label:   "Take them in — implant and all",
        outcome: "The schematics are real. The implant was disabled. Probably.",
        apply:   { recruitFree: true, schematicRandom: true, heatDelta: +45 },
      },
      {
        label:   "Take the schematics — turn them away",
        outcome: "They hand them over without argument. The data checks out.",
        apply:   { schematicRandom: true, morale: -12 },
      },
      {
        label:   "Refuse both",
        outcome: "They disappear back into the tunnels. You don't know what you turned away.",
        apply:   { morale: -5 },
      },
    ],
  },

  // ── ARC-SPECIFIC ────────────────────────────────────────────────────────────

  {
    id:      "arc_signal",
    minTick: 80,
    text:    "An Arc signal directed specifically at your colony. The message: stop surface operations, submit location data, and Arc activity in your sector will cease. They know your colony's name.",
    choices: [
      {
        label:   "Ignore it",
        outcome: "The signal repeats three ticks then stops. You don't know if that's good.",
        apply:   { morale: -5 },
      },
      {
        label:   "Respond — tell them you're armed",
        outcome: "Signal stops immediately. Twelve hours later the heat meter jumps.",
        apply:   { heatDelta: +80, morale: +10 },
      },
      {
        label:   "Let the colony vote",
        outcome: "They vote to ignore it. Overwhelmingly. But now everyone knows something out there knows their name.",
        apply:   { morale: +5, heatDelta: +20 },
      },
    ],
  },

  {
    id:      "mineral_question",
    minTick: 100,
    text:    "Deep in the excavation: an unusual mineral deposit that doesn't match any pre-collapse geological survey. The Arc have been hitting your colony harder than neighboring settlements for months. You're starting to connect the dots.",
    choices: [
      {
        label:   "Mine it — whatever the cost",
        outcome: "Massive haul. The raids don't stop. They get more specific.",
        apply:   { scrap: +80, salvage: +12, arcTech: +5, heatDelta: +120 },
      },
      {
        label:   "Fill it in and seal it off",
        outcome: "Costs resources. The raids ease over time.",
        apply:   { scrap: -40, heatDelta: -150, suppressHeatTicks: 40 },
      },
      {
        label:   "Study it — don't touch it yet",
        outcome: "The researchers are fascinated. No answers yet.",
        apply:   { morale: +3 },
      },
    ],
  },

  // ── SURFACE CONDITION-SPECIFIC ───────────────────────────────────────────────

  {
    id:        "dustStorm_shelter",
    minTick:   10,
    condition: "dustStorm",
    text:      "The storm drove two Arc units to your entrance — sheltering from conditions they weren't built for. Unarmed. They seem as surprised to find you as you are to find them.",
    choices: [
      {
        label:   "Let them shelter — say nothing",
        outcome: "They wait out the storm. Leave without looking back. You don't know what they saw.",
        apply:   { heatDelta: +25 },
      },
      {
        label:   "Neutralize them quietly",
        outcome: "Fast. Clean. The colony doesn't discuss this at dinner.",
        apply:   { arcTech: +2, morale: -15 },
      },
    ],
  },

  {
    id:        "sweep_intel",
    minTick:   30,
    condition: "heavySweep",
    text:      "Your Radio Tower is picking up unencrypted Arc operational chatter about the sweep pattern. You could transmit a false position — but they might triangulate back to you.",
    choices: [
      {
        label:   "Transmit a false position",
        outcome: "It works. The sweep moves north. But they logged the transmission.",
        apply:   { heatDelta: -80, morale: +10 },
      },
      {
        label:   "Record and analyze — don't transmit",
        outcome: "You learn their pattern. Raid frequency drops for several ticks.",
        apply:   { heatDelta: -30, suppressHeatTicks: 20 },
      },
      {
        label:   "Shut down the radio — don't risk it",
        outcome: "Safe. The sweep passes closer than you'd like.",
        apply:   { morale: -5 },
      },
    ],
  },

  {
    id:        "night_deserter",
    minTick:   25,
    condition: "nightRaid",
    text:      "A colonist has packed their things. They're at the entrance. They'd rather take their chances on the surface than wait underground for the next raid. They're asking for rations. Not permission.",
    choices: [
      {
        label:   "Give rations and let them go",
        outcome: "They leave. Some of the colony watches. Some are thinking the same thing.",
        apply:   { removeRandomColonist: true, morale: -12, food: -15 },
      },
      {
        label:   "Let them go — no rations",
        outcome: "They go anyway.",
        apply:   { removeRandomColonist: true, morale: -20 },
      },
      {
        label:   "Talk them down",
        outcome: "Works. They're embarrassed in the morning. Work twice as hard for a week.",
        apply:   { morale: +5 },
      },
    ],
  },

  {
    id:        "em_discovery",
    minTick:   15,
    condition: "emStorm",
    text:      "Lightning took down an Arc unit right at the surface entrance. Still sparking. Working in the storm risks your equipment. The components inside are exceptional.",
    choices: [
      {
        label:   "Strip it now — work in the storm",
        outcome: "Worth it. Equipment takes some damage. The Arc Tech is exceptional.",
        apply:   { arcTech: +4, salvage: +3, scrap: -10 },
      },
      {
        label:   "Wait for the storm to pass",
        outcome: "When you get there it's been picked clean by something else.",
        apply:   { morale: -5 },
      },
    ],
  },

  // ── LATE GAME ───────────────────────────────────────────────────────────────

  {
    id:      "deep_signal",
    minTick: 100,
    text:    "From your deepest excavated level: a signal. Old. Pre-collapse. Repeating. An emergency beacon from something buried below your lowest level. It's been transmitting for years. Nothing up there has noticed. Yet.",
    choices: [
      {
        label:   "Dig deeper — find the source",
        outcome: "What you find changes how your people think about why they're here.",
        apply:   { scrap: -40, morale: +25, salvage: +8, arcTech: +3 },
      },
      {
        label:   "Kill the beacon — bury it in rubble",
        outcome: "The signal stops. Nobody asks what it was.",
        apply:   { morale: -10 },
      },
      {
        label:   "Leave it — it hasn't been found yet",
        outcome: "True. Whatever's powered it this long can probably run forever.",
        apply:   { morale: +5 },
      },
    ],
  },

  {
    id:      "last_stand_relay",
    minTick: 150,
    text:    "Another colony is transmitting on open frequency — live, under full Arc assault, asking for fighters. Your colonists are listening. If you send people they might save a colony. They might not come back.",
    choices: [
      {
        label:   "Send fighters",
        outcome: "Three go. Two come back — with survivors from the other colony.",
        apply:   { expeditionCasualty: true, recruitFree: true, morale: +20 },
      },
      {
        label:   "Send supplies instead",
        outcome: "You fire a cache toward their position. Whether it reaches them you never find out.",
        apply:   { scrap: -40, food: -30, morale: +5 },
      },
      {
        label:   "Maintain silence",
        outcome: "The transmission stops after four ticks. The colony knows what that means.",
        apply:   { morale: -22 },
      },
    ],
  },

  {
    id:      "dying_elder",
    minTick: 60,
    minPop:  6,
    text:    "The oldest person in the colony is fading. Not from injury — from years. They're asking for one thing: to see the surface one more time.",
    choices: [
      {
        label:   "Take them up",
        outcome: "You go at night. They see it. They don't make it back. They were smiling. The colony talks about it for a long time.",
        apply:   { removeRandomColonist: true, morale: +20 },
      },
      {
        label:   "Refuse — too dangerous",
        outcome: "They understand. They pass three ticks later. It's quiet.",
        apply:   { removeRandomColonist: true, morale: -5 },
      },
    ],
  },

  {
    id:      "arc_tech_temptation",
    minTick: 80,
    text:    "Your researchers found something in the latest haul: a partial Arc neural relay. Reverse-engineered it could provide early raid warning. It could also be a tracking device. It might be both.",
    choices: [
      {
        label:   "Install it — one volunteer",
        outcome: "They get headaches. They also wake screaming before every raid. Twice now they've been right.",
        apply:   { morale: -5, suppressHeatTicks: 9999 },
      },
      {
        label:   "Study it — don't install",
        outcome: "Three ticks of research. You improve your Radio Tower sensitivity.",
        apply:   { heatDelta: -20 },
      },
      {
        label:   "Destroy it",
        outcome: "Safe. You feel better not knowing what it was going to do.",
        apply:   { morale: +5 },
      },
    ],
  },

];


// ─── EXPEDITION RADIO CHATTER ─────────────────────────────────────────────────
// One line prepended to each expedition log event entry.
// `expedSilent` surface condition suppresses these entirely — log is plain text.

export const EXPEDITION_FLAVOR = {
  scav: {
    good: [
      "—static— we've got something here, pre-collapse seal —static—",
      "clean haul, minimal contact, heading back with —static—",
      "old cache behind the eastern wall, still sealed —static—",
      "you're not going to believe this —static—",
      "—static— found something worth stopping for —static—",
      "supply cache intact, moving it now —static—",
    ],
    bad: [
      "—static— contact, we have contact —static—",
      "taking fire, repositioning to —static—",
      "they came out of the structure, no warning —static—",
      "—static— man down, man down —static—",
      "ambush, multiple units, we're —static—",
      "it came through the wall, we didn't see it —static—",
    ],
    neutral: [
      "sector clear, nothing worth the trip yet —static—",
      "continuing east, no sign yet —static—",
      "quiet up here. too quiet. —static—",
      "—static— all clear, pushing to secondary position —static—",
      "negative contact, moving further in —static—",
    ],
  },
  strike: {
    good: [
      "—static— outpost is down, we're on the equipment —static—",
      "Arc Tech, multiple downed units, taking what we can carry —static—",
      "they weren't expecting us, window is open —static—",
      "jackpot —static—",
      "—static— found the relay room, it's intact —static—",
    ],
    bad: [
      "—static— ambush, full contact, we're pinned —static—",
      "taking heavy fire, need extraction —static—",
      "—static— they knew we were coming —static—",
      "unit down, continuing to —static—",
      "—static— more than we anticipated —static—",
    ],
    neutral: [
      "outpost abandoned, recent departure — still warm —static—",
      "holding position, watching the perimeter —static—",
      "—static— checking secondary structure —static—",
      "no contact yet, pushing deeper —static—",
      "—static— movement detected, could be wind —static—",
    ],
  },
};


// ─── COLONIST ARTIFACT TEMPLATES ─────────────────────────────────────────────
// Level 5 colonist creates a named artifact.
// [NAME] = colonist name. [ITEM] = random from ARTIFACT_ITEMS.
// Artifact: +0.5 morale/tick while colonist alive. +0.2/tick after death (memorial).

export const ARTIFACT_TEMPLATES = [
  "[NAME]'s [ITEM] — made during the third night watch. Nobody asked them to.",
  "A [ITEM] left in the common area by [NAME]. Still there.",
  "[NAME] built a [ITEM] and never explained why. It works.",
  "The [ITEM] that [NAME] repaired and refuses to let anyone else touch.",
  "[NAME]'s [ITEM] — assembled over forty ticks from parts nobody else wanted.",
  "A hand-made [ITEM] from [NAME]. Crude. Irreplaceable.",
  "[NAME] found this [ITEM] topside and brought it back for no practical reason. The colony needed it anyway.",
];

export const ARTIFACT_ITEMS = [
  "radio receiver", "water gauge", "pressure lamp", "compass", "shelf",
  "map of the colony", "calendar", "signal mirror", "repair manual",
  "carving", "portrait", "wind chime", "sundial", "notebook",
  "luck token", "hand-drawn map", "patched jacket", "salvaged clock",
];


// ─── ARC COMMANDER NAMES ──────────────────────────────────────────────────────
// Named Arc Commander boss events. Triggers at heat 600+ after 5+ raids.
// Designations feel operational and inhuman — Arc nomenclature, not human names.

export const COMMANDER_NAMES = [
  "DESIGNATION VOSS",
  "UNIT-PRIME KAEL",
  "DIRECTOR SERRIK",
  "OPERATOR RHEN",
  "COMMAND NODE ULVAR",
  "TACTICAL PRIME DRATH",
  "SECTOR LEAD MORA",
  "ENFORCEMENT UNIT ZERRIS",
  "PRIORITY NODE ASKEN",
  "FIELD PRIME CALLUN",
  "DIRECTIVE UNIT HESH",
  "OPERATIONAL LEAD TARVEN",
];

export const COMMANDER_WEAKNESSES = [
  "Sentry Post effectiveness doubled against this commander's units",
  "Barricades absorb 50% more damage during this commander's strikes",
  "Arc Turret is highly effective — rolls twice against this commander",
  "EMP Array delays this commander's raids by double",
  "Blast Doors fully nullify this commander's building damage rolls",
];

export const COMMANDER_STRENGTHS = [
  "Barricades provide no protection — this commander's units breach them",
  "Sentry Post has no effect on this commander's raids",
  "Radio Tower cannot predict this commander's timing",
  "Arc Turret fails to fire — this commander's units jam its signal",
  "Sheltered colonists are not safe — this commander targets lower rows",
];


// ─── TRADERS ──────────────────────────────────────────────────────────────────
// Rare visitors. Arrive every 100-150 ticks at high colony reputation.
// Each has a specialty that determines what they offer.

export const TRADERS = [
  {
    name:      "MAREN",
    line:      "Former supply runner. Knows every tunnel between here and the eastern settlements.",
    specialty: "salvage",
  },
  {
    name:      "COLD",
    line:      "Doesn't give a name. Goes by Cold. Doesn't say why.",
    specialty: "arcTech",
  },
  {
    name:      "YUSUF",
    line:      "Trades medical supplies for information about what's happening in the outer tunnels.",
    specialty: "medicine",
  },
  {
    name:      "THE SISTERS",
    line:      "Two of them. Finish each other's sentences. Been doing this longer than your colony has existed.",
    specialty: "schematics",
  },
  {
    name:      "APOLLO",
    line:      "Traveling mechanic. Has chosen this settlement as his base for now. Always says 'for now.'",
    specialty: "scrap",
  },
  {
    name:      "PATIENCE",
    line:      "More topside hours than anyone still alive. Trades in things other people left behind.",
    specialty: "salvage",
  },
  {
    name:      "DR. LANSEN",
    line:      "Real credentials. Trades medicine for Arc Tech. Doesn't explain what for.",
    specialty: "medicine",
  },
  {
    name:      "NINE",
    line:      "Number nine on some list nobody will show you. Trades in information as much as goods.",
    specialty: "arcTech",
  },
];


// ─── COLONY DIRECTIVES ────────────────────────────────────────────────────────
// Toggleable colony laws. Max 3 active at once. Unlocked via Research Lab L3.
// `cost` and `benefit` are flavor text only — mechanics live in Speranza.jsx constants.

export const DIRECTIVES = [
  {
    id:      "overtime",
    label:   "MANDATORY OVERTIME",
    icon:    "⚙️",
    cost:    "-0.2 morale/tick per working colonist",
    benefit: "+20% all production output",
    desc:    "Extended shifts. No exceptions. The colony produces more. The colony resents it.",
  },
  {
    id:      "rationing",
    label:   "RATIONING",
    icon:    "🥫",
    cost:    "-0.3 morale/tick colony-wide",
    benefit: "-40% food consumption",
    desc:    "Smaller portions. Measured water. People are hungry and they know you chose this.",
  },
  {
    id:      "conscription",
    label:   "CONSCRIPTION",
    icon:    "📋",
    cost:    "-0.1 morale/tick. Colonists auto-assigned.",
    benefit: "No idle colonists. All slots filled automatically.",
    desc:    "Everyone works. Nobody chooses. Efficiency improves. Something else doesn't.",
  },
  {
    id:      "lockdown",
    label:   "LOCKDOWN",
    icon:    "🔒",
    cost:    "Expeditions blocked entirely.",
    benefit: "-50% heat buildup rate.",
    desc:    "Nobody goes topside. Arc activity in the sector drops. The colony stops growing.",
  },
  {
    id:      "openComms",
    label:   "OPEN COMMS",
    icon:    "📡",
    cost:    "+0.15 heat/tick from broadcasting.",
    benefit: "+15% expedition good roll probability.",
    desc:    "Broadcasting position improves coordination topside. It also tells them where you are.",
  },
  {
    id:      "combatDrills",
    label:   "COMBAT DRILLS",
    icon:    "🎯",
    cost:    "2 scrap/tick.",
    benefit: "-15% injury chance in raids.",
    desc:    "Continuous training on what to do when they breach. Expensive. The injury rate shows it works.",
  },
  {
    id:      "triageProtocol",
    label:   "TRIAGE PROTOCOL",
    icon:    "⚕️",
    cost:    "-10% production output colony-wide.",
    benefit: "Injured colonists recover 50% faster. Worn Out risk reduced.",
    desc:    "Medical priority above everything else. Production suffers. Fewer permanent casualties.",
  },
];


// ─── COLONY MILESTONES ────────────────────────────────────────────────────────
// Fire once per run. Stored in `firedMilestones` Set in game state.
// `trigger` keys checked by milestone scanner each tick in Speranza.jsx.
// Shown as a special gold-border toast notification.

export const MILESTONES = [
  {
    id:      "firstRaidSurvived",
    trigger: { raidsRepelled: 1 },
    title:   "FIRST RAID REPELLED",
    text:    "They found you. You're still here. That won't be the last of them.",
  },
  {
    id:      "day7",
    trigger: { day: 7 },
    title:   "ONE WEEK UNDERGROUND",
    text:    "Seven days. The colony holds.",
  },
  {
    id:      "day14",
    trigger: { day: 14 },
    title:   "TWO WEEKS",
    text:    "Fourteen days. Some colonies don't last this long.",
  },
  {
    id:      "day30",
    trigger: { day: 30 },
    title:   "ONE MONTH",
    text:    "A month in the dark. Keep going.",
  },
  {
    id:      "day60",
    trigger: { day: 60 },
    title:   "TWO MONTHS",
    text:    "Sixty days underground. The colony has outlasted most.",
  },
  {
    id:      "firstDeath",
    trigger: { totalDeaths: 1 },
    title:   "THE FIRST LOSS",
    text:    "We lost our first. It won't be the last. Remember them.",
  },
  {
    id:      "firstExpeditionReturn",
    trigger: { expeditionsCompleted: 1 },
    title:   "FIRST EXPEDITION RETURNED",
    text:    "They came back. That's not always guaranteed.",
  },
  {
    id:      "pop8",
    trigger: { population: 8 },
    title:   "EIGHT COLONISTS",
    text:    "Eight mouths. Eight reasons to keep the lights on.",
  },
  {
    id:      "pop12",
    trigger: { population: 12 },
    title:   "TWELVE COLONISTS",
    text:    "A real colony now. With all the problems that come with it.",
  },
  {
    id:      "firstSchematic",
    trigger: { schematics: 1 },
    title:   "SCHEMATIC RECOVERED",
    text:    "Someone built this once. We can build it again.",
  },
  {
    id:      "firstT3",
    trigger: { t3Built: 1 },
    title:   "T3 CONSTRUCTION COMPLETE",
    text:    "They didn't think we'd make it this far.",
  },
  {
    id:      "moraleHigh",
    trigger: { morale: 85 },
    title:   "COLONY MORALE: HIGH",
    text:    "Morale has never been higher. Don't waste it.",
  },
  {
    id:      "moraleLow",
    trigger: { moraleLow: -50 },
    title:   "MORALE: FRACTURED",
    text:    "People are starting to ask what they're even fighting for.",
  },
  {
    id:      "firstLargeRaid",
    trigger: { largeRaidsRepelled: 1 },
    title:   "LARGE RAID SURVIVED",
    text:    "A full Arc assault. We're still here.",
  },
  {
    id:      "firstCommanderKilled",
    trigger: { commandersKilled: 1 },
    title:   "COMMANDER ELIMINATED",
    text:    "They'll send another. They always do. But not today.",
  },
  {
    id:      "harvesterDestroyed",
    trigger: { harvestersDestroyed: 1 },
    title:   "HARVESTER DESTROYED",
    text:    "The largest Arc machine we've ever faced. It's scrap now.",
  },
  {
    id:      "firstTrader",
    trigger: { tradersVisited: 1 },
    title:   "FIRST TRADER VISIT",
    text:    "Word has spread. People know this colony is still alive.",
  },
  {
    id:      "level5Colonist",
    trigger: { level5Colonists: 1 },
    title:   "VETERAN COLONIST",
    text:    "Someone here has earned everything this colony can give them.",
  },
  {
    id:      "firstArtifact",
    trigger: { artifacts: 1 },
    title:   "ARTIFACT CREATED",
    text:    "They made something. Not for survival. Just because they needed to.",
  },
  {
    id:      "firstDirective",
    trigger: { directivesActive: 1 },
    title:   "DIRECTIVE ENACTED",
    text:    "You made a hard call. The colony will live with it.",
  },
];


// ─── MEMORIAL EPITAPHS ────────────────────────────────────────────────────────
// Generated on colonist death based on cause of death.
// [NAME] is replaced with colonist name. [LOCATION] for expedition deaths.
// One picked randomly from the matching pool.

export const EPITAPHS = {
  raidKilled: [
    "Held their post. Didn't make it.",
    "Was in the wrong room when the strike hit.",
    "Didn't run. That wasn't in them.",
    "Took the hit that was meant for someone else. Maybe.",
    "Died the way they lived — at their post.",
  ],
  expeditionKilled: [
    "Went topside one too many times.",
    "The surface takes eventually. It took them.",
    "Didn't come back from the [LOCATION] run.",
    "Knew the risk. Went anyway. That was them.",
    "Their last transmission was clear. Then it wasn't.",
    "Volunteered for the run. Nobody made them.",
  ],
  raidFled: [
    "Left during a raid. Nobody blames them. Not out loud.",
    "The fear got them in the end.",
    "Decided the odds weren't worth it.",
  ],
  moraleDeath: [
    "The colony couldn't hold them here anymore.",
    "Left when the lights went out in people's eyes.",
    "Walked into the tunnels. Didn't say goodbye.",
  ],
  wornOut: [
    "Too many close calls. The body stopped cooperating.",
    "Kept working until they couldn't. The colony noticed.",
    "Three injuries too many. Never fully came back from the last one.",
  ],
};
