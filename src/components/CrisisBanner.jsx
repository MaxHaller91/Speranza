// CrisisBanner.jsx — full-width warning when the colony is about to fail
//
// The colony used to die with no build-up: one tick fine, the next a game-over
// screen. This is the "you have a problem and here is how long you have" state,
// escalating from a projection warning through to people actively dying.
//
// Props: res, netFlow, deprivedTicks
import {
  ticksToEmpty, deprivationStage,
  DEPRIVE_COLLAPSE_TICKS, DEPRIVE_DEATH_TICKS, fs,} from "../gameData.js";

const TRACKED = [
  { key: "food",   label: "FOOD",   icon: "🌱" },
  { key: "water",  label: "WATER",  icon: "💧" },
  { key: "energy", label: "POWER",  icon: "⚡" },
];

// Show a projection warning once a stock is within this many ticks of empty.
const RUNWAY_WARN_TICKS = 72; // ~1.5 in-game days

export default function CrisisBanner({ res, netFlow, deprivedTicks = 0 }) {
  const stage = deprivationStage(deprivedTicks);

  // Already out of something — this is the loud state.
  if (stage !== "none") {
    const empty = TRACKED.filter(t => (res?.[t.key] ?? 0) <= 0 && t.key !== "energy");
    const names = empty.length ? empty.map(t => t.label).join(" + ") : "SUPPLIES";
    const copy =
      stage === "warning"
        ? { text: `NO ${names} — colonists start collapsing in ${DEPRIVE_COLLAPSE_TICKS - deprivedTicks} ticks`, color: "#ff8800" }
        : stage === "collapsing"
        ? { text: `NO ${names} — colonists are collapsing · deaths begin in ${Math.max(0, DEPRIVE_DEATH_TICKS - deprivedTicks)} ticks`, color: "#ff4422" }
        : { text: `NO ${names} — COLONISTS ARE DYING`, color: "#ff0000" };

    return (
      <div style={{
        width: "100%", maxWidth: fs(920), marginBottom: 8,
        background: `linear-gradient(90deg, ${copy.color}22, ${copy.color}0d)`,
        border: `1px solid ${copy.color}`,
        borderRadius: 6, padding: "7px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, position: "relative", zIndex: 3,
        animation: "crisisPulse 1.1s infinite",
      }}>
        <div style={{ color: copy.color, fontSize: fs(11), letterSpacing: 2, fontWeight: "bold" }}>
          🚨 {copy.text}
        </div>
        <div style={{ color: "#c8d0d8", fontSize: fs(8), letterSpacing: 1, opacity: 0.85 }}>
          STAFF HYDROPONICS / WATER RECYCLER — OR PULL PEOPLE OFF OTHER POSTS
        </div>
        <style>{`@keyframes crisisPulse { 0%,100%{opacity:1} 50%{opacity:0.72} }`}</style>
      </div>
    );
  }

  // Not empty yet, but heading there — the early warning that lets you act.
  const failing = TRACKED
    .map(t => ({ ...t, ticks: ticksToEmpty(res?.[t.key] ?? 0, netFlow?.[t.key] ?? 0) }))
    .filter(t => t.ticks !== null && t.ticks <= RUNWAY_WARN_TICKS)
    .sort((a, b) => a.ticks - b.ticks);

  if (failing.length === 0) return null;

  const worst = failing[0];
  const urgent = worst.ticks <= 24;

  return (
    <div style={{
      width: "100%", maxWidth: fs(920), marginBottom: 8,
      background: urgent ? "#2a0d00" : "#1a1400",
      border: `1px solid ${urgent ? "#ff7722" : "#8a6a20"}`,
      borderRadius: 6, padding: "6px 12px",
      display: "flex", alignItems: "center", gap: 14,
      position: "relative", zIndex: 3,
    }}>
      <div style={{ color: urgent ? "#ff9944" : "#d4a843", fontSize: fs(10), letterSpacing: 2, fontWeight: "bold" }}>
        ⚠ SUPPLY WARNING
      </div>
      <div style={{ display: "flex", gap: 14, flex: 1, flexWrap: "wrap" }}>
        {failing.map(f => (
          <span key={f.key} style={{ fontSize: fs(9), color: f.ticks <= 24 ? "#ff6644" : "#c8a04a", fontFamily: "monospace" }}>
            {f.icon} {f.label} out in <strong>{f.ticks}t</strong>
            <span style={{ opacity: 0.6 }}> (~{(f.ticks / 48).toFixed(1)}d)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
