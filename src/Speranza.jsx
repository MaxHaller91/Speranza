import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  duckMusic, unduckMusic, playTickAlarm, playAutosave,
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
  HEAT_RAID_GAIN,
  calcHeatDelta, calcRaidChance, RAID_ROLL_EVERY,
  RAID_COOLDOWN_TICKS, RAID_GRACE_TICKS, raidCooldownFor,
  HEAT_RELIEF_RAID_SURVIVED, HEAT_RELIEF_BARRICADE,
  getHeatState, INJURY_TICKS_BASE, HEAL_RATE_NURSE,
  RAID_SIZES, RAID_SIZE_ORDER, RAID_LAUNCH_CHANCE,
  DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY,
  TALENTS, TALENT_ORDER, talentEffects, resolveEarned,
  T2_TECHS, TRAITS, TRAIT_KEYS,
  makeColonist, ROOM_TYPES, EXCAVATION_DEFS,
  EXPEDITION_TYPES, EXPEDITION_ROLL_TABLES, applyMoraleModifier,
  DRAIN_PER_COL, clamp, EMPTY_STAT_BREAKDOWN,
  deprivationStage, ticksToEmpty,
  DEPRIVE_COLLAPSE_TICKS, DEPRIVE_DEATH_TICKS,
  DEPRIVE_COLLAPSE_CHANCE, DEPRIVE_DEATH_CHANCE, DEPRIVE_MORALE_PER_TICK,
  isSaveLockedByRaidState,
  calcColonyWealth, getWealthBracket,
  weightedTargetPick, initColonists, initGrid, INIT_RES,
  STATUS_COLOR, STATUS_LABEL, tickToDayHour, checkMilestoneTrigger,
  earthTexture,
  reconcileGridWorkers, pruneInvalidAssignments, postStatusFor, isOnPost,
  occupiedSeats, reclaimPost, advanceExpeditions,
  calcAdjacency, calcAdjacencyMorale,
} from "./gameData.js";
import SurfaceDefense from './surface_defense';
import SkyBackground   from './components/SkyBackground.jsx';
import RaidBanner      from './components/RaidBanner.jsx';
import GameOverModal   from './components/GameOverModal.jsx';
import StartScreen     from './components/StartScreen.jsx';
import TalentScreen    from './components/TalentScreen.jsx';
import DilemmaModal    from './components/DilemmaModal.jsx';
import TraitPicker     from './components/TraitPicker.jsx';
import BuildMenu       from './components/BuildMenu.jsx';
import ToastPanel      from './components/ToastPanel.jsx';
import ColonyHeader   from './components/ColonyHeader.jsx';
import FlowPanel      from './components/FlowPanel.jsx';
import ColonistRoster from './components/ColonistRoster.jsx';
import ColonyGrid     from './components/ColonyGrid.jsx';
import SidePanel      from './components/SidePanel.jsx';
import HelpModal      from './components/HelpModal.jsx';
import CrisisBanner   from './components/CrisisBanner.jsx';

