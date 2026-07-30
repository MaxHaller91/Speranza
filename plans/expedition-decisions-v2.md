# Plan: Expedition Decisions and Colonist Story Continuity
Generated: 2026-07-30 | Status: AWAITING APPROVAL

## What We're Solving

Expeditions currently feel like a slot machine: the player chooses a mission type and duration, the game selects the first eligible colonists, and hidden tables repeatedly roll loot, injury, or death until the team returns. We will replace that passive middle with short authored text situations that pause the colony and ask for orders. The player will choose a destination and named crew, see qualitative risks, respond to field injuries, and create lasting stories through scars, relationships, named expedition gear, and finite personal story chains. This is **not** a surface map, faction system, real-time minigame, or second strategic layer.

## Current State Inventory

### Systems Involved

Source files expected to change on `opus-5`:

- `src/Speranza.jsx`
  - Expedition state, tick advancement, launch/decision handlers, colony effects, pause behavior, save/load, restart, and prop wiring.
- `src/gameData.js`
  - Colonist defaults and pure expedition transition/filter/normalization helpers.
- `speranza-lore.js`
  - Existing destinations and radio flavor; new authored encounters, scars, gear definitions, and finite story-chain content.
- `src/components/SidePanel.jsx`
  - Destination and manual crew selection, active expedition summaries, and colonist field-history display.
- `src/components/ExpeditionDecisionModal.jsx` (new)
  - Props-only field situation UI.
- `memory-bank/activeContext.md`
- `memory-bank/progress.md`
- `memory-bank/systemPatterns.md`

Files and systems explicitly outside scope:

- `src/surface_defense.jsx`
- Raid lifecycle state and callbacks
- Surface maps or route-board navigation
- Factions, reputation, or diplomacy
- Real-time expedition combat
- Autonomous colony relationship simulation
- Broad equipment/inventory systems

### Relevant State

Current top-level state:

- `expeditions: Expedition[]`
- `expedDuration: 20 | 40 | 60 | 80`
- `expeditionsCompleted: number`
- `colonists: Colonist[]`
- `surfaceHaul: { salvage, arcTech, schematics }`
- `surfaceCondition`, `heat`, `morale`, `timescale`

Current expedition records contain mission type, duration/ticks, selected colonist IDs, automatic-roll timing, event log, accumulated loot, and launch-time morale/condition/quirk snapshots.

Target expedition additions:

```text
{
  locationId,
  phase: "outbound" | "objective" | "returning",
  encounterStep,
  recentEncounterIds: string[],
  flags: string[],
  pendingDecision: null | {
    id, encounterId, kind: "encounter" | "injury",
    title, text, createdTick,
    actorIds: string[], targetId?: string,
    choices: Array<{ id, label, preview, riskLabel }>
  },
  decisionHistory: Array<{ decisionId, choiceId, tick }>,
  fieldInjuries: Array<{ colonistId, severity, stabilized, sourceDecisionId }>,
  pacePenalty: number,
  returnRequested: boolean
}
```

Pending decisions store their concrete text, actors, and available choices. Reloading must restore the same prompt; it must not regenerate or replace it.

Target colonist additions:

```text
{
  expeditionTags: string[],
  scars: Array<{ id, scarId, acquiredTick, sourceDecisionId }>,
  fieldGear: Array<{ instanceId, gearId, condition: "intact" | "damaged" }>
}
```

Relationships should **not** be duplicated inside both colonists. Add one canonical top-level state:

```text
expeditionRelationships: Record<pairKey, {
  colonistIds: [string, string],
  bond: -2 | -1 | 0 | 1 | 2,
  history: Array<{ id, tick, type, summary }>
}>
```

`pairKey` is produced by sorting the two colonist IDs and joining them. One pure helper owns all pair updates. Relationship history events use stable decision IDs so StrictMode or repeated handlers cannot apply them twice.

Finite story-chain progress should also be canonical top-level state because a chain may involve two colonists and must have an authored failure/continuation if one dies:

```text
expeditionStoryThreads: Array<{
  instanceId, chainId, stageId,
  participantIds: string[],
  flags: string[],
  status: "active" | "resolved" | "failed",
  appliedTransitionIds: string[]
}>
```

Launch-draft state in `Speranza.jsx`:

- `expedLocationId: string`
- `expedCrewIds: string[]`

Every top-level state read by the tick loop requires a ref mirror. New state must be included in save/load normalization and `handleRestart()`.

### What Must Not Break

