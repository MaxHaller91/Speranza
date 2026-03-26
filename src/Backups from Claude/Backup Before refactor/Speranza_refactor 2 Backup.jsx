import { useState, useEffect, useCallback, useRef } from "react";
import {
  startMusic, setMusicVolume, getMusicVolume,
  playBuild, playRaid, playInjury, playKill,
  playSuccess, playAlert, playExpedition,
  playUiClick, playLevelUp, playRaidOver,
  playAssign, playUnassign, playMilestone,
  playDilemma, playDilemmaResolve,
  playDemolish, playRepair, playRecruit,
  playShelterAlarm, playSurfaceCondition,
  playStructuralDamage, playBarricadesHold,
  playTurret, playEMP,
  duckMusic, unduckMusic, playTickAlarm,
} from "./sounds.js";
import {
  BACKSTORIES, QUIRKS, SURFACE_CONDITIONS,
  DILEMMA_EVENTS, EXPEDITION_FLAVOR,
  SURFACE_LOCATIONS, ARTIFACT_TEMPLATES, ARTIFACT_ITEMS,
  COMMANDER_NAMES, COMMANDER_WEAKNESSES, COMMANDER_STRENGTHS,
  TRADERS, DIRECTIVES,
  MILESTONES, EPITAPHS,
} from "../speranza-lore.js";
import {
  TICK_MS, MAX_RES,
  HEAT_MAX, HEAT_BASE_GAIN, HEAT_GAIN_PER_ROOM, HEAT_DECAY_PER_TICK,
  HEAT_RAID_GAIN, HEAT_SENTRY_REDUCTION, HEAT_RAID_PROB_BASE, HEAT_RAID_PROB_SCALE,
  getHeatState, INJURY_TICKS_BASE, HEAL_RATE_NURSE,
  RAID_SIZES, RAID_SIZE_ORDER, RAID_LAUNCH_CHANCE,
  T2_TECHS, TRAITS, TRAIT_KEYS,
  makeColonist, ROOM_TYPES, EXCAVATION_DEFS,
  EXPEDITION_TYPES, EXPEDITION_ROLL_TABLES, applyMoraleModifier,
  DRAIN_PER_COL, clamp, EMPTY_STAT_BREAKDOWN,
  weightedTargetPick, initColonists, initGrid, INIT_RES,
  STATUS_COLOR, STATUS_LABEL, tickToDayHour, checkMilestoneTrigger,
  earthTexture,
} from "./gameData.js";
import SurfaceDefense from './surface_defense';
import SkyBackground   from './components/SkyBackground.jsx';
import RaidBanner      from './components/RaidBanner.jsx';
import GameOverModal   from './components/GameOverModal.jsx';
import DilemmaModal    from './components/DilemmaModal.jsx';
import TraitPicker     from './components/TraitPicker.jsx';
import BuildMenu       from './components/BuildMenu.jsx';
import ToastPanel      from './components/ToastPanel.jsx';

