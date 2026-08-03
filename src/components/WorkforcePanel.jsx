// WorkforcePanel.jsx — allocate headcount to labour groups.
//
// This replaces per-cell worker assignment. A playtester lost a colony because
// they could not click the small per-room circles fast enough between popups;
// here you set how many people work FOOD, and the allocator distributes them
// across every food building in priority order, backfilling automatically when
// someone is injured or a new building goes up.
//
// Props-only. It does not touch the clock or the grid.
import { LABOR_GROUPS, LABOR_GROUP_ORDER, groupCapacity, fs } from "../gameData.js";

export default function WorkforcePanel({ colonists, grid, onChangeGroup }) {
  const working = colonists.filter(c => c.status !== "onExpedition");
  const counts = {};
  for (const key of LABOR_GROUP_ORDER) counts[key] = 0;
  let unassigned = 0;
  working.forEach(c => {
    if (c.group && counts[c.group] !== undefined) counts[c.group] += 1;
    else unassigned += 1;
  });

  return (
    <div style={{
      background: "#080b14", border: "1px solid #1a2030", borderRadius: 8,
      padding: 10, marginBottom: 8,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        color: "#2a4a6a", fontSize: fs(8), letterSpacing: 2, marginBottom: 8,
        borderBottom: "1px solid #16202c", paddingBottom: 6,
      }}>
        <span>WORKFORCE</span>
        <span style={{ color: unassigned > 0 ? "#f5a623" : "#2a4a6a" }}>
          {unassigned} IDLE
        </span>
      </div>

      {LABOR_GROUP_ORDER.map(key => {
        const g = LABOR_GROUPS[key];
        const seats = groupCapacity(grid, key);
        const n = counts[key];
        // No buildings for this group yet — show it greyed so the player can see
        // what exists to aim at, rather than hiding the option entirely.
        const dim = seats === 0;
        const over = n > seats;
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 0", opacity: dim ? 0.4 : 1,
          }}>
            <span style={{ fontSize: fs(11), width: fs(16), textAlign: "center" }}>{g.icon}</span>
            <span style={{ flex: 1, color: "#8fa4b8", fontSize: fs(9), letterSpacing: 1 }}>
              {g.label}
            </span>
            <span style={{
              color: over ? "#f5a623" : n > 0 ? "#7ed321" : "#3a4a5a",
              fontSize: fs(10), fontFamily: "monospace", minWidth: fs(34), textAlign: "right",
            }} title={over ? "More people than seats — the extra are idle" : undefined}>
              {n}/{seats}
            </span>
            <button
              onClick={() => onChangeGroup(key, -1)}
              disabled={n === 0}
              title={`Take one person off ${g.label}`}
              style={btn(n > 0)}
            >−</button>
            <button
              onClick={() => onChangeGroup(key, +1)}
              disabled={dim}
              title={dim ? `Build a ${g.rooms[0]} first` : `Put one more person on ${g.label}`}
              style={btn(!dim)}
            >+</button>
          </div>
        );
      })}
    </div>
  );
}

function btn(enabled) {
  return {
    background: enabled ? "#0a0f1a" : "#0a0c12",
    border: `1px solid ${enabled ? "#1e3a5f" : "#161c24"}`,
    borderRadius: 3,
    color: enabled ? "#4ab3f4" : "#2a3441",
    width: fs(20), height: fs(18),
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: fs(11), lineHeight: 1, padding: 0,
    fontFamily: "'Courier New', monospace",
  };
}