- Armory staffing remains required to launch.
- Expedition-blocking surface conditions still block launch.
- Two simultaneous expeditions remain supported.
- Tunnel-Blind colonists remain ineligible.
- Manual selection only permits eligible idle colonists.
- Launch clears `assignedRoom`; return uses `reclaimPost()` when possible.
- No code writes `cell.workers` directly.
- Existing quirks and traits remain meaningful: Surface Born, Pack Rat, Loudmouth, Scavenger, and Ghost.
- Surface conditions and morale remain snapshotted at launch.
- Loot, heat, morale, injuries, deaths, memorials, survivors, schematics, service records, history, and sounds still integrate with colony state.
- Two expeditions may each hold a pending decision without overwriting one another.
- A pending expedition decision pauses the whole colony.
- Resolving one prompt must not resume the colony while another blocking overlay is open.
- Save/load restores pending decisions, injuries, relationships, gear, scars, and story progress without rerolling or duplicating effects.
- Restart clears all new state.
- React StrictMode never doubles a roll, log, reward, casualty, relationship event, gear mutation, or story transition.

### Existing Code to Reuse

- `SURFACE_LOCATIONS` in `speranza-lore.js`: eight existing destinations with flavor, qualitative risk, and reward/risk modifiers. No map is needed; these are launch cards.
- `EXPEDITION_FLAVOR`: existing Scavenge and Arc Strike radio language.
- `EXPEDITION_TYPES`: mission identity, crew requirement, and heat cost.
- Existing morale/condition snapshots, quirk and trait modifiers, loot accumulation, casualty/memorial handling, return processing, `reclaimPost()`, and service-record increments.
- Existing active-expedition cards in `SidePanel` for crew, progress, event log, and haul.
- Existing props-only modal pattern demonstrated by `DilemmaModal`.
- Existing overlay pause effect as the consolidation point for one blocking-overlay policy. It currently has inconsistent ownership—some handlers and toast callbacks also restore timescale—so expedition work must not add another independent restore path.
- Existing save payload already includes `expeditions`; per-expedition decisions and field injuries therefore persist naturally once normalized.
- `COLONIST_BASE()` for safe defaults on new colonists.

## Recommended Option: C — Authored Expeditions with Character Continuity

Build the requested text-decision expedition loop and one narrow but complete character-continuity slice: manual crew and destination selection, three-act authored encounters, field-injury follow-ups, scars, canonical pair relationships, named expedition gear, and two finite story chains. This option addresses both missing elements the player identified—moment-to-moment agency and colonists whose shared history matters—without adding a map, factions, or a generic narrative engine.

The implementation must prove one end-to-end story before broadening content. Do not build five empty “systems” in parallel.

## Phased Implementation

### Phase 1 — Make Existing Expedition Advancement Pure

Fix the known StrictMode bug before changing design. Extract a pure expedition transition from the current `setExpeditions(prev => prev.map(...))` block.

The boundary is:

```text
advanceExpeditions(snapshot, context, rng)
  -> { nextExpeditions, intents }
```

Pure transition responsibilities:

- Decrement current automatic-roll timers.
- Select outcomes with injected RNG.
- Produce the next expedition records.
- Return declarative, expedition-specific intents such as injury, death, loot, return, morale, log, toast, history, and sound.

`Speranza.jsx` responsibilities:

- Read refs once.
- Call the pure transition once.
- Immediately set `expeditionsRef.current = nextExpeditions`.
- Commit `setExpeditions(nextExpeditions)`.
- Apply each intent exactly once outside all state updaters.

Keep current automatic-roll gameplay in this phase so the refactor can be verified independently.

**Verify before moving to Phase 2:**
- [ ] At 10× in development StrictMode, no expedition event, casualty, reward, survivor, return, log, or sound occurs twice.
- [ ] Two simultaneous expeditions advance and return exactly once each.
- [ ] A killed or injured colonist is the same named target in state, log, morale effect, and memorial.
- [ ] Save/reload mid-expedition resumes the next roll once.
- [ ] A focused audit finds no randomness or side effects inside the expedition state updater.

### Phase 2 — Destination and Manual Crew Planning

Replace first-eligible auto-selection with a compact launch planner in the existing Armory panel:

1. Choose Scavenge or Arc Strike.
2. Choose one of the existing `SURFACE_LOCATIONS` cards.
3. Choose exactly the required number of eligible named colonists.
4. Choose duration.
5. Review qualitative briefing and launch.

