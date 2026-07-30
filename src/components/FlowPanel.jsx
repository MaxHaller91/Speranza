// FlowPanel.jsx — supply/demand net flow bars with hover breakdown
// Props: res, netFlow, statBreakdown, mousePos, hoveredFlowStat, onHoverFlowStat
import { ticksToEmpty } from "../gameData.js";

export default function FlowPanel({ res, netFlow, statBreakdown, mousePos, hoveredFlowStat, onHoverFlowStat }) {
  // A falling stock is the single most important thing on this panel, and it
  // used to be invisible until the moment the colony died. Show the countdown.
  const runway = (key) => {
    if (key === "morale" || !res) return null;
    const t = ticksToEmpty(res[key] ?? 0, netFlow[key] ?? 0);
    if (t === null) return null;
    return { ticks: t, days: t / 48 };
  };
  const renderBreakdownLines = (lines, emptyLabel, color) => {
    if (!lines.length) {
      return <div style={{ color, opacity: 0.7, fontSize: 8, lineHeight: 1.4 }}>• {emptyLabel}</div>;
    }
    return lines.slice(0, 5).map((line, i) => (
      <div key={`${emptyLabel}-${i}`} style={{ color, fontSize: 8, lineHeight: 1.4 }}>• {line}</div>
    ));
  };

  return (
    <div style={{ marginTop: 8, background: "#060810", border: "1px solid #1a2030", borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>SUPPLY / DEMAND — NET FLOW PER TICK</div>
      {[
        { key: "energy", icon: "⚡", label: "Energy", color: "#f5a623" },
        { key: "food",   icon: "🌱", label: "Food",   color: "#7ed321" },
        { key: "water",  icon: "💧", label: "Water",  color: "#4a90e2" },
        { key: "morale", icon: "🧭", label: "Morale", color: "#d4a843" },
      ].map(({ key, icon, label, color }) => {
        const val    = key === "morale" ? (statBreakdown.morale?.net ?? 0) : (netFlow[key] || 0);
        const pct    = Math.min(Math.abs(val) / 12, 1) * 50;
        const surplus = val >= 0;
        const crit   = val < -5;
        return (
          <div key={key}
            onMouseEnter={() => onHoverFlowStat(key)}
            onMouseLeave={() => onHoverFlowStat(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 58, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11 }}>{icon}</span>
              <span style={{ fontSize: 9, color: "#3a5060" }}>{label}</span>
            </div>
            <div style={{ flex: 1, height: 12, background: "#0d1020", borderRadius: 6, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#1a2535", zIndex: 2 }} />
              {val !== 0 && (
                <div style={{
                  position: "absolute", top: 1, bottom: 1, borderRadius: 4,
                  left: surplus ? "50%" : `calc(50% - ${pct}%)`,
                  width: `${pct}%`,
                  background: crit ? "#c0392b" : surplus ? color : "#c0392b",
                  boxShadow: surplus ? `0 0 5px ${color}77` : "0 0 5px #c0392b77",
                  transition: "width 0.4s, left 0.4s",
                }} />
              )}
            </div>
            <div style={{ width: 36, textAlign: "right", fontSize: 10, fontFamily: "monospace", flexShrink: 0, fontWeight: "bold", color: crit ? "#ff4444" : surplus ? color : "#ff7755" }}>
              {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
            </div>
            {/* Time-to-empty countdown — the warning the old UI never gave. */}
            {(() => {
              const rw = runway(key);
              if (!rw) return <div style={{ width: 62, flexShrink: 0 }} />;
              const urgent = rw.ticks <= 24;   // half a day or less
              const soon   = rw.ticks <= 72;   // a day and a half
              return (
                <div style={{
                  width: 62, flexShrink: 0, textAlign: "right",
                  fontSize: 8, fontFamily: "monospace",
                  color: urgent ? "#ff4444" : soon ? "#ff9944" : "#5a6a7a",
                  fontWeight: urgent ? "bold" : "normal",
                  animation: urgent ? "flowPulse 1s infinite" : "none",
                }}>
                  {rw.ticks <= 0 ? "EMPTY" : `${rw.ticks}t left`}
                </div>
              );
            })()}
          </div>
        );
      })}
      <style>{`@keyframes flowPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>

      {/* Hover breakdown tooltip */}
      {hoveredFlowStat && statBreakdown[hoveredFlowStat] && (() => {
        const data = statBreakdown[hoveredFlowStat];
        const tooltipNet = data.net ?? 0;
        return (
          <div style={{
            position: "fixed", left: mousePos.x + 14, top: mousePos.y + 10,
            background: "#0d1020", border: "1px solid #2a3a4a", borderRadius: 6,
            padding: "8px 10px", zIndex: 9999, minWidth: 170, maxWidth: 260,
            pointerEvents: "none", boxShadow: "0 0 14px #00000099",
          }}>
            <div style={{ color: "#9ab", fontSize: 8, letterSpacing: 1, marginBottom: 4 }}>{hoveredFlowStat.toUpperCase()} PER-TICK BREAKDOWN</div>
            <div style={{ color: "#7ed321", fontSize: 8, marginBottom: 2 }}>Supply</div>
            {renderBreakdownLines(data.plus, "No supply this tick", "#6fa86f")}
            <div style={{ color: "#ff7777", fontSize: 8, margin: "5px 0 2px" }}>Demand</div>
            {renderBreakdownLines(data.minus, "No demand this tick", "#b67878")}
            <div style={{ marginTop: 6, borderTop: "1px solid #1a2535", paddingTop: 4, color: "#8aa", fontSize: 8, fontFamily: "monospace" }}>
              Net this tick: {tooltipNet > 0 ? `+${tooltipNet.toFixed(1)}` : tooltipNet.toFixed(1)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
