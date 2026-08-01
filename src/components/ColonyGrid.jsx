// ColonyGrid.jsx — colony grid with locked/unlocked rows and earth mortise overlay
// Props: grid, unlockedRows, excavations, selected, hoveredCell, mousePos, gridMetrics,
//        colonists, hoveredColonist, onCellClick, onStartExcavation, onAssign,
//        onSetHoveredCell, onHoverColonist
import { ROOM_TYPES, EXCAVATION_DEFS, earthTexture, calcAdjacency, fs,} from "../gameData.js";
import ColonistLayer from "./ColonistLayer.jsx";

export default function ColonyGrid({
  grid, unlockedRows, excavations, selected, hoveredCell, mousePos, gridMetrics,
  colonists, hoveredColonist, timescale,
  onCellClick, onStartExcavation, onAssign, onSetHoveredCell, onHoverColonist,
}) {
  return (
    <div style={{ border: "none", boxShadow: "none", borderRadius: 6, overflow: "hidden", background: "transparent", position: "relative" }}>
      {grid.map((row, r) => {
        const isLocked   = !unlockedRows.includes(r);
        const excav      = excavations[r];
        const depthLabel = `${(r + 1) * 10}m`;
        return (
          <div key={r} style={{ display: "flex", position: "relative" }}>
            <div className="depth-col" style={{ width: 28, background: "#07090f", borderRight: "1px solid #0d1020", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(8), color: "#1e3040", flexShrink: 0 }}>
              -{depthLabel}
            </div>

            {isLocked ? (
              /* ── LOCKED ROW ── */
              <div style={{ flex: 1, height: fs(78), background: "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.3)", position: "relative", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px" }}>
                <div style={{ position: "relative", zIndex: 5 }}>
                  <div style={{ color: "#334", fontSize: fs(10), letterSpacing: 1 }}>
                    🔒 &nbsp;-{depthLabel} &nbsp;<span style={{ color: "#222" }}>SEALED — excavation required</span>
                  </div>
                  {excav && (
                    <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 140, height: 6, background: "#0d1020", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${((excav.totalTicks - excav.ticksLeft) / excav.totalTicks) * 100}%`, background: "#a0522d", transition: "width 0.4s" }} />
                      </div>
                      <span style={{ color: "#a0522d", fontSize: fs(8) }}>⛏ {excav.ticksLeft}t</span>
                    </div>
                  )}
                </div>
                {!excav && (() => {
                  const prereqMet = unlockedRows.includes(r - 1);
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartExcavation(r); }}
                      disabled={!prereqMet}
                      title={prereqMet ? `Excavate -${(r+1)*10}m for ${EXCAVATION_DEFS[r]?.scrap} scrap` : "Excavate the level above first"}
                      style={{
                        background: prereqMet ? "#0a0800" : "#060606",
                        border: `1px solid ${prereqMet ? "#a0522d" : "#2a2020"}`,
                        borderRadius: 4, color: prereqMet ? "#a0522d" : "#3a2020",
                        padding: "5px 10px", cursor: prereqMet ? "pointer" : "not-allowed",
                        fontSize: fs(9), letterSpacing: 1, fontFamily: "monospace",
                        position: "relative", zIndex: 15,
                      }}
                    >{prereqMet ? `⛏ DIG (${EXCAVATION_DEFS[r]?.scrap ?? "?"}⚙)` : "🔒 DIG"}</button>
                  );
                })()}
              </div>
            ) : (
              /* ── UNLOCKED ROW ── */
              row.map((cell, c) => {
                const def   = cell.type ? ROOM_TYPES[cell.type] : null;
                const isSel = selected?.r === r && selected?.c === c;
                return (
                  <div className="grid-cell" key={c}
                    onClick={() => onCellClick(r, c)}
                    onMouseEnter={() => def && onSetHoveredCell({ r, c })}
                    onMouseLeave={() => onSetHoveredCell(null)}
                    style={{
                      flex: 1, height: fs(78),
                      border: isSel ? "2px solid #4ab3f4" : `1px solid ${def ? def.border + "33" : "#0d1020"}`,
                      background: def ? def.bg : "transparent",
                      cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      position: "relative", transition: "border-color 0.15s, box-shadow 0.15s",
                      boxShadow: isSel
                        ? `inset 0 0 22px ${def?.color ?? "#4ab3f4"}22, 0 0 8px ${def?.color ?? "#4ab3f4"}33`
                        : (def && hoveredCell?.r === r && hoveredCell?.c === c)
                          ? `inset 0 0 28px ${def.color}28, 0 0 12px ${def.color}44`
                          : def ? `inset 0 0 18px ${def.color}0d` : "none",
                    }}>
                    {/* Hover tooltip */}
                    {def && hoveredCell?.r === r && hoveredCell?.c === c && (
                      <div style={{
                        position: "fixed", left: mousePos.x + 14, top: mousePos.y - 10,
                        background: "#0d1020", border: `1px solid ${def.border}66`,
                        borderRadius: 5, padding: "6px 10px", zIndex: 9999,
                        minWidth: 130, maxWidth: 200, pointerEvents: "none",
                        boxShadow: `0 0 14px #00000099`,
                      }}>
                        <div style={{ color: def.color, fontSize: fs(9), fontWeight: "bold", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          {def.sprite
                            ? <img src={def.sprite} alt={def.label} style={{ width: 52, height: 52, imageRendering: "pixelated", objectFit: "contain" }} />
                            : <div style={{ fontSize: fs(18) }}>{def.icon}</div>
                          }
                          <span>{def.label}</span>
                        </div>
                        {def.cap > 0 && <div style={{ color: "#8899aa", fontSize: fs(8), marginBottom: 2 }}>Workers: {grid[r][c].workers} / {def.cap}</div>}
                        {Object.entries(def.produces).length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 1 }}>
                            {Object.entries(def.produces).map(([res, amt]) => (
                              <span key={res} style={{ color: "#7ed321", fontSize: fs(8) }}>+{amt * Math.max(1, grid[r][c].workers)} {res}/t</span>
                            ))}
                          </div>
                        )}
                        {Object.entries(def.consumes).length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 1 }}>
                            {Object.entries(def.consumes).map(([res, amt]) => (
                              <span key={res} style={{ color: "#ff7755", fontSize: fs(8) }}>-{amt * Math.max(1, grid[r][c].workers)} {res}/t</span>
                            ))}
                          </div>
                        )}
                        {/* Adjacency — the reason column placement matters */}
                        {(() => {
                          const adj = calcAdjacency(grid, r, c);
                          if (adj.notes.length === 0) return null;
                          return (
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #1a2030" }}>
                              {adj.notes.map((n, i) => (
                                <div key={i} style={{ color: n.good ? "#7ed321" : "#ff7755", fontSize: fs(7.5), lineHeight: 1.5 }}>
                                  {n.good ? "▲" : "▼"} {n.text}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {grid[r][c].damaged && <div style={{ color: "#ff8800", fontSize: fs(8), marginTop: 3 }}>⚠ DAMAGED — repair: 20 scrap</div>}
                        {def.special === "hospital"   && grid[r][c].workers > 0 && <div style={{ color: "#ff6b9d", fontSize: fs(8), marginTop: 2 }}>Treating up to {grid[r][c].workers * 3} patients</div>}
                        {def.special === "sentryPost" && <div style={{ color: "#e8d44d", fontSize: fs(8), marginTop: 2 }}>-{Math.min(60, grid[r][c].workers * 18)}% heat gain</div>}
                        {!def.cap && !def.produces && <div style={{ color: "#556", fontSize: fs(8) }}>{def.desc}</div>}
                      </div>
                    )}

                    {def ? (
                      <>
                        {def.sprite ? (
                          <>
                            <img src={def.sprite} alt={def.label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated", objectFit: "cover", objectPosition: "center" }} />
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.75))", padding: "6px 4px 3px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ fontSize: fs(8), color: def.color, fontWeight: "bold", letterSpacing: 0.5, textShadow: "0 1px 3px #000" }}>{def.label}</div>
                              {def.cap > 0 && (
                                <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                                  {Array.from({ length: def.cap }).map((_, i) => {
                                    const filled = i < cell.workers;
                                    return (
                                      <div key={i}
                                        onClick={(e) => { e.stopPropagation(); onAssign(r, c, filled ? -1 : 1); }}
                                        title={filled ? "Remove worker" : "Assign worker"}
                                        style={{
                                          width: 9, height: 9, borderRadius: "50%",
                                          background: filled ? def.color : "#1a1a2e",
                                          border: `1px solid ${def.color}${filled ? "cc" : "44"}`,
                                          cursor: "pointer", transition: "background 0.12s, box-shadow 0.12s",
                                          boxShadow: filled ? `0 0 5px ${def.color}88` : "none",
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 7px ${def.color}cc`; e.currentTarget.style.background = filled ? def.color : def.color + "44"; }}
                                        onMouseLeave={e => { e.currentTarget.style.boxShadow = filled ? `0 0 5px ${def.color}88` : "none"; e.currentTarget.style.background = filled ? def.color : "#1a1a2e"; }}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: fs(20) }}>{def.icon}</div>
                            <div style={{ fontSize: fs(8), color: def.color, fontWeight: "bold", letterSpacing: 0.5 }}>{def.label}</div>
                            {def.cap > 0 && (
                              <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                                {Array.from({ length: def.cap }).map((_, i) => {
                                  const filled = i < cell.workers;
                                  return (
                                    <div key={i}
                                      onClick={(e) => { e.stopPropagation(); onAssign(r, c, filled ? -1 : 1); }}
                                      title={filled ? "Remove worker" : "Assign worker"}
                                      style={{
                                        width: 9, height: 9, borderRadius: "50%",
                                        background: filled ? def.color : "#1a1a2e",
                                        border: `1px solid ${def.color}${filled ? "cc" : "44"}`,
                                        cursor: "pointer", transition: "background 0.12s, box-shadow 0.12s",
                                        boxShadow: filled ? `0 0 5px ${def.color}88` : "none",
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 7px ${def.color}cc`; e.currentTarget.style.background = filled ? def.color : def.color + "44"; }}
                                      onMouseLeave={e => { e.currentTarget.style.boxShadow = filled ? `0 0 5px ${def.color}88` : "none"; e.currentTarget.style.background = filled ? def.color : "#1a1a2e"; }}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                        {cell.damaged && (
                          <div style={{ position: "absolute", inset: 0, background: "#ff000018", border: "2px solid #ff4444", pointerEvents: "none", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 3 }}>
                            <span style={{ fontSize: fs(10) }}>⚠</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: "#151e2a", fontSize: fs(16) }}>+</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      {/* Earth mortise SVG overlay */}
      {(() => {
        const CELL_W = gridMetrics.cellW;
        const CELL_H = gridMetrics.cellH;
        const DEPTH_COL = gridMetrics.depthCol;
        const INSET = 5;
        const COLS = 7;
        const ROWS = 4;
        const EXCAVATED = Math.max(0, Math.min(ROWS, unlockedRows.length));
        const W = DEPTH_COL + COLS * CELL_W;
        const H = ROWS * CELL_H;

        const outer = `M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`;
        const holes = [];
        for (let row = 0; row < EXCAVATED; row++) {
          for (let col = 0; col < COLS; col++) {
            const x = DEPTH_COL + col * CELL_W + INSET;
            const y = row * CELL_H + INSET;
            const w = CELL_W - INSET * 2;
            const h = CELL_H - INSET * 2;
            const rx = 3;
            holes.push(
              `M ${x+rx} ${y} L ${x+w-rx} ${y} Q ${x+w} ${y} ${x+w} ${y+rx} ` +
              `L ${x+w} ${y+h-rx} Q ${x+w} ${y+h} ${x+w-rx} ${y+h} ` +
              `L ${x+rx} ${y+h} Q ${x} ${y+h} ${x} ${y+h-rx} ` +
              `L ${x} ${y+rx} Q ${x} ${y} ${x+rx} ${y} Z`
            );
          }
        }
        const fullPath = [outer, ...holes].join(' ');
        return (
          <svg style={{ position: "absolute", top: 0, left: 0, width: W, height: H, zIndex: 2, pointerEvents: "none" }} viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <pattern id="earthPat" x="0" y="0" width={W} height={H} patternUnits="userSpaceOnUse">
                <image href={earthTexture} x="0" y="-30" width={W} height={H + 60} preserveAspectRatio="xMidYMid slice" />
                <rect width={W} height={H} fill="#000000" opacity="0.45" />
              </pattern>
            </defs>
            <path d={fullPath} fill="url(#earthPat)" fillRule="evenodd" />
            {Array.from({ length: EXCAVATED }).map((_, row) =>
              Array.from({ length: COLS }).map((_, col) => {
                const x = DEPTH_COL + col * CELL_W + INSET;
                const y = row * CELL_H + INSET;
                const w = CELL_W - INSET * 2;
                const h = CELL_H - INSET * 2;
                return <rect key={`${col}-${row}`} x={x} y={y} width={w} height={h} fill="none" stroke="#000000" strokeWidth={14} strokeOpacity={0.6} rx={3} />;
              })
            )}
          </svg>
        );
      })()}

      {/* Colonists — drawn above the earth overlay, transparent to clicks */}
      <ColonistLayer
        colonists={colonists}
        grid={grid}
        unlockedRows={unlockedRows}
        excavations={excavations}
        gridMetrics={gridMetrics}
        mousePos={mousePos}
        hoveredColonist={hoveredColonist}
        onHoverColonist={onHoverColonist}
        timescale={timescale}
      />
    </div>
  );
}
