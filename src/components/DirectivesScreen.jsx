// DirectivesScreen.jsx — toggle colony-wide standing orders, up to
// MAX_ACTIVE_DIRECTIVES at once. Unlocked by a built Research Lab.
//
// DIRECTIVES (speranza-lore.js) carries the flavor text and cost/benefit
// labels; the numbers those labels describe live in DIRECTIVE_MECHANICS /
// directiveEffects() in gameData.js, read by the tick loop through a ref.
//
// Like every other overlay, this does NOT touch the clock. `directivesScreenOpen`
// is a pause reason in Speranza.jsx. See "Pause ownership".
import { MAX_ACTIVE_DIRECTIVES } from "../gameData.js";

export default function DirectivesScreen({ directives, active, onToggle, onClose }) {
  const activeSet = new Set(active);
  const atMax = active.length >= MAX_ACTIVE_DIRECTIVES;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 350,
      background: "rgba(2,4,8,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto",
        background: "#070a11", border: "1px solid #1a3040", borderRadius: 8,
        padding: "20px 22px", boxShadow: "0 0 40px #4ab3f422",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ color: "#4ab3f4", fontSize: 14, letterSpacing: 3 }}>📋 DIRECTIVES</div>
          <div style={{ color: atMax ? "#ff8e8e" : "#7ed321", fontSize: 13, fontFamily: "monospace" }}>
            {active.length} / {MAX_ACTIVE_DIRECTIVES} <span style={{ color: "#3a5a2a", fontSize: 9, letterSpacing: 1 }}>ACTIVE</span>
          </div>
        </div>
        <div style={{ color: "#2a4a6a", fontSize: 8, letterSpacing: 1, marginBottom: 14, lineHeight: 1.6 }}>
          Standing colony law. Every benefit has a cost — pick what this run needs.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {directives.map(d => {
            const have = activeSet.has(d.id);
            const disabled = !have && atMax;
            return (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 11,
                background: have ? "#0b1710" : "#0a0c14",
                border: `1px solid ${have ? "#7ed32155" : "#16202c"}`,
                borderRadius: 5, padding: "9px 11px",
              }}>
                <div style={{ fontSize: 15, width: 20, textAlign: "center", opacity: have ? 1 : 0.55 }}>{d.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: have ? "#7ed321" : "#8fa4b8", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>
                    {d.label}
                  </div>
                  <div style={{ color: "#5a6a7a", fontSize: 9, marginTop: 2, lineHeight: 1.45 }}>{d.desc}</div>
                  <div style={{ marginTop: 4, display: "flex", gap: 10, fontSize: 8, letterSpacing: 0.5 }}>
                    <span style={{ color: "#7ed321" }}>+ {d.benefit}</span>
                    <span style={{ color: "#ff8e8e" }}>− {d.cost}</span>
                  </div>
                </div>
                <button
                  onClick={() => onToggle(d.id)}
                  disabled={disabled}
                  title={have ? "Rescind" : disabled ? `Max ${MAX_ACTIVE_DIRECTIVES} directives active` : "Enact"}
                  style={{
                    background: have ? "#1a0d0d" : disabled ? "#0a0c12" : "#08161f",
                    border: `1px solid ${have ? "#7a3a3a" : disabled ? "#1a2028" : "#4ab3f4"}`,
                    borderRadius: 4, padding: "7px 11px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    color: have ? "#ff8e8e" : disabled ? "#3a4450" : "#4ab3f4",
                    fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: 1,
                    whiteSpace: "nowrap",
                  }}
                >{have ? "RESCIND" : "ENACT"}</button>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={{
          width: "100%", marginTop: 16, background: "#0a0c14",
          border: "1px solid #1a3040", borderRadius: 6, color: "#4a6a8a",
          padding: "10px", cursor: "pointer", fontSize: 11, letterSpacing: 3,
          fontFamily: "'Courier New', monospace",
        }}>✕ CLOSE</button>
      </div>
    </div>
  );
}
