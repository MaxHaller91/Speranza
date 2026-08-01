// BuildMenu.jsx — build room modal
// Props: res, surfaceHaul, unlockedTechs, mousePos,
//        hoveredBuildKey, onHoverBuildKey, onBuild, onClose
import { ROOM_TYPES, T2_TECHS, fs,} from "../gameData.js";

export default function BuildMenu({ res, surfaceHaul, unlockedTechs, mousePos, hoveredBuildKey, onHoverBuildKey, onBuild, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000099", zIndex: 7600,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "min(620px, 92vw)", maxHeight: "min(620px, 88vh)",
        background: "#080b14", border: "1px solid #1e3a5f", borderRadius: 8,
        padding: 14, display: "flex", flexDirection: "column",
      }}>
        <div style={{ color: "#4ab3f4", fontSize: fs(12), letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>BUILD ROOM</div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))",
          gap: 6, overflowY: "auto", paddingRight: 2,
        }}>
          {Object.entries(ROOM_TYPES).map(([key, def]) => {
            if (def.requiresTech      && !unlockedTechs.includes(def.requiresTech))          return null;
            if (def.requiresSchematic && !surfaceHaul.schematics.includes(def.requiresSchematic)) return null;
            const canAfford = Object.entries(def.cost).every(([r, a]) => {
              if (r === "salvage") return surfaceHaul.salvage >= a;
              if (r === "arcTech") return surfaceHaul.arcTech >= a;
              return res[r] >= a;
            });
            return (
              <button key={key}
                onClick={() => onBuild(key)}
                disabled={!canAfford}
                onMouseEnter={() => onHoverBuildKey(key)}
                onMouseLeave={() => onHoverBuildKey(null)}
                style={{
                  background: canAfford ? def.bg : "#0a0a0a",
                  border: `1px solid ${canAfford ? def.border : "#1a1a1a"}`,
                  borderRadius: 4, padding: "3px",
                  cursor: canAfford ? "pointer" : "not-allowed",
                  color: canAfford ? def.color : "#2a2a2a",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                  aspectRatio: "1 / 1", minHeight: "unset",
                }}>
                <div style={{ fontSize: fs(19), lineHeight: 1 }}>{def.icon}</div>
                <div style={{ fontSize: fs(8), fontWeight: "bold", textAlign: "center", letterSpacing: 0.2, lineHeight: 1.1 }}>
                  {def.label.length > 12 ? `${def.label.slice(0, 12)}…` : def.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {hoveredBuildKey && (() => {
          const def = ROOM_TYPES[hoveredBuildKey];
          if (!def) return null;
          const costStr = Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(" · ") || "Free";
          const canAfford = Object.entries(def.cost).every(([r, a]) => {
            if (r === "salvage") return surfaceHaul.salvage >= a;
            if (r === "arcTech") return surfaceHaul.arcTech >= a;
            return res[r] >= a;
          });
          const reqs = [];
          if (def.requiresTech)      reqs.push(`Tech: ${T2_TECHS[def.requiresTech]?.label ?? def.requiresTech}`);
          if (def.requiresSchematic) reqs.push(`Schematic: ${def.requiresSchematic}`);
          return (
            <div style={{
              position: "fixed",
              left: mousePos.x + 12, top: mousePos.y + 12,
              background: "#0d1020", border: `1px solid ${def.border}55`,
              borderRadius: 6, padding: "7px 9px", fontSize: fs(8),
              zIndex: 9999, pointerEvents: "none", minWidth: 170, maxWidth: 240,
              boxShadow: "0 0 16px #00000088",
            }}>
              <div style={{ color: def.color, fontSize: fs(9), fontWeight: "bold", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                {def.sprite
                  ? <img src={def.sprite} alt={def.label} style={{ width: 52, height: 52, imageRendering: "pixelated", objectFit: "contain" }} />
                  : <div style={{ fontSize: fs(18) }}>{def.icon}</div>
                }
                <span>{def.label}</span>
              </div>
              <div style={{ color: "#8a9aaa", marginBottom: 2 }}>
                Cost: <span style={{ color: canAfford ? "#7ed321" : "#ff7744" }}>{costStr}</span>
              </div>
              <div style={{ color: "#556677", lineHeight: 1.5 }}>{def.desc}</div>
              {reqs.length > 0 && <div style={{ marginTop: 3, color: "#556677" }}>{reqs.join(" · ")}</div>}
            </div>
          );
        })()}

        <button onClick={onClose} style={{
          width: "100%", background: "none", border: "1px solid #1e2a3a",
          borderRadius: 4, color: "#445", padding: 6, cursor: "pointer", fontSize: fs(10), marginTop: 8,
        }}>CANCEL</button>
      </div>
    </div>
  );
}
