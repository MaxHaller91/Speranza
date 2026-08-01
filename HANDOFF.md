# Speranza — Handoff

**Start here.** Branch `opus-5`, branched from `testing`. Everything below is
committed and pushed.

> **Keep this file current as you go — every commit, not at the end.** A session
> can be cut off mid-task with no warning (usage limits give no advance signal),
> so treat "the docs are up to date" as an invariant that holds continuously
> rather than a step you do before stopping. If you are partway through
> something when you commit, say so in §4 under a **Partially done** heading:
> what works, what does not, and the next concrete action. A precise
> half-finished note is worth far more to the next session than a tidy summary
> written too late to survive.

---

## 1. Read these two things first

**`plans/MASTER_ROADMAP.md`** — contains two invariants that, if broken, silently
corrupt the game, plus the audit script that catches one of them. Both explain
bugs that were misdiagnosed in this repo for months.

**`plans/roadmap/README.md`** — the ordered work queue, with completed items
ticked off and a detail doc per remaining step.

Then `memory-bank/activeContext.md` for what is true right now, and
`memory-bank/progress.md` for what works and what is known broken. The rest of
`memory-bank/` (`projectbrief`, `productContext`, `systemPatterns`,
`techContext`) is stable background — read it when you need it, not every time.
Keep `activeContext.md` *current* rather than appending to it; it rotted once
already by becoming a session log, and a stale "still open" list sent work at
problems that were already fixed.

---

## 2. The two rules

**Never write `cell.workers` directly.** It is derived from each colonist's
`assignedRoom`. Change the colonist and let the reconciler follow. Every "remove
a worker" path used to pick a *random* staffed room.

**Never put randomness or side effects inside a state updater.** `main.jsx`
renders under `StrictMode`, which double-invokes updaters in development. This
caused raid announcements to fire twice, level-ups to log twice, and every
expedition to resolve twice per tick with different random outcomes. The audit
script in the master roadmap must report `0`.

---

## 3. Current state

Done on this branch: colonist→room assignment model, animated colonist sprites,
heat/raid rebalance, starvation as a survivable process, StrictMode purity sweep
(11 sites), base-defense minigame depth, expeditions phases 1–2, room adjacency,
colony naming, two playtest bug passes (ten bugs), a soak-test harness,
**difficulty options** (roadmap step 6 — settler/survivor/condemned),
**talent points** (roadmap 9a — Resolve earned by repelling raids), a start
screen with pause-ownership consolidation, and **roadmap step 2a–2c** (Traders,
Artifacts, Colony Directives — the last unwired lore content is 2d, Arc
Commanders).

Full commit list and detail: `plans/roadmap/README.md` and
`memory-bank/progress.md`.

---

## 4. Open threads, highest value first

### 0) Roadmap step 2d — Arc Commanders (last unwired lore content)

`02-wire-unused-lore.md`'s 2a (Traders), 2b (Artifacts), and 2c (Colony
Directives) are all done — see `memory-bank/progress.md` for each. 2d is what's
left: named raid leaders (`COMMANDER_NAMES`/`COMMANDER_WEAKNESSES`/
`COMMANDER_STRENGTHS` in `speranza-lore.js`) attached to a raid at heat 600+
after 5+ raids, feeding the dormant `commandersKilled` milestone trigger. The
plan doc flags this as the biggest of the four sub-steps — do it on its own.

### a) The 25-day soak test — **difficulty options landed; re-run not yet done**

Roadmap step 6 (difficulty options) landed this session — see
`memory-bank/progress.md` under "Difficulty Options" for the full writeup,
including a NaN bug found and fixed during in-browser verification (a ref held
the difficulty *key string* where a lever expected the resolved config object;
fixed by splitting into `difficultyRef` and `diffConfigRef` in `Speranza.jsx`).
**The soak has not yet been re-run on `settler` to check whether day 25 is now
reachable** — that is the next concrete action for this thread. Everything
below this paragraph is the state as of the *previous* (day-10) run.

