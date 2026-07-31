// StartScreen.jsx — the first thing a new player sees.
//
// Difficulty used to be selectable only from the game-over screen, so a first
// colony was always locked to survivor: you had to die once before the game
// would let you choose. This is that missing "new colony" moment.
//
// It does NOT touch the clock. `runStarted` is a pause reason in Speranza.jsx,
// so the colony is stopped simply because this is open. See "Pause ownership".
import { useState } from "react";
import { DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY } from "../gameData.js";

export default function StartScreen({ defaultName = "SPERANZA", onBegin }) {
  const [name, setName] = useState(defaultName);
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);

  const trimmed = name.trim();
  const begin = () => onBegin(trimmed || defaultName, difficulty);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(2,4,8,0.94)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        width: "100%", maxWidth: 520,
        background: "#070a11", border: "1px solid #1a3040", borderRadius: 8,
        padding: "22px 24px", boxShadow: "0 0 40px #4ab3f422",
      }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#4ab3f4" }}>⛩ SPERANZA</div>
          <div style={{ fontSize: 8, letterSpacing: 3, color: "#2a4a6a", marginTop: 5 }}>
            UNDERGROUND COLONY
          </div>
          <div style={{ fontSize: 9, color: "#4a5a6a", marginTop: 12, lineHeight: 1.6 }}>
            The surface belongs to the Arc. Everything you have left is below it.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="colony-name" style={{ display: "block", color: "#2a4a6a", fontSize: 8, letterSpacing: 2, marginBottom: 6 }}>
            COLONY NAME
          </label>
          <input
            id="colony-name"
            value={name}
            maxLength={22}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") begin(); }}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#0a0c14", border: "1px solid #1a3040", borderRadius: 4,
              color: "#4ab3f4", padding: "9px 11px", fontSize: 13, letterSpacing: 2,
              fontFamily: "'Courier New', monospace", outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ color: "#2a4a6a", fontSize: 8, letterSpacing: 2, marginBottom: 6 }}>DIFFICULTY</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {DIFFICULTY_ORDER.map(key => {
              const on = difficulty === key;
              return (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  aria-pressed={on}
                  style={{
                    flex: 1, padding: "9px 4px", cursor: "pointer", fontSize: 9,
                    letterSpacing: 1, fontFamily: "'Courier New', monospace",
                    background: on ? "#1a2a3a" : "#0a0c14",
                    border: `1px solid ${on ? "#4ab3f4" : "#1a2535"}`,
                    borderRadius: 4,
                    color: on ? "#4ab3f4" : "#5a6a7a",
                    fontWeight: on ? "bold" : "normal",
                  }}
                >{DIFFICULTIES[key].label}</button>
              );
            })}
          </div>
          <div style={{
            minHeight: 30, color: "#5a6a7a", fontSize: 9, lineHeight: 1.5,
            background: "#0a0c14", border: "1px solid #12202c", borderRadius: 4, padding: "7px 9px",
          }}>
            {DIFFICULTIES[difficulty].desc}
          </div>
          <div style={{ color: "#2a3a4a", fontSize: 8, marginTop: 6, letterSpacing: 1 }}>
            You can pick again whenever you start a new colony.
          </div>
        </div>

        <button onClick={begin} style={{
          width: "100%", background: "#08161f", border: "2px solid #4ab3f4",
          borderRadius: 6, color: "#4ab3f4", padding: "12px", cursor: "pointer",
          fontSize: 12, letterSpacing: 3, fontFamily: "'Courier New', monospace",
        }}>BEGIN</button>
      </div>
    </div>
  );
}
