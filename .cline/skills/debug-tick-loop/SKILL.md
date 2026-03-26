---
name: debug-tick-loop
description: Diagnose and fix bugs in Speranza's tick loop. Use when resources are behaving incorrectly, doubling, not updating, or when game state seems to drift or reset unexpectedly during gameplay.
---

# Debug Tick Loop

The tick loop is the most complex and bug-prone part of Speranza. Almost all resource bugs, state drift, and "things happening twice" bugs originate here. Follow this diagnostic process before touching any code.

## Anatomy of the Tick Loop

The tick loop is a `useEffect` with `setInterval` in Speranza.jsx. It:
1. Reads current state via **refs** (not state directly — to avoid stale closures)
2. Computes new resource values
3. Calls `setX(...)` to update state
4. Increments the tick counter

**The ref sync pattern looks like this:**
```js
const someStateRef = useRef(someState);
useEffect(() => { someStateRef.current = someState; }); // bare effect, syncs every render
// Inside tick loop: read someStateRef.current, not someState
```

## Diagnostic Checklist

### 1. Is it a stale closure? (Most common)
**Symptom:** Value reads as its initial value regardless of what the player does. E.g., resources never change from starting values, or heat is always 0 in calculations.

**Check:** Find every state variable the tick loop reads. Confirm each one has a ref mirror AND that the ref is synced in a bare `useEffect(() => { ref.current = val; })`.

**Fix:** Add the missing ref and sync effect.

---

### 2. Is it a dependency array problem? (Second most common)
**Symptom:** The loop reinitializes unexpectedly, game "resets" mid-session, or the same logic fires multiple times.

**Check:** Look at the dependency array of the tick loop's `useEffect`. Every dep listed there causes the effect to re-run (and re-register the interval) when it changes.

**Fix:** Use refs for values the loop needs to read. Remove those values from the dep array. The interval effect should almost never re-run — ideally its deps are `[timescale]` or empty.

---

### 3. Is it a delta vs absolute value problem? (The scrap doubling bug pattern)
**Symptom:** A value doubles, triples, or grows unexpectedly on each tick or event.

**Classic example:** Passing `res.scrap` (absolute) as `initialValue` to a sub-component, then having that component also receive `onValueChange(delta)`. If the initial value sneaks into an effect dep array, the callback fires with the wrong baseline.

**Check:** Find every `onChange` / `onXxxChange` callback that flows into sub-components (especially `surface_defense.jsx`). Confirm the callback receives and applies **deltas** (`+5`, `-20`) not absolute values.

**Fix:** Change the callback to apply a delta: `setRes(r => ({ ...r, scrap: Math.max(0, r.scrap + delta) }))`.

Also check: is the sub-component's `useEffect` that fires the callback listing an absolute value (like `initialScrap`) in its dependency array? If so, remove it and restructure.

---

### 4. Is it a double-mount problem?
**Symptom:** Effects fire twice in development. Resources deduct twice on startup. Events trigger immediately on load.

**Context:** React 18 Strict Mode double-invokes effects in development. This is expected. The solution is to make effects idempotent (safe to run twice) rather than disabling Strict Mode.

**Fix:** Use a ref flag to guard one-time setup:
```js
const initializedRef = useRef(false);
useEffect(() => {
  if (initializedRef.current) return;
  initializedRef.current = true;
  // one-time setup here
}, []);
```

---

### 5. Is the interval being cleared correctly?
**Symptom:** Multiple intervals seem to be running (things happen faster than expected, or happen after the game pauses).

**Check:** The tick loop effect must return a cleanup function: `return () => clearInterval(id)`.

**Fix:** Ensure every `setInterval` in a `useEffect` has a matching cleanup.

---

## Read Before Touching

Before changing any tick loop code:
1. `view` the full tick loop section in Speranza.jsx
2. Map out which state vars are read via refs vs. directly
3. Identify the exact line where the bug manifests
4. Make the smallest possible change

Do NOT rewrite the tick loop. It is complex and working. Surgical edits only.