**The blocker is fixed.** `npm run soak` builds with `--mode soak` (via
`.env.soak`, `VITE_SOAK=1`) and serves on port 4180. That is a *production*
build — honest clock — that keeps the `window.__speranza` hook. Verified both
ways: plain `npm run build` is 363.75 kB with no hook, soak build is 364.76 kB
with it. Preview config `speranza-soak` is in `.claude/launch.json`.

Two hook additions were needed and are in:
- **`state.pauseCause`** — names *why* the clock is stopped (`dilemma`,
  `traitPicker`, `surfaceDefense`, `milestone`, `help`, `buildMenu`, `gameOver`,
  `manual`). Before this a harness saw `timescale: 0` and could not tell whether
  it had paused itself or something was waiting for input. This cost real time.
- **`sandboxMorale(floor)`** — morale, not supply, is what kills an unmanaged
  colony (see the finding below). Same caveat as `sandboxTopUp`: never judge
  balance from a run that used either.

**Result: reached day 10 continuous, not 25.** A large raid wiped all four
colonists on day 10 and the harness restarted the run. Full findings and the
day-by-day table are in `memory-bank/progress.md` under "Automated Soak Test".

Headlines: floats confirmed on energy/food/water; an unmanaged colony dies on
day 3 of *morale* collapse with full stores; heat only ratchets upward (0→219
over 10 days); `large` raids appear on **day 3** against a 3-person colony;
expeditions and tech never fired at all in 10 days.

**Why 25 was not reached, and what to do about it.** Raids kill the colony
faster than it grows, and death restarts at day 1. Two ways forward — the second
is better because it is real product work rather than test scaffolding:

- teach the harness to actually play the tower defense competently, or
- land **roadmap step 6 (difficulty options)** and run the soak on an easier
  setting. Prefer this.

The harness is throwaway JS injected into the page (`window.__soak`); it is not
committed. Rebuild it from the notes in `progress.md` if a run needs repeating.
Note that morale's real range is **−100..100**, not 0..100.

### a-old) Original notes on the soak blocker (kept for context)

A `window.__speranza` dev hook now exposes real game state plus actions
(`build`, `assign`, `recruit`, `launch`, `setTimescale`, `sandboxTopUp`), so a
test harness can assert on state instead of scraping rendered text. It is behind
`import.meta.env.DEV` and verified absent from the production bundle.

**Run the soak against the production preview, not the dev server:**

```bash
npm run build && npx vite preview --port 4173
# then open http://localhost:4173/Speranza/
```

Why: the **dev build runs at ~4.5× when set to 10×**, because StrictMode
double-invokes the whole tick loop. Production hits a true 10× (measured: 20
ticks in 8s). At true 10×, day 25 is about 8 minutes of wall clock.

Caveat: the dev hook is stripped from production builds. Either scrape the DOM
for the soak, or add a build flag that keeps the hook in preview builds.

Related observation worth keeping: a tick appears to cost ~1s of main-thread
work in dev, against a 400ms production budget. There is not much headroom —
this will matter for bigger colonies or a faster speed setting.

### b) Resources are floats at the source — DONE

Fixed in `fd884ff` ("Round resources at source, and put the traders to work").
`roundRes()` in `gameData.js` runs once at the end of the tick's `setRes`
updater, after every drain and production has landed. This section had gone
stale — the fix landed a session before this note was corrected. See
`memory-bank/progress.md` "Floats fixed at source + Traders wired" for the
verification.

### c) Pause ownership — DONE

`timescale` used to be both "the speed the player picked" and "is the game
stopped", so five callers wrote it independently and an overlay effect that had
`timescale` in its own deps fought all of them.

It is now **derived**, and there are only two stored pieces:

- `speed` — what the player chose. Never 0, never written by an overlay.
- `manualPause` — the player's own pause toggle.