Briefing displays:

- Destination flavor and existing risk label.
- Likely loot category, not numeric odds.
- Current snapshotted surface condition.
- Selected crew traits, quirks, scars, gear, and relevant relationship label.
- Duration and heat increase.

No map, route movement, loadout inventory screen, or exact percentages.

**Verify before moving to Phase 3:**
- [ ] Both mission types launch to multiple destinations with the exact selected crew.
- [ ] Required crew count is enforced.
- [ ] Ineligible colonists cannot be selected.
- [ ] Selected colonists leave their posts and later reclaim valid previous posts.
- [ ] Destination, crew, duration, snapshots, and briefing data survive save/load.
- [ ] Restart clears the launch draft.

### Phase 3 — One Complete Three-Act Expedition

Implement the core decision loop with a deliberately small vertical slice before adding character persistence.

Exact interaction loop:

1. Expedition advances until an authored decision milestone.
2. A concrete `pendingDecision` is stored on that expedition.
3. The global blocking-overlay policy pauses the colony and remembers the pre-overlay timescale once.
4. `ExpeditionDecisionModal` shows location, crew, situation text, and 2–3 choices.
5. Every choice shows a qualitative risk label and causal preview.
6. The handler verifies the decision ID is still pending, computes one pure resolution, commits state, then applies intents once.
7. If another expedition decision is queued, it opens next and the colony stays paused.
8. The previous timescale is restored only when no blocking overlay remains.

Three-act shape:

- **Outbound:** approach complication; route posture or resource tradeoff.
- **Objective:** mission-defining choice; reliable low-value option versus higher-risk targeted reward.
- **Return:** extraction pressure; bank the haul, protect people, or risk one final gain.

Initial content count:

- Three reusable encounters: one per act.
- Two destination-specific encounter variants.
- Two to three choices each.
- At least one deterministic choice in every encounter.

Anti-slot-machine rules:

- Choice changes the kind of outcome, not just the wording around one shared roll.
- A safe option reliably reduces danger and reward.
- A targeted option states what it is pursuing.
- Randomness may alter degree or add a complication, but cannot silently reverse the advertised strategy.
- Current haul and “return now” remain meaningful throughout the run.

**Verify before moving to Phase 4:**
- [ ] Every expedition produces an outbound, objective, and return decision.
- [ ] The whole colony pauses when a decision appears.
- [ ] Keyboard timescale controls cannot bypass a blocking expedition decision.
- [ ] Resolving one of two queued expedition decisions does not resume the colony.
- [ ] Existing dilemmas, trait picks, help, build menu, milestone prompts, and expedition decisions obey one pause/restore policy.
- [ ] A pending prompt restores exactly after save/load and does not reroll its actors or choices.
- [ ] Each choice resolves once under StrictMode.

### Phase 4 — Field Injury as a Command Dilemma

Do not immediately set a field casualty to colony `status: "injured"`. While deployed, the colonist remains `onExpedition`; the expedition records a `fieldInjury` and creates an injury decision. This avoids the current contradiction where an expedition member is simultaneously in the hospital and still listed in the field team.

For a two-person team, present:

- **Extract the team — Safe:** enter return phase, keep the current haul, and apply the injury on arrival.
- **Carry them and continue — Desperate:** continue with `pacePenalty`, elevate later danger, and create a rescue-bond event between rescuer and injured colonist.
- **Abandon gear or part of the haul — Risky:** stabilize the colonist, remove/damage named gear or a clearly shown amount/category of loot, then continue without the carry penalty.

For a solo Scavenge run, replace “carry them” with a solo-valid choice:

- **Emergency extraction — Safe.**
- **Self-stabilize and continue — Desperate:** continue with pace/danger penalty.
- **Abandon gear or haul — Risky:** stabilize and continue more safely.

On return:

- Surviving field-injured colonists become colony `status: "injured"` with `injuryTicksLeft`.
- Non-injured survivors reclaim posts.
- A field-injured colonist who dies before return is memorialized once and never processed as a returning survivor.

**Verify before moving to Phase 5:**
- [ ] Solo and two-person injuries show valid, different choices.
- [ ] The injured colonist remains deployed until return or death.
- [ ] Extraction, carry, and sacrifice produce visibly distinct consequences.
- [ ] Gear/loot sacrifice cannot duplicate, underflow, or consume an item not owned.
- [ ] Return sends the injured survivor to hospital exactly once.
- [ ] A dead expedition member cannot later return, gain service credit, or reclaim a post.

