// RaidBanner.jsx — active raid / raid window warning banner
// Props: activeRaid, raidWindow, radioTowerOnline, unlockedTechs
import { RAID_SIZES, RAID_SIZE_ORDER, RAID_LAUNCH_CHANCE } from "../gameData.js";

export default function RaidBanner({ activeRaid, raidWindow, radioTowerOnline, unlockedTechs }) {
  if (!raidWindow && !activeRaid) return null;

  return (
    <div style={{
      width: "100%", maxWidth: 920, marginBottom: 10,
      background: activeRaid ? "#140000" : "#0e0000",
      border: `2px solid ${activeRaid ? "#ff4444" : "#ff2200"}`,
      borderRadius: 6, padding: "10px 16px",
      boxShadow: "0 0 24px #ff444444",
      animation: "raidPulse 1.2s ease-in-out infinite",
    }}>
      {activeRaid ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ color: "#ff4444", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>
              {RAID_SIZES[activeRaid.sizeKey].icon} {RAID_SIZES[activeRaid.sizeKey].label} RAID IN PROGRESS
            </div>
            <div style={{ color: "#884444", fontSize: 9, marginTop: 3, letterSpacing: 1 }}>
              Arc forces are breaching the perimeter — production is at risk
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#ff6666", fontSize: 18, fontWeight: "bold", fontFamily: "monospace" }}>{activeRaid.ticksLeft}</div>
              <div style={{ color: "#5a2a2a", fontSize: 8, letterSpacing: 1 }}>TICKS LEFT</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: activeRaid.strikeCountdown <= 5 ? "#ff4444" : "#f5a623", fontSize: 18, fontWeight: "bold", fontFamily: "monospace" }}>
                {activeRaid.strikeCountdown}
              </div>
              <div style={{ color: "#5a2a2a", fontSize: 8, letterSpacing: 1 }}>NEXT STRIKE</div>
            </div>
            <div style={{ width: 80, height: 8, background: "#200000", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${(activeRaid.ticksLeft / RAID_SIZES[activeRaid.sizeKey].duration) * 100}%`,
                background: "repeating-linear-gradient(90deg, #ff2222 0px, #ff4444 6px, #880000 6px, #880000 12px)",
                transition: "width 0.4s",
              }} />
            </div>
          </div>
        </div>
      ) : raidWindow && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ color: "#ff6622", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>
              {radioTowerOnline
                ? `${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].icon} ${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].label} RAID INCOMING`
                : "❓ UNKNOWN RAID INCOMING"}
            </div>
            <div style={{ color: "#7a3a1a", fontSize: 9, marginTop: 3, letterSpacing: 1 }}>
              Arc forces mobilizing — {Math.round(RAID_LAUNCH_CHANCE * 100)}% strike chance each tick
              {raidWindow.escalations > 0 && ` · escalated ${raidWindow.escalations}×`}
              {!radioTowerOnline && " · 📡 build/restore Radio Tower to identify"}
            </div>
          </div>
          {radioTowerOnline && unlockedTechs.includes("barricades") && (
            <div style={{ color: "#4a8a4a", fontSize: 9, letterSpacing: 1 }}>
              🛡 {Math.round({ small: 75, medium: 30, large: 10 }[RAID_SIZE_ORDER[raidWindow.sizeIdx]])}% block chance
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes raidPulse {
          0%, 100% { box-shadow: 0 0 24px #ff444444; }
          50%       { box-shadow: 0 0 40px #ff4444aa; }
        }
      `}</style>
    </div>
  );
}
