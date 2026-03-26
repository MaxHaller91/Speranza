# Design Notes

Architecture decisions and planned features with enough context to pick up cold. These are not bugs — they are unimplemented decisions waiting for the right moment.

---

## DN-001 — Save / Load System

**Status:** Not started. GitHub Pages playtesting first, then implement.

No save/load system exists. Refreshing the page resets all progress. Recommended approach: localStorage autosave (every 10 ticks, silent) combined with manual file export/import (download/upload `.speranza` JSON). The `fullState` object in the bug report system is already a valid save file shape — serialization is essentially solved.

**Implementation plan:**
- `localStorage` autosave for GitHub Pages / web (one slot, silent, every 10 ticks)
- File download/upload for manual saves (players can back up and share runs)
- Tauri filesystem for Steam release (auto-saves to `AppData/Speranza/saves/`)

**Critical concern — schema versioning:** As colonist objects and grid structures evolve, old saves will be missing new fields and need a migration layer. Add `saveVersion: number` to the save file from day one and write a `migrateSave(data)` function that patches missing fields to their defaults before restoring state. Do this before shipping save support to any players.

---

## DN-002 — Toast / Notification Overhaul

**Status:** Not started. Needs decision on approach before implementation.

Current behavior — game pauses, blocking toast, must dismiss — creates friction when firing frequently. Two problems to solve together:

**Problem A — Toasts are interruptive:**
Proposal: replace with a persistent activity feed in the sidebar. Events scroll in passively, game never pauses, player glances when they want. The colony log and toast system are already near-duplicate data — merging them into one live feed simplifies both.

Possible two-tier system: passive feed for most events, one-time full interrupt only for truly critical moments (first raid, game-over-adjacent).

**Problem B — Colony Log and Effects panels hard-pause and block timescale controls:**
The pause-on-open behavior is broken — timescale buttons can't override it while the panel is open. Options:
- Colony Effects → hover tooltip on the button (works well, it's compact data)
- Colony Log → fold into the persistent sidebar feed (no separate panel needed)
- Both panels → non-blocking, game keeps running while open

**Proposed unified direction:**
- Sidebar becomes the information hub
- Colony Log → always-visible scrollable feed (replaces both log panel and toasts)
- Colony Effects → hover tooltip only, no panel
- Toasts → eliminated as a concept; important events get a highlighted/colored entry in the feed
- Nothing hard-pauses except the pause button itself

**Open questions before implementing:**
- Should any events still interrupt? (raid warning, milestone, level-up?)
- Is the level-up trait picker still a modal or does it become part of the feed?

---

## DN-003 — Resource Scarcity and Stockpile Buildings

**Status:** Idea, not designed yet.

Current resources have a soft cap (MAX_RES = 999) but no storage infrastructure requirement. Proposal: add stockpile/storage room types that increase the effective resource cap. Without them built, resources cap much lower, creating early-game pressure to invest in storage before expanding production.

This would add a meaningful early-game decision: build more production or build storage to hold what you produce. Pairs well with the existing scrap-as-currency system.

**Needs design work before implementation:** cap values, storage room costs, how existing saves/runs would handle the new constraint.

---

## DN-004 — Low Resource Visual and Audio Warning

**Status:** Small improvement, not started.

No clear signal when food or water is critically low. Players can miss it until colonists start dying. Needs:
- Visual: resource bar color shift or pulse animation when below a danger threshold (e.g. <10 units)
- Audio: a distinct warning sound cue (check sounds.js for existing alert functions before adding new ones)

Threshold values to decide: what counts as "dangerously low" for each resource type.

---

## DN-005 — Game Over Screen and Narrative Depth

**Status:** Needs redesign. Colonist levels currently display incorrectly here.

The game over screen is functional but not emotionally resonant. The game's strongest asset is its colonist characters — named people with backstories, quirks, and histories. The end screen should lean into this.

**Ideas:**
- Fix colonist level display (bug, should be in Known Issues but tied to redesign)
- Show each surviving/fallen colonist with their full story — days survived, raids weathered, expeditions completed, cause of death
- Epitaphs for fallen colonists pulled from memorial[]
- Run stats: days survived, total colonists lost, rooms built, raids repelled
- The run code should feel like a memorial plaque, not a debug string

**New Game+ consideration:** Could carries over a single colonist (the "survivor") from a failed run into the next one — same name, backstory, one trait preserved. Creates continuity and emotional stakes across runs. Needs careful balancing so it doesn't trivialize early game.

---

## DN-006 — Level-Up Trait Picker UX

**Status:** Works but needs rethinking alongside DN-002 toast overhaul.

Currently fires as a blocking modal. If toasts move to a feed system, the trait picker should be reconsidered too — it might work better as a highlighted sidebar prompt that the player can action when ready, rather than a hard stop. Depends on resolution of DN-002 first.

---

## DN-007 — Steam / Desktop Release Path

**Status:** Future, no timeline.

Game is currently deployed on GitHub Pages. Path to Steam:
1. Tauri integration (wraps React/Vite into native executable — `.exe`, `.app`, Linux binary). Minimal code changes required. Unlocks filesystem access for save system.
2. Steamworks registration ($100 one-time fee, waived against first $1000 revenue)
3. Store page assets (capsule art, screenshots, trailer, description)
4. SteamPipe build upload + Valve review (~2-5 days)

Tauri is the only technical step. Everything else is paperwork and art. A save system (DN-001) should exist before a Steam release — players expect to pick up where they left off.
