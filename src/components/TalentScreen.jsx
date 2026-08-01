// TalentScreen.jsx — spend Resolve on permanent colony talents.
//
// Resolve is meta-progression: it is earned only by winning raids and it
// survives losing a colony, so a run that ends badly still moves you forward.
// Every talent here modifies a value that already exists in a pure helper —
// nothing in this screen introduces a new system.
//
// Like every other overlay, this does NOT touch the clock. `talentScreenOpen`
// is a pause reason in Speranza.jsx. See "Pause ownership".
import { TALENTS, TALENT_ORDER, fs,} from "../gameData.js";

export default function TalentScreen({ resolve, talents, onUnlock, onClose }) {
  const owned = new Set(talents);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 350,
      background: "rgba(2,4,8,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto",
        background: "#070a11", border: "1px solid #1a3040", borderRadius: 8,
        padding: "20px 22px", boxShadow: "0 0 40px #4ab3f422",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ color: "#4ab3f4", fontSize: fs(14), letterSpacing: 3 }}>✦ TALENTS</div>
          <div style={{ color: "#7ed321", fontSize: fs(13), fontFamily: "monospace" }}>
            {resolve} <span style={{ color: "#3a5a2a", fontSize: fs(9), letterSpacing: 1 }}>RESOLVE</span>
          </div>
        </div>
        <div style={{ color: "#2a4a6a", fontSize: fs(8), letterSpacing: 1, marginBottom: 14, lineHeight: 1.6 }}>
          Earned by repelling raids. Permanent, and kept when a colony falls.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {TALENT_ORDER.map(key => {
            const t = TALENTS[key];
            const have = owned.has(key);
            const afford = resolve >= t.cost;
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 11,
                background: have ? "#0b1710" : "#0a0c14",
                border: `1px solid ${have ? "#7ed32155" : "#16202c"}`,
                borderRadius: 5, padding: "9px 11px",
              }}>
                <div style={{ fontSize: fs(15), width: 20, textAlign: "center", opacity: have ? 1 : 0.55 }}>{t.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: have ? "#7ed321" : "#8fa4b8", fontSize: fs(10), fontWeight: "bold", letterSpacing: 1 }}>
                    {t.label}
                  </div>
                  <div style={{ color: "#5a6a7a", fontSize: fs(9), marginTop: 2, lineHeight: 1.45 }}>{t.desc}</div>
                </div>
                {have ? (
                  <div style={{ color: "#7ed321", fontSize: fs(9), letterSpacing: 1, padding: "0 6px" }}>OWNED</div>
                ) : (
                  <button
                    onClick={() => onUnlock(key)}
                    disabled={!afford}
                    title={afford ? `Unlock for ${t.cost} Resolve` : `Needs ${t.cost} Resolve`}
                    style={{
                      background: afford ? "#08161f" : "#0a0c12",
                      border: `1px solid ${afford ? "#4ab3f4" : "#1a2028"}`,
                      borderRadius: 4, padding: "7px 11px",
                      cursor: afford ? "pointer" : "not-allowed",
                      color: afford ? "#4ab3f4" : "#3a4450",
                      fontSize: fs(10), fontFamily: "'Courier New', monospace", letterSpacing: 1,
                      whiteSpace: "nowrap",
                    }}
                  >{t.cost} ✦</button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={{
          width: "100%", marginTop: 16, background: "#0a0c14",
          border: "1px solid #1a3040", borderRadius: 6, color: "#4a6a8a",
          padding: "10px", cursor: "pointer", fontSize: fs(11), letterSpacing: 3,
          fontFamily: "'Courier New', monospace",
        }}>✕ CLOSE</button>
      </div>
    </div>
  );
}
