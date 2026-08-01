// ColonistRoster.jsx — collapsible colonist cards + hover tooltip
// Props: colonists, rosterOpen, hoveredColonist, selectedColonist, totalColonists,
//        mousePos, onToggleRoster, onSelectColonist, onHoverColonist
import { TRAITS, STATUS_COLOR, STATUS_LABEL, fs,} from "../gameData.js";

export default function ColonistRoster({
  colonists, rosterOpen, hoveredColonist, selectedColonist, totalColonists,
  mousePos, onToggleRoster, onSelectColonist, onHoverColonist,
}) {
  const hovCol = colonists.find(c => c.id === hoveredColonist);

  return (<>
    <div style={{ marginTop: 8, background: "#060810", border: "1px solid #1a2030", borderRadius: 6, overflow: "hidden" }}>
      <div onClick={onToggleRoster}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ color: "#2a4a6a", fontSize: fs(9), letterSpacing: 2 }}>
          COLONIST ROSTER — {totalColonists} PERSONNEL
        </div>
        <div style={{ color: "#2a4a6a", fontSize: fs(10) }}>{rosterOpen ? "▲" : "▼"}</div>
      </div>

      {rosterOpen && (
        <div style={{ padding: "0 12px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {colonists.map(col => {
            const xpInLevel  = (col.xp ?? 0) % 20;
            const hasPending = col.pendingTraitPick;
            const borderColor = hasPending ? "#f5a623" : STATUS_COLOR[col.status];
            return (
              <div key={col.id}
                onClick={() => onSelectColonist(col.id)}
                onMouseEnter={() => onHoverColonist(col.id)}
                onMouseLeave={() => onHoverColonist(null)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 6,
                  background: hasPending ? "#1a1000" : selectedColonist === col.id ? "#0a1525" : "#0a0c14",
                  border: `1px solid ${selectedColonist === col.id ? "#4ab3f4" : borderColor}${hasPending ? "" : selectedColonist === col.id ? "" : "33"}`,
                  borderRadius: 5, padding: "4px 8px", minWidth: 130,
                  boxShadow: hasPending ? `0 0 8px #f5a62366` : selectedColonist === col.id ? "0 0 6px #4ab3f444" : "none",
                  cursor: "pointer",
                }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 3, background: STATUS_COLOR[col.status], boxShadow: `0 0 4px ${STATUS_COLOR[col.status]}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ color: "#c8d0d8", fontSize: fs(9), fontWeight: "bold", letterSpacing: 1 }}>{col.name}</div>
                    {(col.level ?? 0) > 0 && (
                      <div style={{ color: "#f5a623", fontSize: fs(8), background: "#1a1000", border: "1px solid #f5a62344", borderRadius: 3, padding: "0px 3px" }}>Lv{col.level}</div>
                    )}
                    {hasPending && <div style={{ color: "#f5a623", fontSize: fs(9) }}>⭐</div>}
                  </div>
                  <div style={{ color: STATUS_COLOR[col.status], fontSize: fs(8), letterSpacing: 1 }}>{STATUS_LABEL[col.status]}</div>
                  {col.status === "injured" && col.injuryTicksLeft > 0 && (
                    <div style={{ color: "#ff6b6b", fontSize: fs(8), letterSpacing: 0.5, marginTop: 1 }}>
                      ⚕ {col.injuryTicksLeft} tick{col.injuryTicksLeft !== 1 ? "s" : ""} to recover
                    </div>
                  )}
                  <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${(xpInLevel / 20) * 100}%`, background: hasPending ? "#f5a623" : "#2a5a8a", transition: "width 0.4s" }} />
                    </div>
                    <div style={{ color: "#2a4a6a", fontSize: fs(8), fontFamily: "monospace", flexShrink: 0 }}>{xpInLevel}/20</div>
                  </div>
                  <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                    {col.quirk && (
                      <div title={col.quirk.desc} style={{ fontSize: fs(8), background: "#0a0a18", border: "1px solid #2a2a5a44", borderRadius: 3, padding: "0 3px", color: "#9988cc" }}>
                        {col.quirk.icon}
                      </div>
                    )}
                    {col.traits && col.traits.map(t => (
                      <div key={t} title={TRAITS[t]?.desc} style={{ fontSize: fs(8), background: "#0a0a14", border: `1px solid ${TRAITS[t]?.color ?? "#333"}44`, borderRadius: 3, padding: "0 3px", color: TRAITS[t]?.color ?? "#888" }}>
                        {TRAITS[t]?.icon} {TRAITS[t]?.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* Colonist hover tooltip */}
    {hovCol && (
      <div style={{
        position: "fixed", left: mousePos.x + 14, top: mousePos.y + 10,
        background: "#0d1020", border: `1px solid ${STATUS_COLOR[hovCol.status] ?? "#888"}55`,
        borderRadius: 6, padding: "8px 12px", zIndex: 9999,
        minWidth: 150, maxWidth: 220, pointerEvents: "none",
        boxShadow: `0 0 16px #00000099, 0 0 8px ${STATUS_COLOR[hovCol.status] ?? "#888"}22`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[hovCol.status], boxShadow: `0 0 4px ${STATUS_COLOR[hovCol.status]}`, flexShrink: 0 }} />
          <span style={{ color: "#c8d0d8", fontSize: fs(10), fontWeight: "bold", letterSpacing: 1 }}>{hovCol.name}</span>
          {(hovCol.level ?? 0) > 0 && (
            <span style={{ color: "#f5a623", fontSize: fs(8), background: "#1a1000", border: "1px solid #f5a62344", borderRadius: 3, padding: "0 3px" }}>Lv{hovCol.level}</span>
          )}
        </div>
        <div style={{ color: STATUS_COLOR[hovCol.status], fontSize: fs(8), letterSpacing: 1, marginBottom: hovCol.quirk ? 5 : 0 }}>
          {STATUS_LABEL[hovCol.status]}
          {hovCol.status === "injured" && hovCol.injuryTicksLeft > 0 ? ` — ${hovCol.injuryTicksLeft}t` : ""}
        </div>
        {hovCol.quirk && (
          <div style={{ color: "#9988cc", fontSize: fs(8), borderTop: "1px solid #1a1a2e", paddingTop: 4, marginTop: 2 }}>
            {hovCol.quirk.icon} <span style={{ color: "#7a6aaa" }}>{hovCol.quirk.label}</span>
          </div>
        )}
        {hovCol.backstory && (
          <div style={{ color: "#334455", fontSize: fs(8), marginTop: 4, lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid #111", paddingTop: 4 }}>
            {hovCol.backstory.length > 80 ? hovCol.backstory.slice(0, 80) + "…" : hovCol.backstory}
          </div>
        )}
      </div>
    )}
  </>);
}
