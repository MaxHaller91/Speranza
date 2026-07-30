// SidePanel.jsx — right panel: log, colony effects, colonist detail, room panel, memorial
// Props: (see bottom of file for full prop list)
import { ROOM_TYPES, EXPEDITION_TYPES, T2_TECHS, TRAITS, STATUS_COLOR, STATUS_LABEL, tickToDayHour } from "../gameData.js";
import { SURFACE_LOCATIONS } from "../../speranza-lore.js";

export const CAUSE_LABEL = {
  raidKilled: "Killed in raid",
  expeditionKilled: "Killed on expedition",
  raidFled: "Fled during raid",
  starved: "Starved",
  thirst: "Died of thirst",
  moraleDeath: "Left the colony",
};

const RISK_COLOR = {
  LOW: "#7ed321", MEDIUM: "#e8d44d", HIGH: "#ff8800",
  EXTREME: "#ff4444", UNKNOWN: "#bb44ff",
};

/**
 * Turn a destination's roll modifiers into a qualitative sentence. Deliberately
 * no percentages — the player should read intent, not do arithmetic.
 */
function describeHaul(mods = {}) {
  const strong = [];
  const weak   = [];
  const rate = (label, v) => { if (v >= 1.3) strong.push(label); else if (v && v <= 0.75) weak.push(label); };
  rate("scrap", mods.scrapMult);
  rate("salvage", mods.salvageMult);
  rate("Arc tech", mods.arcTechMult);
  const notes = [];
  if (strong.length) notes.push(`Rich in ${strong.join(" & ")}`);
  if (weak.length)   notes.push(`little ${weak.join(" or ")}`);
  if (mods.foodBonus) notes.push("food can be grown here");
  if (mods.survivorChance >= 0.1) notes.push("survivors have been seen");
  if (mods.schematicBonus) notes.push("schematics turn up here");
  if (mods.badMult >= 1.3) notes.push("and it is dangerous");
  else if (mods.badMult && mods.badMult <= 0.75) notes.push("and it is comparatively safe");
  return notes.length ? notes.join(" · ") : "An ordinary run.";
}

