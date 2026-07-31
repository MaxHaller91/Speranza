# Step 10 — Sustained pressure (the colony should never be "solved")

Raised by Max, 2026-07-31, after talents landed:

> "You basically have to be [careless] to lose the colony right now. You could
> just build hydro and water and the colony survives indefinitely. I would like
> to adjust that so the player is constantly having to manage things."

Once a single Hydroponics and a single Water Recycler are staffed, the colony is
self-sustaining and the player has nothing left to do. That is the problem to
fix. A roguelike meta-currency (step 9a) only means anything if runs actually
end.

Note for whoever picks this up: an earlier automated run died on day 3 of morale
collapse, but that colony had **no food or water rooms built and idle
colonists** — it is not evidence of late-game pressure and should not be cited
as such.

## Measured: why it is solved

From `DRAIN_PER_COL` (`gameData.js:777`) — 0.4 food, 0.4 water, 0.2 energy per
colonist per tick — and the room definitions at `gameData.js:293-316`:

| setup | food | water | energy | scrap | |
|---|---|---|---|---|---|
| pop 3, one worker each | +0.8 | +0.8 | +1.4 | 0 | sustains |
| pop 5, one each + workshop | 0.0 | 0.0 | 0.0 | +2.0 | sustains |
| pop 5, two each (full) | +2.0 | +2.0 | +2.0 | +2.0 | sustains |
| pop 8, two each (full) | +0.8 | +0.8 | +1.4 | +2.0 | sustains |
| pop 12, two each (full) | −0.8 | −0.8 | +0.6 | +2.0 | starves |

**The crux: one Hydroponics worker produces 2 food/tick and a colonist eats
0.4, so one worker feeds exactly 5 colonists — and the pop cap with a single
Barracks is also 5.** Life support therefore never has to scale. One staffed
Hydroponics and one staffed Water Recycler cover the entire reachable
population with surplus to spare, forever, and stores climb to `MAX_RES` and
sit there.

It only goes negative around pop 12, which requires deliberately building extra
Barracks — i.e. the player has to opt in to the only pressure that exists.

Whatever fix is chosen, this ratio is the thing to break: **per-colonist demand
must be able to outrun a fixed number of life-support rooms.**

## Directions worth considering

- **Decay / maintenance.** Rooms degrade and need scrap upkeep, so a static
  colony bleeds instead of plateauing. The most standard answer, and it keeps
  Workshop output relevant forever.
- **Population pressure.** Colonists arrive over time and must be housed and fed,
  so standing still means growing need. Turns "solved" into "solved *for now*".
- **Heat as an unavoidable ratchet.** Already nearly true — the recorded trace
  showed heat climbing 0→219 over 10 days and never returning near zero. Raids
  may already be the intended clock; the issue may be that a built-up defence
  makes them ignorable.
- **Depletion.** Water table or soil quality degrades, forcing relocation or tech
  investment.

## Do not

- Do not solve this by raising consumption rates. That punishes the early game,
  which playtesting already found to be the harsh part, without making the late
  game interesting.
- Do not stack this with step 9b (2-D tower defense). Both change how a run
  feels; changing them together makes the result impossible to attribute.

## Done when

- [ ] A player who stops making decisions loses, on a timescale that reads as
      consequence rather than as a timer
- [ ] A player who keeps making good decisions can still lose to bad luck
- [ ] Re-verified on all three difficulties, since settler exists to be forgiving
