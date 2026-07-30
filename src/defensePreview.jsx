// defensePreview.jsx — dev-only harness for the surface defense minigame.
//
// Mounts SurfaceDefense directly so raid size, wealth bracket, sentry count and
// starting scrap can be dialled in without playing a colony up to the point a
// raid fires. Entry point is /defense.html; nothing here ships.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import SurfaceDefense, { waveBudget, waveComposition } from "./surface_defense.jsx";

function Harness() {
  const [raidSize, setRaidSize] = useState("large");
  const [wealth, setWealth]     = useState(0);
  const [sentries, setSentries] = useState(2);
  const [scrap, setScrap]       = useState(400);
  const [runId, setRunId]       = useState(0);
  const [events, setEvents]     = useState([]);

  const log = (m) => setEvents(e => [`${new Date().toLocaleTimeString()} ${m}`, ...e].slice(0, 8));
  const waves = { small: 3, medium: 5, large: 8 }[raidSize];

  const Btn = ({ on, onClick, children }) => (
    <button className={`h${on ? " on" : ""}`} onClick={onClick}>{children}</button>
  );

  return (
    <div>
      <div className="row">
        <strong style={{ color: "#4ab3f4" }}>SURFACE DEFENSE HARNESS</strong>
        <span>raid:</span>
        {["small", "medium", "large"].map(s => (
          <Btn key={s} on={raidSize === s} onClick={() => setRaidSize(s)}>{s}</Btn>
        ))}
        <span>wealth:</span>
        {[0, 1, 2, 3].map(w => (
          <Btn key={w} on={wealth === w} onClick={() => setWealth(w)}>{w}</Btn>
        ))}
        <span>sentries:</span>
        {[0, 2, 4].map(n => (
          <Btn key={n} on={sentries === n} onClick={() => setSentries(n)}>{n}</Btn>
        ))}
        <span>scrap:</span>
        {[100, 250, 400, 900].map(n => (
          <Btn key={n} on={scrap === n} onClick={() => setScrap(n)}>{n}</Btn>
        ))}
        <Btn onClick={() => { setRunId(i => i + 1); setEvents([]); }}>↻ RESTART</Btn>
      </div>

      {/* Difficulty table for the current settings — quick balance read. */}
      <div className="row" style={{ fontSize: 10, color: "#67788a" }}>
        {Array.from({ length: waves }).map((_, w) => {
          const c = waveComposition(w, waves, wealth);
          return (
            <span key={w} style={{ border: "1px solid #1e2a36", padding: "2px 6px" }}>
              w{w + 1} · {waveBudget(w, waves, wealth)}b ·{" "}
              {Object.entries(c).map(([t, n]) => `${n}${t[0]}`).join(" ")}
            </span>
          );
        })}
      </div>

      <SurfaceDefense
        key={`${runId}-${raidSize}-${wealth}-${sentries}-${scrap}`}
        active
        scrap={scrap}
        raidSize={raidSize}
        wealthBracket={wealth}
        sentryWorkers={sentries}
        onScrapChange={(d) => log(`scrap ${d >= 0 ? "+" : ""}${d}`)}
        onRaidWon={() => log("RAID WON")}
        onRaidLost={() => log("RAID LOST")}
        onBunkerDestroyed={() => log("BUNKER DESTROYED")}
      />

      <div style={{ marginTop: 10, color: "#4a5a6a" }}>
        {events.map((e, i) => <div key={i}>{e}</div>)}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