export default function Speranza() {
  const [grid,       setGrid]       = useState(initGrid);
  const [res,        setRes]        = useState(INIT_RES);
  const [colonists,  setColonists]  = useState(initColonists); // array of colonist objects
  const [heat,       setHeat]       = useState(0);
  const [expeditions,  setExpeditions]  = useState([]);
  // The player names their own colony. It is what the game-over screen
  // mourns, which turns "a colony died" into "KESTREL DEEP died on day 34".
  const [colonyName, setColonyName] = useState("SPERANZA");
  // Chosen at new-colony time (game-over "NEW COLONY" screen); persists in
  // the save and is shown on the next game-over screen. Existing saves with
  // no difficulty field default to survivor.
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [expedDuration, setExpedDuration] = useState(40);
  // Launch draft — the player picks a destination and an exact crew before
  // committing, instead of the game grabbing whoever happened to be idle first.
  const [expedLocationId, setExpedLocationId] = useState(SURFACE_LOCATIONS[0].id);
  const [expedCrewIds,    setExpedCrewIds]    = useState([]);
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
  const [pendingWealthBracket, setPendingWealthBracket] = useState(0);
  const [toasts,     setToasts]     = useState([]);
  // raidWindow: null | { sizeIdx: 0|1|2, escalations: number }
  // sizeIdx indexes into RAID_SIZE_ORDER
  const [raidWindow,    setRaidWindow]    = useState(null);
  const [unlockedTechs, setUnlockedTechs] = useState([]);
  // 0 = paused, otherwise multiplier applied to TICK_MS
  const TIMESCALES = [0, 0.5, 1, 2, 4, 10];
  // `timescale` is DERIVED further down — see "Pause ownership" — from the
  // player's chosen speed and whatever is currently blocking the clock.
  // These two are the only stored pieces:
  //   speed       — what the player picked. Never 0, never written by an overlay.
  //   manualPause — the player's own pause toggle.
  const [speed,       setSpeed]       = useState(1);
  const [manualPause, setManualPause] = useState(false);
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
  // Help / quickstart modal
  const HELP_SEEN_KEY = "speranza_help_seen";
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPage, setHelpPage] = useState(0);
  const [recentDilemmaOutcomes, setRecentDilemmaOutcomes] = useState([]);
  // False until the player presses BEGIN on the start screen. Loading a save
  // also counts as starting — you already have a colony at that point.
  const [runStarted, setRunStarted] = useState(false);

  // ── Meta-progression ──────────────────────────────────────────────────────
  // Resolve and talents deliberately live OUTSIDE the run save. They survive
  // losing a colony — that is the whole point of a roguelike meta-currency: a
  // failed run still moves you forward. Stored under their own localStorage key
  // so importing someone else's save cannot hand you their unlocks.
  const META_KEY = "speranza_meta";
  const [resolve, setResolve] = useState(0);
  const [talents, setTalents] = useState([]);
  const [talentScreenOpen, setTalentScreenOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(META_KEY) || "{}");
      if (Number.isFinite(raw.resolve)) setResolve(raw.resolve);
      if (Array.isArray(raw.talents)) setTalents(raw.talents.filter(k => TALENTS[k]));
    } catch { /* corrupt meta should never block starting a game */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(META_KEY, JSON.stringify({ resolve, talents })); } catch {}
  }, [resolve, talents]);

  // Every talent-modified value the game reads, in one place.
  const effects = useMemo(() => talentEffects(talents), [talents]);
  const effectsRef = useRef(effects);
  useEffect(() => { effectsRef.current = effects; }, [effects]);

  // ── Pause ownership ───────────────────────────────────────────────────────
  // ONE place decides whether the clock runs. Previously five callers wrote
  // `timescale` independently — the help modal, an overlay effect that had
  // `timescale` in its own deps and so fought anything else that set it, raid
  // prep, the dilemma trigger, and save-load — and an overlay restored the old
  // speed from a ref afterwards. Dismissing a toast at 10x silently dropped you
  // to 1x, and a harness calling setTimescale(10) was overwritten within a frame.
  //
  // Now: overlays do not write the clock at all. They ARE the pause, by virtue of
  // being open, and `timescale` is derived. Nothing to restore, nothing to race.
  // To add a new blocking overlay, add one line to this list — do not call
  // setTimescale anywhere.
  const pauseReason =
      !runStarted                               ? "startScreen"
    : gameOver                                  ? "gameOver"
    : colonists.some(c => c.pendingTraitPick)   ? "traitPicker"
    : activeDilemma                             ? "dilemma"
    : milestoneToast                            ? "milestone"
    : helpOpen                                  ? "help"
    : surfaceDefenseActive                      ? "surfaceDefense"
    : (buildMenu && selected && grid[selected.r]?.[selected.c] && !grid[selected.r][selected.c].type) ? "buildMenu"
    // Talents sit low: it is a screen the player opened, so anything the *game*
    // raised should be the reported reason when both are up. The clock stops
    // either way — order only decides which cause gets named.
    : talentScreenOpen                          ? "talents"
    : manualPause                               ? "manual"
    : null;
  const timescale = pauseReason ? 0 : speed;

  // Compatibility shim so call sites (keybindings, the header, the dev hook)
  // keep the familiar `setTimescale(n)` shape. 0 means "the player pressed
  // pause"; anything else sets their speed and clears a manual pause. It can
  // never override an overlay — that is the point.
  const setTimescale = useCallback((v) => {
    if (v === 0) { setManualPause(true); return; }
    setManualPause(false);
    setSpeed(v);
  }, []);

  const [historyLog,            setHistoryLog]            = useState([]);
  const [heatSuppressedTicks,   setHeatSuppressedTicks]   = useState(0);
  // Consecutive ticks with food or water at zero. Drives the starvation stages.
  const [deprivedTicks,         setDeprivedTicks]         = useState(0);
  const deprivedTicksRef = useRef(0);
  // Mirrors for timers/flags the tick loop advances directly, now that those
  // rolls happen in the loop body instead of inside state updaters.
  const surfaceConditionTimerRef = useRef(0);
  const surfaceRotateAtRef       = useRef(80 + Math.floor(Math.random() * 41));
  const dilemmaTimerRef          = useRef(0);
  const activeDilemmaRef         = useRef(null);
  const tickHistoryRef = useRef([]);
  const eventTraceRef = useRef([]);
  const currentTickToastTagsRef = useRef([]);
  const deferredAutosaveRef = useRef(false);

  const SAVE_VERSION = 1;
  const AUTOSAVE_SLOT_COUNT = 3;
  const SAVE_SLOT_PREFIX = "speranza.autosave.slot.";
  const SAVE_SLOT_INDEX_KEY = "speranza.autosave.nextSlot";

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
  const resRef            = useRef(res);
  const surfaceDefenseActiveRef = useRef(surfaceDefenseActive);
  useEffect(() => { timescaleRef.current     = timescale;     }, [timescale]);
  useEffect(() => { tickRef.current          = tick;          }, [tick]);
  useEffect(() => { activeRaidRef.current    = activeRaid;    }, [activeRaid]);
  useEffect(() => { resRef.current           = res;           }, [res]);
  useEffect(() => { surfaceDefenseActiveRef.current = surfaceDefenseActive; }, [surfaceDefenseActive]);
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
  useEffect(() => { activeDilemmaRef.current    = activeDilemma;    }, [activeDilemma]);
  useEffect(() => { surfaceConditionTimerRef.current = surfaceConditionTimer; }, [surfaceConditionTimer]);
  useEffect(() => { dilemmaTimerRef.current     = dilemmaTimer;     }, [dilemmaTimer]);
  useEffect(() => { heatSuppressedTicksRef.current = heatSuppressedTicks; }, [heatSuppressedTicks]);
  // Raid cooldown — starts at 48 (one in-game day) to block raids on fresh game
  const raidCooldownTicksRef = useRef(RAID_GRACE_TICKS);
  // The tick interval only depends on [timescale] (rule 3), so it reads
  // difficulty through refs rather than the state variable directly.
  // difficultyRef holds the raw key (e.g. for the game-over report);
  // diffConfigRef holds the resolved multiplier object every lever reads.
  const difficultyRef = useRef(difficulty);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  const diffConfig = DIFFICULTIES[difficulty] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
  const diffConfigRef = useRef(diffConfig);
  useEffect(() => { diffConfigRef.current = diffConfig; }, [diffConfig]);

  // ── Assignment reconciler ────────────────────────────────────────────────
  // Single source of truth: a colonist's `assignedRoom` decides staffing, and
  // `cell.workers` is only ever a mirror of it. Nothing else may write workers.
  // Both helpers return their input reference when there is nothing to change,
  // so setState bails out and this converges in at most two passes.
  useEffect(() => {
    setColonists(prev => pruneInvalidAssignments(prev, gridRef.current));
    setGrid(prev => reconcileGridWorkers(prev, colonistsRef.current));
  }, [colonists, grid]);

  // ── Auto-open help modal on first play ──────────────────────────────────
  useEffect(() => {
    // Wait for BEGIN — otherwise the help modal stacks on top of the start
    // screen and the player meets two dialogs before seeing the game.
    if (!runStarted) return;
    if (!localStorage.getItem(HELP_SEEN_KEY)) {
      setHelpOpen(true); // `helpOpen` is itself a pause reason — see pauseReason
    }
  }, [runStarted]);

  const handleCloseHelp = () => {
    localStorage.setItem(HELP_SEEN_KEY, "1");
    setHelpOpen(false);
    setHelpPage(0);
    // No setTimescale here. Closing the modal clears the pause reason, and the
    // player's chosen speed is still whatever they had — it was never clobbered.
  };

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

  const buildSaveState = useCallback((source = null) => {
    const s = source ?? {
      tick,
      colonyName,
      difficulty,
      res,
      heat,
      morale,
      grid,
      colonists,
      unlockedRows,
      excavations,
      expeditions,
      expedDuration,
      expedLocationId,
      surfaceHaul,
      unlockedTechs,
      memorial,
      raidsRepelled,
      largeRaidsRepelled,
      expeditionsCompleted,
      surfaceCondition,
      surfaceConditionTimer,
      peakPopulation,
      firedMilestones,
      firedDilemmas,
      recentDilemmaOutcomes,
      historyLog,
      heatSuppressedTicks,
      deprivedTicks,
      dilemmaTimer,
      activeDilemma,
    };

    return {
      tick: s.tick,
      colonyName: s.colonyName,
      difficulty: s.difficulty,
      res: s.res,
      heat: s.heat,
      morale: s.morale,
      grid: s.grid,
      colonists: s.colonists,
      unlockedRows: s.unlockedRows,
      excavations: s.excavations,
      expeditions: s.expeditions,
      expedDuration: s.expedDuration,
      expedLocationId: s.expedLocationId,
      surfaceHaul: s.surfaceHaul,
      unlockedTechs: s.unlockedTechs,
      memorial: s.memorial,
      raidsRepelled: s.raidsRepelled,
      largeRaidsRepelled: s.largeRaidsRepelled,
      expeditionsCompleted: s.expeditionsCompleted,
      surfaceCondition: s.surfaceCondition,
      surfaceConditionTimer: s.surfaceConditionTimer,
      peakPopulation: s.peakPopulation,
      firedMilestones: s.firedMilestones,
      firedDilemmas: s.firedDilemmas,
      recentDilemmaOutcomes: s.recentDilemmaOutcomes,
      historyLog: s.historyLog,
      heatSuppressedTicks: s.heatSuppressedTicks,
      deprivedTicks: s.deprivedTicks,
      dilemmaTimer: s.dilemmaTimer,
      activeDilemma: s.activeDilemma,
      activeRaid: null,
      raidWindow: null,
      surfaceDefenseActive: false,
      pendingRaidSize: null,
      timescale: 0,
    };
  }, [
    tick, colonyName, difficulty, res, heat, morale, grid, colonists,
    unlockedRows, excavations, expeditions, expedDuration, expedLocationId,
    surfaceHaul, unlockedTechs, memorial,
    raidsRepelled, largeRaidsRepelled, expeditionsCompleted,
    surfaceCondition, surfaceConditionTimer, peakPopulation,
    firedMilestones, firedDilemmas, recentDilemmaOutcomes,
    historyLog, heatSuppressedTicks, deprivedTicks, dilemmaTimer, activeDilemma,
  ]);

  const buildSavePayload = useCallback((source = null) => ({
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta: {
      day: Math.floor((source?.tick ?? tickRef.current) / 48) + 1,
      tick: source?.tick ?? tickRef.current,
    },
    state: buildSaveState(source),
  }), [buildSaveState]);

  const readNextAutosaveSlot = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_SLOT_INDEX_KEY);
      const parsed = Number(raw ?? 0);
      if (!Number.isFinite(parsed)) return 0;
      return ((parsed % AUTOSAVE_SLOT_COUNT) + AUTOSAVE_SLOT_COUNT) % AUTOSAVE_SLOT_COUNT;
    } catch {
      return 0;
    }
  }, []);

  const writeAutosaveToStorage = useCallback((payload) => {
    try {
      const slot = readNextAutosaveSlot();
      window.localStorage.setItem(`${SAVE_SLOT_PREFIX}${slot}`, JSON.stringify(payload));
      window.localStorage.setItem(SAVE_SLOT_INDEX_KEY, String((slot + 1) % AUTOSAVE_SLOT_COUNT));
      return true;
    } catch {
      return false;
    }
  }, [readNextAutosaveSlot]);

  const readLatestAutosaveFromStorage = useCallback(() => {
    try {
      const next = readNextAutosaveSlot();
      for (let i = 1; i <= AUTOSAVE_SLOT_COUNT; i++) {
        const slot = (next - i + AUTOSAVE_SLOT_COUNT) % AUTOSAVE_SLOT_COUNT;
        const raw = window.localStorage.getItem(`${SAVE_SLOT_PREFIX}${slot}`);
        if (!raw) continue;
        return JSON.parse(raw);
      }
      return null;
    } catch {
      return null;
    }
  }, [readNextAutosaveSlot]);

  const toastDedupeRef = useRef(new Map());

  const pushEventTrace = useCallback((type, entity = null, detail = null, tickOverride = null) => {
    const traceTick = tickOverride ?? tickRef.current;
    eventTraceRef.current = [
      ...eventTraceRef.current,
      { tick: traceTick, type, entity, detail },
    ].slice(-30);
  }, []);

  const prevSurfaceDefenseActiveRef = useRef(surfaceDefenseActive);
  useEffect(() => {
    const prev = prevSurfaceDefenseActiveRef.current;
    if (!prev && surfaceDefenseActive) pushEventTrace("surface_defense_started", null, null);
    if (prev && !surfaceDefenseActive) pushEventTrace("surface_defense_ended", null, null);
    prevSurfaceDefenseActiveRef.current = surfaceDefenseActive;
  }, [surfaceDefenseActive, pushEventTrace]);

  const addToast = useCallback((message, type = "info", opts = {}) => {
    const dedupeKey = opts.key ?? `${type}:${message}`;
    const messageKey = String(message)
      .split("\n")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const debugTag = opts.debugTag
      ?? (typeof opts.key === "string" ? opts.key.replace(/-/g, "_") : (messageKey || `${type}_toast`));
    const dedupeMs = opts.dedupeMs ?? 1200;
    const now = Date.now();
    const last = toastDedupeRef.current.get(dedupeKey);
    if (last && now - last < dedupeMs) return;
    toastDedupeRef.current.set(dedupeKey, now);
    currentTickToastTagsRef.current.push(debugTag);

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

  // The overlay-pause effect that used to live here is gone. It wrote
  // `timescale` while also depending on it, so it fought every other caller.
  // Overlays are now pause *reasons* in the derived `pauseReason` above.
  //
  // Note the colony log and effects panels are deliberately NOT pause reasons:
  // they are read-only side panels, and they used to stop the colony
  // indefinitely with no visible cause.

  const changeMorale = useCallback((delta, reason) => {
    // Difficulty and the Steady Hands talent only soften losses, never amplify
    // gains — otherwise "reduces morale loss" would also shrink every reward.
    const scaled = delta < 0
      ? delta * diffConfigRef.current.moraleDrainMult * effectsRef.current.moraleDrainMult
      : delta;
    setMorale(prev => clamp(prev + scaled, -100, 100));
    moraleEventDeltasRef.current.push({ delta: scaled, reason: reason ?? "morale event" });
    if (Math.abs(scaled) >= 10) {
      const shown = Number.isInteger(scaled) ? scaled : scaled.toFixed(1);
      addLog(`${scaled > 0 ? "📈" : "📉"} Morale ${scaled > 0 ? "+" : ""}${shown} — ${reason}`);
    }
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

  // ── Expedition intents ────────────────────────────────────────────────────
  // advanceExpeditions() is pure and hands back declarative intents; this is the
  // one place they turn into colony state, logs, sounds and morale. Everything
  // here must be safe to run exactly once per intent — no RNG decisions that
  // the pure transition already made, and no work inside a state updater beyond
  // a deterministic map.
  const applyExpeditionIntent = useCallback((intent) => {
    switch (intent.type) {
      case "injureColonist":
        setColonists(prev => prev.map(c => c.id === intent.colonistId
          ? { ...c, status: "injured", previousRoom: c.assignedRoom ?? c.previousRoom ?? null,
              assignedRoom: null, injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 }
          : c));
        break;

      case "killColonist":
        setColonists(prev => prev.filter(c => c.id !== intent.colonist.id));
        addToMemorialRef.current(intent.colonist, "expeditionKilled", tickRef.current);
        pushEventTrace("colonist_killed", intent.colonist.name, "expedition");
        break;

      case "collectLoot": {
        const loot = intent.loot;
        if (loot.scrap || loot.food) setRes(p => ({
          ...p,
          scrap: clamp(p.scrap + (loot.scrap || 0), 0, MAX_RES),
          food:  clamp(p.food  + (loot.food  || 0), 0, MAX_RES),
        }));
        if (loot.salvage || loot.arcTech || loot.schematicFound) {
          setSurfaceHaul(p => ({
            salvage:    p.salvage + (loot.salvage || 0),
            arcTech:    p.arcTech + (loot.arcTech || 0),
            schematics: loot.schematicFound && !p.schematics.includes(loot.schematicFound)
              ? [...p.schematics, loot.schematicFound]
              : p.schematics,
          }));
        }
        break;
      }

      case "survivor": {
        if (colonistsRef.current.length >= calcPopCap(gridRef.current)) {
          addLog("🧍 A survivor was found topside — but there is nowhere to put them.");
          break;
        }
        const newCol = makeColonist(tickRef.current);
        setColonists(p => [...p, newCol]);
        addLog(`🧍 Surface survivor found — ${newCol.name} joined the colony!`);
        break;
      }

      case "returnCrew":
        // Deterministic map — safe as an updater, and it needs the freshest
        // seat counts to decide who can reclaim their old post.
        setColonists(prev => {
          const seats = occupiedSeats(prev);
          return prev.map(c => {
            if (!intent.colonistIds.includes(c.id)) return c;
            const { room, ...patch } = reclaimPost(c, gridRef.current, seats);
            return { ...c, ...patch, expeditionsCompleted: (c.expeditionsCompleted ?? 0) + 1 };
          });
        });
        break;

      case "expeditionComplete":
        setExpeditionsCompleted(prev => {
          const next = prev + 1;
          expeditionsCompletedRef.current = next;
          if (next === 1) addHistoryRef.current("🗺", "First expedition returned");
          return next;
        });
        break;

      case "morale": changeMoraleRef.current(intent.delta, intent.reason); break;
      case "log":    addLog(intent.text); break;
      case "toast":  addToast(intent.message, intent.kind, intent.opts); break;
      case "trace":  pushEventTrace(intent.event, intent.entity ?? null, intent.detail ?? null); break;
      case "sound":
        if (intent.name === "injury")  playInjury();
        if (intent.name === "kill")    playKill();
        if (intent.name === "success") playSuccess();
        break;
      default: break;
    }
  }, [addLog, addToast, pushEventTrace]);
  const applyExpeditionIntentRef = useRef(applyExpeditionIntent);
  useEffect(() => { applyExpeditionIntentRef.current = applyExpeditionIntent; }, [applyExpeditionIntent]);

  // ── Milestone checker ─────────────────────────────────────────────────────
  const checkMilestones = useCallback((snap) => {
    for (const m of MILESTONES) {
      if (firedMilestonesRef.current.includes(m.id)) continue;
      if (checkMilestoneTrigger(m.trigger, snap)) {
        // Sync the ref here, not via the effect. checkMilestones runs from the
        // tick loop AND from raid-end; two calls in one tick both read a stale
        // ref and fire the same milestone twice.
        firedMilestonesRef.current = [...firedMilestonesRef.current, m.id];
        setFiredMilestones(prev => prev.includes(m.id) ? prev : [...prev, m.id]);
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

  const downloadBugReport = useCallback((description) => {
    const now = new Date();
    const payload = {
      appVersion: "dev",
      description,
      timestamp: now.toISOString(),
      tick,
      day: Math.floor(tick / 48),
      recentHistory: tickHistoryRef.current,
      eventTrace: eventTraceRef.current,
      lastLogEntries: log.slice(0, 20),
      fullState: {
        res,
        heat,
        morale,
        grid,
        colonists,
        activeRaid,
        raidWindow,
        surfaceDefenseActive,
        unlockedRows,
        excavations,
        expeditions,
        unlockedTechs,
        surfaceHaul,
        memorial,
        timescale,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const datePart = now.toISOString().slice(0, 10);
    a.href = url;
    a.download = `speranza-bug-${datePart}-tick-${tick}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tick, log, res, heat, morale, grid, colonists, activeRaid, raidWindow, surfaceDefenseActive, unlockedRows, excavations, expeditions, unlockedTechs, surfaceHaul, memorial, timescale]);

  const applyLoadedState = useCallback((state) => {
    if (!state || typeof state !== "object") return false;
    try {
      setGrid(state.grid ?? initGrid());
      setColonyName(state.colonyName ?? "SPERANZA");
      // v1 saves predate difficulty — default them to survivor.
      setDifficulty(DIFFICULTIES[state.difficulty] ? state.difficulty : DEFAULT_DIFFICULTY);
      setRes(state.res ?? INIT_RES);
      setColonists(Array.isArray(state.colonists) ? state.colonists : initColonists());
      setHeat(state.heat ?? 0);
      setMorale(state.morale ?? 50);
      setTick(state.tick ?? 0);
      setUnlockedRows(Array.isArray(state.unlockedRows) ? state.unlockedRows : [0]);
      setExcavations(state.excavations ?? {});
      setExpeditions(Array.isArray(state.expeditions) ? state.expeditions : []);
      setExpedDuration(state.expedDuration ?? 40);
      setExpedLocationId(state.expedLocationId ?? SURFACE_LOCATIONS[0].id);
      setExpedCrewIds([]);
      setSurfaceHaul(state.surfaceHaul ?? { salvage: 0, arcTech: 0, schematics: [] });
      setUnlockedTechs(Array.isArray(state.unlockedTechs) ? state.unlockedTechs : []);
      setMemorial(Array.isArray(state.memorial) ? state.memorial : []);
      setRaidsRepelled(state.raidsRepelled ?? 0);
      setLargeRaidsRepelled(state.largeRaidsRepelled ?? 0);
      setExpeditionsCompleted(state.expeditionsCompleted ?? 0);
      setSurfaceCondition(state.surfaceCondition ?? SURFACE_CONDITIONS[0]);
      setSurfaceConditionTimer(state.surfaceConditionTimer ?? 0);
      setPeakPopulation(state.peakPopulation ?? Math.max(3, (state.colonists ?? []).length || 3));
      setFiredMilestones(Array.isArray(state.firedMilestones) ? state.firedMilestones : []);
      setFiredDilemmas(Array.isArray(state.firedDilemmas) ? state.firedDilemmas : []);
      setRecentDilemmaOutcomes(Array.isArray(state.recentDilemmaOutcomes) ? state.recentDilemmaOutcomes : []);
      setHistoryLog(Array.isArray(state.historyLog) ? state.historyLog : []);
      setHeatSuppressedTicks(state.heatSuppressedTicks ?? 0);
      setDeprivedTicks(state.deprivedTicks ?? 0);
      deprivedTicksRef.current = state.deprivedTicks ?? 0;
      setDilemmaTimer(state.dilemmaTimer ?? 0);
      setActiveDilemma(state.activeDilemma ?? null);

      // v1 normalization safety: never restore live raid/minigame runtime
      setRaidWindow(null);
      setActiveRaid(null);
      setSurfaceDefenseActive(false);
      setPendingRaidSize(null);
      setPendingWealthBracket(0);
      setManualPause(true); // deliberate: a loaded run should not start moving
      setRunStarted(true);  // you have a colony — do not ask for a new one

      addLog("💾 Save loaded. Game paused for safe resume.");
      addToast("💾 SAVE LOADED\nRun state restored.\nRaid runtime normalized to safe state.", "success", { key: `load-ok-${Date.now()}` });
      return true;
    } catch {
      addToast("❌ LOAD FAILED\nSave data could not be applied.", "injury", { key: `load-fail-${Date.now()}` });
      return false;
    }
  }, [addLog, addToast]);

  const handleSaveNow = useCallback(() => {
    const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
    if (saveLocked) {
      addToast("⛔ SAVE LOCKED\nSaving is disabled during raid events.", "info", { key: `save-locked-${tickRef.current}` });
      return;
    }
    const payload = buildSavePayload();
    const ok = writeAutosaveToStorage(payload);
    if (ok) {
      playAutosave();
      addLog("💾 Manual save written to autosave ring.");
      addToast("💾 SAVED\nManual save written.", "success", { key: `save-now-${tickRef.current}` });
    } else {
      addToast("❌ SAVE FAILED\nCould not write local autosave.", "injury", { key: `save-now-fail-${tickRef.current}` });
    }
  }, [raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize, buildSavePayload, writeAutosaveToStorage, addLog, addToast]);

  const handleLoadAutosave = useCallback(() => {
    const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
    if (saveLocked) {
      addToast("⛔ LOAD LOCKED\nLoading is disabled during raid events.", "info", { key: `load-locked-${tickRef.current}` });
      return;
    }
    const payload = readLatestAutosaveFromStorage();
    if (!payload || !payload.state) {
      addToast("ℹ NO AUTOSAVE\nNo autosave data found.", "info", { key: `load-none-${tickRef.current}` });
      return;
    }
    applyLoadedState(payload.state);
  }, [raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize, readLatestAutosaveFromStorage, applyLoadedState, addToast]);

  const handleExportSave = useCallback(() => {
    const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
    if (saveLocked) {
      addToast("⛔ EXPORT LOCKED\nExport is disabled during raid events.", "info", { key: `export-locked-${tickRef.current}` });
      return;
    }
    const payload = buildSavePayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `speranza-save-${datePart}-tick-${tickRef.current}.speranza`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("⇪ SAVE EXPORTED\nPortable save file downloaded.", "success", { key: `export-ok-${tickRef.current}` });
  }, [raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize, buildSavePayload, addToast]);

  const handleImportSave = useCallback(() => {
    const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
    if (saveLocked) {
      addToast("⛔ IMPORT LOCKED\nImport is disabled during raid events.", "info", { key: `import-locked-${tickRef.current}` });
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".speranza,.json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? "{}"));
          const state = parsed?.state;
          if (!state || typeof state !== "object") {
            addToast("❌ IMPORT FAILED\nInvalid save payload.", "injury", { key: `import-invalid-${Date.now()}` });
            return;
          }
          applyLoadedState(state);
        } catch {
          addToast("❌ IMPORT FAILED\nCould not parse save file.", "injury", { key: `import-parse-${Date.now()}` });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize, applyLoadedState, addToast]);

  const handleDeleteAutosaves = useCallback(() => {
    const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
    if (saveLocked) {
      addToast("⛔ DELETE LOCKED\nDeleting saves is disabled during raid events.", "info", { key: `delete-locked-${tickRef.current}` });
      return;
    }
    const ok = window.confirm("Delete all autosave slots?");
    if (!ok) return;
    for (let i = 0; i < AUTOSAVE_SLOT_COUNT; i++) {
      window.localStorage.removeItem(`${SAVE_SLOT_PREFIX}${i}`);
    }
    window.localStorage.setItem(SAVE_SLOT_INDEX_KEY, "0");
    addToast("⌫ AUTOSAVES CLEARED\nAll autosave slots removed.", "success", { key: `delete-ok-${tickRef.current}` });
  }, [raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize, addToast]);

  useEffect(() => {
    if (tick <= 0) return;
    const atMidnight = tick % 48 === 0;
    const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
    if (atMidnight) {
      if (saveLocked) {
        deferredAutosaveRef.current = true;
      } else {
        const ok = writeAutosaveToStorage(buildSavePayload());
        if (ok) playAutosave();
        deferredAutosaveRef.current = false;
      }
      return;
    }
    if (deferredAutosaveRef.current && !saveLocked) {
      const ok = writeAutosaveToStorage(buildSavePayload());
      if (ok) playAutosave();
      deferredAutosaveRef.current = false;
    }
  }, [tick, raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize, buildSavePayload, writeAutosaveToStorage]);

  // ── Main tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timescale === 0) return; // paused — no interval
    const interval = setInterval(() => {
      if (gameOverRef.current) return;
      currentTickToastTagsRef.current = [];

      const g    = gridRef.current;
      const cols = colonistsRef.current;
      const totalCol = cols.length;
      let resourceBreakdownSnapshot = {
        energy: { ...EMPTY_STAT_BREAKDOWN },
        food: { ...EMPTY_STAT_BREAKDOWN },
        water: { ...EMPTY_STAT_BREAKDOWN },
      };
      const moraleTickBreakdown = { plus: [], minus: [], net: 0 };
      let resAfterProduction = resRef.current;

      // 0. Passive morale ────────────────────────────────────────────────────
      {
        let moraleWorkers = 0;
        g.forEach(row => row.forEach(cell => {
          if ((cell.type === "tavern" || cell.type === "diningHall") && cell.workers > 0) {
            moraleWorkers += cell.workers;
          }
        }));
        const diffMoraleDrainMult = diffConfigRef.current.moraleDrainMult;
        const moraleDrain    = Math.max(0, totalCol - 7) * 0.3 * diffMoraleDrainMult;
        const moraleGain     = moraleWorkers * 1.5;
        // Layout consequences: workshops next to bunks cost morale every tick.
        // Only the penalty side is scaled by difficulty — a good layout's bonus
        // isn't a "drain" and shouldn't be softened away by an easier setting.
        const adjMoraleRaw   = calcAdjacencyMorale(g);
        const adjMorale      = adjMoraleRaw < 0 ? adjMoraleRaw * diffMoraleDrainMult : adjMoraleRaw;
        const netMoraleDelta = moraleGain - moraleDrain + adjMorale;
        if (moraleGain > 0) moraleTickBreakdown.plus.push(`Comfort services staffed +${moraleGain.toFixed(1)}`);
        if (moraleDrain > 0) moraleTickBreakdown.minus.push(`Crowding strain -${moraleDrain.toFixed(1)}`);
        if (adjMorale < 0)   moraleTickBreakdown.minus.push(`Noisy neighbours ${adjMorale.toFixed(1)}`);
        if (adjMorale > 0)   moraleTickBreakdown.plus.push(`Good layout +${adjMorale.toFixed(1)}`);
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
        if (quirkMoraleDelta < 0) quirkMoraleDelta *= diffMoraleDrainMult;
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

        g.forEach((row, ri) => row.forEach((cell, ci) => {
          if (!cell.type || !cell.workers) return;
          const def = ROOM_TYPES[cell.type];
          if (def.special === "barracks" || def.special === "armory" || def.special === "tavern" || def.special === "diningHall" ||
              def.special === "arcTurret" || def.special === "empArray" || def.special === "blastDoors" || def.special === "geothermal") return;
          if (cell.damaged) return; // damaged rooms don't produce

          // Where a room sits relative to its neighbours now changes what it
          // does — see calcAdjacency(). Columns used to be entirely inert.
          const adj = calcAdjacency(g, ri, ci, effectsRef.current.adjacencyMult);

          let canRun = true;
          for (const [r, amt] of Object.entries(def.consumes)) {
            const need = r === "energy"
              ? Math.max(0, amt + adj.energyDelta) * cell.workers
              : amt * cell.workers;
            if (next[r] < need) { canRun = false; break; }
          }
          if (!canRun) return;

          for (const [r, amt] of Object.entries(def.consumes)) {
            const used = r === "energy"
              ? Math.max(0, amt + adj.energyDelta) * cell.workers
              : amt * cell.workers;
            next[r] = clamp(next[r] - used, 0, MAX_RES);
            flow[r] -= used;
            if (r === "energy" || r === "food" || r === "water") pushReason(r, -used, `${def.label} upkeep`);
          }
          for (const [r, amt] of Object.entries(def.produces)) {
            const made = amt * cell.workers * adj.outputMult;
            next[r] = clamp(next[r] + made, 0, MAX_RES);
            flow[r] += made;
            if (r === "energy" || r === "food" || r === "water") pushReason(r, made, `${def.label} output`);
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
        // Deterministic snapshot so the deprivation pass below can read this
        // tick's result. Deliberately no side effects here — this updater is
        // double-invoked under StrictMode.
        resAfterProduction = next;
        return next;
      });

      // 1b. Deprivation — starvation / dehydration ──────────────────────────
      // Empty stores no longer end the run on the spot. They start a clock: the
      // colony gets loud warnings, then people collapse, then people die. The
      // run ends when the last colonist is gone, which the population check
      // below already handles.
      {
        const noFood  = resAfterProduction.food  <= 0;
        const noWater = resAfterProduction.water <= 0;
        const deprived = noFood || noWater;
        const prevTicks = deprivedTicksRef.current;

        if (deprived) {
          const ticks = prevTicks + 1;
          deprivedTicksRef.current = ticks;
          setDeprivedTicks(ticks);
          const stage = deprivationStage(ticks, effectsRef.current.collapseTicksBonus);
          const lack = noFood && noWater ? "FOOD AND WATER"
                     : noFood ? "FOOD" : "WATER";

          changeMoraleRef.current(DEPRIVE_MORALE_PER_TICK, `no ${lack.toLowerCase()}`);

          if (ticks === 1) {
            addLog(`🚨 ${lack} EXHAUSTED — the colony is going without.`);
            addToast(`🚨 ${lack} EXHAUSTED\nPeople will start collapsing in ${DEPRIVE_COLLAPSE_TICKS} ticks.\nFix production NOW.`, "raid", { key: "deprivation-start" });
            playAlert();
            addHistoryRef.current("🚨", `${lack} ran out`);
          } else if (ticks === DEPRIVE_COLLAPSE_TICKS) {
            addLog(`🚨 Colonists are collapsing from lack of ${lack.toLowerCase()}.`);
            addToast(`🚨 COLONISTS COLLAPSING\nNo ${lack.toLowerCase()} for ${ticks} ticks.\nDeaths begin in ${DEPRIVE_DEATH_TICKS - ticks} ticks.`, "raid", { key: "deprivation-collapse" });
            playAlert();
          } else if (ticks === DEPRIVE_DEATH_TICKS) {
            addLog(`💀 The colony is starting to die of ${noFood ? "hunger" : "thirst"}.`);
            addToast(`💀 THE COLONY IS DYING\nNo ${lack.toLowerCase()} for ${ticks} ticks.\nColonists are dying now.`, "raid", { key: "deprivation-death" });
            playAlert();
          }

          // Roll and pick the victim OUT here, then hand the updater a pure
          // transform. Rolling inside the updater would fire twice per tick
          // under StrictMode — doubling the real collapse/death rate.
          if (stage === "collapsing" || stage === "dying") {
            const upright = cols.filter(c => c.status !== "injured" && c.status !== "onExpedition");
            if (upright.length > 0 && Math.random() < DEPRIVE_COLLAPSE_CHANCE) {
              const victim = upright[Math.floor(Math.random() * upright.length)];
              setColonists(prev => prev.map(c => c.id === victim.id
                ? { ...c, status: "injured", assignedRoom: null,
                    injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 }
                : c));
              addLog(`⚕ ${victim.name} collapsed from ${noFood ? "hunger" : "thirst"}.`);
              addToast(`⚕ ${victim.name} COLLAPSED\nFrom ${noFood ? "hunger" : "thirst"}.`, "injury", { debugTag: `deprivation_collapse_${victim.name}` });
              playInjury();
            }
          }

          if (stage === "dying" && cols.length > 0 && Math.random() < DEPRIVE_DEATH_CHANCE) {
            // The already-collapsed go first — it reads as a consequence.
            const pool = cols.filter(c => c.status === "injured");
            const from = pool.length ? pool : cols;
            const victim = from[Math.floor(Math.random() * from.length)];
            setColonists(prev => prev.filter(c => c.id !== victim.id));
            addToMemorialRef.current(victim, noFood ? "starved" : "thirst", tickRef.current);
            pushEventTrace("deprivation_death", victim.name, lack);
            addLog(`💀 ${victim.name} died of ${noFood ? "starvation" : "thirst"}.`);
            addToast(`💀 ${victim.name} DIED\nOf ${noFood ? "starvation" : "thirst"}.`, "raid", { debugTag: `deprivation_death_${victim.name}` });
            playKill();
          }
        } else if (prevTicks > 0) {
          deprivedTicksRef.current = 0;
          setDeprivedTicks(0);
          addLog("🍲 Stores are flowing again — the colony is eating.");
          addToast("🍲 CRISIS OVER\nStores are flowing again.", "success", { key: "deprivation-over" });
          changeMoraleRef.current(6, "the colony ate");
        }
      }

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
            setHeat(prev => clamp(prev * (1 - HEAT_RELIEF_BARRICADE), 0, HEAT_MAX)); // a clean block buys a little quiet
            changeMoraleRef.current(10, "barricades held");
            playBarricadesHold();
          } else {
            setSurfaceDefenseActive(true);
            setPendingRaidSize(sizeKey);
            setPendingWealthBracket(rw.wealthBracket ?? 0);
            // No setTimescale — `surfaceDefenseActive` is a pause reason, so the
            // colony stops on its own while the player places defenses.
            raidSuppressedThisRaidRef.current = 0;
            setActiveRaid({ sizeKey, ticksLeft: sizeDef.duration, strikeCountdown: sizeDef.strikeEvery });
            pushEventTrace("raid_launched", null, sizeKey);
            setRaidWindow(null);
            setHeat(prev => clamp(prev + (heatGainSuppressed ? 0 : HEAT_RAID_GAIN), 0, HEAT_MAX)); // raid starting raises heat
            duckMusic();
            playRaid();
            setRaidFlash(true);
            setTimeout(() => setRaidFlash(false), 800);
            if (!currentTickToastTagsRef.current.includes("raid_launch_announcement")) {
              currentTickToastTagsRef.current.push("raid_launch_announcement");
              addLog(`⚔ ${sizeDef.icon} ${sizeDef.label} RAID UNDERWAY — ${sizeDef.duration} ticks! First strike in ${sizeDef.strikeEvery}.`);
              addToast(`⚔ ${sizeDef.label} RAID IN PROGRESS\nArc forces breaching the perimeter.\nFirst strike in ${sizeDef.strikeEvery} ticks.`, "raid", { key: `raid-start-${sizeKey}` });
            }
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
        // Decrement raid cooldown each tick; blocks raid window from opening
        if (raidCooldownTicksRef.current > 0) raidCooldownTicksRef.current--;

        const heatDelta = calcHeatDelta({
          builtRooms,
          sentryWorkers: sentryCount,
          threatMult: condThreatMult * diffConfigRef.current.heatMult,
          suppressed: heatGainSuppressed,
          heatGainMult: effectsRef.current.heatGainMult,
        });
        const nextHeat = clamp(heatRef.current + heatDelta, 0, HEAT_MAX);
        setHeat(nextHeat);

        // The raid roll lives OUT here on purpose. It used to sit inside the
        // setHeat updater, which StrictMode double-invokes in dev — so the roll
        // ran twice per tick and every announcement fired twice. That was the
        // "raid toast fires twice" bug; it was never a missing dedupe guard.
        const condRaidMult = surfaceConditionRef.current.effects.raidFreqMult ?? 1.0;
        const dueToRoll    = tickRef.current % RAID_ROLL_EVERY === 0;
        if (dueToRoll && raidCooldownTicksRef.current <= 0 &&
            Math.random() < calcRaidChance(nextHeat) * condRaidMult * diffConfigRef.current.raidMult) {
          // Determine starting size based on heat state
          const hState = getHeatState(nextHeat);
          const wealth = calcColonyWealth(resRef.current, gridRef.current, colonistsRef.current);
          const wealthBracket = getWealthBracket(wealth);
          let sizeIdx = 0;
          if (wealthBracket === 1) sizeIdx = Math.random() < 0.25 ? 1 : 0;
          if (wealthBracket === 2) sizeIdx = Math.random() < 0.25 ? 2 : 1;
          if (wealthBracket === 3) sizeIdx = Math.random() < 0.50 ? 2 : 1;
          if (hState.label === "MARKED" && sizeIdx < 2) sizeIdx = Math.min(sizeIdx + 1, 2);
          setRaidWindow({ sizeIdx, escalations: 0, wealthBracket });
          pushEventTrace("raid_window_opened", null, RAID_SIZE_ORDER[sizeIdx]);
          const hLabel = hState.label;
          const wealthLabels = ["STRUGGLING", "ESTABLISHED", "PROSPEROUS", "WEALTHY"];
          addLog(`☢ ${hLabel === "MARKED" ? "⚠ MARKED — " : ""}Arc forces detected — raid incoming! [${wealthLabels[wealthBracket]}]`);
          const sensitives = cols.filter(c => c.quirk?.id === "arcSensitive");
          if (sensitives.length > 0 && Math.random() < 0.2) {
            const warnCol = sensitives[Math.floor(Math.random() * sensitives.length)];
            addLog(`🔮 ${warnCol.name}'s instincts are firing. Something is coming.`);
          }
          addToast(`☢ ARC HEAT: ${hLabel}\nRaid incoming — stay alert.`, "injury", { key: `heat-raid-incoming-${hLabel}` });
        }
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

        // Strike fires this tick — suppressed while surface defense mini-game is active
        if (newStrikeCD <= 0 && newTicksLeft > 0 && !surfaceDefenseActiveRef.current) {
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
            pushEventTrace("raid_strike_fired", null, "miss");
            addLog(`💢 ${sizeDef.icon} ARC STRIKE — no exposed workers. Colony holds!`);
            addToast(`💢 ${sizeDef.label} STRIKE\nNo workers exposed — held the line.`, "raid");
          } else {
            pushEventTrace("raid_strike_fired", null, "hit");
            targets.forEach(target => {
              // The target leaves their post — whichever room that actually is.
              // The reconciler drops the worker count for that exact cell.
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
                  // Fleeing means abandoning the post, NOT dying. They go idle
                  // and their room loses its worker via the reconciler — the old
                  // "delete the colonist" behaviour existed only to paper over
                  // the worker-count desync, which the reconciler now prevents.
                  setColonists(prev => prev.map(c => c.id === target.id
                    ? { ...c, status: "idle", assignedRoom: null } : c
                  ));
                  pushEventTrace("colonist_fled", target.name, null);
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} fled their post!`);
                  addToast(`💢 ${sizeDef.label} STRIKE\n${target.name} fled their post — shaken but alive.\nReassign them when it's safe.`, "raid", { debugTag: `colonist_fled_${target.name}` });
                  changeMoraleRef.current(-5, "colonist fled");
                }
              } else if (roll < injureThreshold) {
                // steadyHands: injury → flee instead
                if (isSteadyHands) {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "idle", assignedRoom: null } : c));
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} retreated (steady hands).`);
                  changeMoraleRef.current(-3, "retreat");
                } else {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "injured", assignedRoom: null, injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 } : c));
                  pushEventTrace("colonist_injured", target.name, null);
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} was INJURED!`);
                  addToast(`💢 ${sizeDef.label} STRIKE — CASUALTY\n${target.name} is injured.`, "injury", { debugTag: `colonist_injured_${target.name}` });
                  playInjury();
                  changeMoraleRef.current(-10, "colonist injured in raid");
                }
              } else {
                // steadyHands: kill → injury instead
                if (isSteadyHands) {
                  setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "injured", assignedRoom: null, injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 } : c));
                  pushEventTrace("colonist_injured", target.name, "steadyHands_saved");
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} badly wounded (steady hands saved them).`);
                  addToast(`💢 ${sizeDef.label} STRIKE\n${target.name} severely injured — but alive.`, "injury", { debugTag: `colonist_injured_${target.name}` });
                  playInjury();
                  changeMoraleRef.current(-12, "severe injury");
                } else {
                  setColonists(prev => prev.filter(c => c.id !== target.id));
                  addToMemorialRef.current(target, "raidKilled", tickRef.current);
                  pushEventTrace("colonist_killed", target.name, null);
                  addLog(`💢 ${sizeDef.icon} ARC STRIKE — ${target.name} was KILLED.`);
                  addToast(`💢 ${sizeDef.label} STRIKE — KIA\n${target.name} did not make it.`, "raid", { debugTag: `colonist_killed_${target.name}` });
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
          setHeat(prev => clamp(prev * (1 - HEAT_RELIEF_RAID_SURVIVED), 0, HEAT_MAX)); // surviving buys real breathing room
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
      // Advancement is a pure transition; every consequence comes back as an
      // intent applied exactly once below. See advanceExpeditions() for why.
      {
        const { nextExpeditions, intents } = advanceExpeditions(
          expeditionsRef.current,
          {
            colonists: colonistsRef.current,
            ownedSchematics: surfaceHaulRef.current.schematics,
            condEffects: surfaceConditionRef.current.effects,
            tick: tickRef.current,
            memorialHall: hasMemorialHall(),
          },
        );
        if (nextExpeditions !== expeditionsRef.current) {
          // Sync the ref immediately so a decision handler or the next interval
          // never reads stale expedition data before React commits.
          expeditionsRef.current = nextExpeditions;
          setExpeditions(nextExpeditions);
        }
        intents.forEach(applyExpeditionIntentRef.current);
      }


      // 4. Heal injured colonists ───────────────────────────────────────────
      // Count available nurses in the hospital
      let nursesAvailable = 0;
      // Best bedside bonus among the built hospitals — a hospital placed next
      // to the barracks heals faster than one tucked away in a corner.
      let bedsideMult = 1;
      g.forEach((row, ri) => row.forEach((cell, ci) => {
        if (cell.type !== "hospital") return;
        nursesAvailable += cell.workers;
        bedsideMult = Math.max(bedsideMult, calcAdjacency(g, ri, ci, effectsRef.current.adjacencyMult).healMult);
      }));

      // Work out the healing result first, then apply it as a pure patch map.
      // Announcing from inside the updater double-logged every recovery under
      // StrictMode. The maths here is deterministic, so computing it up front
      // changes nothing about the outcome.
      const healPatches = new Map();
      const recoveries  = [];
      {
        let nurseCapacity = nursesAvailable * 3; // each nurse handles up to 3 patients
        // Seats already taken, so a recovering colonist only reclaims their old
        // post if it still exists and nobody filled in for them.
        const seats = occupiedSeats(cols);
        cols.forEach(col => {
          if (col.status !== "injured") return;
          // IRON LUNGS: heals 2× faster
          const baseHeal = (nurseCapacity > 0 ? (nurseCapacity--, HEAL_RATE_NURSE) : 1) * effectsRef.current.healRateMult;
          let healRate = col.traits?.includes("ironLungs") ? baseHeal * 2 : baseHeal;
          // Quirk: workaholic heals 25% slower, insomniac heals 15% slower
          if (col.quirk?.id === "workaholic")  healRate *= 0.75;
          if (col.quirk?.id === "insomniac")   healRate *= 0.85;
          const newTicks = (col.injuryTicksLeft ?? INJURY_TICKS_BASE) - healRate * bedsideMult;
          if (newTicks <= 0) {
            const { room, ...patch } = reclaimPost(col, g, seats);
            healPatches.set(col.id, { ...patch, injuryTicksLeft: 0 });
            recoveries.push({ name: col.name, room });
          } else {
            healPatches.set(col.id, { injuryTicksLeft: newTicks });
          }
        });
      }

      if (healPatches.size > 0) setColonists(prev => prev.map(col => {
        const patch = healPatches.get(col.id);
        return (patch && col.status === "injured") ? { ...col, ...patch } : col;
      }));

      recoveries.forEach(({ name, room }) => {
        playSuccess();
        if (room) {
          addLog(`💊 ${name} has recovered and returned to the ${room.label}.`);
          addToast(`💊 RECOVERED\n${name} is back at their post.`, "success", { debugTag: `recovered_${name}` });
        } else {
          addLog(`💊 ${name} has recovered and is awaiting assignment.`);
          addToast(`💊 RECOVERED\n${name} is back on their feet — reassign them.`, "success", { debugTag: `recovered_${name}` });
        }
      });

      // 4b. Morale collapse / strained mechanics ───────────────────────────
      // Pick the victim before touching state; the updater stays a pure map.
      if (moraleRef.current <= -100) {
        // 10% chance per tick a colonist deserts
        const vulnerable = cols.filter(c => c.status === "idle" || c.status === "working");
        if (vulnerable.length > 0 && Math.random() < 0.10) {
          const deserter = vulnerable[Math.floor(Math.random() * vulnerable.length)];
          setColonists(prev => prev.filter(c => c.id !== deserter.id));
          pushEventTrace("morale_death", deserter.name, "deserted");
          changeMoraleRef.current(-15, "desertion");
          addLog(`🚪 ${deserter.name} has deserted — morale has collapsed.`);
          addToast(`🚪 DESERTION\n${deserter.name} left the colony.\nMorale has completely collapsed.`, "raid", { debugTag: `desertion_${deserter.name}` });
        }
      } else if (moraleRef.current < 0 && moraleRef.current > -50) {
        // 5% chance a working colonist refuses their post
        const working = cols.filter(c => c.status === "working");
        if (working.length > 0 && Math.random() < 0.05) {
          const refuser = working[Math.floor(Math.random() * working.length)];
          // They walk off their own post; the reconciler updates that cell.
          setColonists(prev => prev.map(c => c.id === refuser.id ? { ...c, status: "idle", assignedRoom: null } : c));
          addLog(`😤 ${refuser.name} refused their post — morale is strained.`);
        }
      }

      // Check population = 0 → game over. Read the ref rather than peeking
      // inside an updater, which StrictMode would run twice.
      if (colonistsRef.current.length === 0 && !gameOverRef.current) {
        const currentTick = tickRef.current;
        setGameOver({
          reason: "All colonists lost — the colony is silent.",
          daysAlive: Math.floor(currentTick / 48) + 1,
          tick: currentTick,
          raidsRepelled: raidsRepelledRef.current,
          casualties: memorialRef.current,
          peakPop: peakPopulation,
          difficulty: difficultyRef.current,
        });
      }
      // All living colonists age. On-duty colonists earn 1 XP per 10 duty ticks.
      // Level up every 20 XP → pendingTraitPick flag set.
      // Announce level-ups outside the updater — logging from inside meant every
      // promotion was written to the log twice under StrictMode.
      const levelUps = [];
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
        if (leveled && !levelUps.some(l => l.name === col.name && l.level === newLevel)) {
          levelUps.push({ name: col.name, level: newLevel });
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
      levelUps.forEach(({ name, level }) => {
        pushEventTrace("colonist_level_up", name, `${level}`);
        addLog(`⭐ ${name} reached Level ${level}! Trait selection available.`);
        changeMoraleRef.current(5, "morale boost from achievement");
      });

      // 6. Excavation progress ──────────────────────────────────────────────
      const excavNow = excavationsRef.current;
      Object.entries(excavNow).forEach(([rowIdxStr, excav]) => {
        if (!excav) return;
        const rowIndex = Number(rowIdxStr);
        const newTicksLeft = excav.ticksLeft - 1;
        if (newTicksLeft <= 0) {
          // Unlock the row
          setUnlockedRows(prev => prev.includes(rowIndex) ? prev : [...prev, rowIndex]);
          // Diggers head back to whatever post they left
          setColonists(prev => {
            const seats = occupiedSeats(prev);
            return prev.map(c => {
              if (c.status !== "excavating") return c;
              const { room, ...patch } = reclaimPost(c, gridRef.current, seats);
              return { ...c, ...patch };
            });
          });
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

        setStatBreakdown({
          energy: resourceBreakdownSnapshot.energy,
          food: resourceBreakdownSnapshot.food,
          water: resourceBreakdownSnapshot.water,
          morale: moraleTickBreakdown,
        });
      }

      setTick(t => {
        const next = t + 1;
        // Track peak population
        setPeakPopulation(prev => Math.max(prev, colonistsRef.current.length));
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

      // Surface condition rotation and dilemma checks used to live inside
      // setSurfaceConditionTimer / setDilemmaTimer updaters, rolling dice and
      // firing sound + log + modal from inside them. StrictMode ran all of that
      // twice per tick. They now run once, here, off refs.
      {
        const nextTick = tickRef.current + 1;

        // Surface condition rotation — every 80-120 ticks (weighted random pick)
        const rotateAt = surfaceRotateAtRef.current;
        const nextTimer = surfaceConditionTimerRef.current + 1;
        if (nextTimer >= rotateAt) {
          const totalWeight = SURFACE_CONDITIONS.reduce((s, c) => s + c.weight, 0);
          let r = Math.random() * totalWeight;
          let picked = SURFACE_CONDITIONS[0];
          for (const cond of SURFACE_CONDITIONS) { r -= cond.weight; if (r <= 0) { picked = cond; break; } }
          setSurfaceCondition(picked);
          addLog(`🌍 SURFACE CONDITION: ${picked.icon} ${picked.label} — ${picked.flavor}`);
          playSurfaceCondition();
          surfaceConditionTimerRef.current = 0;
          surfaceRotateAtRef.current = 80 + Math.floor(Math.random() * 41);
          setSurfaceConditionTimer(0);
        } else {
          surfaceConditionTimerRef.current = nextTimer;
          setSurfaceConditionTimer(nextTimer);
        }

        // Dilemma event check — every 50 ticks, 40% chance if none active
        const nextDt = dilemmaTimerRef.current + 1;
        if (nextDt >= 50 && !activeDilemmaRef.current) {
          if (Math.random() < 0.40) {
            const currentCond = surfaceConditionRef.current.id;
            const popNow      = colonistsRef.current.length;
            const eligible    = DILEMMA_EVENTS.filter(ev => {
              if (firedDilemmasRef.current.includes(ev.id)) return false;
              if (ev.minTick && nextTick < ev.minTick) return false;
              if (ev.minPop  && popNow < ev.minPop)     return false;
              if (ev.condition && ev.condition !== currentCond) return false;
              return true;
            });
            if (eligible.length > 0) {
              const picked = eligible[Math.floor(Math.random() * eligible.length)];
              setActiveDilemma(picked);
              activeDilemmaRef.current = picked;
              pushEventTrace("dilemma_fired", null, picked.id, nextTick);
              // No setTimescale — `activeDilemma` is a pause reason.
              playDilemma();
              setFiredDilemmas(p => [...p, picked.id]);
              firedDilemmasRef.current = [...firedDilemmasRef.current, picked.id];
            }
          }
          dilemmaTimerRef.current = 0;
          setDilemmaTimer(0);
        } else {
          dilemmaTimerRef.current = nextDt;
          setDilemmaTimer(nextDt);
        }
      }

      const historySnapshot = {
        tick: tickRef.current,
        heat: heatRef.current,
        morale: moraleRef.current,
        activeRaid: activeRaidRef.current ? {
          sizeKey: activeRaidRef.current.sizeKey,
          ticksLeft: activeRaidRef.current.ticksLeft,
          strikeCountdown: activeRaidRef.current.strikeCountdown,
        } : null,
        raidWindow: raidWindowRef.current ? { sizeIdx: raidWindowRef.current.sizeIdx } : null,
        surfaceDefenseActive: surfaceDefenseActiveRef.current,
        res: { ...resRef.current },
        colonistStatuses: Object.fromEntries(colonistsRef.current.map(c => [`${c.id}|${c.name}`, c.status])),
        toastsFired: [...currentTickToastTagsRef.current],
      };
      tickHistoryRef.current.push(historySnapshot);
      if (tickHistoryRef.current.length > 10) {
        tickHistoryRef.current = tickHistoryRef.current.slice(-10);
      }
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
    setColonists(prev => prev.map(c => picked.find(p => p.id === c.id)
      ? { ...c, status: "excavating", previousRoom: c.assignedRoom ?? c.previousRoom ?? null, assignedRoom: null }
      : c
    ));
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
      const idle = colonists.filter(co => co.status === "idle");
      if (idle.length === 0) { addLog("⚠ No free colonists available"); return; }
      if (cell.workers >= def.cap) { addLog("⚠ Room is at capacity"); return; }
      const pick = idle[0];
      const newStatus = postStatusFor(cell.type);
      // Post them to this specific cell; the reconciler updates cell.workers.
      setColonists(prev => prev.map(co => co.id === pick.id
        ? { ...co, status: newStatus, assignedRoom: { r, c }, previousRoom: { r, c } }
        : co
      ));
      addLog(`👤 ${pick.name} assigned to ${def.label}`);
      playAssign();
    } else {
      // Stand down someone actually posted to THIS cell — not just anyone with
      // a matching status, which is what used to desync the counts.
      const available = colonists.filter(co =>
        isOnPost(co.status) && co.assignedRoom?.r === r && co.assignedRoom?.c === c
      );
      if (available.length === 0) return;
      const pick = available[available.length - 1]; // last posted, first out
      setColonists(prev => prev.map(co => co.id === pick.id
        ? { ...co, status: "idle", assignedRoom: null }
        : co
      ));
      addLog(`👤 ${pick.name} stood down from ${def.label}`);
      playUnassign();
    }
  };

  const handleDemolish = (r, c) => {
    const cell = grid[r][c];
    if (!cell.type) return;
    // Free exactly the colonists posted to this cell.
    setColonists(prev => prev.map(co =>
      co.assignedRoom?.r === r && co.assignedRoom?.c === c
        ? { ...co, assignedRoom: null, previousRoom: null, status: isOnPost(co.status) ? "idle" : co.status }
        : co
    ));
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

  const handleSurfaceRaidWon = (outcome = {}) => {
    pushEventTrace("raid_resolved_won", null, null);
    const wonSize = pendingRaidSize;
    // Resolve: the reward for surviving. Before this a clean win netted about
    // -15 scrap, so the best raid was one that never happened.
    const earned = resolveEarned(outcome);
    if (earned > 0) {
      setResolve(prev => prev + earned);
      addLog(`✦ +${earned} Resolve — the colony holds.`);
      addToast(
        `✦ +${earned} RESOLVE\n${outcome.waves ?? 0} waves cleared, hatch at ${outcome.hatchHp ?? 0}%.\nSpend it on permanent talents.`,
        "success", { key: `resolve-${tickRef.current}` },
      );
    }
    setSurfaceDefenseActive(false);
    setPendingRaidSize(null);
    setPendingWealthBracket(0);
    setRaidWindow(null);
    setActiveRaid(null);
    raidCooldownTicksRef.current = Math.round(raidCooldownFor(wonSize) * diffConfigRef.current.graceMult);
    unduckMusic();
    playRaidOver();
    setColonists(prev => prev.map(c => ({ ...c, raidsSurvived: (c.raidsSurvived ?? 0) + 1 })));
    setHeat(prev => clamp(prev * (1 - HEAT_RELIEF_RAID_SURVIVED), 0, HEAT_MAX));
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
    pushEventTrace("raid_resolved_lost", null, null);
    const lostSize = pendingRaidSize;
    setSurfaceDefenseActive(false);
    setPendingRaidSize(null);
    setPendingWealthBracket(0);
    // The breach still has to play out underground, so the cooldown only starts
    // counting once that finishes — but the timer is set from the same table.
    raidCooldownTicksRef.current = Math.round(raidCooldownFor(lostSize) * diffConfigRef.current.graceMult);
    unduckMusic();
    playRaid();
    setRaidFlash(true);
    setTimeout(() => setRaidFlash(false), 900);
    addLog("⚠ Surface defenses breached — Arc forces entering colony.");
    addToast(`💥 HATCH BREACHED
You lost the surface. Arc forces are inside.
${RAID_SIZES[lostSize ?? "small"].duration} ticks of strikes incoming — shelter your people.`,
      "raid", { key: `surface-loss-${tickRef.current}` });
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
    // Use exactly the crew the player picked. Fall back to first-eligible only
    // if the draft is somehow short, so the button can never dead-end.
    const draft  = expedCrewIds
      .map(id => idle.find(c => c.id === id))
      .filter(Boolean)
      .slice(0, def.colonistsRequired);
    const picked = draft.length === def.colonistsRequired
      ? draft
      : [...draft, ...idle.filter(c => !draft.includes(c))].slice(0, def.colonistsRequired);
    if (picked.length < def.colonistsRequired) {
      addLog(`⚠ Select ${def.colonistsRequired} crew member(s) before launching`);
      return;
    }

    const location = SURFACE_LOCATIONS.find(l => l.id === expedLocationId) ?? SURFACE_LOCATIONS[0];
    const names    = picked.map(c => c.name).join(" & ");
    const rollEvery = type === "scav" ? 8 : 6;
    // surfaceBorn: +20% good roll weight; packRat: bonus scrap+salvage tracked on expedition
    const hasSurfaceBorn = picked.some(c => c.quirk?.id === "surfaceBorn");
    const hasPackRat     = picked.some(c => c.quirk?.id === "packRat");
    const hasLoudmouth   = picked.some(c => c.quirk?.id === "loudmouth");
    const newExp = {
      id: `exp-${Date.now()}`,
      type,
      locationId:      location.id,
      locationLabel:   location.label,
      locationIcon:    location.icon,
      locationColor:   location.color,
      // Snapshotted at launch, like morale and surface condition, so a later
      // lore edit can't retroactively change a run already in the field.
      locationMods:    { ...location.rollMods },
      duration:        expedDuration,
      ticksLeft:       expedDuration,
      rollEvery,
      rollCountdown:   rollEvery,
      colonistIds:     picked.map(c => c.id),
      eventLog:        [],
      lootAccumulated: { scrap: 0, food: 0, salvage: 0, arcTech: 0, survivor: false },
      moraleSnapshot:  morale,
      conditionSnapshot: { ...surfaceCondition },
      quirkBonuses:    { surfaceBorn: hasSurfaceBorn, packRat: hasPackRat, loudmouth: hasLoudmouth },
    };
    setColonists(prev =>
      prev.map(c => picked.find(p => p.id === c.id)
        ? { ...c, status: "onExpedition", previousRoom: c.assignedRoom ?? c.previousRoom ?? null, assignedRoom: null }
        : c)
    );
    setHeat(t => clamp(t + (heatSuppressedTicksRef.current > 0 ? 0 : def.threatDelta), 0, HEAT_MAX));
    setExpeditions(prev => [...prev, newExp]);
    setExpedCrewIds([]);   // clear the draft so the next launch starts fresh
    pushEventTrace("expedition_launched", null, type);
    addLog(`${def.icon} ${names} deployed to ${location.icon} ${location.label} (${expedDuration}t). ~${Math.floor(expedDuration / rollEvery)} rolls expected.`);
    playExpedition();
  };

  /** Toggle a colonist in the launch draft, capped at the mission's crew size. */
  const handleToggleCrew = (colonistId, maxCrew) => {
    setExpedCrewIds(prev => {
      if (prev.includes(colonistId)) return prev.filter(id => id !== colonistId);
      if (prev.length >= maxCrew) return [...prev.slice(1), colonistId]; // oldest out
      return [...prev, colonistId];
    });
    playUiClick();
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
    if (a.recruitFree) {
      if (colonistsRef.current.length >= popCap) {
        outcomeBits.push("no room for them — turned away");
      } else {
        setColonists(p => [...p, makeColonist(tickRef.current)]);
        outcomeBits.push("1 colonist joined");
      }
    }
    // Pick targets outside the updaters — rolling inside means StrictMode picks
    // a different victim on the second pass and the memorial entry desyncs from
    // who actually died.
    if (a.removeRandomColonist) {
      const pool = colonistsRef.current.filter(c => c.status !== "onExpedition");
      if (pool.length > 0) {
        const target = pool[Math.floor(Math.random() * pool.length)];
        setColonists(prev => prev.filter(c => c.id !== target.id));
        pushEventTrace("morale_death", target.name, "dilemma");
        addToMemorialRef.current(target, "moraleDeath", tickRef.current);
        outcomeBits.push(`${target.name} lost`);
      }
    }
    if (a.injureRandom) {
      const pool = colonistsRef.current.filter(c => c.status === "idle" || c.status === "working");
      if (pool.length > 0) {
        const target = pool[Math.floor(Math.random() * pool.length)];
        setColonists(prev => prev.map(c => c.id === target.id
          ? { ...c, status: "injured", assignedRoom: null, injuryTicksLeft: 20, injuryCount: (c.injuryCount ?? 0) + 1 }
          : c));
        outcomeBits.push(`${target.name} injured`);
      }
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
    // id generated outside the updater so the audit stays at zero — a state
    // updater must never contain randomness, even for a React key.
    const outcomeEntry = {
      id: `d-${Date.now()}-${Math.random()}`,
      tick: tickRef.current,
      title: activeDilemma?.title ?? activeDilemma?.id ?? "Dilemma",
      choice: choice.label,
      summary: outcomeSummary,
    };
    setRecentDilemmaOutcomes(prev => [outcomeEntry, ...prev].slice(0, 8));
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
    // Pull idle + working colonists into shelter, remembering their post so
    // BACK TO WORK can restore it. Sentries stay on the surface bunker — they
    // are the crew that fights, and zeroing their room used to leave them in an
    // impossible state (status onSentry, post unstaffed).
    setColonists(prev => prev.map(c => {
      if (c.status !== "idle" && c.status !== "working") return c;
      return {
        ...c,
        status: "sheltered",
        previousRoom: c.assignedRoom ?? c.previousRoom ?? null,
        assignedRoom: null,
      };
    }));
    addLog("🏠 ALARM SOUNDED — colonists sheltering. Production halted.");
    addToast("🏠 ALARM SOUNDED\nColonists are sheltering.\nThey are immune to Arc strikes.", "info");
    playShelterAlarm();
  };

  const handleBackToWork = () => {
    // Send everyone back to the post they left, where it still exists.
    const g = gridRef.current;
    const seats = new Map();
    setColonists(prev => prev.map(c => {
      if (c.status !== "sheltered") return c;
      const prevRoom = c.previousRoom;
      const cell = prevRoom ? g[prevRoom.r]?.[prevRoom.c] : null;
      const def  = cell?.type ? ROOM_TYPES[cell.type] : null;
      if (!def || def.cap <= 0) return { ...c, status: "idle", assignedRoom: null };
      const key  = `${prevRoom.r}-${prevRoom.c}`;
      const used = seats.get(key) ?? 0;
      if (used >= def.cap) return { ...c, status: "idle", assignedRoom: null };
      seats.set(key, used + 1);
      return { ...c, status: postStatusFor(cell.type), assignedRoom: { ...prevRoom } };
    }));
    addLog("🏠 All clear — colonists returning to their posts.");
    addToast("🏠 ALL CLEAR\nColonists returning to their posts.\nAnyone whose room is gone is now idle.", "success");
  };

  const handleRestart = (nextDifficulty = difficulty) => {
    const nextDiffConfig = DIFFICULTIES[nextDifficulty] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
    setGrid(initGrid());
    // Deep Stores (talent) front-loads a new colony. Resolve and talents are
    // NOT reset here — they are meta-progression and survive losing a colony.
    const stock = effectsRef.current.startingStockBonus;
    setRes(stock > 0 ? { ...INIT_RES, scrap: INIT_RES.scrap + stock, food: INIT_RES.food + stock } : INIT_RES);
    setColonists(initColonists());
    setHeat(0);
    setExpeditions([]);
    setExpedDuration(40);
    setExpedLocationId(SURFACE_LOCATIONS[0].id);
    setExpedCrewIds([]);
    setRaidWindow(null);
    setActiveRaid(null);
    setUnlockedTechs([]);
    setSelected(null);
    setBuildMenu(false);
    setTick(0);
    setGameOver(null);
    setLog(["Colony restarted."]);
    setColonyName("SPERANZA");
    setDifficulty(nextDifficulty);
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
    setDeprivedTicks(0);
    deprivedTicksRef.current = 0;
    surfaceConditionTimerRef.current = 0;
    dilemmaTimerRef.current = 0;
    activeDilemmaRef.current = null;
    raidCooldownTicksRef.current = Math.round(RAID_GRACE_TICKS * nextDiffConfig.graceMult);
    raidSuppressedThisRaidRef.current = 0;
    tickHistoryRef.current = [];
    eventTraceRef.current = [];
    currentTickToastTagsRef.current = [];
    setSurfaceDefenseActive(false);
    setPendingRaidSize(null);
    setPendingWealthBracket(0);
  };

  const handleUnlockTalent = (key) => {
    const t = TALENTS[key];
    // Guard rather than trust the button's disabled state — the dev hook and a
    // future keyboard path can both reach this without going through the UI.
    if (!t || talents.includes(key) || resolve < t.cost) return;
    setResolve(prev => prev - t.cost);
    setTalents(prev => [...prev, key]);
    addLog(`✦ Talent unlocked: ${t.label}.`);
    playLevelUp();
  };

  // Pressing BEGIN on the start screen. Routed through handleRestart so the
  // difficulty-derived refs (notably the raid grace period) are seeded from the
  // chosen difficulty rather than whatever the defaults happened to be.
  const handleBegin = (name, chosenDifficulty) => {
    handleRestart(chosenDifficulty);
    setColonyName(name);
    setLog([`${name} founded. ${DIFFICULTIES[chosenDifficulty].label} conditions.`]);
    setRunStarted(true);
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
  const sentryWorkers = grid.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + (cell.type === "sentryPost" ? cell.workers : 0), 0), 0);
  const saveLocked = isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize });
  const saveLockReason = "Save/load disabled during raid events";

  const handleBunkerDestroyed = () => {
    setColonists(prev => prev.map(c => c.status === "onSentry"
      ? { ...c, status: "injured", previousRoom: c.assignedRoom ?? c.previousRoom ?? null, assignedRoom: null,
          injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 }
      : c
    ));
    addLog("💥 Surface bunker destroyed — sentry workers are injured.");
    addToast("💥 BUNKER DESTROYED\nSentry workers caught in the blast.\nAll sentries injured.", "injury", { key: `bunker-destroyed-${tickRef.current}` });
    playInjury();
    changeMoraleRef.current(-8, "bunker destroyed");
  };



  // ── Dev-only inspection hook ──────────────────────────────────────────────
  // Long playtests previously had to scrape rendered text to work out what the
  // colony was doing, which is fragile and misses anything not on screen. This
  // exposes the real state so a test harness can assert on it directly.
  // Stripped from ordinary production builds by the guard below.
  //
  // The soak escape hatch: long playtests cannot use the dev server, because
  // StrictMode double-invokes the whole tick loop there and 10x speed actually
  // runs at ~4.5x. Only a production build has an honest clock — but a
  // production build normally strips this hook, which left soak tests with no
  // way to read state. `npm run soak` builds with VITE_SOAK=1 to keep it.
  // Plain `npm run build` is unaffected and still ships without the hook.
  //
  // Object identity is deliberately STABLE. This effect used to run on every
  // render and reassign window.__speranza to a fresh object whose getter closed
  // over that render's variables. A harness that did `const s = window.__speranza`
  // once — the obvious thing to write — then read frozen state forever, silently.
  // It cost a soak run: the harness saw `surfaceDefenseActive: true` for 229
  // consecutive polls after the raid had already finished, so it never resumed
  // the clock. Everything live is read through a ref, and the global is assigned
  // exactly once, so capturing the reference is now safe.
  // The guard is a compile-time constant, so this whole block — snapshot
  // closure, actions, sandbox helpers — is dead code the bundler drops from an
  // ordinary production build. Without it the object is rebuilt every render
  // and ships to players.
  const devHookRef = useRef(null);
  if (import.meta.env.DEV || import.meta.env.VITE_SOAK) devHookRef.current = {
    snapshot: () => ({
          tick, day: Math.floor(tick / 48) + 1, timescale,
          colonyName, difficulty, res, heat, morale,
          colonists, popCap, totalColonists, unassigned,
          grid, unlockedRows, excavations,
          expeditions, surfaceHaul, unlockedTechs,
          raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize,
          deprivedTicks, memorial, firedMilestones, historyLog,
          gameOver, log,
          // Why the clock is stopped. Without this a harness sees timescale 0
          // and cannot tell whether it paused itself, a dilemma is waiting for
          // an answer, or someone levelled up — they all look identical from
          // outside, and every one of them blocks an unattended playtest.
          // This is the SAME value the game runs on, not a second copy of the
          // rules — the two used to be able to drift apart.
          activeDilemma, milestoneToast, helpOpen, buildMenu, selected,
          speed, manualPause, resolve, talents, effects,
          pauseCause: pauseReason,
    }),
      // Actions that bypass UI state, so a harness never has to fake clicks.
      setTimescale,
      build: (r, c, type) => { setSelected({ r, c }); setTimeout(() => handleBuild(type), 0); },
      assign: handleAssign,
      recruit: handleRecruit,
      launch: handleLaunchExpedition,
      setCrew: setExpedCrewIds,
      setLocation: setExpedLocationId,
      restart: handleRestart,
      // Sandbox helper for long soak tests: keeps a colony alive so the raid,
      // expedition, milestone and save systems can be exercised over many days
      // without the test also having to play well. Never use it to judge balance.
      sandboxTopUp: (floor = 120) => setRes(prev => ({
        ...prev,
        energy: Math.max(prev.energy, floor),
        food:   Math.max(prev.food,   floor),
        water:  Math.max(prev.water,  floor),
        scrap:  Math.max(prev.scrap,  floor),
      })),
      // Morale, not supply, is what kills an unmanaged colony: with resources
      // pinned at 150 a fresh colony still collapsed to -100 morale and died on
      // day 3. A soak test needs to survive to day 25 to exercise raids,
      // expeditions and milestones at all, so it needs this lever too.
      // Same caveat as sandboxTopUp: never judge balance from a run that used it.
      sandboxMorale: (floor = 40) => setMorale(prev => Math.max(prev, floor)),
      unlockTalent: handleUnlockTalent,
      grantResolve: (n = 20) => setResolve(prev => prev + n),
  };

  useEffect(() => {
    if (!import.meta.env.DEV && !import.meta.env.VITE_SOAK) return;
    if (window.__speranza) return; // assign once — see the identity note above
    const call = (name) => (...args) => devHookRef.current[name](...args);
    window.__speranza = {
      get state() { return devHookRef.current.snapshot(); },
      setTimescale:  call("setTimescale"),
      build:         call("build"),
      assign:        call("assign"),
      recruit:       call("recruit"),
      launch:        call("launch"),
      setCrew:       call("setCrew"),
      setLocation:   call("setLocation"),
      restart:       call("restart"),
      sandboxTopUp:  call("sandboxTopUp"),
      sandboxMorale: call("sandboxMorale"),
      unlockTalent:  call("unlockTalent"),
      grantResolve:  call("grantResolve"),
    };
  }, []);

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

      <ColonyHeader
        tick={tick}
        colonyName={colonyName}
        difficultyLabel={diffConfig.label}
        onRenameColony={setColonyName}
        resolve={resolve}
        onOpenTalents={() => setTalentScreenOpen(true)}
        timescale={timescale}
        musicVolume={musicVolume}
        res={res}
        surfaceHaul={surfaceHaul}
        surfaceCondition={surfaceCondition}
        morale={morale}
        heat={heat}
        heatState={heatState}
        heatPct={heatPct}
        raidWindow={raidWindow}
        radioTowerOnline={radioTowerOnline}
        unlockedTechs={unlockedTechs}
        totalColonists={totalColonists}
        popCap={popCap}
        unassigned={unassigned}
        grid={grid}
        journalOpen={journalOpen}
        effectsOpen={effectsOpen}
        onTimescale={setTimescale}
        onMusicVolume={handleMusicVolumeChange}
        onRecruit={handleRecruit}
        onToggleJournal={() => setJournalOpen(v => !v)}
        onToggleEffects={() => setEffectsOpen(v => !v)}
        onHoverMorale={setHoveredFlowStat}
        onBugReport={downloadBugReport}
        saveLocked={saveLocked}
        saveLockReason={saveLockReason}
        onSaveNow={handleSaveNow}
        onLoadAutosave={handleLoadAutosave}
        onExportSave={handleExportSave}
        onImportSave={handleImportSave}
        onDeleteAutosaves={handleDeleteAutosaves}
        onOpenHelp={() => { setHelpPage(0); setHelpOpen(true); }}
      />

      <CrisisBanner res={res} netFlow={netFlow} deprivedTicks={deprivedTicks} />

      <RaidBanner
        activeRaid={activeRaid}
        raidWindow={raidWindow}
        radioTowerOnline={radioTowerOnline}
        unlockedTechs={unlockedTechs}
      />

      <TraitPicker colonists={colonists} onPickTrait={handlePickTrait} />

      {!runStarted && <StartScreen onBegin={handleBegin} />}

      {talentScreenOpen && (
        <TalentScreen
          resolve={resolve}
          talents={talents}
          onUnlock={handleUnlockTalent}
          onClose={() => setTalentScreenOpen(false)}
        />
      )}

      <GameOverModal gameOver={gameOver} historyLog={historyLog} colonyName={colonyName} onRestart={handleRestart} />

      <DilemmaModal activeDilemma={activeDilemma} onChoice={handleDilemmaChoice} />

      <HelpModal
        isOpen={helpOpen}
        page={helpPage}
        onNext={() => setHelpPage(p => Math.min(p + 1, 4))}
        onPrev={() => setHelpPage(p => Math.max(p - 1, 0))}
        onClose={handleCloseHelp}
      />

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
            wealthBracket={pendingWealthBracket}
            waveMult={diffConfig.waveMult}
            sentryWorkers={sentryWorkers}
            defenseBudgetBonus={effects.defenseBudgetBonus}
            hatchHpBonus={effects.hatchHpBonus}
            active={surfaceDefenseActive}
            onRaidWon={handleSurfaceRaidWon}
            onRaidLost={handleSurfaceRaidLost}
            onBunkerDestroyed={handleBunkerDestroyed}
          />

          <ColonyGrid
            grid={grid}
            unlockedRows={unlockedRows}
            excavations={excavations}
            selected={selected}
            hoveredCell={hoveredCell}
            mousePos={mousePos}
            gridMetrics={gridMetrics}
            colonists={colonists}
            hoveredColonist={hoveredColonist}
            timescale={timescale}
            onCellClick={handleCellClick}
            onStartExcavation={handleStartExcavation}
            onAssign={handleAssign}
            onSetHoveredCell={setHoveredCell}
            onHoverColonist={setHoveredColonist}
          />

          <FlowPanel
            res={res}
            netFlow={netFlow}
            statBreakdown={statBreakdown}
            mousePos={mousePos}
            hoveredFlowStat={hoveredFlowStat}
            onHoverFlowStat={setHoveredFlowStat}
          />

          <ColonistRoster
            colonists={colonists}
            rosterOpen={rosterOpen}
            hoveredColonist={hoveredColonist}
            selectedColonist={selectedColonist}
            totalColonists={totalColonists}
            mousePos={mousePos}
            onToggleRoster={() => setRosterOpen(o => !o)}
            onSelectColonist={(id) => setSelectedColonist(prev => prev === id ? null : id)}
            onHoverColonist={setHoveredColonist}
          />

          <div style={{ marginTop: 5, fontSize: 8, color: "#1a2535", letterSpacing: 1 }}>
            CLICK EMPTY CELL TO BUILD · CLICK CIRCLES TO ASSIGN WORKERS
          </div>
        </div>

                <SidePanel
          journalOpen={journalOpen}
          effectsOpen={effectsOpen}
          log={log}
          surfaceCondition={surfaceCondition}
          heatState={heatState}
          heatSuppressedTicks={heatSuppressedTicks}
          shelteredCount={shelteredCount}
          memorialHallBuilt={memorialHallBuilt}
          hasRadioTower={hasRadioTower}
          radioTowerOnline={radioTowerOnline}
          recentDilemmaOutcomes={recentDilemmaOutcomes}
          selectedColonist={selectedColonist}
          colonists={colonists}
          selCell={selCell}
          buildMenu={buildMenu}
          selected={selected}
          armoryArmed={armoryArmed}
          expeditions={expeditions}
          expedDuration={expedDuration}
          expedLocationId={expedLocationId}
          expedCrewIds={expedCrewIds}
          unassigned={unassigned}
          unlockedTechs={unlockedTechs}
          res={res}
          memorial={memorial}
          onCloseColonist={() => setSelectedColonist(null)}
          onAssign={handleAssign}
          onSetExpedDuration={setExpedDuration}
          onLaunchExpedition={handleLaunchExpedition}
          onSetExpedLocation={setExpedLocationId}
          onToggleCrew={handleToggleCrew}
          onBackToWork={handleBackToWork}
          onSoundAlarm={handleSoundAlarm}
          onRepair={handleRepair}
          onDemolish={handleDemolish}
          onUnlockTech={handleUnlockTech}
          onCloseRoom={() => { setSelected(null); setBuildMenu(false); }}
        />
      </div>

      <div style={{ maxWidth: 920, width: "100%", marginTop: 6, fontSize: 8, color: "#1a2535", letterSpacing: 1, textAlign: "center" }}>
        BUILD ARMORY + ASSIGN ARMORER → LAUNCH EXPEDITIONS · HIGH THREAT = ARC RAIDS · WORKSHOP IS YOUR LIFELINE
      </div>

      <ToastPanel
        toasts={toasts}
        milestoneToast={milestoneToast}
        /* Toasts are notifications, not overlays — they are not pause reasons
           and must not touch the clock. Dismissing a toast at 10x used to drop
           you silently back to 1x. It structurally cannot now: dismissing a
           toast does not change `speed`, and nothing else may write it. */
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
        onDismissAll={() => setToasts([])}
      />

    </div>
  );
}