`pauseReason` is a single ordered expression listing everything that blocks the
clock (`startScreen`, `gameOver`, `traitPicker`, `dilemma`, `milestone`, `help`,
`surfaceDefense`, `buildMenu`, `manual`), and `timescale = pauseReason ? 0 : speed`.

**To add a blocking overlay, add one line to `pauseReason`. Do not call
`setTimescale` anywhere.** A `setTimescale(n)` shim is kept so keybindings, the
header and the dev hook keep working; it can never override an overlay, which is
the whole point. `state.pauseCause` in the dev hook reads that same value rather
than recomputing it, so the two cannot drift.

This is what `plans/expedition-decisions-v2.md` was waiting on — expedition
decision prompts can now be a pause reason without touching the clock.

### d) Everything else

`plans/roadmap/` step 2d (Arc Commanders — see §0 above) plus steps 3–5, 7–9b,
expeditions phases 3–6 (`plans/expedition-decisions-v2.md`), and the Arc
Raiders IP rename, which should happen before any store page exists.

---

## 5. Dev-loop gotchas that will waste your time

- `npm run build` **reloads the dev page** — `dist/` is inside the watched
  directory. Never build in the middle of an in-browser test.
- Editing *any* project file reloads the page too, including markdown.
- Dev harnesses live at `/Speranza/sprites.html` (colonist poses) and
  `/Speranza/defense.html` (the minigame at any raid size). Both are excluded
  from production builds — re-verify that if you touch the build config.
- **The Browser-pane preview tools look for `.claude/launch.json` at the main
  repo root, not the worktree's own `.claude/launch.json`**, even though Bash's
  cwd is the worktree. `preview_start` with a `name` will fail to find the
  worktree's config. Workaround: start the dev server yourself (`npm run dev
  -- --port <N>`, backgrounded via Bash), then write a *main-repo-root*
  `.claude/launch.json` with a `{ "name": ..., "url": "http://localhost:<N>" }`
  entry (no `runtimeExecutable`) and call `preview_start` with that name — it
  attaches to the already-running server instead of trying to launch one.
  Remove that root-level file again when done so it doesn't linger as stray
  config for the next session.

---

## 6. How to work on this repo

This is a game intended for Steam. That sets the bar: it has to be *fun*, not
merely correct. A feature that builds clean and plays badly is not done.

**Play it, don't just build it.** Both playtest passes found bugs that no amount
of reading found — 6/5 colonists, scrap inflating, a raid banner that made
losing look identical to winning. Ship nothing on the strength of a clean build
alone.

**Verify numerically, not visually.** Sprite positions were checked by sampling
canvas pixels; balance changes were checked with throwaway node scripts. "Looks
about right" has been wrong here more than once.

**Report what actually happened.** If a test failed, say so and paste the
output. If you could not reproduce something, say that plainly instead of
inventing a cause — that exact honesty is what located the real bug (losing
being indistinguishable from winning) after the reported symptom turned out not
to exist.

**When told to keep going, execute.** Do not re-ask a question that has already
been answered, and do not narrate options you are not going to take.

**Prefer the smallest change that makes position/decisions matter.** Adjacency
was chosen over a full overhaul for this reason.

## 7. Before you commit

1. **The StrictMode audit script must report `0`.** It is in
   `plans/MASTER_ROADMAP.md` §2. This is not optional — it has silently
   corrupted the game three separate times.
2. `npm run build` passes. (Never run it mid-browser-test; it reloads the page.)
3. You actually ran the thing in the browser and watched it behave.
4. Tick off the roadmap item in `plans/roadmap/README.md`, and update
   `memory-bank/activeContext.md` if what's-true-now changed.
5. Commit to `opus-5` with a message describing the *behaviour* change, not the
   files touched.

**Do not** merge to `main` or `testing`, open a PR, or start roadmap steps 7–8
without a human in the loop.
