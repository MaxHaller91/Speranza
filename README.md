# ⛩ SPERANZA UNDERGROUND

> *The Arc has taken the surface. You are what's left.*

A browser-based colony survival game set in the Arc Raiders universe. Manage resources, expand your underground base, research new technology, recruit and level up colonists, and survive escalating Arc raids.

**▶ Play now:** https://maxhaller91.github.io/Speranza/

---

## Current Build Notes (Testing Branch)

The latest testing build includes several systems that go beyond the original ARC THREAT model:

- **☢ ARC HEAT system** now drives raid pressure (instead of the older single threat framing)
- **Dynamic surface conditions** that can modify threat/production behavior and expedition availability
- **Narrative milestones + dilemmas** that trigger run events and branch outcomes
- Expanded **toast/alert + history log** feedback for major colony events
- Updated **audio layer** (music controls + many new SFX cues)

If something below still references “threat,” treat that as **ARC HEAT pressure** in the current testing version.

---

## Getting Started

When you load the game you'll have:
- **3 named colonists** — one in the Workshop, one in the Power Cell, one idle
- A **Workshop** (makes scrap), a **Power Cell** (makes energy), and a **Barracks** (housing)
- Starting resources: 80 energy, 60 food, 60 water, 50 scrap

Your immediate goals:
1. Build a **Water Recycler** and a **Hydroponics** bay to stop your food and water from draining
2. Assign your idle colonist to one of these rooms
3. Keep an eye on the **ARC HEAT** meter and the **MORALE** bar at the top

---

## The Grid

The 4×7 grid is your underground colony, laid out by depth:
- **Row 1 (−10m):** Surface-adjacent. Most exposed to Arc attacks.
- **Row 2 (−20m):** Mid-depth. Moderate risk.
- **Row 3 (−30m):** Deeper. Lower risk.
- **Row 4 (−40m):** Deepest. Safest, but must be excavated.

Rows 2–4 start **sealed** and must be excavated before you can build there. Click any **empty cell** to open the build menu. Click a **built room** to manage it.

Each room has a **worker capacity** shown as dots — fill them to staff the room to full output. Unstaffed rooms produce nothing.

---

## Resources

| Resource | What it does |
|---|---|
| ⚡ Energy | Powers most rooms — if it runs out, water and food production stops |
| 🌱 Food | Consumed by colonists every tick — hits zero and it's game over |
| 💧 Water | Same as food — keep it positive |
| 🔧 Scrap | Used to construct buildings and repair |
| 🔬 RP | Research Points — used to unlock T2 technology |

The **Supply/Demand bars** below the grid show net flow per tick. A red bar means you're losing that resource faster than you're making it.

---

## Morale

The **MORALE bar** sits next to the threat meter. It ranges from −100 (collapse) to +100 (thriving).

- **Passive drain:** −0.3 per colonist per tick
- **Tavern / Dining Hall:** +1.5 morale/tick per assigned worker (the main way to gain morale)
- **VETERAN colonists** provide a small passive bonus
- **Raid strikes, injuries, and deaths** all deal morale damage

**Morale effects:**
| Range | Status | Effect |
|---|---|---|
| > 75 | THRIVING | +10% bonus on all resource production |
| 26–75 | STABLE | Normal |
| 1–25 | UNEASY | No bonus, slight risk |
| −1 to −50 | STRAINED | 5% chance each tick a working colonist refuses their post |
| −51 to −100 | FRACTURED / COLLAPSE | 10% chance each tick a colonist deserts permanently |

---

## Building Rooms

### T1 — Core Rooms

| Room | Cost | What it does |
|---|---|---|
| ⚡ Power Cell | 10 scrap | +4 energy/tick per worker |
| 💧 Water Recycler | 15 scrap | +3 water/tick, needs energy |
| 🌱 Hydroponics | 20 scrap | +2 food/tick, needs energy + water |
| 🔧 Workshop | Free | +2 scrap/tick, needs energy |
| 🛏 Barracks | 25 scrap | +2 population cap (no workers) |
| ⚔️ Armory | 40 scrap | Enables surface expeditions — needs 1 armorer |
| 🏥 Hospital | 35 scrap | Heals injured colonists — 1 nurse treats up to 3 patients |
| 🔬 Research Lab | 45 scrap | Generates Research Points — assign researchers to accelerate |
| 🍺 Tavern | 40 scrap | +1.5 morale/tick per bartender. Needs water + energy |
| 🍽 Dining Hall | 35 scrap | +1.5 morale/tick per cook. Needs food + energy |

### T2 — Unlocked via Research

