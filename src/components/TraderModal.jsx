// TraderModal.jsx — a trader has arrived and is offering a swap.
//
// Props-only, following DilemmaModal. It does NOT touch the clock:
// `activeTrader` is a pause reason in Speranza.jsx. See "Pause ownership".
import { canAffordOffer, fs,} from "../gameData.js";

export default function TraderModal({ trader, res, surfaceHaul, onAccept, onDecline }) {
  if (!trader) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(2,4,8,0.86)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        width: "100%", maxWidth: 470,
        background: "#0b0a06", border: "1px solid #6a5a2a", borderRadius: 8,
        padding: "18px 20px", boxShadow: "0 0 34px #c8a04422",
      }}>
        <div style={{ color: "#7a6a3a", fontSize: fs(8), letterSpacing: 2, marginBottom: 5 }}>
          TRADER AT THE HATCH · {trader.ticksLeft} TICKS
        </div>
        <div style={{ color: "#e0b050", fontSize: fs(15), fontWeight: "bold", letterSpacing: 2 }}>
          {trader.name}
        </div>
        <div style={{ color: "#7a6a4a", fontSize: fs(9), lineHeight: 1.6, margin: "7px 0 14px", fontStyle: "italic" }}>
          {trader.line}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {trader.offers.map(offer => {
            const afford = canAffordOffer(offer, { res, surfaceHaul });
            return (
              <button
                key={offer.id}
                onClick={() => afford && onAccept(offer)}
                disabled={!afford}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 5,
                  background: afford ? "#12100a" : "#0a0a08",
                  border: `1px solid ${afford ? "#6a5a2a" : "#241f14"}`,
                  cursor: afford ? "pointer" : "not-allowed",
                  fontFamily: "'Courier New', monospace",
                }}
              >
                <div style={{ color: afford ? "#e0b050" : "#4a4436", fontSize: fs(11), fontWeight: "bold" }}>
                  {offer.label}
                </div>
                <div style={{ color: afford ? "#8a7a5a" : "#3e3a30", fontSize: fs(9), marginTop: 3 }}>
                  {offer.desc}{afford ? "" : " — you cannot afford this"}
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={onDecline} style={{
          width: "100%", marginTop: 12, background: "#0a0c14",
          border: "1px solid #2a3040", borderRadius: 6, color: "#6a7a8a",
          padding: "9px", cursor: "pointer", fontSize: fs(10), letterSpacing: 2,
          fontFamily: "'Courier New', monospace",
        }}>SEND THEM AWAY</button>
      </div>
    </div>
  );
}
