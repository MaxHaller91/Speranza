// ColonyHeader.jsx — top bar: title, timescale, resources, heat meter, morale, colonists
// Props: tick, timescale, musicVolume, res, surfaceHaul, surfaceCondition,
//        morale, heat, heatState, heatPct, raidWindow, radioTowerOnline,
//        unlockedTechs, totalColonists, popCap, unassigned, grid,
//        journalOpen, effectsOpen, hoveredFlowStat,
//        onTimescale, onMusicVolume, onRecruit, onToggleJournal, onToggleEffects,
//        onHoverMorale, onBugReport, saveLocked, saveLockReason,
//        onSaveNow, onLoadAutosave, onExportSave, onImportSave, onDeleteAutosaves
import { MAX_RES, HEAT_MAX, calcRaidChance, RAID_ROLL_EVERY, RAID_SIZES, RAID_SIZE_ORDER, tickToDayHour, fs,} from "../gameData.js";

function ResBar({ k, icon, label, color, res }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f", border: `1px solid ${color}33`, borderRadius: 6, padding: "5px 10px", minWidth: 105 }}>
      <span style={{ fontSize: fs(15) }}>{icon}</span>
      <div>
        <div style={{ color: "#888", fontSize: fs(9), letterSpacing: 1 }}>{label}</div>
        <div style={{ color, fontSize: fs(14), fontWeight: "bold", fontFamily: "monospace" }}>{Math.floor(res[k])}</div>
      </div>
      <div style={{ width: 4, height: 28, background: "#1a1a2e", borderRadius: 2, marginLeft: "auto", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
        <div style={{ width: "100%", height: `${(res[k] / MAX_RES) * 100}%`, background: color, transition: "height 0.5s" }} />
      </div>
    </div>
  );
}

export default function ColonyHeader({
  colonyName, difficultyLabel, onRenameColony,
  tick, timescale, musicVolume, res, surfaceHaul, surfaceCondition,
  morale, heat, heatState, heatPct, raidWindow, radioTowerOnline,
  unlockedTechs, totalColonists, popCap, unassigned, grid,
  journalOpen, effectsOpen,
  onTimescale, onMusicVolume, onRecruit, onToggleJournal, onToggleEffects, onHoverMorale, onBugReport,
  saveLocked, saveLockReason, onSaveNow, onLoadAutosave, onExportSave, onImportSave, onDeleteAutosaves,
  onOpenHelp, resolve = 0, onOpenTalents, uiScale = "medium", onChangeUiScale,
  activeDirectivesCount = 0, onOpenDirectives,
}) {
  const moraleColor = morale > 50 ? "#7ed321" : morale > 0 ? "#f5a623" : morale > -50 ? "#ff7744" : "#ff2222";
  const moraleTier  = morale > 75 ? "THRIVING" : morale > 25 ? "STABLE" : morale > 0 ? "UNEASY" : morale > -50 ? "STRAINED" : morale > -75 ? "FRACTURED" : "COLLAPSE";
  const moraleVal   = Math.floor(morale);
  const positivePct = morale > 0 ? (morale / 100) * 50 : 0;
  const negativePct = morale < 0 ? (Math.abs(morale) / 100) * 50 : 0;
  const hasResearchLab = grid.flatMap(r => r).some(c => c.type === "researchLab");

  return (
    <div style={{ width: "100%", maxWidth: fs(920), marginBottom: 10, position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1e3a5f", paddingBottom: 8, marginBottom: 10, flexWrap: "wrap", gap: 8, background: "rgba(3,6,9,0.55)", backdropFilter: "blur(2px)" }}>

        {/* Title + controls */}
        <div>
          {/* Click to rename — the colony is the player's, so let them name it. */}
          <div
            title="Click to rename your colony"
            onClick={() => {
              const next = window.prompt("Name your colony", colonyName);
              if (next && next.trim() && onRenameColony) onRenameColony(next.trim().toUpperCase().slice(0, 22));
            }}
            style={{ fontSize: fs(20), fontWeight: "bold", color: "#4ab3f4", letterSpacing: 3, cursor: "pointer" }}
          >⛩ {colonyName}</div>
          <div style={{ fontSize: fs(9), color: "#2a4a6a", letterSpacing: 2 }}>
            UNDERGROUND COLONY · {tickToDayHour(tick)}
            {difficultyLabel && ` · ${difficultyLabel}`}
          </div>
          <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 5, background: "#0a0c14", border: `1px solid ${surfaceCondition.color}44`, borderRadius: 4, padding: "2px 8px" }}>
            <span style={{ fontSize: fs(10) }}>{surfaceCondition.icon}</span>
            <span style={{ fontSize: fs(8), color: surfaceCondition.color, letterSpacing: 1 }}>{surfaceCondition.label}</span>
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 5, alignItems: "center" }}>
            {[{ v: 0, label: "⏸" }, { v: 0.5, label: ".5×" }, { v: 1, label: "1×" }, { v: 2, label: "2×" }, { v: 4, label: "4×" }, { v: 10, label: "10×" }].map(({ v, label }) => (
              <button key={v} onClick={() => onTimescale(v)} style={{
                background: timescale === v ? "#1a3a5a" : "#0a0c14",
                border: `1px solid ${timescale === v ? "#4ab3f4" : "#1a2535"}`,
                borderRadius: 3, color: timescale === v ? "#4ab3f4" : "#2a4a6a",
                padding: "2px 6px", cursor: "pointer", fontSize: fs(9), fontFamily: "monospace",
                fontWeight: timescale === v ? "bold" : "normal",
              }}>{label}</button>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6, padding: "2px 6px", background: "#0a0c14", border: "1px solid #1a2535", borderRadius: 3 }}>
              <span style={{ color: "#4ab3f4", fontSize: fs(10) }}>🔊</span>
              <input type="range" min="0" max="100" step="1" value={musicVolume} onChange={onMusicVolume}
                style={{ width: 72, accentColor: "#4ab3f4", cursor: "pointer" }} />
              <span style={{ color: "#4ab3f4", fontSize: fs(9), minWidth: 28, textAlign: "right" }}>{musicVolume}%</span>
            </div>
            <button title="Toggle Colony Log" onClick={(e) => { e.stopPropagation(); onToggleJournal(); }} style={{
              background: journalOpen ? "#1a3a5a" : "#0a0c14",
              border: `1px solid ${journalOpen ? "#4ab3f4" : "#1a2535"}`,
              borderRadius: 3, color: journalOpen ? "#4ab3f4" : "#2a4a6a",
              padding: "2px 6px", cursor: "pointer", fontSize: fs(10), fontFamily: "monospace", marginLeft: 4,
            }}>📜</button>
            <button title="Toggle Colony Effects" onClick={(e) => { e.stopPropagation(); onToggleEffects(); }} style={{
              background: effectsOpen ? "#2a2410" : "#0a0c14",
              border: `1px solid ${effectsOpen ? "#d4a843" : "#1a2535"}`,
              borderRadius: 3, color: effectsOpen ? "#d4a843" : "#2a4a6a",
              padding: "2px 6px", cursor: "pointer", fontSize: fs(10), fontFamily: "monospace", marginLeft: 2,
            }}>🧪</button>
            <button
              title="Report Bug"
              onClick={(e) => {
                e.stopPropagation();
                const description = window.prompt("Describe the bug:");
                if (description !== null) onBugReport(description);
              }}
              style={{
                background: "#090b11",
                border: "1px solid #1a2535",
                borderRadius: 3,
                color: "#3c4d63",
                padding: "2px 6px",
                cursor: "pointer",
                fontSize: fs(9),
                fontFamily: "monospace",
                marginLeft: 2,
                letterSpacing: 0.5,
              }}
            >🐛</button>
            <button
              title={saveLocked ? saveLockReason : "Save now"}
              onClick={(e) => { e.stopPropagation(); onSaveNow(); }}
              disabled={saveLocked}
              style={{
                background: saveLocked ? "#090b11" : "#0a2a1a",
                border: `1px solid ${saveLocked ? "#1a2535" : "#2a7a4a"}`,
                borderRadius: 3,
                color: saveLocked ? "#3c4d63" : "#7ed321",
                padding: "2px 6px",
                cursor: saveLocked ? "not-allowed" : "pointer",
                fontSize: fs(9),
                fontFamily: "monospace",
                marginLeft: 2,
                letterSpacing: 0.5,
              }}
            >💾</button>
            <button
              title={saveLocked ? saveLockReason : "Load latest autosave"}
              onClick={(e) => { e.stopPropagation(); onLoadAutosave(); }}
              disabled={saveLocked}
              style={{
                background: saveLocked ? "#090b11" : "#101a2a",
                border: `1px solid ${saveLocked ? "#1a2535" : "#35537a"}`,
                borderRadius: 3,
                color: saveLocked ? "#3c4d63" : "#6fb4ff",
                padding: "2px 6px",
                cursor: saveLocked ? "not-allowed" : "pointer",
                fontSize: fs(9),
                fontFamily: "monospace",
                marginLeft: 2,
                letterSpacing: 0.5,
              }}
            >⤴</button>
            <button
              title={saveLocked ? saveLockReason : "Export save file"}
              onClick={(e) => { e.stopPropagation(); onExportSave(); }}
              disabled={saveLocked}
              style={{
                background: saveLocked ? "#090b11" : "#1a1408",
                border: `1px solid ${saveLocked ? "#1a2535" : "#7a5f2a"}`,
                borderRadius: 3,
                color: saveLocked ? "#3c4d63" : "#e6c06f",
                padding: "2px 6px",
                cursor: saveLocked ? "not-allowed" : "pointer",
                fontSize: fs(9),
                fontFamily: "monospace",
                marginLeft: 2,
                letterSpacing: 0.5,
              }}
            >⇪</button>
            <button
              title={saveLocked ? saveLockReason : "Import save file"}
              onClick={(e) => { e.stopPropagation(); onImportSave(); }}
              disabled={saveLocked}
              style={{
                background: saveLocked ? "#090b11" : "#111018",
                border: `1px solid ${saveLocked ? "#1a2535" : "#4f3a7a"}`,
                borderRadius: 3,
                color: saveLocked ? "#3c4d63" : "#bb99ff",
                padding: "2px 6px",
                cursor: saveLocked ? "not-allowed" : "pointer",
                fontSize: fs(9),
                fontFamily: "monospace",
                marginLeft: 2,
                letterSpacing: 0.5,
              }}
            >⇩</button>
            <button
              title={saveLocked ? saveLockReason : "Delete autosaves"}
              onClick={(e) => { e.stopPropagation(); onDeleteAutosaves(); }}
              disabled={saveLocked}
              style={{
                background: saveLocked ? "#090b11" : "#1a0d0d",
                border: `1px solid ${saveLocked ? "#1a2535" : "#7a3a3a"}`,
                borderRadius: 3,
                color: saveLocked ? "#3c4d63" : "#ff8e8e",
                padding: "2px 6px",
                cursor: saveLocked ? "not-allowed" : "pointer",
                fontSize: fs(9),
                fontFamily: "monospace",
                marginLeft: 2,
                letterSpacing: 0.5,
              }}
            >⌫</button>
            <button
              title="UI size"
              onClick={(e) => {
                e.stopPropagation();
                const order = ["small", "medium", "large"];
                const next = order[(order.indexOf(uiScale) + 1) % order.length];
                onChangeUiScale && onChangeUiScale(next);
              }}
              style={{
                background: "#0a0f1a",
                border: "1px solid #1e3a5f",
                borderRadius: 3,
                color: "#4ab3f4",
                padding: "2px 7px",
                cursor: "pointer",
                fontSize: fs(10),
                fontFamily: "monospace",
              }}
            >{ { small: "A⁻", medium: "A", large: "A⁺" }[uiScale] }</button>
            <button
              title="Talents - spend Resolve on permanent upgrades"
              onClick={(e) => { e.stopPropagation(); onOpenTalents && onOpenTalents(); }}
              style={{
                background: resolve > 0 ? "#0d1a0d" : "#0a0f1a",
                border: `1px solid ${resolve > 0 ? "#7ed32188" : "#1e3a5f"}`,
                borderRadius: 3,
                color: resolve > 0 ? "#7ed321" : "#3a5a7a",
                padding: "2px 7px",
                cursor: "pointer",
                fontSize: fs(10),
                fontFamily: "monospace",
              }}
            >{"✦"}{resolve > 0 ? ` ${resolve}` : ""}</button>
            {hasResearchLab && (
              <button
                title="Directives - toggle standing colony law"
                onClick={(e) => { e.stopPropagation(); onOpenDirectives && onOpenDirectives(); }}
                style={{
                  background: activeDirectivesCount > 0 ? "#0d1a0d" : "#0a0f1a",
                  border: `1px solid ${activeDirectivesCount > 0 ? "#7ed32188" : "#1e3a5f"}`,
                  borderRadius: 3,
                  color: activeDirectivesCount > 0 ? "#7ed321" : "#3a5a7a",
                  padding: "2px 7px",
                  cursor: "pointer",
                  fontSize: fs(10),
                  fontFamily: "monospace",
                }}
              >{"📋"}{activeDirectivesCount > 0 ? ` ${activeDirectivesCount}` : ""}</button>
            )}
            <button
              title="Field Manual / How to Play"
              onClick={(e) => { e.stopPropagation(); onOpenHelp(); }}
              style={{
                background: "#0a0f1a",
                border: "1px solid #1e3a5f",
                borderRadius: 3,
                color: "#4ab3f4",
                padding: "2px 7px",
                cursor: "pointer",
                fontSize: fs(10),
                fontFamily: "monospace",
                marginLeft: 4,
                letterSpacing: 0.5,
                fontWeight: "bold",
              }}
            >?</button>
            {timescale === 0 && (
              <span style={{ color: "#f5a623", fontSize: fs(8), marginLeft: 3, letterSpacing: 1 }}>PAUSED</span>
            )}
          </div>
        </div>

        {/* Heat meter */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 180 }}>
          <div style={{ fontSize: fs(9), color: raidWindow ? "#ff4444" : heatState.color, letterSpacing: 2, fontWeight: "bold" }}>
            ☢ ARC HEAT: {raidWindow ? `⚠ RAID INCOMING` : heatState.label}
          </div>
          <div style={{ width: "100%", height: 10, background: "#0d1020", borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: raidWindow ? "100%" : `${heatPct}%`,
              background: raidWindow
                ? `repeating-linear-gradient(90deg, #ff2222 0px, #ff4444 8px, #880000 8px, #880000 16px)`
                : `linear-gradient(90deg, #1a5a1a, ${heatState.color})`,
              boxShadow: (raidWindow || heat > 600) ? `0 0 10px #ff4444` : "none",
              transition: raidWindow ? "none" : "width 0.5s, background 0.5s",
            }} />
          </div>
          {raidWindow ? (
            <div style={{ fontSize: fs(8), color: "#ff4444", letterSpacing: 1, fontWeight: "bold" }}>
              {radioTowerOnline
                ? `${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].icon} ${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].label} RAID INCOMING — rolling each tick`
                : "❓ UNKNOWN RAID INCOMING — rolling each tick"}
              {radioTowerOnline && unlockedTechs.includes("barricades") && ` · 🛡 ${Math.round({ small:75, medium:30, large:10 }[RAID_SIZE_ORDER[raidWindow.sizeIdx]])}% block`}
            </div>
          ) : (
            <div style={{ fontSize: fs(8), color: "#2a4a6a" }}>
              {/* Raids roll every RAID_ROLL_EVERY ticks, so surface the odds of
                  being hit at all today rather than a single roll's chance. */}
              {Math.floor(heat)}/1000 · {Math.round((1 - Math.pow(1 - calcRaidChance(heat), 48 / RAID_ROLL_EVERY)) * 100)}% raid chance/day
              {unlockedTechs.includes("barricades") && " · 🛡 Barricades active"}
            </div>
          )}
        </div>

        {/* Morale bar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 160 }}>
          <div style={{ fontSize: fs(9), color: moraleColor, letterSpacing: 2, fontWeight: "bold" }}>
            🧭 MORALE: {moraleTier}
          </div>
          <div onMouseEnter={() => onHoverMorale("morale")} onMouseLeave={() => onHoverMorale(null)}
            style={{ width: "100%", height: 10, background: "#0d1020", borderRadius: 5, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#2a3545", zIndex: 2 }} />
            {morale > 0 && <div style={{ position: "absolute", left: "50%", top: 0, height: "100%", width: `${positivePct}%`, background: `linear-gradient(90deg, #3a7a1a, ${moraleColor})`, borderRadius: "0 4px 4px 0", transition: "width 0.5s" }} />}
            {morale < 0 && <div style={{ position: "absolute", right: "50%", top: 0, height: "100%", width: `${negativePct}%`, background: `linear-gradient(270deg, #7a2020, ${moraleColor})`, borderRadius: "4px 0 0 4px", transition: "width 0.5s" }} />}
          </div>
          <div style={{ fontSize: fs(8), color: moraleColor, fontFamily: "monospace" }}>
            {moraleVal > 0 ? `+${moraleVal}` : moraleVal} / 100
          </div>
        </div>

        {/* Colonists summary */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#0a1520", border: "1px solid #1e3a5f", borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: fs(9), letterSpacing: 1 }}>COLONISTS</div>
            <div style={{ color: "#4ab3f4", fontSize: fs(14), fontWeight: "bold" }}>👤 {totalColonists}/{popCap}</div>
            <div style={{ color: "#456", fontSize: fs(9) }}>FREE: {unassigned}</div>
          </div>
          <button onClick={onRecruit} style={{ background: "#0a2a1a", border: "1px solid #2a7a4a", borderRadius: 6, color: "#7ed321", padding: "8px 12px", cursor: "pointer", fontSize: fs(10), letterSpacing: 1 }}>+ RECRUIT</button>
        </div>
      </div>

      {/* Resources */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ResBar k="energy" icon="⚡" label="Energy" color="#f5a623" res={res} />
        <ResBar k="food"   icon="🌱" label="Food"   color="#7ed321" res={res} />
        <ResBar k="water"  icon="💧" label="Water"  color="#4a90e2" res={res} />
        <ResBar k="scrap"  icon="🔧" label="Scrap"  color="#bd10e0" res={res} />
        {hasResearchLab && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f", border: "1px solid #00e5ff33", borderRadius: 6, padding: "5px 10px", minWidth: 105 }}>
            <span style={{ fontSize: fs(15) }}>🔬</span>
            <div>
              <div style={{ color: "#888", fontSize: fs(9), letterSpacing: 1 }}>RESEARCH</div>
              <div style={{ color: "#00e5ff", fontSize: fs(14), fontWeight: "bold", fontFamily: "monospace" }}>{Math.floor(res.rp)} RP</div>
            </div>
          </div>
        )}
      </div>

      {/* Surface Haul */}
      {(surfaceHaul.salvage > 0 || surfaceHaul.arcTech > 0 || surfaceHaul.schematics.length > 0) && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 14, background: "#0a0c14", border: "1px solid #33334455", borderRadius: 6, padding: "5px 12px", fontSize: fs(9), color: "#8899aa", letterSpacing: 1 }}>
          <span style={{ color: "#556", fontSize: fs(8) }}>SURFACE HAUL:</span>
          {surfaceHaul.salvage > 0    && <span>🔩 SALVAGE: <strong style={{ color: "#c8a060" }}>{surfaceHaul.salvage}</strong></span>}
          {surfaceHaul.arcTech > 0    && <span>⚙️ ARC TECH: <strong style={{ color: "#bb44ff" }}>{surfaceHaul.arcTech}</strong></span>}
          {surfaceHaul.schematics.length > 0 && <span>📋 SCHEMATICS: <strong style={{ color: "#00e5ff" }}>{surfaceHaul.schematics.length}</strong></span>}
        </div>
      )}
    </div>
  );
}