### Phase 5 — One Character-Continuity Story Slice

Now connect scars, relationships, named gear, and story chains through one complete authored slice instead of implementing independent generic frameworks.

Initial relationship model:

- Canonical pair score from `-2` to `+2`.
- Player-facing labels only: **Fractured, Wary, Neutral, Trusted, Bonded**.
- No passive relationship simulation.
- Relationships change only from explicit authored expedition decisions.
- Initial event types: rescued, abandoned, shared success, and sacrificed for.
- Keep the latest five history entries per pair.
- If one participant dies, retain the surviving colonist's readable history through the canonical relationship record; no new events target the dead colonist.

Initial scar model:

- Three authored scars maximum.
- A scar has narrative text and at most one narrow expedition-facing effect.
- Scars never alter room production or become a general status framework.

Initial gear model:

- Three named expedition items maximum.
- Gear lives on a colonist, not in a broad colony inventory.
- It may unlock one choice, absorb one consequence, become damaged, or be abandoned.
- No equipment slots, crafting, rarity tiers, or procedural loot affixes.

Initial story content:

1. **Signal in the Static** — a three-stage personal chain seeded at the Eastern Relay. A colonist can preserve strange relay codes, return to investigate, and choose whether to use, destroy, or be marked by the signal. Endings can grant named gear, a field tag, or an authored scar.
2. **What We Carry** — a three-stage pair chain seeded by a field injury. Rescue, abandonment, or sacrifice changes the pair bond; a later expedition confronts that history and resolves toward trust, estrangement, or costly reconciliation.

Each story transition has a stable ID recorded in `appliedTransitionIds`. Repeated clicks, StrictMode, or load cannot grant it twice. Every stage defines what happens if a required participant is dead, unavailable, or no longer eligible: alternate continuation, authored failure, or clean resolution—never a permanently stuck thread.

Field-history UI in colonist detail shows:

- Scars
- Named gear and condition
- Active/resolved personal story entries
- Relationships by name and label, with the latest authored history line

**Verify before moving to Phase 6:**
- [ ] Rescue, abandonment, shared success, and sacrifice update one canonical pair record once.
- [ ] Relationship labels and history survive save/load and participant death.
- [ ] Each scar and gear item changes at least one later decision, not only flavor text.
- [ ] Both story chains complete through at least two different endings.
- [ ] Story stages cannot skip, repeat rewards, or become permanently stuck after a participant dies.
- [ ] Old saves and new recruits receive safe empty defaults.

### Phase 6 — Content Breadth, Balance, and QA

Only after the vertical slice is fun:

- Expand to 8–12 total encounter definitions, mixing reusable and destination-specific situations.
- Keep three-act pacing and 2–4 decisions per expedition depending on duration.
- Add recency protection so an encounter does not repeat within one run.
- Tune conservative versus aggressive choices against current loot, heat, injury, death, and colony-resource pacing.
- Confirm scars, relationships, gear, and chains remain rare enough to feel personal.

Required final QA:

- [ ] Complete at least six expeditions across both mission types and multiple destinations.
- [ ] Test two simultaneous runs reaching decisions close together.
- [ ] Test conservative, aggressive, injury, death, early-return, gear-loss, and story-chain paths.
- [ ] Test save/load with launch draft, active expedition, pending normal decision, pending injury decision, active story thread, damaged gear, and relationship history.
- [ ] Test restart from each of those states.
- [ ] Test existing dilemma/trait/help/build/milestone overlays against expedition prompts.
- [ ] `npm run build` passes.
- [ ] No console errors or duplicate event traces appear at 1× or 10×.
- [ ] Update the three memory-bank files and document the expedition lifecycle/pair-key/pause patterns.

## What Could Go Wrong

The single riskiest part is preserving exactly-once colony effects while replacing the current expedition updater. Today that updater mixes RNG, nested setters, logs, sounds, morale, memorials, loot, survivors, and return processing; silent duplication or omission is more likely than a visible crash.

