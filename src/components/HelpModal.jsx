// HelpModal.jsx — first-run quickstart guide / field manual
// Opens automatically on first play (localStorage key: speranza_help_seen)
// Reopenable via the ? button in ColonyHeader.
// Props: isOpen, page, onNext, onPrev, onClose

const PAGES = [
  {
    icon: "⛩",
    title: "WELCOME, COMMANDER",
    subtitle: "What is Speranza?",
    bullets: [
      "You command an underground colony beneath an Arc-controlled surface. Your job: keep your people alive and build deeper while the Arc hunts you from above.",
      "Every room you build and every expedition you run raises your Arc threat signature. The Arc doesn't care — until it does.",
      "Use the ⏸ / 1× / 4× timescale buttons at the top to control pace. Pausing is free — use it whenever you need to think.",
    ],
  },
  {
    icon: "🏗",
    title: "BUILD & STAFF YOUR COLONY",
    subtitle: "Resources & Construction",
    bullets: [
      "You have 5 resources: Energy ⚡, Food 🌱, Water 💧, Scrap 🔧, Research Points 🔬. If any runs dry, your colony suffers.",
      "Click any empty underground cell to open the Build Menu. Core chain: Power Cell (10 scrap) → Water Recycler (15) → Hydroponics (20). Rooms do nothing without workers.",
      "Click the worker dots on a room or use +/− in the right panel to assign colonists. Build Barracks (25 scrap, +2 pop cap) to house more people — recruit for 15 food + 15 water.",
      "Excavate the bottom row to unlock more grid space. It costs scrap and ties up colonists while digging.",
    ],
  },
  {
    icon: "☢",
    title: "THE ARC THREAT",
    subtitle: "Heat, Raids & Defense",
    bullets: [
      "The Heat meter has 5 states: UNDETECTED → SCANNING → TARGETED → HUNTED → MARKED. Every room and expedition adds heat. It decays slowly on its own.",
      "When heat peaks, a Raid Window opens — the colony pauses and you enter the surface defense minigame. Place turrets, barricades, and missiles to stop Arc units reaching the hatch.",
      "Raids come in 3 sizes: SMALL (20-tick duration, light waves), MEDIUM (30 ticks, heavier assault), LARGE (60-tick siege with air units — hits 3 rooms per strike if the surface is breached). At MARKED heat, sizes escalate.",
      "Build a Research Lab (45 scrap) to earn RP. Spend it on: Barricades (50 RP, 40% block chance), Sentry Post (75 RP, −5 heat/tick per worker), Radio Tower (75 RP, reveals raid size), Shelter (100 RP, alarm keeps colonists immune from strikes).",
    ],
  },
  {
    icon: "🎒",
    title: "EXPEDITIONS & RESEARCH",
    subtitle: "Going to the Surface",
    bullets: [
      "Build an Armory (40 scrap) and assign at least 1 colonist as an armorer — this unlocks the Expedition panel.",
      "Expeditions return Scrap, Salvage, Arc Tech, and occasionally survivors. Longer expeditions (20–80 ticks) return better loot but carry more risk.",
      "Salvage and Arc Tech unlock advanced buildings not available with scrap alone: Arc Turret 🔫, EMP Array ⚡, Blast Doors 🛡, Geothermal Generator 🌋.",
      "The Hospital (35 scrap) heals injured colonists. 1 nurse treats up to 3 patients — without nurses, healing is 4× slower and injured colonists can't work.",
    ],
  },
  {
    icon: "💡",
    title: "YOUR CREW & SURVIVAL",
    subtitle: "Colonists, Morale & Tips",
    bullets: [
      "Colonists gain XP and level up, letting you pick permanent Traits: VETERAN (never flees raids), GHOST (50% less targeted), SCAVENGER (+50% expedition scrap), IRON LUNGS (heals 2× faster), HARDENED (20% injury chance vs 30%).",
      "Morale matters. Deaths hurt it badly. Raids hurt it. The Tavern and Dining Hall restore it over time. The Memorial Hall cuts morale loss from deaths by 40%.",
      "Keep at least one Power Cell fully staffed — a blackout cripples every room that needs energy (Water, Hydro, Workshop, Armory, Hospital, Research Lab).",
      "Don't let heat reach HUNTED (600+) without defenses ready. Large raids target 3 rooms and can kill colonists in a single strike. Build a Workshop early — it produces scrap passively so construction doesn't stall.",
    ],
  },
];

const TOTAL = PAGES.length;

export default function HelpModal({ isOpen, page, onNext, onPrev, onClose }) {
  if (!isOpen) return null;

  const current = PAGES[page];
  const isLast  = page === TOTAL - 1;
  const isFirst = page === 0;

  const btnBase = {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    padding: "4px 10px",
    background: "#0a0c14",
    border: "1px solid #1a2535",
    color: "#4ab3f4",
    cursor: "pointer",
    borderRadius: 3,
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      zIndex: 9500,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)",
    }}>
      <div style={{
        background: "#080b14",
        border: "2px solid #1e3a5f",
        borderRadius: 10,
        padding: "28px 32px",
        maxWidth: 520,
        width: "90%",
        maxHeight: "85vh",
        overflowY: "auto",
        fontFamily: "monospace",
        boxShadow: "0 0 40px rgba(74,179,244,0.12)",
      }}>

        {/* Page icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 26 }}>{current.icon}</span>
          <div>
            <div style={{ color: "#f5a623", fontSize: 13, letterSpacing: 2, fontWeight: "bold" }}>
              {current.title}
            </div>
            <div style={{ color: "#2a4a6a", fontSize: 8, letterSpacing: 2, marginTop: 2 }}>
              FIELD MANUAL · PAGE {page + 1} / {TOTAL} · {current.subtitle.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #1e3a5f", margin: "12px 0" }} />

        {/* Bullet content */}
        <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "none" }}>
          {current.bullets.map((b, i) => (
            <li key={i} style={{
              color: "#7a9ab4",
              fontSize: 11,
              lineHeight: 1.85,
              marginBottom: 10,
              paddingLeft: 10,
              borderLeft: "2px solid #1e3a5f",
            }}>
              {b}
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #1e3a5f", margin: "16px 0 12px" }} />

        {/* Navigation row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Prev arrow */}
          <button onClick={onPrev} disabled={isFirst} style={{
            ...btnBase,
            opacity: isFirst ? 0.3 : 1,
            cursor: isFirst ? "default" : "pointer",
          }}>◀</button>

          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 5, flex: 1, justifyContent: "center" }}>
            {PAGES.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%",
                background: i === page ? "#4ab3f4" : "#1e3a5f",
                transition: "background 0.2s",
              }} />
            ))}
          </div>

          {/* Next / Begin */}
          {isLast ? (
            <button onClick={onClose} style={{
              ...btnBase,
              background: "rgba(74,179,244,0.12)",
              border: "1px solid #4ab3f4",
              color: "#4ab3f4",
              letterSpacing: 2,
              padding: "4px 14px",
            }}>BEGIN →</button>
          ) : (
            <button onClick={onNext} style={btnBase}>▶</button>
          )}

          {/* Close (always visible) */}
          <button onClick={onClose} style={{
            ...btnBase,
            color: "#3c4d63",
            fontSize: 9,
            marginLeft: 6,
          }}>✕ CLOSE</button>
        </div>

      </div>
    </div>
  );
}
