# Step 9 — Talent points (roguelike meta) + tower-defense depth

Two related ideas from Max, 2026-07-30. Do talents FIRST — the raid rework is
optional polish, the talent system fills an actual hole.

## 9a. Talent points — fills a hole the economy fix created

The raid economy fix (commit `32e7bcc`) removed a broken reward: raids used to
pay 685–1289 scrap win or lose, making them the best income in the game. That
was right to remove, but it leaves **surviving a raid with no reward at all** —
a clean win now nets about −15 scrap.

A separate meta-currency is a much better fit than scrap, because it is
progression rather than inflation.

### Model

- New currency, earned **only** by winning raids. Suggested: 1 per wave cleared,
  bonus for finishing at high hatch HP. Name it something that isn't lifted from
  Arc Raiders (see the IP note in `README.md`).
- Spent on a small tree of **permanent colony talents**. Keep the first pass to
  6–8 nodes; the game already has plenty of systems.
- Talents should modify things that already exist, via the pure helpers:
  - `calcHeatDelta` — "Deep Silence: −10% heat gain"
  - `DEPRIVE_COLLAPSE_TICKS` — "Rationing Discipline: +4 ticks before collapse"
  - `HEAL_RATE_NURSE` — "Field Medicine: +1 heal rate"
  - `DEFENSE_BUDGET` — "Standing Reserve: +40 defense budget"
  - adjacency rule strength — "Integrated Design: plumbing bonus 15% → 25%"
- Persist in the save; **do not** reset on `handleRestart` if you want it to feel
  roguelike across runs — decide this deliberately and write it down.

### Why this order

It is mostly data + one modal + threading multipliers through functions that are
already pure and already isolated. Low risk, high payoff.

## 9b. Tower-defense depth (optional)

The minigame already is a tower defense. What makes it read as a bar rather than
a battlefield is that **placement is 1-D**: `handleCanvasClick` takes only an x
coordinate and every defense sits on `GROUND_Y`.

The single highest-impact change is **2-D placement** — let the player build
back from the hatch, not just along it.

Touch points, all inside `surface_defense.jsx` (non-destructive to the colony):
- `makeDefense(x, type)` → `makeDefense(x, y, type)`
- targeting currently uses `Math.abs(en.x - def.x)` — needs real 2-D distance
- enemy pathing is `en.x += speed * dir` on one line — needs lanes or a path
- `defenseAt()` grab radius becomes 2-D
- rendering already draws at `(x, y)`, so it mostly follows

Do NOT start this until talents are in and the game has been played to day 25+.
It is the largest change to that file since it was written.

## Done when

- [ ] Winning a raid grants meta-currency, visible in the header
- [ ] A talent screen spends it on at least 6 nodes that alter real values
- [ ] Talents persist correctly and their save/restart behaviour is documented
- [ ] Balance re-simulated after talents exist (they will shift the heat curve)