| Room | Unlock Cost | What it does |
|---|---|---|
| 🪖 Sentry Post | 75 RP | Each assigned sentry reduces Arc threat by 5/tick. Exposed during raids. |
| 📡 Radio Tower | 75 RP | Reveals incoming raid size during the raid window. Without it, size is unknown. |
| 🏠 Shelter | 100 RP | Sound the alarm to shelter colonists — they're immune to Arc strikes while sheltered, but production stops. |

### T3 — Schematic-Gated (found via expeditions)

T3 buildings require **Salvage** and **Arc Tech** (from surface expeditions) in addition to scrap. They only appear in the build menu once you've recovered the matching schematic.

| Room | Schematic | Cost | What it does |
|---|---|---|---|
| 🔫 Arc Turret | turretSchematics | 60 scrap + 8 salvage + 3 Arc Tech | Passive: 30% chance per strike to eliminate 1 incoming Arc unit. Costs 2 energy/tick. |
| ⚡🔲 EMP Array | empSchematics | 80 scrap + 10 salvage + 5 Arc Tech | 50% chance to reduce raid targets by 1 per strike. Delays next strike +3 ticks. Needs 1 operator. |
| 🛡 Blast Doors | fortSchematics | 50 scrap + 6 salvage + 2 Arc Tech | Passive: 40% chance to absorb building damage targeting Row 1 per strike. |
| 🌋 Geothermal Gen | geoSchematics | 70 scrap + 12 salvage + 4 Arc Tech | Passive: +6 energy/tick. No workers needed. Unlocked by −40m excavation. |

---

## Excavation

