// TraitPicker.jsx — level-up trait selection card
// Props: colonists, onPickTrait
import { TRAITS, TRAIT_KEYS } from "../gameData.js";

export default function TraitPicker({ colonists, onPickTrait }) {
  const pending = colonists.filter(c => c.pendingTraitPick);
  if (pending.length === 0) return null;

  return (<>
    {pending.map(col => (
      <div key={col.id} style={{
        width: "100%", maxWidth: 920, marginBottom: 10,
        background: "#120d00", border: "2px solid #f5a623",
        borderRadius: 8, padding: "12px 16px",
        boxShadow: "0 0 30px #f5a62344",
        position: "relative", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 16 }}>⭐</div>
          <div>
            <div style={{ color: "#f5a623", fontSize: 12, fontWeight: "bold", letterSpacing: 2 }}>
              {col.name} — LEVEL {col.level} REACHED
            </div>
            <div style={{ color: "#7a5a20", fontSize: 8, letterSpacing: 1, marginTop: 2 }}>
              Choose a trait. This is permanent.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TRAIT_KEYS.filter(k => !col.traits.includes(k)).map(traitKey => {
            const trait = TRAITS[traitKey];
            return (
              <button key={traitKey} onClick={() => onPickTrait(col.id, traitKey)} style={{
                flex: "1 1 140px", background: "#0d0900", border: `1px solid ${trait.color}66`,
                borderRadius: 6, padding: "8px 10px", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ color: trait.color, fontSize: 11, fontWeight: "bold", marginBottom: 3 }}>
                  {trait.icon} {trait.label}
                </div>
                <div style={{ color: "#5a5040", fontSize: 8, lineHeight: 1.4 }}>{trait.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </>);
}