export default function SidePanel({
  // display state
  journalOpen, effectsOpen, log,
  surfaceCondition, heatState, heatSuppressedTicks, shelteredCount,
  memorialHallBuilt, hasRadioTower, radioTowerOnline,
  recentDilemmaOutcomes,
  // colonist detail
  selectedColonist, colonists,
  // room panel
  selCell, buildMenu, selected,
  armoryArmed, expeditions, expedDuration, unassigned,
  expedLocationId, expedCrewIds,
  unlockedTechs, res, memorial,
  // callbacks
  onCloseColonist, onAssign, onSetExpedDuration, onLaunchExpedition,
  onSetExpedLocation, onToggleCrew,
  onBackToWork, onSoundAlarm, onRepair, onDemolish, onUnlockTech,
  onCloseRoom,
}) {
  const selCol = colonists.find(c => c.id === selectedColonist);
  const selectedLocation = SURFACE_LOCATIONS.find(l => l.id === expedLocationId) ?? SURFACE_LOCATIONS[0];
  // Tunnel-Blind colonists can't go topside, so they're never offered.
  const eligibleCrew = colonists.filter(c => c.status === "idle" && c.quirk?.id !== "tunnelBlind");
  const maxCrewNeeded = Math.max(...Object.values(EXPEDITION_TYPES).map(d => d.colonistsRequired));

  return (
    <div style={{ width: 205, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>

      {/* Colony Log */}
      {journalOpen && (
        <div style={{ background: "#050710", border: "1px solid #0d1520", borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>COLONY LOG</div>
          <div style={{ fontSize: 8, lineHeight: 1.9, maxHeight: 160, overflowY: "auto" }}>
            {log.map((entry, i) => (
              <div key={i} style={{ color: i === 0 ? "#5a8ab0" : "#2a4060", borderBottom: "1px solid #0d1520", paddingBottom: 2, marginBottom: 2 }}>{entry}</div>
            ))}
          </div>
        </div>
      )}

      {/* Colony Effects */}
      {effectsOpen && (
        <div style={{ background: "#0b0c12", border: "1px solid #2a2414", borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#d4a843", fontSize: 9, letterSpacing: 2, marginBottom: 7 }}>🧪 COLONY EFFECTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 8 }}>
            <div style={{ color: "#8899aa" }}>Surface: <span style={{ color: surfaceCondition.color }}>{surfaceCondition.icon} {surfaceCondition.label}</span></div>
            <div style={{ color: "#556677", fontSize: 7, lineHeight: 1.4 }}>{surfaceCondition.desc}</div>
            <div style={{ color: "#8899aa" }}>Heat State: <span style={{ color: heatState.color }}>{heatState.label}</span></div>
            <div style={{ color: "#8899aa" }}>Heat Suppression: <span style={{ color: heatSuppressedTicks > 0 ? "#7ed321" : "#556" }}>{heatSuppressedTicks}t</span></div>
            <div style={{ color: "#8899aa" }}>Shelter: <span style={{ color: shelteredCount > 0 ? "#7ecfb4" : "#556" }}>{shelteredCount > 0 ? `${shelteredCount} sheltered` : "inactive"}</span></div>
            <div style={{ color: "#8899aa" }}>Memorial Hall: <span style={{ color: memorialHallBuilt ? "#9988bb" : "#556" }}>{memorialHallBuilt ? "active" : "not built"}</span></div>
            <div style={{ color: "#8899aa" }}>Radio Tower: <span style={{ color: hasRadioTower ? (radioTowerOnline ? "#4ab3f4" : "#ff7744") : "#556" }}>{hasRadioTower ? (radioTowerOnline ? "online" : "offline by condition") : "not built"}</span></div>
          </div>
          <div style={{ marginTop: 8, borderTop: "1px solid #1a1d2a", paddingTop: 6 }}>
            <div style={{ color: "#7a6a4a", fontSize: 8, letterSpacing: 1, marginBottom: 4 }}>RECENT DILEMMA OUTCOMES</div>
            {recentDilemmaOutcomes.length === 0 ? (
              <div style={{ color: "#445", fontSize: 8, fontStyle: "italic" }}>No recent outcomes.</div>
            ) : (
              <div style={{ maxHeight: 96, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                {recentDilemmaOutcomes.slice(0, 4).map((outcome) => (
                  <div key={outcome.id} style={{ borderBottom: "1px solid #121522", paddingBottom: 3 }}>
                    <div style={{ color: "#8a9aaa", fontSize: 7 }}>[{tickToDayHour(outcome.tick)}]</div>
                    <div style={{ color: "#b8c8d8", fontSize: 8 }}>{outcome.choice}</div>
                    <div style={{ color: "#556677", fontSize: 7 }}>{outcome.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Colonist Detail */}
      {selCol && (() => {
        const xpInLevel   = (selCol.xp ?? 0) % 20;
        const statusColor = STATUS_COLOR[selCol.status] ?? "#888";
        return (
          <div style={{ background: "#080b14", border: "1px solid #1a2a3a", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 5px ${statusColor}`, flexShrink: 0 }} />
                <div style={{ color: "#c8d0d8", fontSize: 11, fontWeight: "bold", letterSpacing: 1 }}>{selCol.name}</div>
                {(selCol.level ?? 0) > 0 && (
                  <div style={{ color: selCol.level >= 3 ? "#ffd700" : "#aaaaaa", fontSize: 7, background: selCol.level >= 3 ? "#1a1400" : "#111", border: `1px solid ${selCol.level >= 3 ? "#ffd70044" : "#33333344"}`, borderRadius: 3, padding: "1px 4px" }}>LVL {selCol.level}</div>
                )}
              </div>
              <button onClick={onCloseColonist} style={{ background: "none", border: "1px solid #1a2535", borderRadius: 3, color: "#445", padding: "1px 5px", cursor: "pointer", fontSize: 10 }}>✕</button>
            </div>
            <div style={{ color: statusColor, fontSize: 8, letterSpacing: 1, marginBottom: 8 }}>
              {STATUS_LABEL[selCol.status]}{selCol.status === "injured" && selCol.injuryTicksLeft > 0 ? ` — ${selCol.injuryTicksLeft}t to recover` : ""}
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 3 }}>EXPERIENCE — LVL {selCol.level ?? 0}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 5, background: "#1a1a2e", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(xpInLevel / 20) * 100}%`, background: "#2a5a8a", borderRadius: 3, transition: "width 0.4s" }} />
                </div>
                <div style={{ color: "#2a4a6a", fontSize: 7, fontFamily: "monospace" }}>{xpInLevel}/20</div>
              </div>
            </div>
            {selCol.traits?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>TRAITS</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {selCol.traits.map(t => (
                    <div key={t} title={TRAITS[t]?.desc} style={{ fontSize: 8, background: "#0a0a14", border: `1px solid ${TRAITS[t]?.color ?? "#333"}44`, borderRadius: 3, padding: "1px 5px", color: TRAITS[t]?.color ?? "#888" }}>
                      {TRAITS[t]?.icon} {TRAITS[t]?.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selCol.quirk && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>QUIRK</div>
                <div style={{ background: "#0a0a18", border: "1px solid #2a2a5a", borderRadius: 4, padding: "5px 8px" }}>
                  <div style={{ color: "#9988cc", fontSize: 9, marginBottom: 2 }}>{selCol.quirk.icon} {selCol.quirk.label}</div>
                  <div style={{ color: "#556677", fontSize: 7, lineHeight: 1.5 }}>{selCol.quirk.desc}</div>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>BACKGROUND</div>
              <div style={{ color: "#445566", fontSize: 7, lineHeight: 1.6, fontStyle: "italic" }}>{selCol.backstory || "No record."}</div>
            </div>
            <div>
              <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>SERVICE RECORD</div>
              {[
                ["Joined", tickToDayHour(selCol.joinTick ?? 0)],
                ["Expeditions completed", selCol.expeditionsCompleted ?? 0],
                ["Raids survived", selCol.raidsSurvived ?? 0],
                ["Times injured", selCol.injuryCount ?? 0],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: "#445", fontSize: 8 }}>{label}</span>
                  <span style={{ color: "#7a9aaa", fontSize: 8, fontFamily: "monospace" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Room Panel */}
      {selCell?.type && !buildMenu && (
        <div style={{ background: "#080b14", border: `1px solid ${ROOM_TYPES[selCell.type].border}44`, borderRadius: 8, padding: 10 }}>
          <div style={{ color: ROOM_TYPES[selCell.type].color, fontSize: 11, letterSpacing: 1, marginBottom: 3 }}>
            {ROOM_TYPES[selCell.type].icon} {ROOM_TYPES[selCell.type].label.toUpperCase()}
          </div>
          <div style={{ color: "#445", fontSize: 8, marginBottom: selCell.damaged ? 6 : 8 }}>{ROOM_TYPES[selCell.type].desc}</div>

          {selCell.damaged && (
            <div style={{ background: "#1a0000", border: "1px solid #ff4444", borderRadius: 4, padding: "5px 7px", marginBottom: 8 }}>
              <div style={{ color: "#ff4444", fontSize: 8, fontWeight: "bold" }}>⚠ STRUCTURAL DAMAGE</div>
              <div style={{ color: "#884444", fontSize: 7, marginTop: 2 }}>Room offline — not producing. Repair to restore.</div>
            </div>
          )}

          {ROOM_TYPES[selCell.type].cap > 0 && (
            <>
              <div style={{ color: "#667", fontSize: 9, marginBottom: 4 }}>WORKERS: {selCell.workers}/{ROOM_TYPES[selCell.type].cap}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onAssign(selected.r, selected.c, -1)} style={{ flex: 1, background: "#1a0a0a", border: "1px solid #5a2a2a", borderRadius: 4, color: "#c44", padding: 4, cursor: "pointer", fontSize: 14 }}>−</button>
                <button onClick={() => onAssign(selected.r, selected.c,  1)} style={{ flex: 1, background: "#0a1a0a", border: "1px solid #2a5a2a", borderRadius: 4, color: "#4c4", padding: 4, cursor: "pointer", fontSize: 14 }}>+</button>
              </div>
              <div style={{ marginTop: 6, fontSize: 8 }}>
                {Object.entries(ROOM_TYPES[selCell.type].produces).map(([r, a]) => <div key={r} style={{ color: "#4a7a4a" }}>+{a * selCell.workers}/tick {r}</div>)}
                {Object.entries(ROOM_TYPES[selCell.type].consumes).map(([r, a]) => <div key={r} style={{ color: "#7a4a4a" }}>-{a * selCell.workers}/tick {r}</div>)}
              </div>
            </>
          )}

          {/* Armory expedition UI */}
          {selCell.type === "armory" && (
            <div style={{ marginTop: 10 }}>
              {!armoryArmed ? (
                <div style={{ fontSize: 9, color: "#5a3a3a", border: "1px solid #3a1a1a", borderRadius: 4, padding: "6px 8px", textAlign: "center" }}>
                  Assign 1 armorer above to unlock expeditions
                </div>
              ) : (<>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>DURATION</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[20, 40, 60, 80].map(d => (
                      <button key={d} onClick={() => onSetExpedDuration(d)} style={{
                        flex: 1, background: expedDuration === d ? "#2a0008" : "#0a0a0a",
                        border: `1px solid ${expedDuration === d ? "#ff4444" : "#2a1a1a"}`,
                        borderRadius: 3, color: expedDuration === d ? "#ff6666" : "#443344",
                        padding: "3px 0", cursor: "pointer", fontSize: 8, fontFamily: "monospace",
                      }}>{d}t</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 7, color: "#443333", marginTop: 3 }}>~{Math.floor(expedDuration / 8)} scav · ~{Math.floor(expedDuration / 6)} strike rolls</div>
                </div>

                {expeditions.map(exp => {
                  const def = EXPEDITION_TYPES[exp.type];
                  const names = exp.colonistIds.map(id => colonists.find(c => c.id === id)?.name ?? "?").join(" & ");
                  const progressPct = ((exp.duration - exp.ticksLeft) / exp.duration) * 100;
                  const lastEvents  = exp.eventLog.slice(-3);
                  const loot = exp.lootAccumulated;
                  const lootStr = [loot.scrap > 0 && `+${loot.scrap}⚙`, loot.salvage > 0 && `+${loot.salvage}🔩`, loot.arcTech > 0 && `+${loot.arcTech}⚙️`, loot.survivor && "🧍survivor"].filter(Boolean).join(" · ");
                  return (
                    <div key={exp.id} style={{ background: "#0d0008", border: "1px solid #ff444422", borderRadius: 6, padding: 7, marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <div style={{ color: def.color, fontSize: 9, fontWeight: "bold" }}>{def.icon} {def.label}</div>
                        <div style={{ color: "#5a3a3a", fontSize: 8, fontFamily: "monospace" }}>{exp.ticksLeft}t</div>
                      </div>
                      <div style={{ fontSize: 7, color: "#665555", marginBottom: 4 }}>👤 {names}</div>
                      <div style={{ height: 4, background: "#0d1020", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${progressPct}%`, background: def.color, transition: "width 0.4s" }} />
                      </div>
                      {lastEvents.map((evt, i) => <div key={i} style={{ fontSize: 7, color: "#664444", lineHeight: 1.5, fontFamily: "monospace" }}>{evt}</div>)}
                      {lootStr && <div style={{ marginTop: 3, fontSize: 7, color: "#556633" }}>🎒 {lootStr}</div>}
                    </div>
                  );
                })}

                {expeditions.length < 2 ? (
                  <div>
                    {/* ── Destination ── */}
                    <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 5 }}>DESTINATION</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, maxHeight: 132, overflowY: "auto" }}>
                      {SURFACE_LOCATIONS.map(loc => {
                        const sel = expedLocationId === loc.id;
                        return (
                          <button key={loc.id} onClick={() => onSetExpedLocation(loc.id)} title={loc.flavor} style={{
                            display: "flex", alignItems: "center", gap: 5, width: "100%", textAlign: "left",
                            background: sel ? `${loc.color}18` : "#0a0a0e",
                            border: `1px solid ${sel ? loc.color : "#1a1a24"}`,
                            borderRadius: 4, padding: "3px 6px", cursor: "pointer",
                          }}>
                            <span style={{ fontSize: 10 }}>{loc.icon}</span>
                            <span style={{ flex: 1, fontSize: 8, color: sel ? loc.color : "#66707a", letterSpacing: 0.5 }}>{loc.label}</span>
                            <span style={{ fontSize: 6.5, color: RISK_COLOR[loc.risk] ?? "#667" }}>{loc.risk}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedLocation && (
                      <div style={{ fontSize: 7, color: "#4a5560", lineHeight: 1.5, marginBottom: 8, fontStyle: "italic", borderLeft: `2px solid ${selectedLocation.color}55`, paddingLeft: 6 }}>
                        {selectedLocation.flavor}
                        <div style={{ marginTop: 3, fontStyle: "normal", color: "#5a6a55" }}>
                          {describeHaul(selectedLocation.rollMods)}
                        </div>
                      </div>
                    )}

                    {/* ── Crew ── */}
                    <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 5 }}>
                      CREW {expedCrewIds.length > 0 && <span style={{ color: "#5a7a5a" }}>· {expedCrewIds.length} selected</span>}
                    </div>
                    {eligibleCrew.length === 0 ? (
                      <div style={{ fontSize: 8, color: "#5a3a3a", marginBottom: 8 }}>No eligible colonists — free someone from a post.</div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                        {eligibleCrew.map(c => {
                          const sel = expedCrewIds.includes(c.id);
                          return (
                            <button key={c.id}
                              onClick={() => onToggleCrew(c.id, maxCrewNeeded)}
                              title={c.quirk ? `${c.quirk.icon} ${c.quirk.label}` : undefined}
                              style={{
                                fontSize: 8, letterSpacing: 0.5, fontFamily: "monospace",
                                background: sel ? "#0d2a14" : "#0a0a0e",
                                border: `1px solid ${sel ? "#4caf50" : "#22222c"}`,
                                color: sel ? "#7fd08a" : "#66707a",
                                borderRadius: 3, padding: "2px 5px", cursor: "pointer",
                              }}>
                              {sel ? "✓ " : ""}{c.name}
                              {(c.level ?? 0) > 0 && <span style={{ color: "#f5a623" }}> L{c.level}</span>}
                              {c.quirk && <span> {c.quirk.icon}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Launch ── */}
                    <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>LAUNCH</div>
                    {Object.entries(EXPEDITION_TYPES).map(([key, def]) => {
                      const enough = expedCrewIds.length === def.colonistsRequired;
                      const canSend = enough && eligibleCrew.length >= def.colonistsRequired;
                      return (
                        <button key={key} onClick={() => onLaunchExpedition(key)} disabled={!canSend} style={{
                          display: "block", width: "100%", marginBottom: 6,
                          background: canSend ? "#100008" : "#0a0a0a",
                          border: `1px solid ${canSend ? def.color : "#1a1a1a"}`,
                          borderRadius: 5, padding: "7px 8px", cursor: canSend ? "pointer" : "not-allowed", textAlign: "left",
                        }}>
                          <div style={{ fontSize: 11, color: canSend ? def.color : "#333" }}>{def.icon} {def.label}</div>
                          <div style={{ fontSize: 7, color: canSend ? "#556" : "#222", marginTop: 2, lineHeight: 1.4 }}>{def.desc}</div>
                          <div style={{ fontSize: 7, color: canSend ? "#883333" : "#222", marginTop: 3 }}>
                            {canSend
                              ? `${expedCrewIds.length} crew · ${expedDuration}t · heat +${def.threatDelta}`
                              : `needs exactly ${def.colonistsRequired} selected crew`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 8, color: "#5a3a3a", border: "1px solid #3a1a1a", borderRadius: 4, padding: "6px 8px", textAlign: "center" }}>Max 2 expeditions active</div>
                )}
              </>)}
            </div>
          )}

          {/* Hospital */}
          {selCell.type === "hospital" && (() => {
            const injured    = colonists.filter(c => c.status === "injured");
            const nurseCount = selCell.workers;
            const capacity   = nurseCount * 3;
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#ff6b9d", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>PATIENTS — {injured.length} in recovery</div>
                {nurseCount === 0 && injured.length > 0 && (
                  <div style={{ fontSize: 8, color: "#7a4a4a", background: "#1a0008", border: "1px solid #5a2030", borderRadius: 4, padding: "5px 7px", marginBottom: 6 }}>⚠ No nurses assigned — healing at 25% speed</div>
                )}
                {nurseCount > 0 && <div style={{ fontSize: 8, color: "#556", marginBottom: 6 }}>{nurseCount} nurse{nurseCount > 1 ? "s" : ""} · treating up to {capacity} patients</div>}
                {injured.length === 0 ? (
                  <div style={{ fontSize: 8, color: "#334", fontStyle: "italic" }}>No patients currently.</div>
                ) : injured.map(col => (
                  <div key={col.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#100008", border: "1px solid #ff6b9d33", borderRadius: 4, padding: "4px 7px", marginBottom: 4 }}>
                    <div style={{ color: "#c8d0d8", fontSize: 9 }}>{col.name}</div>
                    <div style={{ color: "#ff6b9d", fontSize: 8, fontFamily: "monospace" }}>⚕ {col.injuryTicksLeft ?? 0}t</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Research Lab */}
          {selCell.type === "researchLab" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ color: "#00e5ff", fontSize: 9, letterSpacing: 1 }}>T2 TECHNOLOGIES</div>
                <div style={{ color: "#00e5ff", fontSize: 9, fontFamily: "monospace" }}>{Math.floor(res.rp)} RP</div>
              </div>
              {Object.entries(T2_TECHS).map(([key, tech]) => {
                const unlocked  = unlockedTechs.includes(key);
                const canAfford = res.rp >= tech.cost;
                return (
                  <div key={key} style={{ marginBottom: 6, background: unlocked ? "#001a10" : "#0a0c14", border: `1px solid ${unlocked ? "#00e5ff" : canAfford ? "#00e5ff44" : "#1a2030"}`, borderRadius: 5, padding: "6px 8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div style={{ color: unlocked ? "#00e5ff" : canAfford ? "#aaa" : "#445", fontSize: 10 }}>{tech.icon} {tech.label}</div>
                      {unlocked ? (
                        <div style={{ color: "#00e5ff", fontSize: 8 }}>✓ DONE</div>
                      ) : (
                        <button onClick={() => onUnlockTech(key)} disabled={!canAfford} style={{
                          background: canAfford ? "#003a4a" : "#0a0a0a",
                          border: `1px solid ${canAfford ? "#00e5ff" : "#1a2030"}`,
                          borderRadius: 3, color: canAfford ? "#00e5ff" : "#334",
                          padding: "2px 6px", cursor: canAfford ? "pointer" : "not-allowed", fontSize: 8,
                        }}>{tech.cost} RP</button>
                      )}
                    </div>
                    <div style={{ color: "#334", fontSize: 7, lineHeight: 1.4 }}>{tech.desc}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shelter */}
          {selCell.type === "shelter" && (() => {
            const sheltered = colonists.filter(c => c.status === "sheltered");
            const alarmOn   = sheltered.length > 0;
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#7ecfb4", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>SHELTER STATUS — {sheltered.length} sheltering</div>
                {alarmOn ? (<>
                  <div style={{ background: "#001a0f", border: "1px solid #7ecfb433", borderRadius: 4, padding: "6px 8px", marginBottom: 8 }}>
                    {sheltered.map(col => <div key={col.id} style={{ color: "#7ecfb4", fontSize: 9, paddingBottom: 2 }}>🏠 {col.name}</div>)}
                  </div>
                  <button onClick={onBackToWork} style={{ width: "100%", background: "#001a0f", border: "1px solid #7ecfb4", borderRadius: 4, color: "#7ecfb4", padding: "6px 8px", cursor: "pointer", fontSize: 9, letterSpacing: 1 }}>🏠 BACK TO WORK</button>
                </>) : (<>
                  <div style={{ fontSize: 8, color: "#446655", marginBottom: 6 }}>Sounds the alarm and pulls all idle/working colonists into shelter. Production stops but they cannot be targeted by Arc strikes.</div>
                  <button onClick={onSoundAlarm} style={{ width: "100%", background: "#1a0808", border: "1px solid #ff4444", borderRadius: 4, color: "#ff6666", padding: "6px 8px", cursor: "pointer", fontSize: 9, letterSpacing: 1 }}>🚨 SOUND ALARM</button>
                </>)}
              </div>
            );
          })()}

          {/* Sentry Post */}
          {selCell.type === "sentryPost" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#e8d44d", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>SENTRY STATUS</div>
              <div style={{ background: "#0d0f00", border: "1px solid #e8d44d33", borderRadius: 4, padding: "6px 8px" }}>
                {selCell.workers === 0 ? (
                  <div style={{ color: "#5a5020", fontSize: 8 }}>No sentries assigned.</div>
                ) : (<>
                  <div style={{ color: "#c8d0d8", fontSize: 9 }}>🪖 {selCell.workers} sentry{selCell.workers > 1 ? "ies" : ""} active</div>
                  <div style={{ color: "#e8d44d", fontSize: 8, marginTop: 3 }}>-{Math.min(60, selCell.workers * 18)}% heat gain</div>
                  <div style={{ color: "#5a5020", fontSize: 7, marginTop: 2 }}>Sentries are exposed during raids.</div>
                </>)}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={onCloseRoom} style={{ flex: 1, background: "none", border: "1px solid #1e2a3a", borderRadius: 4, color: "#445", padding: 4, cursor: "pointer", fontSize: 9 }}>CLOSE</button>
            {selCell.damaged && (
              <button onClick={() => onRepair(selected.r, selected.c)} style={{ flex: 1, background: "#001a0a", border: "1px solid #20a040", borderRadius: 4, color: "#4ca060", padding: 4, cursor: "pointer", fontSize: 9 }}>🔧 REPAIR (20 scrap)</button>
            )}
            <button onClick={() => onDemolish(selected.r, selected.c)} style={{ flex: 1, background: "#1a0000", border: "1px solid #5a2020", borderRadius: 4, color: "#844", padding: 4, cursor: "pointer", fontSize: 9 }}>DEMOLISH</button>
          </div>
        </div>
      )}

      {/* Default: memorial or hint */}
      {!selected && (
        <div style={{ background: "#080b14", border: "1px solid #1a2030", borderRadius: 8, padding: 10 }}>
          {memorial.length > 0 ? (<>
            <div style={{ color: "#7a6a4a", fontSize: 9, letterSpacing: 2, marginBottom: 8, borderBottom: "1px solid #2a1a0a", paddingBottom: 6 }}>🕯 MEMORIAL</div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {memorial.map((entry, i) => (
                <div key={entry.id ?? i} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: i < memorial.length - 1 ? "1px solid #1a1a2a" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ color: "#c8d0d8", fontSize: 9, fontWeight: "bold" }}>{entry.name}</span>
                    <span style={{ color: "#555", fontSize: 7 }}>LVL {entry.level}</span>
                  </div>
                  <div style={{ color: "#c87a30", fontSize: 7, letterSpacing: 0.5, marginBottom: 3 }}>
                    {CAUSE_LABEL[entry.cause] ?? "Left the colony"}
                    {" — "}DAY {entry.day} · {entry.hour}
                  </div>
                  <div style={{ color: "#445", fontSize: 7, fontStyle: "italic", lineHeight: 1.5 }}>{entry.epitaph}</div>
                </div>
              ))}
            </div>
          </>) : (
            <div style={{ color: "#2a3a4a", fontSize: 9, textAlign: "center", padding: "10px 0", letterSpacing: 1 }}>Select a cell to build or manage a room</div>
          )}
        </div>
      )}
    </div>
  );
}
