# Beta: professions, needs, and an escalating raid clock

Branch `beta-anno-tiers`, from `testing` @ `976194b`. Experimental. If it does not
feel better than the survival game on `testing`, it gets abandoned, and that is a
fine outcome.

## The problem this exists to solve

Measured, not guessed (`memory-bank/progress.md`):

> One Hydroponics worker produces 2 food/tick and a colonist eats 0.4, so one
> worker feeds exactly 5 colonists — and the population cap with a single
> Barracks is also 5.

Life support never has to scale, so the colony is solved on about day 5 and
nothing after that is a decision. A player put it plainly: *"you basically have
to be careless to lose the colony right now."*

The fix is not harsher numbers. It is that **advancing must cost more than it
immediately returns**, so there is always a next bottleneck.

## Decisions taken (Max, 2026-08-01)

1. **Professions replace traits entirely** at level-up. Traits are retired —
   two progression systems on the same event muddies both, and traits are
   invisible stat bumps nobody can observe.
2. **Unmet needs never demote anyone.** They withhold the *bonus*, and that
   bonus is what you need to advance. Nothing is ever taken away.
3. **Raids become rarer and much harder.**

Decision 2 is the load-bearing one. It means:

- **No death spiral is possible.** The colony's existing failure mode was
  morale → refusals → lost life support → starvation. Needs deliberately do not
  touch morale, and cannot remove capability.
- A raid that flattens your supply chain **stalls** you rather than unravelling
  you. That removes the worst trap in this design without needing buffers or
  grace periods.
- The system reads as **investment**, not maintenance. You are never punished
  for standing still, only prevented from moving forward.

## The loop

```
raids escalate over time
      ↓  survive them
you need better defences and tech
      ↓  unlocked by
Research Points
      ↓  produced only by
Technicians whose needs are met
      ↓  needs supplied by
a production chain
      ↓  which costs
cells, workers, and food those workers eat
```

The clock is the raid escalation. Standing still is safe today and fatal in ten
days. That replaces starvation as the pressure, since starvation demonstrably
does not work once two rooms are staffed.

## What "the bonus" concretely is

Each profession has a **signature output that only flows while its needs are
met**. Use what already exists rather than inventing currencies:

| Profession | Needs | Signature output when satisfied |
|---|---|---|
| **Labourer** (default) | food, water (already global) | none — staffs basic rooms |
| **Technician** | Filtered Water | **Research Points** at the Research Lab |
| **Medic** | Medical Supplies | healing throughput at the Hospital |

RP already gates the T2 tech tree, which already gates Barricades, Sentry Post,
Radio Tower. So "unmet needs stop you advancing" needs no new machinery: an
unsatisfied Technician still works, still staffs the Lab, and simply produces no
RP. The tech tree stalls. The escalating raids do not.

## The chain (exactly one, on purpose)

**Filtration Plant** — water + energy → Filtered Water. Staffable by a
**Labourer**, which solves the bootstrap problem: the first Technician does not
require a Technician. Only later tiers close the loop.

Two buildings already in the game become need-satisfiers instead of morale
faucets. Right now Tavern and Dining Hall consume water/food/energy and produce
nothing but `+1.5 morale/tick` each — a real building pouring into one
undifferentiated bucket. They become **wants**: satisfied, they grant a
production bonus; unsatisfied, nothing happens.

## Raid rebalance

Current cadence: `RAID_ROLL_EVERY = 8` ticks with `0.05 + 0.16 × heat%` per roll.
At maximum heat that is 6 rolls/day at 0.21 → **about a 76% chance of a raid
every single day**. The playtest bore this out: raids on days 3, 4, 6, 6, 8, 9.

And they are trivial. From the same playtest: *"a barricade and 2 upgraded
turrets easily kill everything and I was getting like 900 scrap to spend but I
didn't need to do anything besides upgrade the turret twice, which was like 60
scrap."* A committed defence budget only creates a decision when it is scarce.

Target: **roughly one raid every 3–4 days, each 2–3× the current threat.**

- Lengthen `RAID_ROLL_EVERY` and cut the probability constants
- Raise the wave threat budget substantially
- Make the defence budget genuinely binding — either lower it or cut scrap income
- Telegraph earlier, so preparation is a real phase rather than a formality
- **Let the player fast-forward a raid.** Raids are the only thing that stops
  the colony clock, so a boring one is a pure tax on the player's time.

## First slice — build this, then decide

Do **not** build seven professions and five chains. Prove the loop is fun first:

- [ ] Professions replace traits at level-up: Labourer / Technician / Medic
- [ ] Technician needs Filtered Water; Filtration Plant produces it
- [ ] RP flows only from satisfied Technicians
- [ ] One panel showing unmet needs at a glance
- [ ] Raids: rarer, harder, fast-forwardable

If promoting someone and scrambling to supply them feels good, it will feel
better with more professions. If it feels like paperwork, we spent a day rather
than a fortnight.

## Rules this must not break

Needs are satisfied by **building and staffing**, never by clicking on
colonists. The moment it becomes per-person micromanagement it is exactly the
annoying system we were trying to avoid.

The invariants in `plans/MASTER_ROADMAP.md` still apply — derived
`cell.workers`, pure state updaters, and `pauseReason` as the single clock
owner. Any new modal is one line in `pauseReason` and never calls
`setTimescale`.

## Open questions

1. **Do later level-ups deepen a profession or re-pick it?** Picking once at
   first level-up and deepening after is more Anno-like; re-picking is more
   forgiving. Not decided.
2. **Space.** 28 cells, gated behind excavation. Each chain eats cells, which is
   the point — but if it strangles the game, step 8 (per-cell excavation) may
   need to land first so the map can actually grow.
3. **Does the tech tree need more depth?** If RP is the advancement gate, the
   current T2 tree may be too short to be worth gating.