The bottom three rows of the colony are **sealed** at game start. To unlock them you must excavate, going level by level (can't skip rows).

Click the **⛏ DIG** button on a sealed row to begin. Excavation costs scrap and takes several ticks, pulling colonists off their regular duties.

| Level | Cost | Workers | Ticks | Discovery |
|---|---|---|---|---|
| −20m | 40 scrap | 1 | 15 | Old utility tunnels. Power Cell costs 5 less scrap here. |
| −30m | 80 scrap | 2 | 25 | Pre-Arc storage vaults. +60 scrap found in rubble. |
| −40m | 150 scrap | 2 | 40 | Geothermal vents detected. Geothermal Generator schematics unlock. |

Deeper rooms are **safer from Arc strikes** — building your critical production there reduces the chance of losing it to a raid.

---

## Colonists

Your colonists are individuals with names. They level up, gain traits, and can die permanently.

**Statuses:**
- 🟢 **IDLE** — free, can be assigned
- 🔵 **ON DUTY** — working in a room
- 🟡 **DEPLOYED** — on a surface expedition
- 🔴 **INJURED** — recovering in hospital
- 🟡 **ON SENTRY** — reducing Arc threat at a Sentry Post
- 🩵 **SHELTERED** — protected during a raid alarm
- 🟤 **EXCAVATING** — digging out a new level

### XP & Leveling
Colonists earn **1 XP every 10 duty ticks** (while ON DUTY or ON SENTRY). Every **20 XP** they level up and you pick a trait.

### Traits
When a colonist levels up, choose one of five permanent traits:

| Trait | Effect |
|---|---|
| 🎖 VETERAN | Never flees during raids |
| 💪 IRON LUNGS | Heals 2× faster when injured |
| 🎒 SCAVENGER | +50% positive outcomes on scavenge expeditions |
| 👻 GHOST | 50% less likely to be targeted in raids |
| 🛡 HARDENED | Injury chance reduced (20% instead of 30% in raids) |

---

## Arc Raids

The **ARC HEAT** meter rises as your colony grows and operates. A larger/active colony builds heat faster, while sentries suppress it. As heat escalates, raid pressure increases and incoming events become more dangerous.

### Raid Window — Incoming
Each tick there's a **60% chance** the raid launches. If it doesn't, the raid **escalates** — Small grows to Medium, Medium to Large.

- **Small ⚡** — 1 worker targeted per strike
- **Medium 🔥** — 2 workers targeted, 10% building damage chance
- **Large 💀** — 3 workers targeted, 25% building damage chance

The **Radio Tower** reveals which size is coming. Without it, size is unknown until it fires.

### Active Raid
Once the raid fires it becomes a **sustained assault**:
- Small: 20 ticks · Medium: 30 ticks · Large: 60 ticks
- An **Arc Strike** fires every 10 ticks

**Per-strike colonist outcomes** (vs. exposed workers — those ON DUTY, ON SENTRY, or IDLE):
- **50%** — flees their post (VETERAN ignores this)
- **30%** — INJURED (HARDENED reduces this to 20%)
- **20%** — killed permanently

**Row-based targeting:** Colonists in shallower rooms are more likely to be targeted. Row 1 (−10m) is 4× as likely to be hit as Row 4 (−40m). The **GHOST** trait halves an individual's targeting weight.

**Building damage:** Medium and Large raids can damage rooms. Damaged rooms stop producing until repaired (20 scrap — click room → REPAIR).

**T3 defenses fire per strike:**
- **Arc Turret:** 30% to eliminate 1 Arc unit (reduces targets)
- **EMP Array:** 50% to reduce targets by 1 AND delay the next strike by 3 ticks
- **Blast Doors:** 40% to absorb building damage to Row 1

---

## Expeditions

Build an **Armory** and assign 1 armorer to unlock surface expeditions. Up to 2 expeditions can run simultaneously.

| Expedition | Colonists | Threat | Roll every | Loot profile |
|---|---|---|---|---|
| 🏃 Scavenge Run | 1 | +2 threat | 8 ticks | Scrap, Salvage, survivors — low risk |
| 💥 Arc Strike | 2 | +18 threat | 6 ticks | Arc Tech, Salvage, schematics — high risk |

Expeditions use a **roll table** — each roll generates an event (good, neutral, or bad). Morale affects the table: high morale boosts good outcomes, low morale makes bad outcomes more likely.

**SCAVENGER** trait boosts positive outcomes on scavenge runs. **GHOST** slightly reduces bad outcomes.

### Surface Haul
Some loot can't be stored as normal resources — it goes into the **Surface Haul** panel:
- 🔩 **Salvage** — raw material needed for T3 buildings
- ⚙️ **Arc Tech** — advanced components needed for T3 buildings
- 📋 **Schematics** — blueprints that unlock T3 buildings in the build menu

Schematics drop randomly from Arc Strike expeditions. There are 5 in total.

---

## Research & T2 Technology

Build a **Research Lab** and assign researchers to generate RP. Click the Research Lab to open the tech tree.

| Tech | Cost | Effect |
|---|---|---|
| 🛡 Barricades | 50 RP | Passive chance to fully block an incoming raid before it fires (75%/30%/10% for Small/Medium/Large). Costs 15 scrap to repair after a successful block. |
| 🪖 Sentry Post | 75 RP | Unlocks Sentry Post building |
| 📡 Radio Tower | 75 RP | Unlocks Radio Tower building |
| 🏠 Shelter | 100 RP | Unlocks Shelter building |

---

## Tips for Survival

- **Energy is the backbone.** If it runs out, water and food production collapses. Always keep a surplus. Build Power Cells early.
- **Don't build too fast.** Every room raises Arc threat. Expand at a pace your defenses can handle.
- **Dig deeper.** Row 4 is 4× safer from Arc strikes than Row 1. Put your most critical production down there.
- **Tavern or Dining Hall early.** Morale collapses without them — low morale causes colonists to walk out on their own.
- **Barricades are worth it.** At 75% block chance for Small raids, they'll save you repeatedly early on.
- **Staff your Hospital.** Without a nurse, healing takes 4× longer. Injured colonists are dead weight until healed.
- **Watch the NEXT STRIKE counter.** When it turns red (≤5 ticks) consider sounding the shelter alarm if you have it.
- **Arc Strike expeditions are high risk, high reward.** They're the only way to get Arc Tech, Salvage, and Schematics needed for T3 buildings — but they also spike your threat significantly.
- **Level up colonists on sentry.** Sentry time counts as duty ticks, so your sentries gain XP while reducing threat.
- **Veteran trait + Sentry Post = guaranteed threat reduction.** Veterans never flee and hold their posts no matter what.

---

## Controls

| Action | How |
|---|---|
| Build a room | Click empty grid cell → select from build menu |
| Manage a room | Click built room → use +/− buttons for workers |
| Recruit colonist | Click **+ RECRUIT** (costs 15 food + 15 water) |
| Excavate a level | Click **⛏ DIG** on a sealed row |
| Launch expedition | Click Armory room (must have armorer assigned) |
| Research tech | Click Research Lab room |
| Shelter colonists | Click Shelter room → SOUND ALARM |
| Pick colonist trait | Appears automatically at level-up above the grid |
| Repair damaged room | Click damaged room → REPAIR (20 scrap) |
| Demolish a room | Click room → DEMOLISH (returns 5 scrap) |
| Pause / change speed | ⏸ .5× 1× 2× 4× 10× buttons in top left |
| Mute audio | 🔊/🔇 button next to speed controls |

---

*Built in the Arc Raiders universe. The Arc doesn't sleep. Neither should you.*