- **StrictMode duplication:** RNG or side effects left inside any updater can double casualties, rewards, relationships, gear changes, or story transitions.
- **Ref/state divergence:** If a decision handler commits state without immediately updating refs, the next interval can process stale expedition data.
- **Pause ownership conflict:** Existing overlay effects, help handlers, raid prep, and toast callbacks can all influence timescale. Adding an expedition-specific resume call would allow one overlay to resume beneath another.
- **Lost simultaneous prompt:** One global active decision can overwrite another. Pending decisions stay on their owning expedition; the visible prompt is derived deterministically.
- **Save reroll or double grant:** Save concrete prompts and stable transition IDs. Normalize rather than regenerate pending decisions on load.
- **Field/hospital contradiction:** A field injury must not use colony injured status until return.
- **Dead-member return:** All return credit and post reclamation must filter to surviving deployed IDs.
- **Asymmetric relationships:** Never store mirrored relationship state on both colonists; use one sorted pair key.
- **Orphaned story thread:** Every stage needs participant-death and ineligibility behavior.
- **Gear duplication:** Gear instances and mutations need stable IDs and exactly-once intents.
- **False choices:** If previews promise safety while hidden rolls erase that distinction, the system remains a slot machine.
- **Content explosion:** Branching stories multiply quickly. Ship two complete three-stage chains before adding more.
- **Schema migration:** `SAVE_VERSION` is currently 1. Version 2 must add safe defaults for colonist fields, relationships, threads, launch draft, and new expedition fields without corrupting active v1 expeditions.

## Decisions Needed Before Starting

None. The user has made the required design decisions. Implementation should stop after each phase for browser verification before continuing.

## Decisions Made

1. Expedition decisions pause the whole colony.
2. Risks are communicated qualitatively: Safe / Risky / Desperate and likely consequence/reward type, never exact percentages.
3. Colonists can gain permanent scars, relationships, named expedition gear, and finite evolving story chains.
4. The player manually selects expedition crew.
5. Field injury creates a follow-up command choice: extract, carry/self-stabilize with penalties, or sacrifice gear/haul to stabilize.
6. There will be no surface map, faction layer, real-time expedition minigame, generic quest engine, or broad social simulation.

## Options Considered

### Option A — Minimal: Command Calls

Replace automatic rolls with generic “proceed carefully / take a targeted risk / return now” prompts while preserving current crew auto-selection and most current tables.

- **Complexity:** About 6–10 focused hours plus testing.
- **Reuse:** Highest; current tables and UI remain central.
- **Blast radius:** Tick advancement, one prompt component, save/restart.
- **Strength:** Quickly removes complete passivity.
- **Limitation:** Repetitive, shallow colonist identity, and no lasting shared history.

### Option B — Moderate: Authored Expeditions

Add destination and manual crew selection plus three-act authored text decisions and injury follow-ups. Preserve consequences through existing injury, death, morale, loot, and service records only.

- **Complexity:** About 16–25 focused hours including a content and balance pass.
- **Reuse:** Existing locations, flavor, snapshots, expedition card, and colony consequences.
- **Blast radius:** Expedition launch/advancement/UI, pause flow, save/restart.
- **Strength:** Solves moment-to-moment agency with contained architecture.
- **Limitation:** Colonists remember expeditions mainly as counters; relationships and personal arcs remain absent.

### Option C — Deep: Authored Expeditions with Character Continuity (Selected)

Build Option B, then add one bounded continuity slice: scars, canonical pair relationships, three named gear items, and two finite three-stage story chains. There is still no map or faction layer.

- **Complexity:** About 30–45 focused hours including content, migration, and browser QA.
- **Reuse:** All Option B reuse plus existing colonist detail/service record and lore boundaries.
- **Blast radius:** Expedition systems, colonist schema, canonical relationship/story state, save migration, and field-history UI. Raid systems remain untouched.
- **Strength:** Solves agency and gives named colonists shared history with future consequences.
- **Limitation:** Authored content is expensive; expansion must remain deliberate.

## Do Not

- Do not add a surface map, route board, factions, reputation, diplomacy, or real-time expedition play.
- Do not build a generic quest/dialogue engine, broad inventory, equipment slots, or autonomous relationship simulation.
- Do not implement continuity systems before one three-act expedition and the injury loop are playable and verified.
- Do not author a large catalog before both initial story chains work end to end.
- Do not place RNG, setters, logs, toasts, sounds, memorial writes, relationship changes, gear mutations, or story transitions inside state updaters.
- Do not use one global pending-decision state as the source of truth.
- Do not independently restore timescale from the expedition handler.
- Do not expose exact probabilities.
- Do not make all choices alternate presentations of the same random table.
- Do not mark a deployed colonist as colony-injured before return.
- Do not duplicate relationship state on both colonists.
- Do not write `cell.workers` directly.
- Do not touch the raid lifecycle or surface-defense implementation.