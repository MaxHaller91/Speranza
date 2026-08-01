import { fs } from "../gameData.js";
// DilemmaModal.jsx — situation report / choice modal
// Props: activeDilemma, onChoice

export default function DilemmaModal({ activeDilemma, onChoice }) {
  if (!activeDilemma) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000bb", zIndex: 8000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#080b14", border: "2px solid #4a3a6a", borderRadius: 10,
        padding: "28px 32px", maxWidth: 440, width: "90%",
        boxShadow: "0 0 40px #4a3a6a55",
      }}>
        <div style={{ fontSize: fs(9), color: "#4a3a6a", letterSpacing: 3, marginBottom: 8 }}>SITUATION REPORT</div>
        <div style={{ fontSize: fs(14), color: "#c8b8e8", fontWeight: "bold", letterSpacing: 1, marginBottom: 14 }}>
          {activeDilemma.title ?? activeDilemma.id.replace(/_/g, " ").toUpperCase()}
        </div>
        <div style={{ color: "#7a8a9a", fontSize: fs(10), lineHeight: 1.7, marginBottom: 20, fontStyle: "italic", borderLeft: "2px solid #2a2a4a", paddingLeft: 12 }}>
          {activeDilemma.text}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(activeDilemma.choices ?? []).map((choice, i) => (
            <button key={i} onClick={() => onChoice(choice)} style={{
              background: "#0a0c18", border: "1px solid #2a2a5a",
              borderRadius: 6, color: "#aab8cc", padding: "10px 14px",
              cursor: "pointer", textAlign: "left", fontSize: fs(10), lineHeight: 1.5,
              fontFamily: "monospace", transition: "border-color 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#6a5a9a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a5a"}
            >
              <div style={{ color: "#c8b8e8", marginBottom: 3, fontWeight: "bold" }}>{choice.label}</div>
              {choice.preview && <div style={{ color: "#556677", fontSize: fs(9) }}>{choice.preview}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
