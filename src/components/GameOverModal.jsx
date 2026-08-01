// GameOverModal.jsx — game over / colony collapse screen
// Props: gameOver, historyLog, onRestart
import { useState } from "react";
import { DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, fs,} from "../gameData.js";

export default function GameOverModal({ colonyName, gameOver, historyLog, onRestart }) {
  const [nextDifficulty, setNextDifficulty] = useState(DEFAULT_DIFFICULTY);
  if (!gameOver) return null;

  const playedDifficulty = DIFFICULTIES[gameOver.difficulty] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
  const days = gameOver.daysAlive ?? 1;
  const grade = days >= 80 ? "LEGEND" : days >= 40 ? "DEFENDER" : days >= 20 ? "SURVIVOR" : "LOST";
  const gradeColor = { LEGEND: "#ffd700", DEFENDER: "#4ab3f4", SURVIVOR: "#7ed321", LOST: "#ff4444" }[grade];
  const runCode = "SPZ-" + btoa(JSON.stringify({
    d: days,
    r: gameOver.raidsRepelled,
    k: gameOver.casualties?.length ?? 0,
  })).slice(0, 8).toUpperCase();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc", zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#07090f", border: "2px solid #ff3333", borderRadius: 12,
        padding: "32px 40px", maxWidth: 520, width: "90%", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 0 60px #ff000044",
      }}>
        {/* Grade */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: fs(36), marginBottom: 6 }}>💀</div>
          <div style={{ fontSize: fs(28), fontWeight: "bold", color: gradeColor, letterSpacing: 4, marginBottom: 4 }}>
            {grade}
          </div>
          <div style={{ fontSize: fs(10), color: "#445566", letterSpacing: 2 }}>COLONY DESIGNATION: {colonyName ?? "SPERANZA"}</div>
          <div style={{ fontSize: fs(9), color: "#5a4a2a", letterSpacing: 2, marginTop: 2 }}>DIFFICULTY: {playedDifficulty.label}</div>
        </div>

        {/* Reason */}
        <div style={{ background: "#1a0808", border: "1px solid #ff333344", borderRadius: 6, padding: "10px 14px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ color: "#ff6666", fontSize: fs(11), letterSpacing: 1 }}>{gameOver.reason}</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            ["DAYS SURVIVED",   days],
            ["RAIDS REPELLED",  gameOver.raidsRepelled ?? 0],
            ["COLONISTS LOST",  gameOver.casualties?.length ?? 0],
            ["PEAK POPULATION", gameOver.peakPop ?? 0],
          ].map(([label, val]) => (
            <div key={label} style={{ background: "#0a0c18", border: "1px solid #1a2535", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: "#2a4a6a", fontSize: fs(8), letterSpacing: 1, marginBottom: 3 }}>{label}</div>
              <div style={{ color: "#c8d8e8", fontSize: fs(20), fontWeight: "bold" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Casualties */}
        {(gameOver.casualties?.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#7a6a4a", fontSize: fs(9), letterSpacing: 2, marginBottom: 6, borderBottom: "1px solid #2a1a0a", paddingBottom: 4 }}>
              🕯 FALLEN COLONISTS
            </div>
            <div style={{ maxHeight: 120, overflowY: "auto" }}>
              {gameOver.casualties.map((entry, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #0d1020", fontSize: fs(9) }}>
                  <span style={{ color: "#c8d0d8" }}>{entry.name} <span style={{ color: "#555" }}>LVL {entry.level}</span></span>
                  <span style={{ color: "#8a5a3a" }}>
                    {entry.cause === "raidKilled"        ? "killed in raid"
                   : entry.cause === "expeditionKilled" ? "lost topside"
                   : entry.cause === "raidFled"         ? "fled"
                   : entry.cause === "starved"          ? "starved"
                   : entry.cause === "thirst"           ? "died of thirst"
                   : "left"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Colony history timeline */}
        {historyLog.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#7a6a4a", fontSize: fs(9), letterSpacing: 2, marginBottom: 6, borderBottom: "1px solid #2a1a0a", paddingBottom: 4 }}>
              📜 COLONY TIMELINE
            </div>
            <div style={{ maxHeight: 140, overflowY: "auto" }}>
              {historyLog.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px solid #0d1020", fontSize: fs(9) }}>
                  <span style={{ color: "#445566", minWidth: 42, flexShrink: 0 }}>Day {ev.day}</span>
                  <span style={{ fontSize: fs(10) }}>{ev.icon}</span>
                  <span style={{ color: "#8899aa" }}>{ev.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Run code */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ color: "#2a4a6a", fontSize: fs(8), letterSpacing: 2, marginBottom: 4 }}>RUN CODE</div>
          <div style={{ background: "#0a0c14", border: "1px solid #1a3040", borderRadius: 4, padding: "6px 14px", display: "inline-block" }}>
            <span style={{ color: "#4ab3f4", fontSize: fs(12), fontFamily: "monospace", letterSpacing: 2 }}>{runCode}</span>
            <button onClick={() => navigator.clipboard?.writeText(runCode)} style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#2a5a7a", fontSize: fs(9) }}>COPY</button>
          </div>
        </div>

        {/* New colony difficulty pick — the levers only apply going forward. */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#2a4a6a", fontSize: fs(8), letterSpacing: 2, marginBottom: 6, textAlign: "center" }}>
            NEXT COLONY DIFFICULTY
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {DIFFICULTY_ORDER.map(key => (
              <button
                key={key}
                onClick={() => setNextDifficulty(key)}
                style={{
                  flex: 1, padding: "8px 4px", cursor: "pointer", fontSize: fs(9),
                  letterSpacing: 1, fontFamily: "monospace",
                  background: nextDifficulty === key ? "#1a2a3a" : "#0a0c14",
                  border: `1px solid ${nextDifficulty === key ? "#4ab3f4" : "#1a2535"}`,
                  borderRadius: 4,
                  color: nextDifficulty === key ? "#4ab3f4" : "#5a6a7a",
                  fontWeight: nextDifficulty === key ? "bold" : "normal",
                }}
              >{DIFFICULTIES[key].label}</button>
            ))}
          </div>
        </div>

        <button onClick={() => onRestart(nextDifficulty)} style={{
          width: "100%", background: "#1a0000", border: "2px solid #ff3333",
          borderRadius: 6, color: "#ff6666", padding: "12px", cursor: "pointer",
          fontSize: fs(12), letterSpacing: 3, fontFamily: "monospace",
        }}>NEW COLONY</button>
      </div>
    </div>
  );
}
