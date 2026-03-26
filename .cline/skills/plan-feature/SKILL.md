---
name: plan-feature
description: Create a structured implementation plan for a complex feature or design change in Speranza. Use when the user asks to plan, think through, or design something — especially when referencing a design note (DN-XXX), saying "how should we approach", "let's think about", or "plan out". Do NOT use for simple tasks with obvious implementation paths like adding a room type or fixing a known bug.
---

# Plan Feature

This skill produces a written plan file before any code is touched. You are in planning mode — do not write implementation code, do not edit any source files, do not make any changes to the project. Your only output is a plan document.

Complete all four phases in order. Do not skip or combine phases.

---

## Phase 1 — Understand

Before forming any opinions, build a complete picture of the current state.

**Read these files first, always:**
- `memory-bank/design-notes.md` — find the relevant DN entry and read it fully
- `memory-bank/systemPatterns.md` — understand how the affected systems currently work
- `memory-bank/progress.md` — check for related known issues that this change could fix simultaneously
- `memory-bank/activeContext.md` — understand current focus and recent changes

**Then read every source file that touches the affected systems.** For UI changes this typically means the relevant component files AND the Speranza.jsx sections that wire them. Do not guess at what's in these files — read them.

**Produce an inventory with answers to all of these:**

*Scope:*
- What systems are involved? List every file that will likely need to change.
- What state variables are relevant? List them with their current types/shapes.
- What currently works in this area that must not break?
- What does the user actually want to achieve? Restate it in your own words.
- Are there related known issues in progress.md that this change should resolve simultaneously?

*Reuse inventory — before proposing anything new, answer these:*
- Is there existing code in the project that already does part of what's needed? (e.g. the bug report `fullState` serializer, existing handler patterns, existing ref-mirror patterns)
- Which existing patterns should the new code follow rather than introduce alternatives to?
- Are there existing helpers in `gameData.js` that could be extended rather than duplicated?
- What existing component prop interfaces could be extended rather than replaced?

Do not proceed to Phase 2 until the inventory and reuse scan are complete.

---

## Phase 2 — Options

Propose exactly three approaches. Label them clearly:

**Option A — Minimal**
The smallest change that meaningfully improves the situation. Explicitly ask: what is the least we could do that would actually help? This option must be a genuine solution, not a strawman. Reuses the most existing code.

**Option B — Moderate**
A more complete solution that addresses the root cause without restructuring working systems. Introduces new patterns only if they already exist elsewhere in the codebase.

**Option C — Comprehensive**
The full vision if done properly. More files touched, more new patterns introduced. Higher risk, higher reward.

For each option, be explicit about:
- What files change and how
- What existing code is reused vs what is new
- What currently-working behavior could be affected
- Implementation complexity (rough hours — be honest)
- What it doesn't solve

Do not recommend an option yet. Just describe them accurately.

---

## Phase 3 — Critical Pass

Review your own Phase 2 output adversarially. Work through every check below and write a specific response to each one.

### General checks

**Over-complication check:**
For each option — is it introducing new abstractions, new patterns, new component structures, or new state shapes that don't already exist in the codebase? If yes, is that complexity actually required or is it just "cleaner"? New patterns create maintenance burden and risk. Flag any option that introduces significant new architecture without clear necessity.

**Blast radius check:**
For each option — how many currently-working things are in the blast radius? List them specifically. A change that touches 8 components to improve 1 behavior is high-risk regardless of how clean the approach is. Could the same improvement be achieved with a smaller blast radius?

**Assumption check:**
Did you assume anything about how the code works without verifying it in the source files? List every assumption. If an assumption turns out to be wrong, which options would fail or need significant revision?

**Minimal option check:**
Could Option A actually satisfy the user's stated goal? If yes — why are you not recommending it? The burden of proof is on more complex options to justify their additional risk and effort.

**Silent breakage check:**
What could go wrong that wouldn't immediately throw an error? Think about: stale closures in the tick loop, props that stop being passed, state that gets out of sync, sounds that stop firing, components that render with wrong data, handlers that fire in the wrong order.

