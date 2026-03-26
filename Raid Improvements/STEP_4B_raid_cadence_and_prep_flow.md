# Step 5 — Raid Cadence, Pause, and Prep Flow Polish

## Purpose

Polish the raid experience after the core raid systems are in place.

This step fixes cadence and UX issues that sit between colony raid triggering and the surface-defense flow.

---

## Files Touched

- `src/Speranza.jsx`
- `src/surface_defense.jsx`

---

## Ownership

- `Speranza.jsx` owns raid eligibility, cooldowns, grace periods, and pause-on-raid-start behavior
- `surface_defense.jsx` owns first-wave prep, inter-wave countdowns, and minigame scrap presentation/sync behavior

---

## Goals

- No immediate raid on a fresh game
- No back-to-back raids; minimum cooldown is one in-game day
- Heat remains the core pressure meter, but cooldown hard-gates raid-window creation
- Raid start pauses the colony so the player can place defenses
- The first prep button reads **Start Raid**
- Between waves, the player gets a **10-second countdown** instead of an unlimited manual start
- Raid scrap shown in the minigame must stay aligned with colony scrap

---

## Recommended Implementation Order

### 1. Add raid cooldown gating in `Speranza.jsx`

- Add a cooldown timer/ref (for example `raidCooldownTicks`)
- Decrement it in the main tick loop
- While cooldown is active, do not allow `setRaidWindow(...)`
- Set cooldown when a raid resolves or is fully blocked
- Use the same mechanism or a closely related rule to prevent raids from firing immediately on a new game

### 2. Pause the colony when a raid starts

- When `surfaceDefenseActive` begins, do not force gameplay to continue at 1×
- Give the player a paused defense-placement phase first

### 3. Refactor minigame flow in `surface_defense.jsx`

- Initial prep button should read **Start Raid**
- Wave 1 starts manually from that first prep phase
- After each wave, switch to an intermission/countdown phase
- Countdown length: **10 seconds**
- Allow defense placement during the intermission if that still feels good in playtesting
- Next wave auto-starts when countdown expires

### 4. Audit and fix scrap sync

- Re-check every scrap mutation in `surface_defense.jsx`
- Confirm placement cost, kill rewards, and wave bonuses each apply exactly one delta
- Ensure displayed raid scrap cannot drift from the parent colony scrap source of truth

---

## What Not To Do

- do not replace heat with a cooldown-only model
- do not rely on a bigger heat drop alone to prevent chain raids
- do not move colony raid cadence logic into `surface_defense.jsx`
- do not change `onScrapChange` away from delta semantics

---

## Verification Checklist

- [ ] No raid can fire immediately on a fresh game
- [ ] No raid can fire again until at least one in-game day has passed
- [ ] High heat still makes raids possible once cooldown expires
- [ ] Raid start pauses the colony and gives the player setup time
- [ ] First button says **Start Raid**
- [ ] Inter-wave countdown is 10 seconds and auto-starts the next wave
- [ ] Raid scrap shown in the minigame matches the colony scrap state correctly
