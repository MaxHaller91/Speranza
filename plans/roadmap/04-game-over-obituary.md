# Step 4 — Game over as an obituary

Currently the death screen prints stats and a base64 run code. Meanwhile the
game already tracks: a memorial wall with authored epitaphs, a `historyLog` of
milestones, named colonists with service records, and now a player-chosen colony
name. That is genuinely good material going unused at the exact moment the
player is most emotionally invested.

Players screenshot and share an obituary. Nobody shares a run code.

## Build

Rewrite `GameOverModal.jsx` to tell the story of the decline:

1. **Headline** — `KESTREL DEEP · DAY 34` and the cause.
2. **The turn** — find the last point the colony was healthy and name what broke.
   `historyLog` entries plus `memorial` timestamps give you this. Something like
   "Held for 22 days. Then the Hydroponics went down on Day 24 and never
   recovered."
3. **The dead** — the memorial wall, with epitaphs. This already exists in
   `SidePanel`; reuse the rendering.
4. **The survivors** — who was still alive at the end, and for how long they had
   served. Reads from colonist `joinTick` / `raidsSurvived` /
   `expeditionsCompleted`.
5. **Timeline** — the existing `historyLog`, rendered as a vertical strip.

Keep the run code, but demote it.

## Fix while here

`progress.md` notes colonist levels display incorrectly on this screen. Verify
against `memorial[].level`, which is captured at death by `addToMemorial()`.

## Done when

- [ ] Screen names the colony and reads as a narrative, not a stat block
- [ ] Memorial epitaphs appear
- [ ] Colonist levels are correct
- [ ] Looks right after both failure modes (starvation, and population zero)