**Reuse check:**
Does the recommended option actually use the reuse opportunities identified in Phase 1? If not, explain why not.

### Speranza-specific checks

**Tick loop check:**
Does this feature add new state that the tick loop reads? If yes — a ref mirror is required for every new piece of state the loop reads. Is that reflected in the plan?

**Raid lifecycle check:**
Does this touch anything in the raid pipeline (`raidWindow`, `activeRaid`, `surfaceDefenseActive`, surface defense callbacks)? If yes, flag as HIGH RISK and require explicit handling of the state handoff sequence in the plan. The raid system has known fragility — do not touch it casually.

**Restart handler check:**
Does this add new state to Speranza.jsx? If yes — `handleRestart()` must also be updated to reset that state. Missing this is a silent bug that only surfaces when the player restarts without refreshing.

**Component prop chain check:**
Does this change what props a component receives? If yes — list every component in the chain that needs updating. Missing a prop update causes silent failures where components render stale or undefined data.

**gameData.js boundary check:**
Is any of the new logic being placed in Speranza.jsx that is actually a pure function with no React dependency? If yes, it belongs in gameData.js. Flag it.

### Open questions

List any decisions that require the user's input before implementation can proceed. These are things where the right answer depends on design preference, not technical correctness. Do not make these decisions yourself — flag them explicitly and number them.

---

## Phase 4 — Plan Document

After completing all three phases, write the plan to a file:

**Filename:** `plans/{dn-number}-{short-name}.md` (e.g. `plans/dn-002-toast-overhaul.md`)
If no DN number applies: `plans/{short-name}.md`

**Required sections in this order:**

```markdown
# Plan: [Feature Name]
Generated: [date] | Status: AWAITING APPROVAL

## What We're Solving
[One paragraph restating the goal in plain language]

## Current State Inventory

### Systems Involved
[List of every file that will change]

### Relevant State
[State variables involved with their shapes]

### What Must Not Break
[Specific list of currently-working behavior in the blast radius]

### Existing Code to Reuse
[What already exists that this feature can build on — be specific about 
function names, file locations, patterns to follow]

## Recommended Option: [A/B/C — Name]
[Why this option in 2-3 sentences, including why the simpler option wasn't sufficient]

## Phased Implementation
Break the recommended option into ordered phases. Each phase should be 
independently testable — if phase 2 breaks something, it should be obvious 
it wasn't phase 1.

### Phase 1 — [Name]
[What changes in this phase — plain English, no code]

**Verify before moving to Phase 2:**
- [ ] [Specific manual test the user can perform in-browser]
- [ ] [Specific manual test]

### Phase 2 — [Name]
[What changes in this phase]

**Verify before moving to Phase 3:**
- [ ] [Specific manual test]
- [ ] [Specific manual test]

[Continue for all phases]

## What Could Go Wrong
[The non-obvious failure modes from the critical pass — silent bugs, lifecycle 
issues, ref desync, prop chain gaps. Specific, not generic.]

## Decisions Needed Before Starting
[Numbered list of open questions requiring user input]

1. **[Decision name]:**
   - Option A: ...
   - Option B: ...

## Decisions Made
[Leave this section blank — the user fills it in before handing to Act mode]

1. 
2.
3.

## Options Considered
[Brief summary of all three options and why the others weren't chosen]

## Do Not
[Explicit list of things Cline should NOT do during implementation.
Over-complications caught in the critical pass go here.
Speranza-specific constraints go here.]

- Do not ...
- Do not ...
```

---

## After Writing the Plan

Tell the user:
1. The plan has been written to `plans/[filename]`
2. The open decisions that need answers — list them clearly and concisely
3. That they should: read the plan, fill in the "Decisions Made" section with their answers, then start a new Cline task in Act mode with: *"Implement the plan at plans/[filename] — read it fully before doing anything else, and check Decisions Made before starting each phase"*

Do not start implementing. Do not ask if you should start. The user will initiate the Act mode task separately when ready.