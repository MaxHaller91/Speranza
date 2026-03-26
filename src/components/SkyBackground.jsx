// SkyBackground.jsx — day/night sky cycle, stars, sun/moon arc
// Props: tick (number)

const SKY_STOPS = [
  { t: 0.00, top: "#020510", bottom: "#020510" },
  { t: 0.18, top: "#060818", bottom: "#0d0f1e" },
  { t: 0.22, top: "#1a0a0a", bottom: "#4a1a08" },
  { t: 0.27, top: "#2a1505", bottom: "#c85020" },
  { t: 0.33, top: "#1a2030", bottom: "#d4601a" },
  { t: 0.42, top: "#0d1828", bottom: "#2a4a6a" },
  { t: 0.50, top: "#0a1520", bottom: "#1a3048" },
  { t: 0.58, top: "#0d1828", bottom: "#2a4a5a" },
  { t: 0.67, top: "#1a1008", bottom: "#c06020" },
  { t: 0.73, top: "#1a0808", bottom: "#601008" },
  { t: 0.80, top: "#080510", bottom: "#120818" },
  { t: 1.00, top: "#020510", bottom: "#020510" },
];

function lerpHex(a, b, t) {
  const ah = a.replace("#", "");
  const bh = b.replace("#", "");
  const ar = parseInt(ah.slice(0, 2), 16), ag = parseInt(ah.slice(2, 4), 16), ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16), bg = parseInt(bh.slice(2, 4), 16), bb = parseInt(bh.slice(4, 6), 16);
  return `#${Math.round(ar + (br - ar) * t).toString(16).padStart(2, "0")}${Math.round(ag + (bg - ag) * t).toString(16).padStart(2, "0")}${Math.round(ab + (bb - ab) * t).toString(16).padStart(2, "0")}`;
}

export default function SkyBackground({ tick }) {
  const dayFraction = (tick % 48) / 48;

  let skyA = SKY_STOPS[0], skyB = SKY_STOPS[1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (dayFraction >= SKY_STOPS[i].t && dayFraction <= SKY_STOPS[i + 1].t) {
      skyA = SKY_STOPS[i]; skyB = SKY_STOPS[i + 1]; break;
    }
  }
  const span = skyB.t - skyA.t;
  const local = span === 0 ? 0 : (dayFraction - skyA.t) / span;
  const skyTop    = lerpHex(skyA.top,    skyB.top,    local);
  const skyBottom = lerpHex(skyA.bottom, skyB.bottom, local);

  const isNight = dayFraction < 0.18 || dayFraction > 0.78;
  const starOpacity = dayFraction < 0.18
    ? 1 - (dayFraction / 0.18)
    : dayFraction > 0.78
    ? (dayFraction - 0.78) / 0.22
    : 0;

  const angle = dayFraction * Math.PI * 2 - Math.PI / 2;
  const isSunVisible  = dayFraction > 0.18 && dayFraction < 0.80;
  const isMoonVisible = dayFraction < 0.20 || dayFraction > 0.76;
  const xPct = 50 + Math.cos(angle) * 42;
  const yPct = 38 + Math.sin(angle) * 32;
  const sunColor = dayFraction < 0.27 ? "#c84010"
    : dayFraction < 0.33 ? "#f5a030"
    : dayFraction < 0.67 ? "#f5d060"
    : dayFraction < 0.73 ? "#f08020"
    : "#c03010";
  const moonAngle = angle + Math.PI;
  const moonX = 50 + Math.cos(moonAngle) * 42;
  const moonY = 38 + Math.sin(moonAngle) * 32;

  return (<>
    {/* Sky gradient */}
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: "55vh",
      background: `linear-gradient(to bottom, ${skyTop} 0%, ${skyBottom} 100%)`,
      zIndex: 0, pointerEvents: "none", transition: "background 2s ease",
    }} />

    {/* Stars */}
    {isNight && (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "45vh",
        zIndex: 0, pointerEvents: "none", opacity: starOpacity, transition: "opacity 3s ease",
      }}>
        {[...Array(40)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 37 + 11) % 100}%`,
            top:  `${(i * 23 + 7)  % 80}%`,
            width:  i % 4 === 0 ? 2 : 1,
            height: i % 4 === 0 ? 2 : 1,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: 0.6 + (i % 3) * 0.2,
            animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite alternate`,
            animationDelay: `${(i * 0.3) % 3}s`,
          }} />
        ))}
      </div>
    )}

    {/* Sun / Moon arc */}
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "45vh", zIndex: 0, pointerEvents: "none" }}>
      {isSunVisible && yPct < 95 && (
        <div style={{
          position: "absolute", left: `${xPct}%`, top: `${yPct}%`,
          transform: "translate(-50%, -50%)",
          width: 22, height: 22, borderRadius: "50%", background: sunColor,
          boxShadow: `0 0 30px 8px ${sunColor}88, 0 0 60px 20px ${sunColor}44`,
          transition: "background 2s ease, box-shadow 2s ease",
        }} />
      )}
      {isMoonVisible && moonY < 95 && moonY > 5 && (
        <div style={{
          position: "absolute", left: `${moonX}%`, top: `${moonY}%`,
          transform: "translate(-50%, -50%)",
          width: 16, height: 16, borderRadius: "50%", background: "#c8d4e0",
          boxShadow: "0 0 16px 4px #c8d4e066, 0 0 30px 10px #c8d4e033",
        }} />
      )}
    </div>

    {/* Fade to dark below */}
    <div style={{
      position: "fixed", top: "40vh", left: 0, right: 0, height: "20vh",
      background: "linear-gradient(to bottom, transparent, #030609)",
      zIndex: 0, pointerEvents: "none",
    }} />

    <style>{`
      @keyframes twinkle {
        from { opacity: 0.2; transform: scale(0.8); }
        to   { opacity: 1;   transform: scale(1.2); }
      }
    `}</style>
  </>);
}
