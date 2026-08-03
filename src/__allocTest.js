// Throwaway test harness for allocateLabor(). Imported from the browser console
// via the dev server so the PNG imports in gameData.js resolve.
//   const t = await import('/Speranza/src/__allocTest.js'); t.run();
import { allocateLabor, groupCapacity, groupOfRoom } from "./gameData.js";

const cell  = (type) => ({ type, workers: 0 });
const empty = () => ({ type: null, workers: 0 });
const mkGrid = (row0) => [row0, [empty(), empty()], [empty(), empty()], [empty(), empty()]];
const col = (id, group, extra = {}) => ({
  id, name: id, status: "idle", group, assignedRoom: null, previousRoom: null, ...extra,
});

export function run() {
  const results = [];
  const check = (name, got, want) =>
    results.push({ name, got, want, ok: JSON.stringify(got) === JSON.stringify(want) });

  check("groupOfRoom hydro", groupOfRoom("hydro"), "food");
  check("groupOfRoom tavern", groupOfRoom("tavern"), "recreation");
  check("groupOfRoom barracks has no group", groupOfRoom("barracks"), null);

  const g1 = mkGrid([cell("hydro"), cell("hydro")]);
  check("two hydro = 4 seats", groupCapacity(g1, "food"), 4);

  // Priority order: hydro before diningHall even though diningHall is earlier on the grid.
  const g2 = mkGrid([cell("diningHall"), cell("hydro")]);
  const a = allocateLabor([col("a", "food"), col("b", "food")], g2);
  check("hydro fills before diningHall", a.map(c => c.assignedRoom), [{ r: 0, c: 1 }, { r: 0, c: 1 }]);

  // Overflow idles rather than disappearing.
  const g3 = mkGrid([cell("water")]);
  const b = allocateLabor([col("a", "water"), col("b", "water"), col("c", "water")], g3);
  check("third water worker idles", b.map(c => c.assignedRoom), [{ r: 0, c: 0 }, { r: 0, c: 0 }, null]);
  check("nobody is lost", b.length, 3);

  const c2 = allocateLabor([col("a", null, { assignedRoom: { r: 0, c: 0 }, status: "working" })], g3);
  check("ungrouped stands down", c2[0].assignedRoom, null);

  const d = allocateLabor([col("x", "food", { status: "injured" })], g1);
  check("injured are not yanked to a post", d[0].status, "injured");

  check("same reference when nothing changes", allocateLabor(b, g3) === b, true);

  const g4 = mkGrid([cell("sentryPost")]);
  check("sentry post yields onSentry", allocateLabor([col("a", "defense")], g4)[0].status, "onSentry");

  const fails = results.filter(r => !r.ok);
  return { allPass: fails.length === 0, failures: fails, results };
}
