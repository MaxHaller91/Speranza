# ⛩ SPERANZA UNDERGROUND

> *The Arc has taken the surface. You are what's left.*

A browser-based colony survival game set in the Arc Raiders universe. Manage resources, expand your underground base, research new technology, and survive escalating Arc raids.

**▶ Play now:** https://maxhaller91.github.io/Speranza/

---

## Getting Started

When you load the game you'll have:
- **3 named colonists** — VASQUEZ is in the Workshop, CHEN is in the Power Cell, and one spare colonist standing idle
- A **Workshop** (makes scrap), a **Power Cell** (makes energy), and a **Barracks** (housing)
- Starting resources: 80 energy, 60 food, 60 water, 50 scrap

Your immediate goals:
1. Build a **Water Recycler** and a **Hydroponics** bay to stop your food and water from draining
2. Assign your idle colonist to one of these rooms
3. Keep an eye on the **ARC THREAT** meter in the top right

---

## The Grid

The 4×7 grid is your colony. Click any **empty cell** to open the build menu. Click a **built room** to manage it.

Each room has a **worker capacity** shown as dots — fill the dots to staff the room to full output. Staffed rooms produce resources every tick. Unstaffed rooms produce nothing.

---

## Resources

| Resource | What it does |
|---|---|
| ⚡ Energy | Powers most rooms — if it runs out, water and food production stops |
| 🌱 Food | Consumed by colonists every tick — hits zero and it's game over |
| 💧 Water | Same as food — keep it positive |
| 🔧 Scrap | Used to construct buildings |
| 🔬 RP | Research Points — used to unlock T2 technology |

The **Supply/Demand bars** below the grid show net flow per tick. Red bar = you're losing that resource faster than you're making it. Fix it before it hits zero.

---

## Building Rooms

| Room | Scrap Cost | What it does |
|---|---|---|
| ⚡ Power Cell | 10 | +4 energy/tick per worker |
| 💧 Water Recycler | 15 | +3 water/tick, needs energy |
| 🌱 Hydroponics | 20 | +2 food/tick, needs energy + water |
| 🔧 Workshop | Free | +2 scrap/tick, needs energy |
| 🛏 Barracks | 25 | +2 population cap (no workers needed) |
| ⚔️ Armory | 40 | Lets you launch surface expeditions |
| 🏥 Hospital | 35 | Heals injured colonists |
| 🔬 Research Lab | 45 | Generates Research Points |

**Important:** every building you construct increases the Arc threat rate. Bigger colony = more pressure. Expand smart.

---

## Colonists

Your colonists are individuals with names. They matter — losing VASQUEZ to a raid feels different than losing a number.

**Statuses:**
- 🟢 **IDLE** — free, can be assigned to a room
- 🔵 **ON DUTY** — assigned and working
- 🟡 **DEPLOYED** — on a surface expedition
- 🔴 **INJURED** — recovering, can't work
- 🟡 **ON SENTRY** — assigned to a Sentry Post, reducing Arc threat

To assign a colonist, click a room and press **+**. To unassign, press **−**.

**Recruiting:** Click **+ RECRUIT** (costs 15 food + 15 water). You can't recruit past your population cap — build more Barracks to raise it.

---

## Arc Raids

The **ARC THREAT** meter fills as time passes. A larger colony fills it faster. When it hits 100% a **raid window** opens.

### Phase 1 — Incoming
A raid is mobilizing. Each tick there's a **60% chance** it launches. If it doesn't launch, the raid escalates — Small raids grow into Medium, then Large.

- **Small ⚡** — 1 worker targeted
- **Medium 🔥** — 2 workers targeted
- **Large 💀** — 3 workers targeted

The full-width red banner at the top tells you what's coming.

### Phase 2 — Active Raid
When the raid fires, it becomes a **sustained assault** lasting many ticks:
- **Small**: 20 ticks
- **Medium**: 30 ticks
- **Large**: 60 ticks

Every 10 ticks an **Arc Strike** hits — exposed workers (those ON DUTY or ON SENTRY) are targeted. Per-strike outcomes:
- **50%** — colonist flees their post (becomes idle, shaken)
- **30%** — colonist is **INJURED** (sent to hospital to recover)
- **20%** — colonist is **KILLED** (permanent)

Medium and large raids can also damage buildings. Damaged rooms stop producing until repaired (costs 20 scrap — click the room and hit **REPAIR**).

Watch the **NEXT STRIKE** counter in the raid banner. When it turns red (≤5 ticks), brace for impact.

---

## Expeditions

Build an **Armory** and assign 1 colonist as an armorer to unlock surface expeditions.

| Expedition | Colonists | Duration | Fail Chance | Reward |
|---|---|---|---|---|
| 🏃 Scavenge Run | 1 | 5 ticks | 10% | +25 scrap |
| 💥 Arc Strike | 2 | 8 ticks | 30% | +60 scrap, +30 energy |

**Warning:** expeditions also increase Arc threat. Don't send people out if a raid is about to hit.

---

## Research & T2 Technology

Build a **Research Lab** and assign researchers to generate RP. Open the Research Lab panel to spend RP on upgrades:

| Tech | Cost | Effect |
|---|---|---|
| 🛡 Barricades | 50 RP | Passive chance to fully block an incoming raid (75%/30%/10% by size). Costs 15 scrap to repair after a block. |
| 🪖 Sentry Post | 75 RP | Unlocks the Sentry Post building. Assigned sentries reduce threat by 5/tick each — but they're exposed during raids. |
| 📡 Radio Tower | 75 RP | *Coming soon* — reveals raid size before it launches |
| 🏠 Shelter | 100 RP | *Coming soon* — sound the alarm to make colonists immune to raid strikes |

---

## Tips for Survival

- **Don't build too fast.** Every room raises Arc threat. Make sure your defenses can keep up.
- **Staff your rooms.** An empty room produces nothing. A full room produces twice as much as a half-staffed one.
- **Energy is the backbone.** If energy runs out, water and food production collapses. Always keep a surplus.
- **Recruit early.** More colonists = more output, but also more food/water drain. Find the balance.
- **Barricades are worth it.** Unlocking them early can block a raid outright — especially small raids (75% block chance).
- **During a Large raid (60 ticks), you will take multiple strikes.** Unassign colonists from rooms during a raid to reduce exposure, or get the Shelter tech to protect them properly.
- **Watch the log.** It tells you exactly what happened and when. Named colonists make it worth reading.

---

## Controls

| Action | How |
|---|---|
| Build a room | Click empty grid cell → select from menu |
| Manage a room | Click built room → use +/− buttons |
| Recruit colonist | Click **+ RECRUIT** button |
| Launch expedition | Click Armory room (must have armorer assigned) |
| Research tech | Click Research Lab room |
| Repair damaged room | Click damaged room → REPAIR button |
| Demolish a room | Click room → DEMOLISH (returns 5 scrap) |
| Pause / change speed | ⏸ .5× 1× 2× 4× 10× buttons in top left |
| Mute audio | 🔊/🔇 button next to speed controls |

---

*Built in the Arc Raiders universe. The Arc doesn't sleep. Neither should you.*