export default function Speranza() {
  const [grid,       setGrid]       = useState(initGrid);
  const [res,        setRes]        = useState(INIT_RES);
  const [colonists,  setColonists]  = useState(initColonists); // array of colonist objects
  const [heat,       setHeat]       = useState(0);
  const [expeditions,  setExpeditions]  = useState([]);
  const [expedDuration, setExpedDuration] = useState(40);
  const [selected,   setSelected]   = useState(null);
  const [buildMenu,  setBuildMenu]  = useState(false);
  const [hoveredBuildKey, setHoveredBuildKey] = useState(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [netFlow,    setNetFlow]    = useState({ energy: 0, food: 0, water: 0, scrap: 0 });
  const [rosterOpen, setRosterOpen] = useState(true);
  const [log,        setLog]        = useState([
    "Speranza colony initialized.",
    "Workshop and Power Cell online.",
    "Arc threat detected on surface.",
  ]);
  const [tick,       setTick]       = useState(0);
  const [gameOver,   setGameOver]   = useState(null);
  const [raidFlash,  setRaidFlash]  = useState(false);
  const [surfaceDefenseActive, setSurfaceDefenseActive] = useState(false);
  const [pendingRaidSize, setPendingRaidSize] = useState(null);
  const [toasts,     setToasts]     = useState([]);
  // raidWindow: null | { sizeIdx: 0|1|2, escalations: number }
  // sizeIdx indexes into RAID_SIZE_ORDER
  const [raidWindow,    setRaidWindow]    = useState(null);
  const [unlockedTechs, setUnlockedTechs] = useState([]);
  // 0 = paused, otherwise multiplier applied to TICK_MS
  const TIMESCALES = [0, 0.5, 1, 2, 4, 10];
  const [timescale,   setTimescale]   = useState(1);
  const [musicVolume, setMusicVolumeState] = useState(() => Math.round(getMusicVolume() * 100));
  // activeRaid: null | { sizeKey, ticksLeft, strikeCountdown }
  const [activeRaid,  setActiveRaid]  = useState(null);
  // Pass 1 new state
  const [morale,        setMorale]        = useState(50);
  const [unlockedRows,  setUnlockedRows]  = useState([0]);
  const [surfaceHaul,   setSurfaceHaul]   = useState({ salvage: 0, arcTech: 0, schematics: [] });
  const [excavations,   setExcavations]   = useState({});
  // Session A additions
  const [memorial,           setMemorial]           = useState([]);
  const [firedMilestones,    setFiredMilestones]    = useState([]);
  const [milestoneToast,     setMilestoneToast]     = useState(null);
  const [hoveredCell,        setHoveredCell]        = useState(null);
  const [hoveredColonist,    setHoveredColonist]    = useState(null);
  const [hoveredFlowStat,    setHoveredFlowStat]    = useState(null);
  const [mousePos,           setMousePos]           = useState({ x: 0, y: 0 });
  const [gridMetrics,        setGridMetrics]        = useState({ cellW: 96, cellH: 78, depthCol: 28, surfaceBarH: 24 });
  const [statBreakdown, setStatBreakdown] = useState({
    energy: { ...EMPTY_STAT_BREAKDOWN },
    food: { ...EMPTY_STAT_BREAKDOWN },
    water: { ...EMPTY_STAT_BREAKDOWN },
    morale: { ...EMPTY_STAT_BREAKDOWN },
  });
  const [selectedColonist,   setSelectedColonist]   = useState(null);
  const [raidsRepelled,      setRaidsRepelled]      = useState(0);
  const [largeRaidsRepelled, setLargeRaidsRepelled] = useState(0);
  const [expeditionsCompleted, setExpeditionsCompleted] = useState(0);
  // Session B additions
  const [surfaceCondition,      setSurfaceCondition]      = useState(SURFACE_CONDITIONS[0]); // starts as CLEAR
  const [surfaceConditionTimer, setSurfaceConditionTimer] = useState(0);
  const [peakPopulation,        setPeakPopulation]        = useState(3);
  const [activeDilemma,         setActiveDilemma]         = useState(null);
  const [dilemmaTimer,          setDilemmaTimer]          = useState(0);
  const [firedDilemmas,         setFiredDilemmas]         = useState([]);
  const [recentDilemmaOutcomes, setRecentDilemmaOutcomes] = useState([]);
  const [historyLog,            setHistoryLog]            = useState([]);
  const [heatSuppressedTicks,   setHeatSuppressedTicks]   = useState(0);

  // ── Derived ───────────────────────────────────────────────────────────────
  // These are computed from colonists array — no separate state needed
  const idleColonists  = colonists.filter(c => c.status === "idle");
  const unassigned     = idleColonists.length;
  const totalColonists = colonists.length;

  const calcPopCap = (g) => {
    let cap = 3;
    g.forEach(row => row.forEach(cell => { if (cell.type === "barracks") cap += 2; }));
    return cap;
  };
  const popCap = calcPopCap(grid);

  // ── Refs — tick loop reads these ──────────────────────────────────────────
  const gridRef           = useRef(grid);
  const colonistsRef      = useRef(colonists);
  const expeditionsRef    = useRef(expeditions);
  const gameOverRef       = useRef(gameOver);
  const raidWindowRef     = useRef(raidWindow);
  const unlockedTechsRef  = useRef(unlockedTechs);
  const timescaleRef      = useRef(timescale);
  const tickRef           = useRef(tick);
  useEffect(() => { gridRef.current          = grid;          }, [grid]);
  useEffect(() => { colonistsRef.current     = colonists;     }, [colonists]);
  useEffect(() => { expeditionsRef.current   = expeditions;   }, [expeditions]);
  useEffect(() => { gameOverRef.current      = gameOver;      }, [gameOver]);
  useEffect(() => { raidWindowRef.current    = raidWindow;    }, [raidWindow]);
  useEffect(() => { unlockedTechsRef.current = unlockedTechs; }, [unlockedTechs]);
  const activeRaidRef     = useRef(activeRaid);
  useEffect(() => { timescaleRef.current     = timescale;     }, [timescale]);
  useEffect(() => { tickRef.current          = tick;          }, [tick]);
  useEffect(() => { activeRaidRef.current    = activeRaid;    }, [activeRaid]);
  const moraleRef       = useRef(morale);
  const unlockedRowsRef = useRef(unlockedRows);
  const surfaceHaulRef  = useRef(surfaceHaul);
  const excavationsRef  = useRef(excavations);
  useEffect(() => { moraleRef.current       = morale;       }, [morale]);
  useEffect(() => { unlockedRowsRef.current = unlockedRows; }, [unlockedRows]);
  useEffect(() => { surfaceHaulRef.current  = surfaceHaul;  }, [surfaceHaul]);
  useEffect(() => { excavationsRef.current  = excavations;  }, [excavations]);
  // Session A refs
  const memorialRef           = useRef(memorial);
  const firedMilestonesRef    = useRef(firedMilestones);
  const raidsRepelledRef      = useRef(raidsRepelled);
  const largeRaidsRepelledRef = useRef(largeRaidsRepelled);
  const expeditionsCompletedRef = useRef(expeditionsCompleted);
  useEffect(() => { memorialRef.current             = memorial;            }, [memorial]);
  useEffect(() => { firedMilestonesRef.current      = firedMilestones;     }, [firedMilestones]);
  useEffect(() => { raidsRepelledRef.current        = raidsRepelled;       }, [raidsRepelled]);
  useEffect(() => { largeRaidsRepelledRef.current   = largeRaidsRepelled;  }, [largeRaidsRepelled]);
  useEffect(() => { expeditionsCompletedRef.current = expeditionsCompleted;}, [expeditionsCompleted]);
  // Session B refs
  const surfaceConditionRef = useRef(surfaceCondition);
  const heatRef             = useRef(heat);
  const firedDilemmasRef    = useRef(firedDilemmas);
  const heatSuppressedTicksRef = useRef(heatSuppressedTicks);
  const raidSuppressedThisRaidRef = useRef(0);
  useEffect(() => { surfaceConditionRef.current = surfaceCondition; }, [surfaceCondition]);
  useEffect(() => { heatRef.current             = heat;             }, [heat]);
  useEffect(() => { firedDilemmasRef.current    = firedDilemmas;    }, [firedDilemmas]);
  useEffect(() => { heatSuppressedTicksRef.current = heatSuppressedTicks; }, [heatSuppressedTicks]);

  // ── Track mouse position for tooltips ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // ── Track measured grid layout for mortise overlay alignment ───────────
  useEffect(() => {
    const measureGridMetrics = () => {
      const cellEl = document.querySelector(".grid-cell");
      const depthEl = document.querySelector(".depth-col");
      const surfaceBarEl = document.querySelector(".surface-bar");
      if (!cellEl || !depthEl || !surfaceBarEl) return;

      const next = {
        cellW: cellEl.offsetWidth || 96,
        cellH: cellEl.offsetHeight || 78,
        depthCol: depthEl.offsetWidth || 28,
        surfaceBarH: surfaceBarEl.offsetHeight || 24,
      };

      setGridMetrics(prev => (
        prev.cellW === next.cellW &&
        prev.cellH === next.cellH &&
        prev.depthCol === next.depthCol &&
        prev.surfaceBarH === next.surfaceBarH
      ) ? prev : next);
    };

    const rafId = window.requestAnimationFrame(measureGridMetrics);
    window.addEventListener("resize", measureGridMetrics);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measureGridMetrics);
    };
  }, [unlockedRows.length]);

  // ── Audio: start music on first interaction ───────────────────────────────
  const handleFirstInteraction = useCallback(() => {
    startMusic();
  }, []);

  const handleMusicVolumeChange = useCallback((e) => {
    const next = Number(e.target.value);
    setMusicVolumeState(next);
    setMusicVolume(next / 100);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [`[${tickToDayHour(tickRef.current)}] ${msg}`, ...prev.slice(0, 29)]);
  }, []);

  const timescaleBeforeToastRef = useRef(1); // stores timescale to restore after toasts clear
  const forcedPauseByOverlayRef = useRef(false);
  const toastDedupeRef = useRef(new Map());

  const addToast = useCallback((message, type = "info", opts = {}) => {
    const dedupeKey = opts.key ?? `${type}:${message}`;
    const dedupeMs = opts.dedupeMs ?? 1200;
    const now = Date.now();
    const last = toastDedupeRef.current.get(dedupeKey);
    if (last && now - last < dedupeMs) return;
    toastDedupeRef.current.set(dedupeKey, now);

    if (toastDedupeRef.current.size > 200) {
      for (const [k, t] of toastDedupeRef.current.entries()) {
        if (now - t > 60000) toastDedupeRef.current.delete(k);
      }
    }

    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-dismiss after 10s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000);
  }, []);

  useEffect(() => {
    const buildMenuOpen = !!(buildMenu && selected && grid[selected.r]?.[selected.c] && !grid[selected.r][selected.c].type);
    const traitPickerOpen = colonists.some(c => c.pendingTraitPick);
    const popupActive =
      traitPickerOpen ||
      !!gameOver ||
      !!activeDilemma ||
      buildMenuOpen ||
      !!milestoneToast ||
      journalOpen ||
      effectsOpen;

    if (popupActive) {
      if (!forcedPauseByOverlayRef.current && timescale !== 0) {
        timescaleBeforeToastRef.current = timescale;
      }
      forcedPauseByOverlayRef.current = true;
      if (timescale !== 0) setTimescale(0);
    } else if (forcedPauseByOverlayRef.current) {
      forcedPauseByOverlayRef.current = false;
      setTimescale(timescaleBeforeToastRef.current || 1);
    }
  }, [buildMenu, selected, grid, colonists, gameOver, activeDilemma, milestoneToast, toasts.length, journalOpen, effectsOpen, timescale]);

  const changeMorale = useCallback((delta, reason) => {
    setMorale(prev => clamp(prev + delta, -100, 100));
    moraleEventDeltasRef.current.push({ delta, reason: reason ?? "morale event" });
    if (Math.abs(delta) >= 10) addLog(`${delta > 0 ? "📈" : "📉"} Morale ${delta > 0 ? "+" : ""}${delta} — ${reason}`);
  }, []);
  const changeMoraleRef = useRef(changeMorale);
  const moraleEventDeltasRef = useRef([]);
  useEffect(() => { changeMoraleRef.current = changeMorale; }, [changeMorale]);

  // ── Memorial helper ───────────────────────────────────────────────────────
  const addToMemorial = useCallback((colonist, cause, currentTick) => {
    const pool = EPITAPHS[cause] ?? EPITAPHS.raidKilled;
    const epitaph = pool[Math.floor(Math.random() * pool.length)];
    const entry = {
      id:        colonist.id,
      name:      colonist.name,
      level:     colonist.level ?? 0,
      traits:    colonist.traits ?? [],
      cause,
      day:       Math.floor(currentTick / 48) + 1,
      hour:      (() => {
        const h = Math.floor((currentTick % 48) / 2);
        const m = (currentTick % 2 === 1) ? "30" : "00";
        return `${String(h).padStart(2,"0")}:${m}`;
      })(),
      epitaph,
    };
    setMemorial(prev => {
      if (prev.length === 0) addHistoryRef.current("💀", `First loss: ${entry.name}`);
      return [entry, ...prev];
    });
  }, []);
  const addToMemorialRef = useRef(addToMemorial);
  useEffect(() => { addToMemorialRef.current = addToMemorial; }, [addToMemorial]);

  // Memorial Hall passive: checks grid for built memorial
  const hasMemorialHall = () => gridRef.current.some(row => row.some(cell => cell.type === "memorial"));

  // History log — records key colony events for the game-over timeline
  const addHistory = useCallback((icon, text) => {
    setHistoryLog(prev => [...prev, { tick: tickRef.current, day: Math.floor(tickRef.current / 48) + 1, icon, text }]);
  }, []);
  const addHistoryRef = useRef(addHistory);
  useEffect(() => { addHistoryRef.current = addHistory; }, [addHistory]);

  // ── Milestone checker ─────────────────────────────────────────────────────
  const checkMilestones = useCallback((snap) => {
    for (const m of MILESTONES) {
      if (firedMilestonesRef.current.includes(m.id)) continue;
      if (checkMilestoneTrigger(m.trigger, snap)) {
        setFiredMilestones(prev => [...prev, m.id]);
        setMilestoneToast({ title: m.title, text: m.text });
        changeMoraleRef.current(5, `milestone: ${m.title}`);
        addHistoryRef.current("⭐", m.title);
        playMilestone();
        break;
      }
    }
  }, []);
  const checkMilestonesRef = useRef(checkMilestones);
  useEffect(() => { checkMilestonesRef.current = checkMilestones; }, [checkMilestones]);

  // ── Main tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timescale === 0) return; // paused — no interval
    const interval = setInterval(() => {
      if (gameOverRef.current) return;

      const g    = gridRef.current;
      const cols = colonistsRef.current;
      const totalCol = cols.length;
      let resourceBreakdownSnapshot = {
        energy: { ...EMPTY_STAT_BREAKDOWN },
        food: { ...EMPTY_STAT_BREAKDOWN },
        water: { ...EMPTY_STAT_BREAKDOWN },
      };
      const moraleTickBreakdown = { plus: [], minus: [], net: 0 };

      // 0. Passive morale ────────────────────────────────────────────────────
      {
        let moraleWorkers = 0;
        g.forEach(row => row.forEach(cell => {
          if ((cell.type === "tavern" || cell.type === "diningHall") && cell.workers > 0) {
            moraleWorkers += cell.workers;
          }
        }));
        const moraleDrain    = Math.max(0, totalCol - 7) * 0.3;
        const moraleGain     = moraleWorkers * 1.5;
        const netMoraleDelta = moraleGain - moraleDrain;
        if (moraleGain > 0) moraleTickBreakdown.plus.push(`Comfort services staffed +${moraleGain.toFixed(1)}`);
        if (moraleDrain > 0) moraleTickBreakdown.minus.push(`Crowding strain -${moraleDrain.toFixed(1)}`);
        moraleTickBreakdown.net += netMoraleDelta;
        setMorale(prev => clamp(prev + netMoraleDelta, -100, 100));
        const veteranCount = cols.filter(c => c.traits?.includes("veteran")).length;
        if (veteranCount > 0) {
          const veteranBonus = veteranCount * 0.1;
          moraleTickBreakdown.plus.push(`Veteran confidence +${veteranBonus.toFixed(1)}`);
          moraleTickBreakdown.net += veteranBonus;
          setMorale(prev => clamp(prev + veteranBonus, -100, 100));
        }
        // Quirk passive morale effects
        let quirkMoraleDelta = 0;
        cols.forEach(c => {
          if (!c.quirk) return;
          if (c.quirk.id === "lightSleeper" && c.status !== "injured") quirkMoraleDelta += 0.1;
          if (c.quirk.id === "claustrophobic") quirkMoraleDelta -= 0.1;
        });
        if (quirkMoraleDelta > 0) moraleTickBreakdown.plus.push(`Helpful quirk effects +${quirkMoraleDelta.toFixed(1)}`);
        if (quirkMoraleDelta < 0) moraleTickBreakdown.minus.push(`Stressful quirk effects ${quirkMoraleDelta.toFixed(1)}`);
        if (quirkMoraleDelta !== 0) {
          moraleTickBreakdown.net += quirkMoraleDelta;
          setMorale(prev => clamp(prev + quirkMoraleDelta, -100, 100));
        }
      }

      // 1. Resource production ───────────────────────────────────────────────
      setRes(prev => {
        const next = { ...prev };
        const flow = { energy: 0, food: 0, water: 0, scrap: 0, rp: 0 };
        const statReasons = {
          energy: { plus: [], minus: [], net: 0 },
          food: { plus: [], minus: [], net: 0 },
          water: { plus: [], minus: [], net: 0 },
        };
        const pushReason = (stat, delta, reason) => {
          if (!statReasons[stat] || delta === 0) return;
          if (delta > 0) statReasons[stat].plus.push(`${reason} +${delta.toFixed(1)}`);
          if (delta < 0) statReasons[stat].minus.push(`${reason} ${delta.toFixed(1)}`);
          statReasons[stat].net += delta;
        };

        g.forEach(row => row.forEach(cell => {
          if (!cell.type || !cell.workers) return;
          const def = ROOM_TYPES[cell.type];
          if (def.special === "barracks" || def.special === "armory" || def.special === "tavern" || def.special === "diningHall" ||
              def.special === "arcTurret" || def.special === "empArray" || def.special === "blastDoors" || def.special === "geothermal") return;
          if (cell.damaged) return; // damaged rooms don't produce

          let canRun = true;
          for (const [r, amt] of Object.entries(def.consumes)) {
            if (next[r] < amt * cell.workers) { canRun = false; break; }
          }
          if (!canRun) return;

          for (const [r, amt] of Object.entries(def.consumes)) {
            next[r] = clamp(next[r] - amt * cell.workers, 0, MAX_RES);
            flow[r] -= amt * cell.workers;
            if (r === "energy" || r === "food" || r === "water") pushReason(r, -(amt * cell.workers), `${def.label} upkeep`);
          }
          for (const [r, amt] of Object.entries(def.produces)) {
            next[r] = clamp(next[r] + amt * cell.workers, 0, MAX_RES);
            flow[r] += amt * cell.workers;
            if (r === "energy" || r === "food" || r === "water") pushReason(r, amt * cell.workers, `${def.label} output`);
          }
        }));

        // Armory energy drain
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "armory" && cell.workers > 0) {
            next.energy = clamp(next.energy - 1, 0, MAX_RES);
            flow.energy -= 1;
            pushReason("energy", -1, "Armory operation");
          }
        }));

        // Tavern + Dining Hall resource consumption
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "tavern" && cell.workers > 0) {
            next.water  = clamp(next.water  - 1 * cell.workers, 0, MAX_RES);
            next.energy = clamp(next.energy - 1 * cell.workers, 0, MAX_RES);
            flow.water  -= 1 * cell.workers;
            flow.energy -= 1 * cell.workers;
            pushReason("water", -(1 * cell.workers), "Tavern operation");
            pushReason("energy", -(1 * cell.workers), "Tavern operation");
          }
          if (cell.type === "diningHall" && cell.workers > 0) {
            next.food   = clamp(next.food   - 2 * cell.workers, 0, MAX_RES);
            next.energy = clamp(next.energy - 1 * cell.workers, 0, MAX_RES);
            flow.food   -= 2 * cell.workers;
            flow.energy -= 1 * cell.workers;
            pushReason("food", -(2 * cell.workers), "Dining Hall operation");
            pushReason("energy", -(1 * cell.workers), "Dining Hall operation");
          }
        }));

        // T3 Building energy costs + geothermal passive production (Pass 6)
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "arcTurret" && !cell.damaged) {
            next.energy = clamp(next.energy - 2, 0, MAX_RES);
            flow.energy -= 2;
            pushReason("energy", -2, "Arc Turret drain");
          }
          if (cell.type === "empArray" && cell.workers > 0 && !cell.damaged) {
            next.energy = clamp(next.energy - 3 * cell.workers, 0, MAX_RES);
            flow.energy -= 3 * cell.workers;
            pushReason("energy", -(3 * cell.workers), "EMP Array drain");
          }
          if (cell.type === "geothermal" && !cell.damaged) {
            next.energy = clamp(next.energy + 6, 0, MAX_RES);
            flow.energy += 6;
            pushReason("energy", 6, "Geothermal generation");
          }
        }));

        // Colonist upkeep — based on total headcount, ironStomach quirk reduces food/water
        const condFoodMult = surfaceConditionRef.current.effects.foodDrainMult ?? 1.0;
        for (const [r, amt] of Object.entries(DRAIN_PER_COL)) {
          let drain = 0;
          cols.forEach(c => {
            let mult = (c.quirk?.id === "ironStomach" && (r === "food" || r === "water")) ? 0.7 : 1.0;
            if (r === "food") mult *= condFoodMult;
            drain += amt * mult;
          });
          next[r]  = clamp(next[r] - drain, 0, MAX_RES);
          flow[r] -= drain;
          if (r === "energy" || r === "food" || r === "water") pushReason(r, -drain, "Colony upkeep");
        }

        // Morale production bonus — morale > 75 gives +10% of positive flow
        if (moraleRef.current > 75) {
          for (const [r, val] of Object.entries(flow)) {
            if (val > 0) next[r] = clamp(next[r] + val * 0.1, 0, MAX_RES);
            if (val > 0 && (r === "energy" || r === "food" || r === "water")) pushReason(r, val * 0.1, "High-morale efficiency");
          }
        }

        setNetFlow(flow);
        resourceBreakdownSnapshot = statReasons;
        if (next.food <= 0 && next.water <= 0) {
          const currentTick = tickRef.current;
          const daysAlive = Math.floor(currentTick / 48) + 1;
          setGameOver({
            reason: "No food or water — colony collapsed.",
            daysAlive,
            tick: currentTick,
            raidsRepelled: raidsRepelledRef.current,
            casualties: memorialRef.current,
            peakPop: peakPopulation,
          });
        }
        return next;
      });

      // 2. Heat buildup + probabilistic raid trigger ──────────────────────────
      const builtRooms     = g.flatMap(row => row).filter(cell => cell.type).length;
      const condThreatMult = surfaceConditionRef.current.effects.threatMult ?? 1.0;
      const rw             = raidWindowRef.current;
      const ar             = activeRaidRef.current;
      const heatGainSuppressed = heatSuppressedTicksRef.current > 0;

      if (rw) {
        // ── Raid window is open — roll each tick to launch or escalate ──────
        if (Math.random() < RAID_LAUNCH_CHANCE) {
          const sizeKey  = RAID_SIZE_ORDER[rw.sizeIdx];
          const sizeDef  = RAID_SIZES[sizeKey];
          const barricadesActive = unlockedTechsRef.current.includes("barricades");
          const blockChance = { small: 0.75, medium: 0.30, large: 0.10 }[sizeKey] ?? 0;
          if (barricadesActive && Math.random() < blockChance) {
            const repairCost = 15;
            addLog(`🛡 BARRICADES HELD — ${sizeDef.label} raid repelled! (${repairCost} scrap to repair)`);
            addToast(`🛡 BARRICADES HELD\n${sizeDef.label} raid repelled.\n-${repairCost} scrap for repairs.`, "success", { key: `barricades-held-${sizeKey}` });
            setRes(prev => ({ ...prev, scrap: Math.max(0, prev.scrap - repairCost) }));
            setRaidFlash(true);
            setTimeout(() => setRaidFlash(false), 500);
            setRaidWindow(null);
            setHeat(prev => clamp(prev - 40, 0, HEAT_MAX)); // barricade block slightly lowers heat
            changeMoraleRef.current(10, "barricades held");
            playBarricadesHold();
          } else {
            setSurfaceDefenseActive(true);
            setPendingRaidSize(sizeKey);
            setTimescale(1);
            raidSuppressedThisRaidRef.current = 0;
            setActiveRaid({ sizeKey, ticksLeft: sizeDef.duration, strikeCountdown: sizeDef.strikeEvery });
            setRaidWindow(null);
            setHeat(prev => clamp(prev + (heatGainSuppressed ? 0 : HEAT_RAID_GAIN), 0, HEAT_MAX)); // raid starting raises heat
            duckMusic();
            playRaid();
            setRaidFlash(true);
            setTimeout(() => setRaidFlash(false), 800);
            addLog(`⚔ ${sizeDef.icon} ${sizeDef.label} RAID UNDERWAY — ${sizeDef.duration} ticks! First strike in ${sizeDef.strikeEvery}.`);
            addToast(`⚔ ${sizeDef.label} RAID IN PROGRESS\nArc forces breaching the perimeter.\nFirst strike in ${sizeDef.strikeEvery} ticks.`, "raid", { key: `raid-start-${sizeKey}` });
          }
        } else {
          const nextSizeIdx = Math.min(rw.sizeIdx + 1, RAID_SIZE_ORDER.length - 1);
          const escalated   = nextSizeIdx > rw.sizeIdx;
          if (escalated) {
            const newLabel = RAID_SIZES[RAID_SIZE_ORDER[nextSizeIdx]].label;
            addLog(`⚠ Arc forces regrouping — raid escalated to ${newLabel}!`);
            addToast(`⚠ RAID ESCALATING\nArc forces regrouped.\nIncoming raid is now ${newLabel}.`, "injury", { key: `raid-escalating-${newLabel}` });
          }
          setRaidWindow({ sizeIdx: nextSizeIdx, escalations: rw.escalations + 1 });
        }

      } else if (!ar) {
        // ── No active raid — update heat, then roll for raid trigger ──────────
        let sentryCount = 0;
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "sentryPost") sentryCount += cell.workers;
        }));
        setHeat(prev => {
          const gain    = heatGainSuppressed ? 0 : (HEAT_BASE_GAIN + builtRooms * HEAT_GAIN_PER_ROOM) * condThreatMult;
          const sentry  = sentryCount * HEAT_SENTRY_REDUCTION;
          const next    = clamp(prev + gain - HEAT_DECAY_PER_TICK - sentry, 0, HEAT_MAX);
          // Probability-based raid trigger
          const raidChance = HEAT_RAID_PROB_BASE + (next / HEAT_MAX) * HEAT_RAID_PROB_SCALE;
          const condRaidMult = surfaceConditionRef.current.effects.raidFreqMult ?? 1.0;
          if (tickRef.current % 48 === 0 && Math.random() < raidChance * condRaidMult) {
            // Determine starting size based on heat state
            const hState = getHeatState(next);
            let sizeIdx = 0;
            if (hState.label === "TARGETED" || hState.label === "HUNTED") sizeIdx = 1;
            if (hState.label === "MARKED") sizeIdx = Math.random() < 0.4 ? 2 : 1;
            setRaidWindow({ sizeIdx, escalations: 0 });
            const hLabel = hState.label;
            addLog(`☢ ${hLabel === "MARKED" ? "⚠ MARKED — " : ""}Arc forces detected — raid incoming!`);
            const sensitives = cols.filter(c => c.quirk?.id === "arcSensitive");
            if (sensitives.length > 0 && Math.random() < 0.2) {
              const warnCol = sensitives[Math.floor(Math.random() * sensitives.length)];
              addLog(`🔮 ${warnCol.name}'s instincts are firing. Something is coming.`);
            }
            addToast(`☢ ARC HEAT: ${hLabel}\nRaid incoming — stay alert.`, "injury", { key: `heat-raid-incoming-${hLabel}` });
          }
          return next;
        });
      }

      // 2b. Active raid countdown + periodic strikes ────────────────────────
      const arNow = activeRaidRef.current;
      if (arNow) {
        const sizeDef          = RAID_SIZES[arNow.sizeKey];
        const newStrikeCD      = arNow.strikeCountdown - 1;
        let armoryWorkers = 0;
        g.forEach(row => row.forEach(cell => {
          if (cell.type === "armory") armoryWorkers += cell.workers;
        }));
        let suppressedUnits = 0;
        for (let i = 0; i < armoryWorkers; i++) {
          if (Math.random() < 0.12) suppressedUnits += 1;
        }
        if (suppressedUnits > 0) {
          raidSuppressedThisRaidRef.current += suppressedUnits;
          addLog(`⚔ Colony defenders pushed back — ${suppressedUnits} Arc unit(s) suppressed.`);
        }
        const newTicksLeft     = Math.max(0, arNow.ticksLeft - 1 - (suppressedUnits * 2));

        // Pre-strike tick sound (5 ticks before strike)
        if (newStrikeCD === 5) playTickAlarm();

        // Track EMP strike delay bonus (Pass 6) — must be declared outside the if-block
        let strikeDelayBonus = 0;

        // Strike fires this tick
        if (newStrikeCD <= 0 && newTicksLeft > 0) {
          const memBonus = hasMemorialHall() ? 2 : 0; // memorial reduces raid strike morale loss by 2
          changeMoraleRef.current(-3 + memBonus, "raid strike landed");
          // T3 Defenses: Arc Turret + EMP Array (Pass 6)
          let raidSizeReduction = 0;
          g.forEach(row => row.forEach(cell => {
            if (cell.type === "arcTurret" && !cell.damaged) {
              if (Math.random() < 0.30) {
                raidSizeReduction++;
                playTurret();
              }
            }
            if (cell.type === "empArray" && cell.workers > 0 && !cell.damaged) {
              if (Math.random() < 0.50) {
                raidSizeReduction++;
                strikeDelayBonus += 3;
                playEMP();
              }
            }
          }));
          if (raidSizeReduction > 0) {
            addLog(`🔫 Defenses active — ${raidSizeReduction} Arc unit(s) eliminated!`);
            addToast(`🔫 DEFENSES ACTIVE\n${raidSizeReduction} Arc unit(s) eliminated.`, "success", { key: "defenses-active" });
          }
          const effectiveSizeDef = { ...sizeDef, targets: Math.max(1, sizeDef.targets - raidSizeReduction) };
          const atRisk = cols.filter(c => c.status === "working" || c.status === "onSentry" || c.status === "idle");
          const targets = weightedTargetPick(atRisk, g, effectiveSizeDef); // Pass 5+6: row-weighted + T3
          if (targets.length === 0) {
            addLog(`💢 ${sizeDef.icon} ARC STRIKE — no exposed workers. Colony holds!`);
            addToast(`💢 ${sizeDef.label} STRIKE\nNo workers exposed — held the line.`, "raid");
          } else {
            targets.forEach(target => {
              setGrid(prev => {
                const ng = prev.map(row => row.map(c => ({ ...c })));
                const staffed = [];
                ng.forEach((row, r) => row.forEach((cell, c) => {
                  if (cell.type && cell.workers > 0) staffed.push({ r, c });
                }));
                if (staffed.length > 0) {
                  const room = staffed[Math.floor(Math.random() * staffed.length)];
                  ng[room.r][room.c].workers = Math.max(0, ng[room.r][room.c].workers - 1);
                }
                return ng;
              });
              const roll = Math.random();
              // HARDENED: injury window shrinks from 30% to 20% (0.50–0.70 instead of 0.50–0.80)
              const injureThreshold = target.traits?.includes("hardened") ? 0.70 : 0.80;
              // Quirk: steadyHands — kills become injuries, injuries become flee
              const isParanoid     = target.quirk?.id === "paranoid";
              const isSteadyHands  = target.quirk?.id === "steadyHands";
              if (roll < 0.50) {
                // VETERAN or PARANOID: holds post — never flees
                if (target.traits?.includes("veteran") || isParanoid) {
                  addLog(`  → ${target.name} held their post — ${isParanoid ? "too stubborn to run" : "veteran resolve"}.`);
                } else if (isSteadyHands) {
                  // steadyHands: flee → close call, just log it
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} barely made it out.`);
                  changeMoraleRef.current(-2, "close call");
                } else {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "idle" } : c));
                  addToMemorialRef.current(target, "raidFled", tickRef.current);
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} fled their post!`);
                  addToast(`💢 ${sizeDef.label} STRIKE\n${target.name} fled — shaken but alive.`, "raid");
                  changeMoraleRef.current(-5, "colonist fled");
                }
              } else if (roll < injureThreshold) {
                // steadyHands: injury → flee instead
                if (isSteadyHands) {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "idle" } : c));
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} retreated (steady hands).`);
                  changeMoraleRef.current(-3, "retreat");
                } else {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "injured", injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 } : c));
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} was INJURED!`);
                  addToast(`💢 ${sizeDef.label} STRIKE — CASUALTY\n${target.name} is injured.`, "injury");
                  playInjury();
                  changeMoraleRef.current(-10, "colonist injured in raid");
                }
              } else {
                // steadyHands: kill → injury instead
                if (isSteadyHands) {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "injured", injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 } : c));
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} badly wounded (steady hands saved them).`);
                  addToast(`💢 ${sizeDef.label} STRIKE\n${target.name} severely injured — but alive.`, "injury");
                  playInjury();
                  changeMoraleRef.current(-12, "severe injury");
                } else {
                  setColonists(prev => prev.filter(c => c.id !== target.id));
                  addToMemorialRef.current(target, "raidKilled", tickRef.current);
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} was KILLED.`);
                  addToast(`💢 ${sizeDef.label} STRIKE — KIA\n${target.name} did not make it.`, "raid");
                  playKill();
                  const killPenalty = hasMemorialHall() ? -12 : -20;
                  changeMoraleRef.current(killPenalty, "colonist killed");
                }
              }
            });
          }
          // Building damage chance per strike
          const dmgChance = { small: 0, medium: 0.10, large: 0.25 }[arNow.sizeKey] ?? 0;
          if (dmgChance > 0 && Math.random() < dmgChance) {
            // Pass 5: row-weighted building damage — row 0 (surface) 4× more likely than row 3
            const weightedRooms = [];
            g.forEach((row, ri) => row.forEach((cell, ci) => {
              if (cell.type && !cell.damaged) {
                const w = [4, 3, 2, 1][ri] ?? 1;
                for (let i = 0; i < w; i++) weightedRooms.push({ r: ri, c: ci, type: cell.type });
              }
            }));
            if (weightedRooms.length > 0) {
              const dmgTarget = weightedRooms[Math.floor(Math.random() * weightedRooms.length)];
              // Pass 6: Blast Doors — 40% chance to absorb damage targeting row 0
              const hasBlastDoors = g.some(row => row.some(cell => cell.type === "blastDoors" && !cell.damaged));
              if (dmgTarget.r === 0 && hasBlastDoors && Math.random() < 0.40) {
                addLog(`🛡 Blast Doors absorbed structural damage on row 0!`);
              } else {
                setGrid(prev => {
                  const ng = prev.map(row => row.map(c => ({ ...c })));
                  ng[dmgTarget.r][dmgTarget.c].damaged = true;
                  return ng;
                });
                addLog(`💥 ${ROOM_TYPES[dmgTarget.type].label} took structural damage!`);
                addToast(`💥 STRUCTURAL DAMAGE\n${ROOM_TYPES[dmgTarget.type].label} damaged.\nRepair costs 20 scrap.`, "injury", { key: `structural-damage-${dmgTarget.type}` });
                playStructuralDamage();
              }
            }
          }
          setRaidFlash(true);
          setTimeout(() => setRaidFlash(false), 500);
        }

        // End raid or continue
        if (newTicksLeft <= 0) {
          setActiveRaid(null);
          setColonists(prev => prev.map(c => ({ ...c, raidsSurvived: (c.raidsSurvived ?? 0) + 1 })));
          setHeat(prev => clamp(prev - 30, 0, HEAT_MAX)); // raid ending reduces heat slightly
          unduckMusic();
          addLog(`✅ ${sizeDef.label} raid repelled — Arc forces withdrew.`);
          addToast(`✅ RAID OVER\n${sizeDef.label} Arc forces withdrew.\nThreat level reset.`, "success", { key: `raid-over-${sizeDef.label}` });
          playRaidOver();
          changeMoraleRef.current(8, "raid survived");
          if (raidSuppressedThisRaidRef.current > 0) {
            changeMoraleRef.current(2, "defenders held the line");
            addLog(`🛡 Defenders' stand lifted spirits (+2 morale).`);
            if (Math.random() < 0.03) {
              setSurfaceHaul(prev => ({ ...prev, arcTech: prev.arcTech + 1 }));
              addLog("⚙ Rare Arc cache seized from retreating forces (+1 Arc Tech).");
              addToast("⚙ DEFENDER BONUS\nRare Arc cache seized.\n+1 Arc Tech", "success", { key: `raid-bonus-${tickRef.current}` });
            }
          }
          raidSuppressedThisRaidRef.current = 0;
          setRaidsRepelled(prev => {
            const n = prev + 1;
            raidsRepelledRef.current = n;
            if (n === 1) addHistoryRef.current("⚔", "First raid repelled");
            return n;
          });
          if (arNow.sizeKey === "large") {
            setLargeRaidsRepelled(prev => { const n = prev + 1; largeRaidsRepelledRef.current = n; return n; });
            addHistoryRef.current("⚔", `Large raid repelled`);
          }
          // milestone check snapshot
          checkMilestonesRef.current({
            raidsRepelled:        raidsRepelledRef.current,
            largeRaidsRepelled:   largeRaidsRepelledRef.current,
            totalDeaths:          memorialRef.current.length,
            expeditionsCompleted: expeditionsCompletedRef.current,
            population:           colonistsRef.current.length,
            day:                  Math.floor(tickRef.current / 48) + 1,
            morale:               moraleRef.current,
            schematics:           surfaceHaulRef.current.schematics.length,
            t3Built:              0,
          });
        } else {
          setActiveRaid({
            ...arNow,
            ticksLeft: newTicksLeft,
            strikeCountdown: (newStrikeCD <= 0 ? sizeDef.strikeEvery : newStrikeCD) + strikeDelayBonus,
          });
        }
      }

      // 3. Expedition rolls ──────────────────────────────────────────────────
      setExpeditions(prev => prev.map(exp => {
        let updated = { ...exp, ticksLeft: exp.ticksLeft - 1, rollCountdown: exp.rollCountdown - 1 };

        if (updated.rollCountdown <= 0 && updated.ticksLeft > 0) {
          const expColonists = colonistsRef.current.filter(c => exp.colonistIds.includes(c.id));
          let table = [...EXPEDITION_ROLL_TABLES[exp.type]];
          table = applyMoraleModifier(table, exp.moraleSnapshot);
          const condEffects = exp.conditionSnapshot?.effects ?? {};
          const expedGoodMult = condEffects.expedGoodMult ?? 1.0;
          const expedBadMult  = condEffects.expedBadMult ?? 1.0;
          table = table.map(e => ({
            ...e,
            weight: e.type === "good" ? e.weight * expedGoodMult
                  : e.type === "bad"  ? e.weight * expedBadMult
                  : e.weight,
          }));
          expColonists.forEach(col => {
            if (col.traits?.includes("scavenger") && exp.type === "scav") {
              table = table.map(e => ({ ...e, weight: e.type === "good" ? e.weight * 1.15 : e.weight }));
            }
            if (col.traits?.includes("ghost")) {
              table = table.map(e => ({ ...e, weight: e.type === "bad" ? e.weight * 0.9 : e.weight }));
            }
          });
          // surfaceBorn quirk: +20% good weight
          if (exp.quirkBonuses?.surfaceBorn) {
            table = table.map(e => ({ ...e, weight: e.type === "good" ? e.weight * 1.2 : e.weight }));
          }

          const totalWeight = table.reduce((s, e) => s + e.weight, 0);
          let rand = Math.random() * totalWeight;
          let picked = table[table.length - 1];
          for (const entry of table) { rand -= entry.weight; if (rand <= 0) { picked = entry; break; } }

          const result = picked.apply(exp);
          const tickLabel = `[T${tickRef.current}]`;
          // Expedition radio chatter — prefix to log entries unless expedSilent
          const getChatter = (outcomeType) => {
            if (surfaceConditionRef.current.effects.expedSilent) return "";
            const pool = EXPEDITION_FLAVOR[exp.type]?.[outcomeType];
            if (!pool || pool.length === 0) return "";
            return pool[Math.floor(Math.random() * pool.length)] + " ";
          };

          if (result === "injure" || result === "kill") {
            const target = expColonists.length > 0 ? expColonists[Math.floor(Math.random() * expColonists.length)] : null;
            if (target) {
              if (result === "injure") {
                setColonists(p => p.map(c => c.id === target.id ? { ...c, status: "injured", injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 } : c));
                updated.eventLog = [...updated.eventLog, `${tickLabel} ${getChatter("bad")}${target.name} ${picked.label}.`];
                changeMoraleRef.current(-10, "colonist injured on expedition");
                playInjury();
              } else {
                setColonists(p => p.filter(c => c.id !== target.id));
                addToMemorialRef.current(target, "expeditionKilled", tickRef.current);
                updated.eventLog = [...updated.eventLog, `${tickLabel} ${getChatter("bad")}${target.name} ${picked.label}.`];
                const expKillPenalty = hasMemorialHall() ? -12 : -20;
                changeMoraleRef.current(expKillPenalty, "colonist killed on expedition");
                playKill();
              }
            }
          } else if (typeof result === "object") {
            const newLoot = { ...updated.lootAccumulated };
            if (result.scrap)    { newLoot.scrap    = (newLoot.scrap    || 0) + result.scrap + (exp.quirkBonuses?.packRat ? 1 : 0); }
            if (result.salvage)  { newLoot.salvage  = (newLoot.salvage  || 0) + result.salvage + (exp.quirkBonuses?.packRat ? 1 : 0); }
            if (result.arcTech)  { newLoot.arcTech  = (newLoot.arcTech  || 0) + result.arcTech; }
            if (result.survivor) { newLoot.survivor = true; }
            if (result.schematic) {
              const allSchematics = ["turretSchematics","empSchematics","fortSchematics","geoSchematics","researchSchematics"];
              const owned = surfaceHaulRef.current.schematics;
              const available = allSchematics.filter(s => !owned.includes(s));
              if (available.length > 0) {
                const found = available[Math.floor(Math.random() * available.length)];
                newLoot.schematicFound = found;
                updated.eventLog = [...updated.eventLog, `${tickLabel} 📋 SCHEMATIC FOUND — ${found}!`];
                addToast(`📋 SCHEMATIC RECOVERED\n${found}\nCheck the build menu.`, "success");
              }
            }
            updated.lootAccumulated = newLoot;
            if (picked.type !== "neutral") {
              updated.eventLog = [...updated.eventLog, `${tickLabel} ${getChatter(picked.type)}${picked.label}.`];
            } else {
              updated.eventLog = [...updated.eventLog, `${tickLabel} ${getChatter("neutral")}${picked.label}.`];
            }
          }
          updated.rollCountdown = exp.rollEvery;
        }

        if (updated.ticksLeft <= 0) {
          const loot = updated.lootAccumulated;
          if (loot.scrap)   setRes(p => ({ ...p, scrap: clamp(p.scrap + loot.scrap, 0, MAX_RES) }));
          if (loot.salvage || loot.arcTech || loot.schematicFound) {
            setSurfaceHaul(p => ({
              salvage:    p.salvage + (loot.salvage  || 0),
              arcTech:    p.arcTech + (loot.arcTech  || 0),
              schematics: loot.schematicFound ? [...p.schematics, loot.schematicFound] : p.schematics,
            }));
          }
          if (loot.survivor) {
            const newCol = makeColonist(tickRef.current);
            setColonists(p => [...p, newCol]);
            addLog(`🧍 Surface survivor found — ${newCol.name} joined the colony!`);
          }
          setColonists(p => p.map(c => updated.colonistIds.includes(c.id)
            ? { ...c, status: "idle", expeditionsCompleted: (c.expeditionsCompleted ?? 0) + 1 }
            : c
          ));
          const hasGoodLoot = (loot.scrap || 0) > 0 || (loot.salvage || 0) > 0 || (loot.arcTech || 0) > 0;
          addLog(`✅ Expedition returned. ${hasGoodLoot ? `+${loot.scrap || 0} scrap${loot.salvage ? ` · +${loot.salvage} salvage` : ""}${loot.arcTech ? ` · +${loot.arcTech} arcTech` : ""}` : "Empty-handed."}`);
          addToast(`✅ EXPEDITION COMPLETE\n${hasGoodLoot ? "Resources recovered." : "They came back empty-handed."}`, hasGoodLoot ? "success" : "info");
          const baseMoraleChange = hasGoodLoot ? 8 : -5;
          const loudmouthBonus = (updated.quirkBonuses?.loudmouth && hasGoodLoot) ? 5 : 0;
          changeMoraleRef.current(baseMoraleChange + loudmouthBonus, hasGoodLoot ? "expedition success" : "expedition failed");
          setExpeditionsCompleted(prev => {
            const next = prev + 1;
            expeditionsCompletedRef.current = next;
            if (next === 1) addHistoryRef.current("🗺", "First expedition returned");
            return next;
          });
          playSuccess();
          return null;
        }
        return updated;
      }).filter(Boolean));

      // 4. Heal injured colonists ───────────────────────────────────────────
      // Count available nurses in the hospital
      let nursesAvailable = 0;
      g.forEach(row => row.forEach(cell => {
        if (cell.type === "hospital") nursesAvailable += cell.workers;
      }));

      setColonists(prev => {
        let nurseCapacity = nursesAvailable * 3; // each nurse handles up to 3 patients
        return prev.map(col => {
          if (col.status !== "injured") return col;
          // IRON LUNGS: heals 2× faster
          const baseHeal = nurseCapacity > 0 ? (nurseCapacity--, HEAL_RATE_NURSE) : 1;
          let healRate = col.traits?.includes("ironLungs") ? baseHeal * 2 : baseHeal;
          // Quirk: workaholic heals 25% slower, insomniac heals 15% slower
          if (col.quirk?.id === "workaholic")  healRate *= 0.75;
          if (col.quirk?.id === "insomniac")   healRate *= 0.85;
          const newTicks = (col.injuryTicksLeft ?? INJURY_TICKS_BASE) - healRate;
          if (newTicks <= 0) {
            addLog(`💊 ${col.name} has recovered and returned to duty.`);
            addToast(`💊 RECOVERED\n${col.name} is back on their feet.`, "success");
            playSuccess();
      return { ...col, status: "idle", injuryTicksLeft: 0 };
          }
          return { ...col, injuryTicksLeft: newTicks };
        });
      });

      // 4b. Morale collapse / strained mechanics ───────────────────────────
      if (moraleRef.current <= -100) {
        // 10% chance per tick a colonist deserts
        if (Math.random() < 0.10) {
          setColonists(prev => {
            const vulnerable = prev.filter(c => c.status === "idle" || c.status === "working");
            if (vulnerable.length === 0) return prev;
            const deserter = vulnerable[Math.floor(Math.random() * vulnerable.length)];
            setMorale(p => clamp(p - 15, -100, 100));
            addLog(`🚪 ${deserter.name} has deserted — morale has collapsed.`);
            addToast(`🚪 DESERTION\n${deserter.name} left the colony.\nMorale has completely collapsed.`, "raid");
            return prev.filter(c => c.id !== deserter.id);
          });
        }
      } else if (moraleRef.current < 0 && moraleRef.current > -50) {
        // 5% chance a working colonist refuses their post
        if (Math.random() < 0.05) {
          setColonists(prev => {
            const working = prev.filter(c => c.status === "working");
            if (working.length === 0) return prev;
            const refuser = working[Math.floor(Math.random() * working.length)];
            addLog(`😤 ${refuser.name} refused their post — morale is strained.`);
            setGrid(prevGrid => {
              const ng = prevGrid.map(row => row.map(c => ({ ...c })));
              const staffed = [];
              ng.forEach((row, ri) => row.forEach((cell, ci) => {
                if (cell.type && cell.workers > 0) staffed.push({ r: ri, c: ci });
              }));
              if (staffed.length > 0) {
                const room = staffed[Math.floor(Math.random() * staffed.length)];
                ng[room.r][room.c].workers = Math.max(0, ng[room.r][room.c].workers - 1);
              }
              return ng;
            });
            return prev.map(c => c.id === refuser.id ? { ...c, status: "idle" } : c);
          });
        }
      }

      // Check population = 0 → game over
      setColonists(prev => {
        if (prev.length === 0 && !gameOverRef.current) {
          const currentTick = tickRef.current;
          setGameOver({
            reason: "All colonists lost — the colony is silent.",
            daysAlive: Math.floor(currentTick / 48) + 1,
            tick: currentTick,
            raidsRepelled: raidsRepelledRef.current,
            casualties: memorialRef.current,
            peakPop: peakPopulation,
          });
        }
        return prev;
      });
      // All living colonists age. On-duty colonists earn 1 XP per 10 duty ticks.
      // Level up every 20 XP → pendingTraitPick flag set.
      setColonists(prev => prev.map(col => {
        const onDuty   = col.status === "working" || col.status === "onSentry";
        const newAlive = (col.ticksAlive ?? 0) + 1;
        // insomniac: dutyTicks always increments regardless of status
        const newDuty  = (col.dutyTicks  ?? 0) + (onDuty || col.quirk?.id === "insomniac" ? 1 : 0);
        // workaholic: gains XP every 8 ticks instead of 10
        const xpInterval = col.quirk?.id === "workaholic" ? 8 : 10;
        const newXp    = (col.xp ?? 0) + (onDuty && newDuty % xpInterval === 0 ? 1 : 0);
        const newLevel = Math.floor(newXp / 20);
        const leveled  = newLevel > (col.level ?? 0);
        if (leveled) {
          addLog(`⭐ ${col.name} reached Level ${newLevel}! Trait selection available.`);
          changeMoraleRef.current(5, "morale boost from achievement");
        }
        return {
          ...col,
          ticksAlive:       newAlive,
          dutyTicks:        newDuty,
          xp:               newXp,
          level:            newLevel,
          pendingTraitPick: leveled ? true : col.pendingTraitPick,
        };
      }));

      // 6. Excavation progress ──────────────────────────────────────────────
      const excavNow = excavationsRef.current;
      Object.entries(excavNow).forEach(([rowIdxStr, excav]) => {
        if (!excav) return;
        const rowIndex = Number(rowIdxStr);
        const newTicksLeft = excav.ticksLeft - 1;
        if (newTicksLeft <= 0) {
          // Unlock the row
          setUnlockedRows(prev => prev.includes(rowIndex) ? prev : [...prev, rowIndex]);
          // Free excavating colonists back to idle
          setColonists(prev => prev.map(c => c.status === "excavating" ? { ...c, status: "idle" } : c));
          // Discovery event
          const def = EXCAVATION_DEFS[rowIndex];
          if (def) {
            addLog(`⛏ ${def.label} excavation complete! ${def.discovery}`);
            addToast(`⛏ EXCAVATION COMPLETE\n${def.label} — Level unlocked!\n${def.discovery}`, "success");
            addHistoryRef.current("⛏", `Excavation: ${def.label} unlocked`);
            // Row 2 discovery: +60 scrap
            if (rowIndex === 2) {
              setRes(prev => ({ ...prev, scrap: clamp(prev.scrap + 60, 0, MAX_RES) }));
            }
          }
          playSuccess();
          // Remove from excavations
          setExcavations(prev => {
            const next = { ...prev };
            delete next[rowIndex];
            return next;
          });
        } else {
          setExcavations(prev => ({ ...prev, [rowIndex]: { ...excav, ticksLeft: newTicksLeft } }));
        }
      });

      if (heatSuppressedTicksRef.current > 0) {
        setHeatSuppressedTicks(prev => Math.max(0, prev - 1));
      }

      {
        const eventDeltas = moraleEventDeltasRef.current.splice(0, moraleEventDeltasRef.current.length);
        eventDeltas.forEach(({ delta, reason }) => {
          if (delta > 0) moraleTickBreakdown.plus.push(`${reason} +${delta.toFixed(1)}`);
          if (delta < 0) moraleTickBreakdown.minus.push(`${reason} ${delta.toFixed(1)}`);
          moraleTickBreakdown.net += delta;
        });

        const noResourceNotes = ["energy", "food", "water"].reduce((acc, key) => {
          const b = resourceBreakdownSnapshot[key];
          acc[key] = (b.plus.length === 0 && b.minus.length === 0)
            ? { ...b, plus: ["No major modifiers this tick"] }
            : b;
          return acc;
        }, {});

        const finalMorale = (moraleTickBreakdown.plus.length === 0 && moraleTickBreakdown.minus.length === 0)
          ? { ...moraleTickBreakdown, plus: ["No major modifiers this tick"] }
          : moraleTickBreakdown;

        setStatBreakdown({
          energy: noResourceNotes.energy,
          food: noResourceNotes.food,
          water: noResourceNotes.water,
          morale: finalMorale,
        });
      }

      setTick(t => {
        const next = t + 1;
        // Track peak population
        setPeakPopulation(prev => Math.max(prev, colonistsRef.current.length));
        // Surface condition rotation — every 80-120 ticks (weighted random pick)
        setSurfaceConditionTimer(prev => {
          const nextTimer = prev + 1;
          const rotateAt = 80 + Math.floor(Math.random() * 41); // 80-120
          if (nextTimer >= rotateAt) {
            const totalWeight = SURFACE_CONDITIONS.reduce((s, c) => s + c.weight, 0);
            let r = Math.random() * totalWeight;
            let next = SURFACE_CONDITIONS[0];
            for (const cond of SURFACE_CONDITIONS) { r -= cond.weight; if (r <= 0) { next = cond; break; } }
            setSurfaceCondition(next);
            addLog(`🌍 SURFACE CONDITION: ${next.icon} ${next.label} — ${next.flavor}`);
            playSurfaceCondition();
            return 0;
          }
          return nextTimer;
        });
        // Dilemma event check — every 50 ticks, 40% chance if none active
        setDilemmaTimer(prev => {
          const nextDt = prev + 1;
          if (nextDt >= 50 && !activeDilemma) {
            if (Math.random() < 0.40) {
              const currentTick = next;
              const currentCond = surfaceConditionRef.current.id;
              const popNow      = colonistsRef.current.length;
              const eligible    = DILEMMA_EVENTS.filter(ev => {
                if (firedDilemmasRef.current.includes(ev.id)) return false;
                if (ev.minTick && currentTick < ev.minTick) return false;
                if (ev.minPop  && popNow < ev.minPop)       return false;
                if (ev.condition && ev.condition !== currentCond) return false;
                return true;
              });
              if (eligible.length > 0) {
                const picked = eligible[Math.floor(Math.random() * eligible.length)];
                setActiveDilemma(picked);
                setTimescale(0);
                playDilemma();
                setFiredDilemmas(p => [...p, picked.id]);
                firedDilemmasRef.current = [...firedDilemmasRef.current, picked.id];
              }
            }
            return 0;
          }
          return nextDt;
        });
        checkMilestonesRef.current({
          raidsRepelled:        raidsRepelledRef.current,
          largeRaidsRepelled:   largeRaidsRepelledRef.current,
          totalDeaths:          memorialRef.current.length,
          expeditionsCompleted: expeditionsCompletedRef.current,
          population:           colonistsRef.current.length,
          day:                  Math.floor(next / 48) + 1,
          morale:               moraleRef.current,
          schematics:           surfaceHaulRef.current.schematics.length,
          t3Built:              0,
        });
        return next;
      });
    }, TICK_MS / timescale);

    return () => clearInterval(interval);
  }, [timescale]); // restart interval when timescale changes

  // Keybindings: space = close popups, 1-5 = timescale
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setBuildMenu(false);
        setSelected(null);
        setJournalOpen(false);
        setEffectsOpen(false);
        setSelectedColonist(null);
      }
      if (e.key === "1") setTimescale(0);
      if (e.key === "2") setTimescale(0.5);
      if (e.key === "3") setTimescale(1);
      if (e.key === "4") setTimescale(2);
      if (e.key === "5") setTimescale(4);
      if (e.key === "6") setTimescale(10);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Warnings — edge-triggered (only log on false→true transition) ─────────
  const prevWarn = useRef({ food: false, water: false, energy: false, heat: false });
  useEffect(() => {
    if (tick === 0) return;
    const cur = {
      food:   res.food   < 20,
      water:  res.water  < 20,
      energy: res.energy < 20,
      heat:   heat > 600,  // HUNTED state
    };
    if (cur.food   && !prevWarn.current.food)   { addLog("⚠ FOOD CRITICAL");                         playAlert(); }
    if (cur.water  && !prevWarn.current.water)  { addLog("⚠ WATER CRITICAL");                        playAlert(); }
    if (cur.energy && !prevWarn.current.energy) { addLog("⚠ ENERGY CRITICAL");                       playAlert(); }
    if (cur.heat   && !prevWarn.current.heat)   { addLog("🚨 ARC HEAT: HUNTED — raids will intensify!"); }
    prevWarn.current = cur;
  }, [tick]);

  // ── Milestone toast auto-dismiss ─────────────────────────────────────────
  useEffect(() => {
    if (!milestoneToast) return;
    const timer = setTimeout(() => setMilestoneToast(null), 5000);
    return () => clearTimeout(timer);
  }, [milestoneToast]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCellClick = (r, c) => {
    if (gameOver) return;
    playUiClick();
    setSelected({ r, c });
    setBuildMenu(!grid[r][c].type);
  };

  const handleStartExcavation = (rowIndex) => {
    const def = EXCAVATION_DEFS[rowIndex];
    if (!def) return;
    if (unlockedRows.includes(rowIndex)) { addLog("⚠ This level is already excavated"); return; }
    if (!unlockedRows.includes(rowIndex - 1)) { addLog("⚠ Must excavate the level above first"); return; }
    if (excavations[rowIndex]) { addLog("⚠ Excavation already in progress for this level"); return; }
    if (res.scrap < def.scrap) { addLog(`❌ Need ${def.scrap} scrap to excavate ${def.label}`); return; }
    // Find idle colonists
    const idle = colonists.filter(c => c.status === "idle");
    const actualCount = Math.min(def.workers, idle.length);
    if (actualCount === 0) { addLog("⚠ No idle colonists available for excavation"); return; }
    const picked = idle.slice(0, actualCount);
    const totalTicks = Math.ceil(def.ticks * (def.workers / actualCount));
    setRes(prev => ({ ...prev, scrap: prev.scrap - def.scrap }));
    setColonists(prev => prev.map(c => picked.find(p => p.id === c.id) ? { ...c, status: "excavating" } : c));
    setExcavations(prev => ({ ...prev, [rowIndex]: { workersAssigned: actualCount, ticksLeft: totalTicks, totalTicks } }));
    addLog(`⛏ Excavation of ${def.label} begun. ${actualCount} worker(s) assigned.`);
  };

  const handleBuild = (type) => {
    if (!selected) return;
    const { r, c } = selected;
    if (!unlockedRows.includes(r)) { addLog("⚠ This level is not excavated yet"); return; }
    const def = ROOM_TYPES[type];
    // Check all costs — salvage/arcTech come from surfaceHaul
    for (const [resource, amt] of Object.entries(def.cost)) {
      if (resource === "salvage") { if (surfaceHaul.salvage < amt) { addLog(`❌ Need ${amt} salvage for ${def.label}`); return; } }
      else if (resource === "arcTech") { if (surfaceHaul.arcTech < amt) { addLog(`❌ Need ${amt} Arc Tech for ${def.label}`); return; } }
      else { if (res[resource] < amt) { addLog(`❌ Need ${amt} ${resource} for ${def.label}`); return; } }
    }
    setRes(prev => {
      const next = { ...prev };
      for (const [resource, amt] of Object.entries(def.cost)) {
        if (resource !== "salvage" && resource !== "arcTech") next[resource] -= amt;
      }
      return next;
    });
    const salvageCost = def.cost.salvage ?? 0;
    const arcTechCost = def.cost.arcTech ?? 0;
    if (salvageCost > 0 || arcTechCost > 0) {
      setSurfaceHaul(prev => ({ ...prev, salvage: prev.salvage - salvageCost, arcTech: prev.arcTech - arcTechCost }));
    }
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[r][c] = { id: `${r}-${c}`, type, workers: 0, damaged: false };
      return next;
    });
        addLog(`🏗 Built ${def.label} at sector [${r + 1}-${c + 1}]`);
        playBuild();
    setHoveredBuildKey(null);
    setBuildMenu(false);
    setSelected(null);
  };

  const handleAssign = (r, c, delta) => {
    const cell = grid[r][c];
    if (!cell.type) return;
    const def = ROOM_TYPES[cell.type];
    if (def.special === "barracks") return;

    if (delta > 0) {
      // Assign: find first idle colonist (not injured)
      const idle = colonists.filter(co => co.status === "idle");
      if (idle.length === 0) { addLog("⚠ No free colonists available"); return; }
      if (cell.workers >= def.cap) { addLog("⚠ Room is at capacity"); return; }
      const pick = idle[0];
      const newStatus = cell.type === "sentryPost" ? "onSentry" : "working";
      setColonists(prev => prev.map(co => co.id === pick.id ? { ...co, status: newStatus } : co));
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })));
        next[r][c].workers += 1;
        return next;
      });
      addLog(`👤 ${pick.name} assigned to ${def.label}`);
      playAssign();
    } else {
      // Unassign: find a colonist with the right status for this room
      if (cell.workers === 0) return;
      const statusFilter = cell.type === "sentryPost" ? "onSentry" : "working";
      const available = colonists.filter(co => co.status === statusFilter);
      if (available.length === 0) return;
      const pick = available[0];
      setColonists(prev => prev.map(co => co.id === pick.id ? { ...co, status: "idle" } : co));
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })));
        next[r][c].workers = Math.max(0, next[r][c].workers - 1);
        return next;
      });
      addLog(`👤 ${pick.name} stood down from ${def.label}`);
      playUnassign();
    }
  };

  const handleDemolish = (r, c) => {
    const cell = grid[r][c];
    if (!cell.type) return;
    // Free all workers assigned to this room
    let freed = 0;
    setColonists(prev => {
      let toFree = cell.workers;
      return prev.map(co => {
        if (toFree > 0 && (co.status === "working" || co.status === "onSentry")) { toFree--; freed++; return { ...co, status: "idle" }; }
        return co;
      });
    });
    setRes(prev => ({ ...prev, scrap: Math.min(MAX_RES, prev.scrap + 5) }));
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[r][c] = { id: `${r}-${c}`, type: null, workers: 0 };
      return next;
    });
    addLog(`💥 Demolished ${ROOM_TYPES[cell.type].label} at [${r + 1}-${c + 1}] (+5 scrap)`);
    playDemolish();
    setSelected(null);
    setBuildMenu(false);
  };

  const handleRepair = (r, c) => {
    const cell = grid[r][c];
    if (!cell.type || !cell.damaged) return;
    if (res.scrap < 20) { addLog("⚠ Need 20 scrap to repair"); return; }
    setRes(prev => ({ ...prev, scrap: prev.scrap - 20 }));
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[r][c] = { ...next[r][c], damaged: false };
      return next;
    });
    addLog(`🔧 ${ROOM_TYPES[cell.type].label} at [${r + 1}-${c + 1}] repaired. (-20 scrap)`);
    playRepair();
  };

  const handleSurfaceRaidWon = () => {
    const wonSize = pendingRaidSize;
    setSurfaceDefenseActive(false);
    setPendingRaidSize(null);
    setRaidWindow(null);
    setActiveRaid(null);
    unduckMusic();
    playRaidOver();
    setColonists(prev => prev.map(c => ({ ...c, raidsSurvived: (c.raidsSurvived ?? 0) + 1 })));
    setHeat(prev => clamp(prev - 60, 0, HEAT_MAX));
    changeMoraleRef.current(8, "raid repelled on surface");
    addLog("⚔ Surface defenses held — raid repelled before breach!");
    addToast("🛡 RAID REPELLED\nSurface defenses eliminated all Arc units.\nColony secure.", "success", { key: `surface-win-${tickRef.current}` });
    setRaidsRepelled(prev => {
      const n = prev + 1;
      raidsRepelledRef.current = n;
      if (n === 1) addHistoryRef.current("⚔", "First raid repelled");
      return n;
    });
    if (wonSize === "large") {
      setLargeRaidsRepelled(prev => { const n = prev + 1; largeRaidsRepelledRef.current = n; return n; });
      addHistoryRef.current("⚔", "Large raid repelled on surface");
    }
    checkMilestonesRef.current({
      raidsRepelled:        raidsRepelledRef.current,
      largeRaidsRepelled:   largeRaidsRepelledRef.current,
      totalDeaths:          memorialRef.current.length,
      expeditionsCompleted: expeditionsCompletedRef.current,
      population:           colonistsRef.current.length,
      day:                  Math.floor(tickRef.current / 48) + 1,
      morale:               moraleRef.current,
      schematics:           surfaceHaulRef.current.schematics.length,
      t3Built:              0,
    });
  };

  const handleSurfaceRaidLost = () => {
    setSurfaceDefenseActive(false);
    setPendingRaidSize(null);
    unduckMusic();
    addLog("⚠ Surface defenses breached — Arc forces entering colony.");
  };

  const handleRecruit = () => {
    if (totalColonists >= popCap) { addLog("⚠ Pop cap reached — build more Barracks"); return; }
    if (res.food < 15 || res.water < 15) { addLog("⚠ Need 15 food + 15 water to recruit"); return; }
    setRes(prev => ({ ...prev, food: prev.food - 15, water: prev.water - 15 }));
    const newCol = makeColonist(tickRef.current);
    setColonists(prev => [...prev, newCol]);
    addLog(`🧍 ${newCol.name} joined from surface survivors!`);
    playRecruit();
  };

  const handleUnlockTech = (techKey) => {
    const tech = T2_TECHS[techKey];
    if (!tech) return;
    if (unlockedTechs.includes(techKey)) { addLog(`⚠ ${tech.label} already unlocked`); return; }
    if (res.rp < tech.cost) { addLog(`⚠ Need ${tech.cost} RP to unlock ${tech.label} (have ${Math.floor(res.rp)})`); return; }
    setRes(prev => ({ ...prev, rp: prev.rp - tech.cost }));
    setUnlockedTechs(prev => [...prev, techKey]);
    addLog(`🔬 ${tech.icon} ${tech.label} unlocked!`);
    addToast(`🔬 RESEARCH COMPLETE\n${tech.icon} ${tech.label} unlocked.`, "success");
    playSuccess();
  };

  const handlePickTrait = (colonistId, traitKey) => {
    const trait = TRAITS[traitKey];
    if (!trait) return;
    const target = colonists.find(c => c.id === colonistId);
    if (!target || target.traits.includes(traitKey)) return;
    setColonists(prev => prev.map(col => {
      if (col.id !== colonistId) return col;
      const newTraits = [...col.traits, traitKey];
      return { ...col, traits: newTraits, pendingTraitPick: false };
    }));
    addLog(`${trait.icon} ${target.name} gained trait: ${trait.label}`);
    addToast(`${trait.icon} TRAIT ACQUIRED\n${target.name} — ${trait.label}\n${trait.desc}`, "success", {
      key: `trait-${colonistId}-${traitKey}`,
      dedupeMs: 3000,
    });
    playLevelUp();
  };

  const handleLaunchExpedition = (type) => {
    if (expeditions.length >= 2) { addLog("⚠ Maximum 2 expeditions active at once"); return; }
    // Surface condition may block expeditions (e.g. dust storm)
    if (surfaceCondition.effects.expedBlocked) {
      addLog(`⚠ Expeditions blocked — ${surfaceCondition.icon} ${surfaceCondition.label}`);
      return;
    }
    const def = EXPEDITION_TYPES[type];
    // tunnelBlind quirk: excluded from expeditions
    const idle = colonists.filter(c => c.status === "idle" && c.quirk?.id !== "tunnelBlind");
    const allIdle = colonists.filter(c => c.status === "idle");
    if (allIdle.length < def.colonistsRequired) {
      addLog(`⚠ Need ${def.colonistsRequired} free colonist(s) — only ${allIdle.length} available`);
      return;
    }
    if (idle.length < def.colonistsRequired) {
      addLog(`⚠ All available colonists are Tunnel-Blind — cannot go topside`);
      return;
    }
    const picked   = idle.slice(0, def.colonistsRequired);
    const names    = picked.map(c => c.name).join(" & ");
    const rollEvery = type === "scav" ? 8 : 6;
    // surfaceBorn: +20% good roll weight; packRat: bonus scrap+salvage tracked on expedition
    const hasSurfaceBorn = picked.some(c => c.quirk?.id === "surfaceBorn");
    const hasPackRat     = picked.some(c => c.quirk?.id === "packRat");
    const hasLoudmouth   = picked.some(c => c.quirk?.id === "loudmouth");
    const newExp = {
      id: `exp-${Date.now()}`,
      type,
      duration:        expedDuration,
      ticksLeft:       expedDuration,
      rollEvery,
      rollCountdown:   rollEvery,
      colonistIds:     picked.map(c => c.id),
      eventLog:        [],
      lootAccumulated: { scrap: 0, salvage: 0, arcTech: 0, survivor: false },
      moraleSnapshot:  morale,
      conditionSnapshot: { ...surfaceCondition },
      quirkBonuses:    { surfaceBorn: hasSurfaceBorn, packRat: hasPackRat, loudmouth: hasLoudmouth },
    };
    setColonists(prev =>
      prev.map(c => picked.find(p => p.id === c.id) ? { ...c, status: "onExpedition" } : c)
    );
    setHeat(t => clamp(t + (heatSuppressedTicksRef.current > 0 ? 0 : def.threatDelta), 0, HEAT_MAX));
    setExpeditions(prev => [...prev, newExp]);
    addLog(`${def.icon} ${names} deployed on ${def.label} (${expedDuration}t). ~${Math.floor(expedDuration / rollEvery)} rolls expected.`);
    playExpedition();
  };

  const handleDilemmaChoice = (choice) => {
    const a = choice.apply ?? {};
    const outcomeBits = [];
    if (a.morale)       changeMoraleRef.current(a.morale, `dilemma: ${activeDilemma?.id}`);
    if (a.morale)       outcomeBits.push(`Morale ${a.morale > 0 ? "+" : ""}${a.morale}`);
    if (a.scrap)        setRes(p => ({ ...p, scrap:   clamp(p.scrap   + a.scrap,   0, MAX_RES) }));
    if (a.scrap)        outcomeBits.push(`Scrap ${a.scrap > 0 ? "+" : ""}${a.scrap}`);
    if (a.food)         setRes(p => ({ ...p, food:    clamp(p.food    + a.food,    0, MAX_RES) }));
    if (a.food)         outcomeBits.push(`Food ${a.food > 0 ? "+" : ""}${a.food}`);
    if (a.water)        setRes(p => ({ ...p, water:   clamp(p.water   + a.water,   0, MAX_RES) }));
    if (a.water)        outcomeBits.push(`Water ${a.water > 0 ? "+" : ""}${a.water}`);
    if (a.arcTech)      setSurfaceHaul(p => ({ ...p, arcTech:  p.arcTech  + a.arcTech  }));
    if (a.arcTech)      outcomeBits.push(`Arc Tech +${a.arcTech}`);
    if (a.salvage)      setSurfaceHaul(p => ({ ...p, salvage:  p.salvage  + a.salvage  }));
    if (a.salvage)      outcomeBits.push(`Salvage +${a.salvage}`);
    if (a.heatDelta)    setHeat(p => clamp(p + a.heatDelta, 0, HEAT_MAX));
    if (a.heatDelta)    outcomeBits.push(`Heat ${a.heatDelta > 0 ? "+" : ""}${a.heatDelta}`);
    if (a.suppressHeatTicks) setHeatSuppressedTicks(a.suppressHeatTicks);
    if (a.suppressHeatTicks) outcomeBits.push(`Heat suppressed ${a.suppressHeatTicks}t`);
    if (a.recruitFree)  setColonists(p => [...p, makeColonist(tickRef.current)]);
    if (a.recruitFree)  outcomeBits.push("1 colonist joined");
    if (a.removeRandomColonist) {
      setColonists(prev => {
        const pool = prev.filter(c => c.status !== "onExpedition");
        if (pool.length === 0) return prev;
        const target = pool[Math.floor(Math.random() * pool.length)];
        addToMemorialRef.current(target, "moraleDeath", tickRef.current);
        return prev.filter(c => c.id !== target.id);
      });
      outcomeBits.push("1 colonist lost");
    }
    if (a.injureRandom) {
      setColonists(prev => {
        const pool = prev.filter(c => c.status === "idle" || c.status === "working");
        if (pool.length === 0) return prev;
        const target = pool[Math.floor(Math.random() * pool.length)];
        return prev.map(c => c.id === target.id ? { ...c, status: "injured", injuryTicksLeft: 20, injuryCount: (c.injuryCount ?? 0) + 1 } : c);
      });
      outcomeBits.push("1 colonist injured");
    }
    if (a.schematicRandom) {
      const allSch = ["turretSchematics","empSchematics","fortSchematics","geoSchematics","researchSchematics"];
      const owned  = surfaceHaulRef.current.schematics;
      const avail  = allSch.filter(s => !owned.includes(s));
      if (avail.length > 0) {
        const found = avail[Math.floor(Math.random() * avail.length)];
        setSurfaceHaul(p => ({ ...p, schematics: [...p.schematics, found] }));
        addLog(`📋 Schematic recovered: ${found}`);
        outcomeBits.push(`Schematic: ${found}`);
      }
    }
    const outcomeSummary = outcomeBits.length > 0 ? outcomeBits.join(" · ") : "No immediate effect.";
    setRecentDilemmaOutcomes(prev => [
      {
        id: `d-${Date.now()}-${Math.random()}`,
        tick: tickRef.current,
        title: activeDilemma?.title ?? activeDilemma?.id ?? "Dilemma",
        choice: choice.label,
        summary: outcomeSummary,
      },
      ...prev,
    ].slice(0, 8));
    addToast(`📋 DILEMMA RESOLVED\n${choice.label}\n${outcomeSummary}`, "info", {
      key: `dilemma-${activeDilemma?.id}-${choice.label}-${tickRef.current}`,
      dedupeMs: 200,
    });
    addLog(`📋 ${activeDilemma?.id}: "${choice.label}" — ${choice.outcome}`);
    addHistoryRef.current("📋", `Dilemma: ${(activeDilemma?.title ?? activeDilemma?.id ?? "event").replace(/_/g, " ")} → ${choice.label}`);
    playDilemmaResolve();
    setActiveDilemma(null);
  };

  const handleSoundAlarm = () => {
    // Shelter idle and working colonists; unassign them from rooms
    setColonists(prev => prev.map(c =>
      (c.status === "idle" || c.status === "working") ? { ...c, status: "sheltered" } : c
    ));
    setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, workers: 0 }))));
    addLog("🏠 ALARM SOUNDED — colonists sheltering. Production halted.");
    addToast("🏠 ALARM SOUNDED\nColonists are sheltering.\nThey are immune to Arc strikes.", "info");
    playShelterAlarm();
  };

  const handleBackToWork = () => {
    setColonists(prev => prev.map(c =>
      c.status === "sheltered" ? { ...c, status: "idle" } : c
    ));
    addLog("🏠 All clear — colonists returned to idle. Reassign them to rooms.");
    addToast("🏠 ALL CLEAR\nColonists returning from shelter.\nReassign them to restore production.", "success");
  };

  const handleRestart = () => {
    setGrid(initGrid());
    setRes(INIT_RES);
    setColonists(initColonists());
    setHeat(0);
    setExpeditions([]);
    setExpedDuration(40);
    setRaidWindow(null);
    setActiveRaid(null);
    setUnlockedTechs([]);
    setSelected(null);
    setBuildMenu(false);
    setTick(0);
    setGameOver(null);
    setLog(["Colony restarted."]);
    setMorale(50);
    setUnlockedRows([0]);
    setSurfaceHaul({ salvage: 0, arcTech: 0, schematics: [] });
    setExcavations({});
    setMemorial([]);
    setFiredMilestones([]);
    setMilestoneToast(null);
    setSelectedColonist(null);
    setRaidsRepelled(0);
    setLargeRaidsRepelled(0);
    setExpeditionsCompleted(0);
    setSurfaceCondition(SURFACE_CONDITIONS[0]);
    setSurfaceConditionTimer(0);
    setPeakPopulation(3);
    setActiveDilemma(null);
    setDilemmaTimer(0);
    setFiredDilemmas([]);
    setHistoryLog([]);
    raidSuppressedThisRaidRef.current = 0;
    setSurfaceDefenseActive(false);
    setPendingRaidSize(null);
  };

  // ── Derived UI ────────────────────────────────────────────────────────────
  const selCell       = selected ? grid[selected.r][selected.c] : null;
  const armoryArmed   = grid.flatMap(r => r).some(c => c.type === "armory" && c.workers > 0);
  const hasRadioTower = grid.flatMap(r => r).some(c => c.type === "radioTower");
  const radioTowerOnline = hasRadioTower && !surfaceCondition.effects.radioOffline;
  const heatState     = getHeatState(heat);
  const heatPct       = (heat / HEAT_MAX) * 100;
  const shelteredCount = colonists.filter(c => c.status === "sheltered").length;
  const memorialHallBuilt = grid.flatMap(r => r).some(c => c.type === "memorial");


  // ── Render helpers ────────────────────────────────────────────────────────
  const ResBar = ({ k, icon, label, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f", border: `1px solid ${color}33`, borderRadius: 6, padding: "5px 10px", minWidth: 105 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div>
        <div style={{ color: "#888", fontSize: 9, letterSpacing: 1 }}>{label}</div>
        <div style={{ color, fontSize: 14, fontWeight: "bold", fontFamily: "monospace" }}>{Math.floor(res[k])}</div>
      </div>
      <div style={{ width: 4, height: 28, background: "#1a1a2e", borderRadius: 2, marginLeft: "auto", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
        <div style={{ width: "100%", height: `${(res[k] / MAX_RES) * 100}%`, background: color, transition: "height 0.5s" }} />
      </div>
    </div>
  );

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div onClick={handleFirstInteraction} style={{
      minHeight: "100vh", background: "transparent", color: "#c8d0d8",
      position: "relative",
      fontFamily: "'Courier New', monospace",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "14px 8px",
      outline: raidFlash ? "3px solid #ff4444" : "3px solid transparent",
      transition: "outline 0.15s",
    }}>

      <SkyBackground tick={tick} />

      {/* ── HEADER ── */}
      <div style={{ width: "100%", maxWidth: 920, marginBottom: 10, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1e3a5f", paddingBottom: 8, marginBottom: 10, flexWrap: "wrap", gap: 8, background: "rgba(3,6,9,0.55)", backdropFilter: "blur(2px)" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#4ab3f4", letterSpacing: 3 }}>⛩ SPERANZA</div>
            <div style={{ fontSize: 9, color: "#2a4a6a", letterSpacing: 2 }}>UNDERGROUND COLONY · {tickToDayHour(tick)}</div>
            {/* Surface condition badge */}
            <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 5,
              background: "#0a0c14", border: `1px solid ${surfaceCondition.color}44`,
              borderRadius: 4, padding: "2px 8px" }}>
              <span style={{ fontSize: 10 }}>{surfaceCondition.icon}</span>
              <span style={{ fontSize: 8, color: surfaceCondition.color, letterSpacing: 1 }}>{surfaceCondition.label}</span>
            </div>
            {/* Timescale controls */}
            <div style={{ display: "flex", gap: 3, marginTop: 5, alignItems: "center" }}>
              {[{ v: 0, label: "⏸" }, { v: 0.5, label: ".5×" }, { v: 1, label: "1×" }, { v: 2, label: "2×" }, { v: 4, label: "4×" }, { v: 10, label: "10×" }].map(({ v, label }) => (
                <button key={v} onClick={() => setTimescale(v)} style={{
                  background: timescale === v ? "#1a3a5a" : "#0a0c14",
                  border: `1px solid ${timescale === v ? "#4ab3f4" : "#1a2535"}`,
                  borderRadius: 3, color: timescale === v ? "#4ab3f4" : "#2a4a6a",
                  padding: "2px 6px", cursor: "pointer", fontSize: 9, fontFamily: "monospace",
                  fontWeight: timescale === v ? "bold" : "normal",
                }}>{label}</button>
              ))}
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                marginLeft: 6, padding: "2px 6px",
                background: "#0a0c14", border: "1px solid #1a2535", borderRadius: 3,
              }}>
                <span style={{ color: "#4ab3f4", fontSize: 10 }}>🔊</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={musicVolume}
                  onChange={handleMusicVolumeChange}
                  style={{ width: 72, accentColor: "#4ab3f4", cursor: "pointer" }}
                />
                <span style={{ color: "#4ab3f4", fontSize: 9, minWidth: 28, textAlign: "right" }}>{musicVolume}%</span>
              </div>
              <button
                title="Toggle Colony Log"
                onClick={(e) => { e.stopPropagation(); setJournalOpen(v => !v); }}
                style={{
                  background: journalOpen ? "#1a3a5a" : "#0a0c14",
                  border: `1px solid ${journalOpen ? "#4ab3f4" : "#1a2535"}`,
                  borderRadius: 3, color: journalOpen ? "#4ab3f4" : "#2a4a6a",
                  padding: "2px 6px", cursor: "pointer", fontSize: 10, fontFamily: "monospace",
                  marginLeft: 4,
                }}
              >📜</button>
              <button
                title="Toggle Colony Effects"
                onClick={(e) => { e.stopPropagation(); setEffectsOpen(v => !v); }}
                style={{
                  background: effectsOpen ? "#2a2410" : "#0a0c14",
                  border: `1px solid ${effectsOpen ? "#d4a843" : "#1a2535"}`,
                  borderRadius: 3, color: effectsOpen ? "#d4a843" : "#2a4a6a",
                  padding: "2px 6px", cursor: "pointer", fontSize: 10, fontFamily: "monospace",
                  marginLeft: 2,
                }}
              >🧪</button>
              {timescale === 0 && (
                <span style={{ color: "#f5a623", fontSize: 8, marginLeft: 3, letterSpacing: 1 }}>PAUSED</span>
              )}
            </div>
          </div>

          {/* Heat meter */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 180 }}>
            <div style={{ fontSize: 9, color: raidWindow ? "#ff4444" : heatState.color, letterSpacing: 2, fontWeight: "bold" }}>
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
              <div style={{ fontSize: 8, color: "#ff4444", letterSpacing: 1, fontWeight: "bold" }}>
                {radioTowerOnline
                  ? `${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].icon} ${RAID_SIZES[RAID_SIZE_ORDER[raidWindow.sizeIdx]].label} RAID INCOMING — rolling each tick`
                  : "❓ UNKNOWN RAID INCOMING — rolling each tick"}
                {radioTowerOnline && unlockedTechs.includes("barricades") && ` · 🛡 ${Math.round({ small:75, medium:30, large:10 }[RAID_SIZE_ORDER[raidWindow.sizeIdx]])}% block`}
              </div>
            ) : (
              <div style={{ fontSize: 8, color: "#2a4a6a" }}>
                {Math.floor(heat)}/1000 · {Math.round(HEAT_RAID_PROB_BASE * 100 + (heat / HEAT_MAX) * HEAT_RAID_PROB_SCALE * 100)}% raid chance/day
                {unlockedTechs.includes("barricades") && " · 🛡 Barricades active"}
              </div>
            )}
          </div>

          {/* Morale bar */}
          {(() => {
            const moraleColor = morale > 50 ? "#7ed321" : morale > 0 ? "#f5a623" : morale > -50 ? "#ff7744" : "#ff2222";
            const moraleTier  = morale > 75 ? "THRIVING" : morale > 25 ? "STABLE" : morale > 0 ? "UNEASY" : morale > -50 ? "STRAINED" : morale > -75 ? "FRACTURED" : "COLLAPSE";
            const moraleVal   = Math.floor(morale);
            const positivePct = morale > 0 ? (morale / 100) * 50 : 0;
            const negativePct = morale < 0 ? (Math.abs(morale) / 100) * 50 : 0;
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 160 }}>
                <div style={{ fontSize: 9, color: moraleColor, letterSpacing: 2, fontWeight: "bold" }}>
                  🧭 MORALE: {moraleTier}
                </div>
                <div
                  onMouseEnter={() => setHoveredFlowStat("morale")}
                  onMouseLeave={() => setHoveredFlowStat(null)}
                  style={{ width: "100%", height: 10, background: "#0d1020", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                  {/* Center divider */}
                  <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#2a3545", zIndex: 2 }} />
                  {/* Positive half (right of center) */}
                  {morale > 0 && (
                    <div style={{ position: "absolute", left: "50%", top: 0, height: "100%", width: `${positivePct}%`, background: `linear-gradient(90deg, #3a7a1a, ${moraleColor})`, borderRadius: "0 4px 4px 0", transition: "width 0.5s" }} />
                  )}
                  {/* Negative half (left of center) */}
                  {morale < 0 && (
                    <div style={{ position: "absolute", right: "50%", top: 0, height: "100%", width: `${negativePct}%`, background: `linear-gradient(270deg, #7a2020, ${moraleColor})`, borderRadius: "4px 0 0 4px", transition: "width 0.5s" }} />
                  )}
                </div>
                <div style={{ fontSize: 8, color: moraleColor, fontFamily: "monospace" }}>
                  {moraleVal > 0 ? `+${moraleVal}` : moraleVal} / 100
                </div>
              </div>
            );
          })()}

          {/* Colonists summary */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ background: "#0a1520", border: "1px solid #1e3a5f", borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
              <div style={{ color: "#888", fontSize: 9, letterSpacing: 1 }}>COLONISTS</div>
              <div style={{ color: "#4ab3f4", fontSize: 14, fontWeight: "bold" }}>👤 {totalColonists}/{popCap}</div>
              <div style={{ color: "#456", fontSize: 9 }}>FREE: {unassigned}</div>
            </div>
            <button onClick={handleRecruit} style={{
              background: "#0a2a1a", border: "1px solid #2a7a4a", borderRadius: 6,
              color: "#7ed321", padding: "8px 12px", cursor: "pointer", fontSize: 10, letterSpacing: 1,
            }}>+ RECRUIT</button>
          </div>
        </div>

        {/* Resources */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ResBar k="energy" icon="⚡" label="Energy" color="#f5a623" />
          <ResBar k="food"   icon="🌱" label="Food"   color="#7ed321" />
          <ResBar k="water"  icon="💧" label="Water"  color="#4a90e2" />
          <ResBar k="scrap"  icon="🔧" label="Scrap"  color="#bd10e0" />
          {/* RP shown only if a research lab exists */}
          {grid.flatMap(r => r).some(c => c.type === "researchLab") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f", border: "1px solid #00e5ff33", borderRadius: 6, padding: "5px 10px", minWidth: 105 }}>
              <span style={{ fontSize: 15 }}>🔬</span>
              <div>
                <div style={{ color: "#888", fontSize: 9, letterSpacing: 1 }}>RESEARCH</div>
                <div style={{ color: "#00e5ff", fontSize: 14, fontWeight: "bold", fontFamily: "monospace" }}>{Math.floor(res.rp)} RP</div>
              </div>
            </div>
          )}
        </div>
        {/* Surface Haul */}
        {(surfaceHaul.salvage > 0 || surfaceHaul.arcTech > 0 || surfaceHaul.schematics.length > 0) && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 14, background: "#0a0c14", border: "1px solid #33334455", borderRadius: 6, padding: "5px 12px", fontSize: 9, color: "#8899aa", letterSpacing: 1 }}>
            <span style={{ color: "#556", fontSize: 8 }}>SURFACE HAUL:</span>
            {surfaceHaul.salvage > 0 && <span>🔩 SALVAGE: <strong style={{ color: "#c8a060" }}>{surfaceHaul.salvage}</strong></span>}
            {surfaceHaul.arcTech > 0 && <span>⚙️ ARC TECH: <strong style={{ color: "#bb44ff" }}>{surfaceHaul.arcTech}</strong></span>}
            {surfaceHaul.schematics.length > 0 && <span>📋 SCHEMATICS: <strong style={{ color: "#00e5ff" }}>{surfaceHaul.schematics.length}</strong></span>}
          </div>
        )}
      </div>

      <RaidBanner
        activeRaid={activeRaid}
        raidWindow={raidWindow}
        radioTowerOnline={radioTowerOnline}
        unlockedTechs={unlockedTechs}
      />

      <TraitPicker colonists={colonists} onPickTrait={handlePickTrait} />

      <GameOverModal gameOver={gameOver} historyLog={historyLog} onRestart={handleRestart} />

      <DilemmaModal activeDilemma={activeDilemma} onChoice={handleDilemmaChoice} />

      {buildMenu && selCell && !selCell.type && (
        <BuildMenu
          res={res}
          surfaceHaul={surfaceHaul}
          unlockedTechs={unlockedTechs}
          mousePos={mousePos}
          hoveredBuildKey={hoveredBuildKey}
          onHoverBuildKey={setHoveredBuildKey}
          onBuild={handleBuild}
          onClose={() => { setHoveredBuildKey(null); setBuildMenu(false); setSelected(null); }}
        />
      )}

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 920, position: "relative", zIndex: 1 }}>

        {/* Grid column */}
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>

          <SurfaceDefense
            scrap={res.scrap}
            onScrapChange={(delta) => setRes(r => ({ ...r, scrap: Math.max(0, r.scrap + delta) }))}
            raidSize={pendingRaidSize ?? "small"}
            active={surfaceDefenseActive}
            onRaidWon={handleSurfaceRaidWon}
            onRaidLost={handleSurfaceRaidLost}
          />

          <div style={{ border: "none", boxShadow: "none", borderRadius: 6, overflow: "hidden", background: "transparent", position: "relative" }}>

            {grid.map((row, r) => {
              const isLocked = !unlockedRows.includes(r);
              const excav    = excavations[r];
              const depthLabel = `${(r + 1) * 10}m`;
              return (
                <div key={r} style={{ display: "flex", position: "relative" }}>
                  <div className="depth-col" style={{ width: 28, background: "#07090f", borderRight: "1px solid #0d1020", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#1e3040", flexShrink: 0 }}>
                    -{depthLabel}
                  </div>
                  {isLocked ? (
                    /* ── LOCKED ROW ── */
                    <div style={{
                      flex: 1, height: 78,
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(0,0,0,0.3)",
                      position: "relative",
                      zIndex: 5,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0 14px",
                    }}>
                      <div style={{ position: "relative", zIndex: 5 }}>
                        <div style={{ color: "#334", fontSize: 10, letterSpacing: 1 }}>
                          🔒 &nbsp;-{depthLabel} &nbsp;<span style={{ color: "#222" }}>SEALED — excavation required</span>
                        </div>
                        {excav && (
                          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 140, height: 6, background: "#0d1020", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 3,
                                width: `${((excav.totalTicks - excav.ticksLeft) / excav.totalTicks) * 100}%`,
                                background: "#a0522d", transition: "width 0.4s",
                              }} />
                            </div>
                            <span style={{ color: "#a0522d", fontSize: 8 }}>⛏ {excav.ticksLeft}t</span>
                          </div>
                        )}
                      </div>
                      {!excav && (() => {
                        const prereqMet = unlockedRows.includes(r - 1);
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartExcavation(r); }}
                            disabled={!prereqMet}
                            title={prereqMet ? `Excavate -${(r+1)*10}m for ${EXCAVATION_DEFS[r]?.scrap} scrap` : "Excavate the level above first"}
                            style={{
                              background: prereqMet ? "#0a0800" : "#060606",
                              border: `1px solid ${prereqMet ? "#a0522d" : "#2a2020"}`,
                              borderRadius: 4,
                              color: prereqMet ? "#a0522d" : "#3a2020",
                              padding: "5px 10px",
                              cursor: prereqMet ? "pointer" : "not-allowed",
                              fontSize: 9, letterSpacing: 1, fontFamily: "monospace",
                              position: "relative", zIndex: 15,
                            }}
                          >{prereqMet ? `⛏ DIG (${EXCAVATION_DEFS[r]?.scrap ?? "?"}⚙)` : "🔒 DIG"}</button>
                        );
                      })()}
                    </div>
                  ) : (
                    /* ── UNLOCKED ROW — normal cell rendering ── */
                    row.map((cell, c) => {
                      const def   = cell.type ? ROOM_TYPES[cell.type] : null;
                      const isSel = selected?.r === r && selected?.c === c;
                      return (
                        <div className="grid-cell" key={c} onClick={() => handleCellClick(r, c)}
                          onMouseEnter={() => def && setHoveredCell({ r, c })}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                          flex: 1, height: 78,
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
                          {/* Hover tooltip — rendered as fixed overlay following mouse */}
                          {def && hoveredCell?.r === r && hoveredCell?.c === c && (
                            <div style={{
                              position: "fixed",
                              left: mousePos.x + 14,
                              top: mousePos.y - 10,
                              background: "#0d1020", border: `1px solid ${def.border}66`,
                              borderRadius: 5, padding: "6px 10px", zIndex: 9999,
                              minWidth: 130, maxWidth: 200, pointerEvents: "none",
                              boxShadow: `0 0 14px #00000099`,
                            }}>
                              <div style={{ color: def.color, fontSize: 9, fontWeight: "bold", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                {def.sprite
                                  ? <img src={def.sprite} alt={def.label} style={{ width: 52, height: 52, imageRendering: "pixelated", objectFit: "contain" }} />
                                  : <div style={{ fontSize: 18 }}>{def.icon}</div>
                                }
                                <span>{def.label}</span>
                              </div>
                              {def.cap > 0 && (
                                <div style={{ color: "#8899aa", fontSize: 8, marginBottom: 2 }}>
                                  Workers: {grid[r][c].workers} / {def.cap}
                                </div>
                              )}
                              {Object.entries(def.produces).length > 0 && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 1 }}>
                                  {Object.entries(def.produces).map(([res, amt]) => (
                                    <span key={res} style={{ color: "#7ed321", fontSize: 8 }}>+{amt * Math.max(1, grid[r][c].workers)} {res}/t</span>
                                  ))}
                                </div>
                              )}
                              {Object.entries(def.consumes).length > 0 && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 1 }}>
                                  {Object.entries(def.consumes).map(([res, amt]) => (
                                    <span key={res} style={{ color: "#ff7755", fontSize: 8 }}>-{amt * Math.max(1, grid[r][c].workers)} {res}/t</span>
                                  ))}
                                </div>
                              )}
                              {grid[r][c].damaged && (
                                <div style={{ color: "#ff8800", fontSize: 8, marginTop: 3 }}>⚠ DAMAGED — repair: 20 scrap</div>
                              )}
                              {def.special === "hospital" && grid[r][c].workers > 0 && (
                                <div style={{ color: "#ff6b9d", fontSize: 8, marginTop: 2 }}>
                                  Treating up to {grid[r][c].workers * 3} patients
                                </div>
                              )}
                              {def.special === "sentryPost" && (
                                <div style={{ color: "#e8d44d", fontSize: 8, marginTop: 2 }}>
                                  -{grid[r][c].workers * 5} heat/tick
                                </div>
                              )}
                              {!def.cap && !def.produces && <div style={{ color: "#556", fontSize: 8 }}>{def.desc}</div>}
                            </div>
                          )}
                          {def ? (
                            <>
                              {def.sprite ? (
                                <>
                                  {/* Sprite fills full cell edge to edge */}
                                  <img
                                    src={def.sprite}
                                    alt={def.label}
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      width: "100%",
                                      height: "100%",
                                      imageRendering: "pixelated",
                                      objectFit: "cover",
                                      objectPosition: "center",
                                    }}
                                  />
                                  {/* Label + dots overlaid at bottom of cell */}
                                  <div style={{
                                    position: "absolute",
                                    bottom: 0, left: 0, right: 0,
                                    background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                                    padding: "6px 4px 3px",
                                    display: "flex", flexDirection: "column", alignItems: "center",
                                  }}>
                                    <div style={{ fontSize: 6, color: def.color, letterSpacing: 0.5, textAlign: "center", textShadow: "0 1px 3px #000" }}>
                                      {def.label.toUpperCase()}
                                    </div>
                                    {def.cap > 0 && (
                                      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                                        {[...Array(def.cap)].map((_, i) => {
                                          const filled = i < cell.workers;
                                          return (
                                            <div
                                              key={i}
                                              onClick={e => { e.stopPropagation(); handleAssign(r, c, filled ? -1 : 1); }}
                                              title={filled ? "Remove worker" : "Assign worker"}
                                              style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                background: filled ? def.color : "rgba(0,0,0,0.5)",
                                                border: `1px solid ${def.color}${filled ? "cc" : "44"}`,
                                                cursor: "pointer",
                                                boxShadow: filled ? `0 0 4px ${def.color}88` : "none",
                                              }}
                                              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 7px ${def.color}cc`; }}
                                              onMouseLeave={e => { e.currentTarget.style.boxShadow = filled ? `0 0 4px ${def.color}88` : "none"; }}
                                            />
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div style={{ fontSize: 18 }}>{def.icon}</div>
                                  <div style={{ fontSize: 7, color: def.color, letterSpacing: 0.5, marginTop: 2, textAlign: "center" }}>
                                    {def.label.toUpperCase()}
                                  </div>
                                  {def.cap > 0 && (
                                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                      {[...Array(def.cap)].map((_, i) => {
                                        const filled = i < cell.workers;
                                        return (
                                          <div
                                            key={i}
                                            onClick={e => { e.stopPropagation(); handleAssign(r, c, filled ? -1 : 1); }}
                                            title={filled ? "Remove worker" : "Assign worker"}
                                            style={{
                                              width: 9, height: 9, borderRadius: "50%",
                                              background: filled ? def.color : "#1a1a2e",
                                              border: `1px solid ${def.color}${filled ? "cc" : "44"}`,
                                              cursor: "pointer",
                                              transition: "background 0.12s, box-shadow 0.12s",
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
                                <div style={{
                                  position: "absolute", inset: 0, background: "#ff000018",
                                  border: "2px solid #ff4444", pointerEvents: "none",
                                  display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                                  padding: 3,
                                }}>
                                  <span style={{ fontSize: 10 }}>⚠</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ color: "#151e2a", fontSize: 16 }}>+</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
            {(() => {
              const CELL_W = gridMetrics.cellW;
              const CELL_H = gridMetrics.cellH;
              const DEPTH_COL = gridMetrics.depthCol;
              const INSET = 5;
              const COLS = 7;
              const ROWS = 4;
              const EXCAVATED = Math.max(0, Math.min(ROWS, unlockedRows.length));
              const SURFACE_BAR_H = gridMetrics.surfaceBarH;

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
                  const r = 3;
                  holes.push(
                    `M ${x+r} ${y} L ${x+w-r} ${y} Q ${x+w} ${y} ${x+w} ${y+r} ` +
                    `L ${x+w} ${y+h-r} Q ${x+w} ${y+h} ${x+w-r} ${y+h} ` +
                    `L ${x+r} ${y+h} Q ${x} ${y+h} ${x} ${y+h-r} ` +
                    `L ${x} ${y+r} Q ${x} ${y} ${x+r} ${y} Z`
                  );
                }
              }
              const fullPath = [outer, ...holes].join(' ');

              return (
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: W,
                    height: H,
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <defs>
                    {/* Earth texture embedded directly in SVG — no z-index dependency */}
                    <pattern
                      id="earthPat"
                      x="0" y="0"
                      width={W} height={H}
                      patternUnits="userSpaceOnUse"
                    >
                      <image
                        href={earthTexture}
                        x="0" y="-30"
                        width={W} height={H + 60}
                        preserveAspectRatio="xMidYMid slice"
                      />
                      {/* Dark tint so it reads as underground not daylight */}
                      <rect width={W} height={H} fill="#000000" opacity="0.45" />
                    </pattern>
                  </defs>

                  {/* Earth texture fills the wall areas, holes punch through to rooms */}
                  <path
                    d={fullPath}
                    fill="url(#earthPat)"
                    fillRule="evenodd"
                  />

                  {/* Inner shadow on each hole for carved/recessed depth */}
                  {Array.from({ length: EXCAVATED }).map((_, row) =>
                    Array.from({ length: COLS }).map((_, col) => {
                      const x = DEPTH_COL + col * CELL_W + INSET;
                      const y = row * CELL_H + INSET;
                      const w = CELL_W - INSET * 2;
                      const h = CELL_H - INSET * 2;
                      return (
                        <rect
                          key={`${col}-${row}`}
                          x={x} y={y}
                          width={w} height={h}
                          fill="none"
                          stroke="#000000"
                          strokeWidth={14}
                          strokeOpacity={0.6}
                          rx={3}
                        />
                      );
                    })
                  )}
                </svg>
              );
            })()}
          </div>

          {/* ── Supply / Demand ── */}
          <div style={{ marginTop: 8, background: "#060810", border: "1px solid #1a2030", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>SUPPLY / DEMAND — NET FLOW PER TICK</div>
            {[
              { key: "energy", icon: "⚡", label: "Energy", color: "#f5a623" },
              { key: "food",   icon: "🌱", label: "Food",   color: "#7ed321" },
              { key: "water",  icon: "💧", label: "Water",  color: "#4a90e2" },
              { key: "morale", icon: "🧭", label: "Morale", color: "#d4a843" },
            ].map(({ key, icon, label, color }) => {
              const val    = key === "morale" ? (statBreakdown.morale?.net ?? 0) : (netFlow[key] || 0);
              const pct    = Math.min(Math.abs(val) / 12, 1) * 50;
              const surplus = val >= 0;
              const crit   = val < -5;
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHoveredFlowStat(key)}
                  onMouseLeave={() => setHoveredFlowStat(null)}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 58, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11 }}>{icon}</span>
                    <span style={{ fontSize: 9, color: "#3a5060" }}>{label}</span>
                  </div>
                  <div style={{ flex: 1, height: 12, background: "#0d1020", borderRadius: 6, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#1a2535", zIndex: 2 }} />
                    {val !== 0 && (
                      <div style={{
                        position: "absolute", top: 1, bottom: 1, borderRadius: 4,
                        left: surplus ? "50%" : `calc(50% - ${pct}%)`,
                        width: `${pct}%`,
                        background: crit ? "#c0392b" : surplus ? color : "#c0392b",
                        boxShadow: surplus ? `0 0 5px ${color}77` : "0 0 5px #c0392b77",
                        transition: "width 0.4s, left 0.4s",
                      }} />
                    )}
                  </div>
                  <div style={{ width: 36, textAlign: "right", fontSize: 10, fontFamily: "monospace", flexShrink: 0, fontWeight: "bold", color: crit ? "#ff4444" : surplus ? color : "#ff7755" }}>
                    {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                  </div>
                </div>
              );
            })}

            {hoveredFlowStat && statBreakdown[hoveredFlowStat] && (() => {
              const data = statBreakdown[hoveredFlowStat];
              return (
                <div style={{
                  position: "fixed",
                  left: mousePos.x + 14,
                  top: mousePos.y + 10,
                  background: "#0d1020",
                  border: "1px solid #2a3a4a",
                  borderRadius: 6,
                  padding: "8px 10px",
                  zIndex: 9999,
                  minWidth: 170,
                  maxWidth: 260,
                  pointerEvents: "none",
                  boxShadow: "0 0 14px #00000099",
                }}>
                  <div style={{ color: "#9ab", fontSize: 8, letterSpacing: 1, marginBottom: 4 }}>{hoveredFlowStat.toUpperCase()} MODIFIERS</div>
                  <div style={{ color: "#7ed321", fontSize: 8, marginBottom: 2 }}>+ Reasons</div>
                  {(data.plus.length ? data.plus : ["No major modifiers this tick"]).slice(0, 5).map((line, i) => (
                    <div key={`p-${i}`} style={{ color: "#6fa86f", fontSize: 8, lineHeight: 1.4 }}>• {line}</div>
                  ))}
                  <div style={{ color: "#ff7777", fontSize: 8, margin: "5px 0 2px" }}>– Reasons</div>
                  {(data.minus.length ? data.minus : ["No major modifiers this tick"]).slice(0, 5).map((line, i) => (
                    <div key={`m-${i}`} style={{ color: "#b67878", fontSize: 8, lineHeight: 1.4 }}>• {line}</div>
                  ))}
                  <div style={{ marginTop: 6, borderTop: "1px solid #1a2535", paddingTop: 4, color: "#8aa", fontSize: 8, fontFamily: "monospace" }}>
                    Net this tick: {data.net > 0 ? `+${data.net.toFixed(1)}` : data.net.toFixed(1)}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Colonist Roster ── */}
          <div style={{ marginTop: 8, background: "#060810", border: "1px solid #1a2030", borderRadius: 6, overflow: "hidden" }}>
            <div
              onClick={() => setRosterOpen(o => !o)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2 }}>
                COLONIST ROSTER — {totalColonists} PERSONNEL
              </div>
              <div style={{ color: "#2a4a6a", fontSize: 10 }}>{rosterOpen ? "▲" : "▼"}</div>
            </div>

            {rosterOpen && (
              <div style={{ padding: "0 12px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {colonists.map(col => {
                  const xpInLevel  = (col.xp ?? 0) % 20;
                  const hasPending = col.pendingTraitPick;
                  const borderColor = hasPending ? "#f5a623" : STATUS_COLOR[col.status];
                  return (
                    <div key={col.id}
                      onClick={() => setSelectedColonist(prev => prev === col.id ? null : col.id)}
                      onMouseEnter={() => setHoveredColonist(col.id)}
                      onMouseLeave={() => setHoveredColonist(null)}
                      style={{
                      display: "flex", alignItems: "flex-start", gap: 6,
                      background: hasPending ? "#1a1000" : selectedColonist === col.id ? "#0a1525" : "#0a0c14",
                      border: `1px solid ${selectedColonist === col.id ? "#4ab3f4" : borderColor}${hasPending ? "" : selectedColonist === col.id ? "" : "33"}`,
                      borderRadius: 5, padding: "4px 8px", minWidth: 130,
                      boxShadow: hasPending ? `0 0 8px #f5a62366` : selectedColonist === col.id ? "0 0 6px #4ab3f444" : "none",
                      cursor: "pointer",
                    }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                        background: STATUS_COLOR[col.status],
                        boxShadow: `0 0 4px ${STATUS_COLOR[col.status]}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ color: "#c8d0d8", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>
                            {col.name}
                          </div>
                          {(col.level ?? 0) > 0 && (
                            <div style={{ color: "#f5a623", fontSize: 7, background: "#1a1000", border: "1px solid #f5a62344", borderRadius: 3, padding: "0px 3px" }}>
                              Lv{col.level}
                            </div>
                          )}
                          {hasPending && <div style={{ color: "#f5a623", fontSize: 9 }}>⭐</div>}
                        </div>
                        {/* Status */}
                        <div style={{ color: STATUS_COLOR[col.status], fontSize: 7, letterSpacing: 1 }}>
                          {STATUS_LABEL[col.status]}
                        </div>
                        {/* Injury countdown */}
                        {col.status === "injured" && col.injuryTicksLeft > 0 && (
                          <div style={{ color: "#ff6b6b", fontSize: 7, letterSpacing: 0.5, marginTop: 1 }}>
                            ⚕ {col.injuryTicksLeft} tick{col.injuryTicksLeft !== 1 ? "s" : ""} to recover
                          </div>
                        )}
                        {/* XP bar */}
                        <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ flex: 1, height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 2,
                              width: `${(xpInLevel / 20) * 100}%`,
                              background: hasPending ? "#f5a623" : "#2a5a8a",
                              transition: "width 0.4s",
                            }} />
                          </div>
                          <div style={{ color: "#2a4a6a", fontSize: 6, fontFamily: "monospace", flexShrink: 0 }}>
                            {xpInLevel}/20
                          </div>
                        </div>
                        {/* Trait pips + quirk icon */}
                        <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                          {col.quirk && (
                            <div title={col.quirk.desc} style={{ fontSize: 8, background: "#0a0a18", border: "1px solid #2a2a5a44", borderRadius: 3, padding: "0 3px", color: "#9988cc" }}>
                              {col.quirk.icon}
                            </div>
                          )}
                          {col.traits && col.traits.map(t => (
                            <div key={t} title={TRAITS[t]?.desc} style={{
                              fontSize: 8, background: "#0a0a14",
                              border: `1px solid ${TRAITS[t]?.color ?? "#333"}44`,
                              borderRadius: 3, padding: "0 3px",
                              color: TRAITS[t]?.color ?? "#888",
                            }}>
                              {TRAITS[t]?.icon} {TRAITS[t]?.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 5, fontSize: 8, color: "#1a2535", letterSpacing: 1 }}>
            CLICK EMPTY CELL TO BUILD · CLICK CIRCLES TO ASSIGN WORKERS
          </div>
        </div>

        {/* ── COLONIST HOVER TOOLTIP (fixed, follows mouse) ── */}
        {hoveredColonist && (() => {
          const col = colonists.find(c => c.id === hoveredColonist);
          if (!col) return null;
          const statusColor = STATUS_COLOR[col.status] ?? "#888";
          return (
            <div style={{
              position: "fixed",
              left: mousePos.x + 14,
              top: mousePos.y + 10,
              background: "#0d1020", border: `1px solid ${statusColor}55`,
              borderRadius: 6, padding: "8px 12px", zIndex: 9999,
              minWidth: 150, maxWidth: 220, pointerEvents: "none",
              boxShadow: `0 0 16px #00000099, 0 0 8px ${statusColor}22`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: `0 0 4px ${statusColor}`, flexShrink: 0 }} />
                <span style={{ color: "#c8d0d8", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>{col.name}</span>
                {(col.level ?? 0) > 0 && (
                  <span style={{ color: "#f5a623", fontSize: 8, background: "#1a1000", border: "1px solid #f5a62344", borderRadius: 3, padding: "0 3px" }}>Lv{col.level}</span>
                )}
              </div>
              <div style={{ color: statusColor, fontSize: 8, letterSpacing: 1, marginBottom: col.quirk ? 5 : 0 }}>
                {STATUS_LABEL[col.status]}
                {col.status === "injured" && col.injuryTicksLeft > 0 ? ` — ${col.injuryTicksLeft}t` : ""}
              </div>
              {col.quirk && (
                <div style={{ color: "#9988cc", fontSize: 8, borderTop: "1px solid #1a1a2e", paddingTop: 4, marginTop: 2 }}>
                  {col.quirk.icon} <span style={{ color: "#7a6aaa" }}>{col.quirk.label}</span>
                </div>
              )}
              {col.backstory && (
                <div style={{ color: "#334455", fontSize: 7, marginTop: 4, lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid #111" , paddingTop: 4 }}>
                  {col.backstory.length > 80 ? col.backstory.slice(0, 80) + "…" : col.backstory}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── SIDE PANEL ── */}
        <div style={{ width: 205, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>

          {/* Log */}
          {journalOpen && (
            <div style={{ background: "#050710", border: "1px solid #0d1520", borderRadius: 8, padding: 10 }}>
              <div style={{ color: "#2a4a6a", fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>COLONY LOG</div>
              <div style={{ fontSize: 8, lineHeight: 1.9, maxHeight: 160, overflowY: "auto" }}>
                {log.map((entry, i) => (
                  <div key={i} style={{ color: i === 0 ? "#5a8ab0" : "#2a4060", borderBottom: "1px solid #0d1520", paddingBottom: 2, marginBottom: 2 }}>
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Colony Effects */}
          {effectsOpen && (
            <div style={{ background: "#0b0c12", border: "1px solid #2a2414", borderRadius: 8, padding: 10 }}>
              <div style={{ color: "#d4a843", fontSize: 9, letterSpacing: 2, marginBottom: 7 }}>🧪 COLONY EFFECTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 8 }}>
                <div style={{ color: "#8899aa" }}>
                  Surface: <span style={{ color: surfaceCondition.color }}>{surfaceCondition.icon} {surfaceCondition.label}</span>
                </div>
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

          {/* Colonist Detail Window */}
          {selectedColonist && (() => {
            const col = colonists.find(c => c.id === selectedColonist);
            if (!col) return null;
            const xpInLevel = (col.xp ?? 0) % 20;
            const statusColor = STATUS_COLOR[col.status] ?? "#888";
            return (
              <div style={{ background: "#080b14", border: "1px solid #1a2a3a", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 5px ${statusColor}`, flexShrink: 0 }} />
                    <div style={{ color: "#c8d0d8", fontSize: 11, fontWeight: "bold", letterSpacing: 1 }}>{col.name}</div>
                    {(col.level ?? 0) > 0 && (
                      <div style={{ color: col.level >= 3 ? "#ffd700" : "#aaaaaa", fontSize: 7, background: col.level >= 3 ? "#1a1400" : "#111", border: `1px solid ${col.level >= 3 ? "#ffd70044" : "#33333344"}`, borderRadius: 3, padding: "1px 4px" }}>LVL {col.level}</div>
                    )}
                  </div>
                  <button onClick={() => setSelectedColonist(null)} style={{ background: "none", border: "1px solid #1a2535", borderRadius: 3, color: "#445", padding: "1px 5px", cursor: "pointer", fontSize: 10 }}>✕</button>
                </div>
                <div style={{ color: statusColor, fontSize: 8, letterSpacing: 1, marginBottom: 8 }}>
                  {STATUS_LABEL[col.status]}{col.status === "injured" && col.injuryTicksLeft > 0 ? ` — ${col.injuryTicksLeft}t to recover` : ""}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 3 }}>EXPERIENCE — LVL {col.level ?? 0}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 5, background: "#1a1a2e", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(xpInLevel / 20) * 100}%`, background: "#2a5a8a", borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ color: "#2a4a6a", fontSize: 7, fontFamily: "monospace" }}>{xpInLevel}/20</div>
                  </div>
                </div>
                {col.traits && col.traits.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>TRAITS</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {col.traits.map(t => (
                        <div key={t} title={TRAITS[t]?.desc} style={{ fontSize: 8, background: "#0a0a14", border: `1px solid ${TRAITS[t]?.color ?? "#333"}44`, borderRadius: 3, padding: "1px 5px", color: TRAITS[t]?.color ?? "#888" }}>
                          {TRAITS[t]?.icon} {TRAITS[t]?.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {col.quirk && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>QUIRK</div>
                    <div style={{ background: "#0a0a18", border: "1px solid #2a2a5a", borderRadius: 4, padding: "5px 8px" }}>
                      <div style={{ color: "#9988cc", fontSize: 9, marginBottom: 2 }}>{col.quirk.icon} {col.quirk.label}</div>
                      <div style={{ color: "#556677", fontSize: 7, lineHeight: 1.5 }}>{col.quirk.desc}</div>
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>BACKGROUND</div>
                  <div style={{ color: "#445566", fontSize: 7, lineHeight: 1.6, fontStyle: "italic" }}>{col.backstory || "No record."}</div>
                </div>
                <div>
                  <div style={{ color: "#2a4a6a", fontSize: 7, letterSpacing: 1, marginBottom: 4 }}>SERVICE RECORD</div>
                  {[
                    ["Joined", tickToDayHour(col.joinTick ?? 0)],
                    ["Expeditions completed", col.expeditionsCompleted ?? 0],
                    ["Raids survived", col.raidsSurvived ?? 0],
                    ["Times injured", col.injuryCount ?? 0],
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

          {/* Room panel */}
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
                  <div style={{ color: "#667", fontSize: 9, marginBottom: 4 }}>
                    WORKERS: {selCell.workers}/{ROOM_TYPES[selCell.type].cap}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleAssign(selected.r, selected.c, -1)} style={{ flex: 1, background: "#1a0a0a", border: "1px solid #5a2a2a", borderRadius: 4, color: "#c44", padding: 4, cursor: "pointer", fontSize: 14 }}>−</button>
                    <button onClick={() => handleAssign(selected.r, selected.c,  1)} style={{ flex: 1, background: "#0a1a0a", border: "1px solid #2a5a2a", borderRadius: 4, color: "#4c4", padding: 4, cursor: "pointer", fontSize: 14 }}>+</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 8 }}>
                    {Object.entries(ROOM_TYPES[selCell.type].produces).map(([r, a]) =>
                      <div key={r} style={{ color: "#4a7a4a" }}>+{a * selCell.workers}/tick {r}</div>
                    )}
                    {Object.entries(ROOM_TYPES[selCell.type].consumes).map(([r, a]) =>
                      <div key={r} style={{ color: "#7a4a4a" }}>-{a * selCell.workers}/tick {r}</div>
                    )}
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
                  ) : (
                    <>
                      {/* Duration Picker */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>DURATION</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[20, 40, 60, 80].map(d => (
                            <button key={d} onClick={() => setExpedDuration(d)} style={{
                              flex: 1, background: expedDuration === d ? "#2a0008" : "#0a0a0a",
                              border: `1px solid ${expedDuration === d ? "#ff4444" : "#2a1a1a"}`,
                              borderRadius: 3, color: expedDuration === d ? "#ff6666" : "#443344",
                              padding: "3px 0", cursor: "pointer", fontSize: 8, fontFamily: "monospace",
                            }}>{d}t</button>
                          ))}
                        </div>
                        <div style={{ fontSize: 7, color: "#443333", marginTop: 3 }}>
                          ~{Math.floor(expedDuration / 8)} scav · ~{Math.floor(expedDuration / 6)} strike rolls
                        </div>
                      </div>

                      {/* Active expedition live panels */}
                      {expeditions.map(exp => {
                        const def = EXPEDITION_TYPES[exp.type];
                        const names = exp.colonistIds.map(id => colonists.find(c => c.id === id)?.name ?? "?").join(" & ");
                        const progressPct = ((exp.duration - exp.ticksLeft) / exp.duration) * 100;
                        const lastEvents = exp.eventLog.slice(-3);
                        const loot = exp.lootAccumulated;
                        const lootStr = [
                          loot.scrap   > 0 && `+${loot.scrap}⚙`,
                          loot.salvage > 0 && `+${loot.salvage}🔩`,
                          loot.arcTech > 0 && `+${loot.arcTech}⚙️`,
                          loot.survivor && "🧍survivor",
                        ].filter(Boolean).join(" · ");
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
                            {lastEvents.length > 0 && lastEvents.map((evt, i) => (
                              <div key={i} style={{ fontSize: 7, color: "#664444", lineHeight: 1.5, fontFamily: "monospace" }}>{evt}</div>
                            ))}
                            {lootStr && <div style={{ marginTop: 3, fontSize: 7, color: "#556633" }}>🎒 {lootStr}</div>}
                          </div>
                        );
                      })}

                      {/* Launch buttons */}
                      {expeditions.length < 2 ? (
                        <div>
                          <div style={{ color: "#884444", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>LAUNCH EXPEDITION</div>
                          {Object.entries(EXPEDITION_TYPES).map(([key, def]) => {
                            const canSend = unassigned >= def.colonistsRequired;
                            return (
                              <button key={key} onClick={() => handleLaunchExpedition(key)} disabled={!canSend} style={{
                                display: "block", width: "100%", marginBottom: 6,
                                background: canSend ? "#100008" : "#0a0a0a",
                                border: `1px solid ${canSend ? def.color : "#1a1a1a"}`,
                                borderRadius: 5, padding: "7px 8px",
                                cursor: canSend ? "pointer" : "not-allowed", textAlign: "left",
                              }}>
                                <div style={{ fontSize: 11, color: canSend ? def.color : "#333" }}>{def.icon} {def.label}</div>
                                <div style={{ fontSize: 7, color: canSend ? "#556" : "#222", marginTop: 2, lineHeight: 1.4 }}>{def.desc}</div>
                                <div style={{ fontSize: 7, color: canSend ? "#883333" : "#222", marginTop: 3 }}>
                                  {def.colonistsRequired} colonist · {expedDuration}t · heat +{def.threatDelta}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: 8, color: "#5a3a3a", border: "1px solid #3a1a1a", borderRadius: 4, padding: "6px 8px", textAlign: "center" }}>
                          Max 2 expeditions active
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Hospital patient list */}
              {selCell.type === "hospital" && (() => {
                const injured = colonists.filter(c => c.status === "injured");
                const nurseCount = selCell.workers;
                const capacity   = nurseCount * 3;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "#ff6b9d", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
                      PATIENTS — {injured.length} in recovery
                    </div>
                    {nurseCount === 0 && injured.length > 0 && (
                      <div style={{ fontSize: 8, color: "#7a4a4a", background: "#1a0008", border: "1px solid #5a2030", borderRadius: 4, padding: "5px 7px", marginBottom: 6 }}>
                        ⚠ No nurses assigned — healing at 25% speed
                      </div>
                    )}
                    {nurseCount > 0 && (
                      <div style={{ fontSize: 8, color: "#556", marginBottom: 6 }}>
                        {nurseCount} nurse{nurseCount > 1 ? "s" : ""} · treating up to {capacity} patients
                      </div>
                    )}
                    {injured.length === 0 ? (
                      <div style={{ fontSize: 8, color: "#334", fontStyle: "italic" }}>No patients currently.</div>
                    ) : (
                      injured.map(col => (
                        <div key={col.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#100008", border: "1px solid #ff6b9d33", borderRadius: 4, padding: "4px 7px", marginBottom: 4 }}>
                          <div style={{ color: "#c8d0d8", fontSize: 9 }}>{col.name}</div>
                          <div style={{ color: "#ff6b9d", fontSize: 8, fontFamily: "monospace" }}>
                            ⚕ {col.injuryTicksLeft ?? 0}t
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}

              {/* Research Lab tech tree */}
              {selCell.type === "researchLab" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ color: "#00e5ff", fontSize: 9, letterSpacing: 1 }}>T2 TECHNOLOGIES</div>
                    <div style={{ color: "#00e5ff", fontSize: 9, fontFamily: "monospace" }}>{Math.floor(res.rp)} RP</div>
                  </div>
                  {Object.entries(T2_TECHS).map(([key, tech]) => {
                    const unlocked   = unlockedTechs.includes(key);
                    const canAfford  = res.rp >= tech.cost;
                    return (
                      <div key={key} style={{
                        marginBottom: 6, background: unlocked ? "#001a10" : "#0a0c14",
                        border: `1px solid ${unlocked ? "#00e5ff" : canAfford ? "#00e5ff44" : "#1a2030"}`,
                        borderRadius: 5, padding: "6px 8px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <div style={{ color: unlocked ? "#00e5ff" : canAfford ? "#aaa" : "#445", fontSize: 10 }}>
                            {tech.icon} {tech.label}
                          </div>
                          {unlocked ? (
                            <div style={{ color: "#00e5ff", fontSize: 8 }}>✓ DONE</div>
                          ) : (
                            <button onClick={() => handleUnlockTech(key)} disabled={!canAfford} style={{
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

              {/* Shelter panel */}
              {selCell.type === "shelter" && (() => {
                const sheltered = colonists.filter(c => c.status === "sheltered");
                const alarmOn   = sheltered.length > 0;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "#7ecfb4", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
                      SHELTER STATUS — {sheltered.length} sheltering
                    </div>
                    {alarmOn ? (
                      <>
                        <div style={{ background: "#001a0f", border: "1px solid #7ecfb433", borderRadius: 4, padding: "6px 8px", marginBottom: 8 }}>
                          {sheltered.map(col => (
                            <div key={col.id} style={{ color: "#7ecfb4", fontSize: 9, paddingBottom: 2 }}>🏠 {col.name}</div>
                          ))}
                        </div>
                        <button onClick={handleBackToWork} style={{ width: "100%", background: "#001a0f", border: "1px solid #7ecfb4", borderRadius: 4, color: "#7ecfb4", padding: "6px 8px", cursor: "pointer", fontSize: 9, letterSpacing: 1 }}>
                          🏠 BACK TO WORK
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 8, color: "#446655", marginBottom: 6 }}>
                          Sounds the alarm and pulls all idle/working colonists into shelter. Production stops but they cannot be targeted by Arc strikes.
                        </div>
                        <button onClick={handleSoundAlarm} style={{ width: "100%", background: "#1a0808", border: "1px solid #ff4444", borderRadius: 4, color: "#ff6666", padding: "6px 8px", cursor: "pointer", fontSize: 9, letterSpacing: 1 }}>
                          🚨 SOUND ALARM
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Sentry Post status */}
              {selCell.type === "sentryPost" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: "#e8d44d", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>SENTRY STATUS</div>
                  <div style={{ background: "#0d0f00", border: "1px solid #e8d44d33", borderRadius: 4, padding: "6px 8px" }}>
                    {selCell.workers === 0 ? (
                      <div style={{ color: "#5a5020", fontSize: 8 }}>No sentries assigned.</div>
                    ) : (
                      <>
                        <div style={{ color: "#c8d0d8", fontSize: 9 }}>🪖 {selCell.workers} sentry{selCell.workers > 1 ? "ies" : ""} active</div>
                        <div style={{ color: "#e8d44d", fontSize: 8, marginTop: 3 }}>-{selCell.workers * 5} heat/tick</div>
                        <div style={{ color: "#5a5020", fontSize: 7, marginTop: 2 }}>Sentries are exposed during raids.</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => { setSelected(null); setBuildMenu(false); }} style={{ flex: 1, background: "none", border: "1px solid #1e2a3a", borderRadius: 4, color: "#445", padding: 4, cursor: "pointer", fontSize: 9 }}>CLOSE</button>
                {selCell.damaged && (
                  <button onClick={() => handleRepair(selected.r, selected.c)} style={{ flex: 1, background: "#001a0a", border: "1px solid #20a040", borderRadius: 4, color: "#4ca060", padding: 4, cursor: "pointer", fontSize: 9 }}>🔧 REPAIR (20 scrap)</button>
                )}
                <button onClick={() => handleDemolish(selected.r, selected.c)} style={{ flex: 1, background: "#1a0000", border: "1px solid #5a2020", borderRadius: 4, color: "#844", padding: 4, cursor: "pointer", fontSize: 9 }}>DEMOLISH</button>
              </div>
            </div>
          )}

          {/* Default: memorial wall or hint */}
          {!selected && (
            <div style={{ background: "#080b14", border: "1px solid #1a2030", borderRadius: 8, padding: 10 }}>
              {memorial.length > 0 ? (
                <>
                  <div style={{ color: "#7a6a4a", fontSize: 9, letterSpacing: 2, marginBottom: 8, borderBottom: "1px solid #2a1a0a", paddingBottom: 6 }}>
                    🕯 MEMORIAL
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {memorial.map((entry, i) => (
                      <div key={entry.id ?? i} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: i < memorial.length - 1 ? "1px solid #1a1a2a" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ color: "#c8d0d8", fontSize: 9, fontWeight: "bold" }}>{entry.name}</span>
                          <span style={{ color: "#555", fontSize: 7 }}>LVL {entry.level}</span>
                        </div>
                        <div style={{ color: "#c87a30", fontSize: 7, letterSpacing: 0.5, marginBottom: 3 }}>
                          {entry.cause === "raidKilled"       ? "Killed in raid"      :
                           entry.cause === "expeditionKilled" ? "Killed on expedition":
                           entry.cause === "raidFled"         ? "Fled during raid"    : "Left the colony"}
                          {" — "}DAY {entry.day} · {entry.hour}
                        </div>
                        <div style={{ color: "#445", fontSize: 7, fontStyle: "italic", lineHeight: 1.5 }}>{entry.epitaph}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: "#2a3a4a", fontSize: 9, textAlign: "center", padding: "10px 0", letterSpacing: 1 }}>
                  Select a cell to build or manage a room
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div style={{ maxWidth: 920, width: "100%", marginTop: 6, fontSize: 8, color: "#1a2535", letterSpacing: 1, textAlign: "center" }}>
        BUILD ARMORY + ASSIGN ARMORER → LAUNCH EXPEDITIONS · HIGH THREAT = ARC RAIDS · WORKSHOP IS YOUR LIFELINE
      </div>

      <ToastPanel
        toasts={toasts}
        milestoneToast={milestoneToast}
        onDismiss={(id) => {
          setToasts(prev => {
            const next = prev.filter(t => t.id !== id);
            if (next.length === 0) setTimescale(timescaleBeforeToastRef.current);
            return next;
          });
        }}
        onDismissAll={() => {
          setToasts([]);
          setTimescale(timescaleBeforeToastRef.current);
        }}
      />

    </div>
  );
}
