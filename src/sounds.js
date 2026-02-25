// ─── Speranza Audio Manager ───────────────────────────────────────────────────
// Background music: HTMLAudioElement playlist (music1–4.mp3 in /public)
// Sound effects:    Web Audio API (synthesized, no files)

// ── Playlist ─────────────────────────────────────────────────────────────────
const TRACKS = [
  "music1.mp3",
  "music2.mp3",
  "music3.mp3",
  "music4.mp3",
  "music5.mp3",
  "music6.mp3",
];

// ── State ─────────────────────────────────────────────────────────────────────
let audioCtx    = null;
let muted       = false;
let musicEl     = null;   // current HTMLAudioElement
let trackIdx    = 0;
let musicStarted = false;
let sfxMasterGain = null;
let raidDucked = false;

const MASTER_VOL_KEY = "speranza_master_volume";
const DEFAULT_MASTER_VOLUME = 0.4;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function loadMasterVolume() {
  try {
    const raw = window.localStorage.getItem(MASTER_VOL_KEY);
    if (raw == null) return DEFAULT_MASTER_VOLUME;
    const num = Number(raw);
    if (Number.isNaN(num)) return DEFAULT_MASTER_VOLUME;
    return clamp01(num);
  } catch {
    return DEFAULT_MASTER_VOLUME;
  }
}

let masterVolume = loadMasterVolume();

function saveMasterVolume(val) {
  try {
    window.localStorage.setItem(MASTER_VOL_KEY, String(val));
  } catch {}
}

function currentMusicVolume() {
  if (muted) return 0;
  return raidDucked ? Math.max(0.02, masterVolume * 0.25) : masterVolume;
}

function applyMusicVolume() {
  if (musicEl) musicEl.volume = currentMusicVolume();
}

function applySfxVolume() {
  if (!sfxMasterGain) return;
  const ctx = sfxMasterGain.context;
  // Keep SFX volume fixed; music slider only controls background music.
  sfxMasterGain.gain.setValueAtTime(muted ? 0 : DEFAULT_MASTER_VOLUME, ctx.currentTime);
}

function sfxOut(ctx) {
  return sfxMasterGain ?? ctx.destination;
}

// SFX cooldown — prevents stacking at high timescale
let sfxCooldown = false;
function sfxGuard(fn) {
  if (muted || sfxCooldown) return;
  sfxCooldown = true;
  fn();
  setTimeout(() => { sfxCooldown = false; }, 150);
}

// ── AudioContext (lazy — created on first user gesture) ───────────────────────
function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sfxMasterGain = audioCtx.createGain();
    sfxMasterGain.connect(audioCtx.destination);
    applySfxVolume();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ── Music ─────────────────────────────────────────────────────────────────────
function playTrack(idx) {
  if (musicEl) {
    musicEl.pause();
    musicEl.onended = null;
  }
  trackIdx = idx % TRACKS.length;
  const el = new Audio(TRACKS[trackIdx]);
  el.volume = currentMusicVolume();
  el.onended = () => playTrack(trackIdx + 1);
  el.play().catch(() => {}); // swallow autoplay errors
  musicEl = el;
}

export function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  playTrack(0);
}

export function stopMusic() {
  if (musicEl) {
    musicEl.pause();
    musicEl.onended = null;
    musicEl = null;
  }
  musicStarted = false;
}

export function setMuted(val) {
  muted = val;
  applyMusicVolume();
  applySfxVolume();
}

export function getMuted() { return muted; }

export function setMusicVolume(val) {
  masterVolume = clamp01(val);
  saveMasterVolume(masterVolume);
  applyMusicVolume();
}

export function getMusicVolume() {
  return masterVolume;
}

export function setMasterVolume(val) {
  setMusicVolume(val);
}

export function getMasterVolume() {
  return masterVolume;
}

// ── SFX Helpers ───────────────────────────────────────────────────────────────
function osc(ctx, type, freq, startTime, duration, gainPeak, detune = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, startTime);
  if (detune) o.detune.setValueAtTime(detune, startTime);
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  o.connect(g);
  g.connect(sfxOut(ctx));
  o.start(startTime);
  o.stop(startTime + duration + 0.05);
}

function noise(ctx, startTime, duration, gainPeak, highpass = 800) {
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gainPeak, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxOut(ctx));
  src.start(startTime);
  src.stop(startTime + duration);
}

// ── SFX Exports ───────────────────────────────────────────────────────────────

/** Short click when placing a room */
export function playBuild() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, "triangle", 320, t,        0.06, 0.18);
    osc(ctx, "triangle", 560, t + 0.04, 0.05, 0.04, 0);
  });
}

/** Soft UI click */
export function playUiClick() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, "triangle", 420, t, 0.04, 0.08);
  });
}

/** Pulsing alarm — raid fires */
export function playRaid() {
  if (muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  // two harsh pulses
  osc(ctx, "sawtooth", 180, t,        0.22, 0.18);
  osc(ctx, "sawtooth", 160, t + 0.22, 0.22, 0.20);
  noise(ctx, t, 0.08, 0.10, 300);
}

/** Low thud — colonist injured */
export function playInjury() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.25);
  });
}

/** Harsh descending buzz — colonist killed */
export function playKill() {
  if (muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
  g.gain.setValueAtTime(0.20, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.42);
}

/** Ascending two-note chime — tech unlock / colonist recovered */
export function playSuccess() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, "sine", 523, t,        0.14, 0.18);
    osc(ctx, "sine", 784, t + 0.14, 0.14, 0.22);
  });
}

/** Brighter level-up flourish */
export function playLevelUp() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, "sine", 523, t, 0.10, 0.15);
    osc(ctx, "sine", 659, t + 0.08, 0.12, 0.18);
    osc(ctx, "sine", 880, t + 0.18, 0.14, 0.20);
  });
}

/** Triple beep — resource critical */
export function playAlert() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      osc(ctx, "square", 880, t + i * 0.12, 0.08, 0.12);
    }
  });
}

/** Duck music during active raid */
export function duckMusic() {
  raidDucked = true;
  applyMusicVolume();
}

/** Restore music after raid */
export function unduckMusic() {
  raidDucked = false;
  applyMusicVolume();
}

/** Metallic tick — pre-strike warning */
export function playTickAlarm() {
  if (muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  noise(ctx, t, 0.03, 0.18, 1400);
  osc(ctx, "square", 1100, t, 0.04, 0.10);
}

/** Short ascending sweep — expedition launched */
export function playExpedition() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.20);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.28);
  });
}

/** Raid cleared / stood down cue */
export function playRaidOver() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, "triangle", 300, t, 0.10, 0.14);
    osc(ctx, "triangle", 420, t + 0.09, 0.12, 0.16);
  });
}

/** Assign worker */
export function playAssign() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    filt.type = "bandpass";
    filt.frequency.value = 100;
    filt.Q.value = 2;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.15);
  });
}

/** Unassign worker */
export function playUnassign() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.05);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.1);
  });
}

/** Milestone hit */
export function playMilestone() {
  if (muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  const g2 = ctx.createGain();
  o.type = "sine";
  o2.type = "sine";
  o.frequency.value = 110;
  o2.frequency.value = 155;
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
  g2.gain.value = 0.3;
  o.connect(g);
  o2.connect(g2);
  g2.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o2.start(t);
  o.stop(t + 2.6);
  o2.stop(t + 2.6);
}

/** Dilemma appears */
export function playDilemma() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    [0, 0.4].forEach(delay => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      o.type = "square";
      o.frequency.value = 220;
      filt.type = "lowpass";
      filt.frequency.value = 800;
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.12, t + delay + 0.02);
      g.gain.setValueAtTime(0.12, t + delay + 0.12);
      g.gain.linearRampToValueAtTime(0, t + delay + 0.18);
      o.connect(filt);
      filt.connect(g);
      g.connect(ctx.destination);
      o.start(t + delay);
      o.stop(t + delay + 0.2);
    });
  });
}

/** Dilemma resolved */
export function playDilemmaResolve() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 180;
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.12);
  });
}

/** Room demolished */
export function playDemolish() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const tt = i / ctx.sampleRate;
      data[i] = Math.exp(-tt * 8) * (Math.random() * 2 - 1) * 0.6;
    }
    const src = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    src.buffer = buf;
    filt.type = "lowpass";
    filt.frequency.value = 800;
    filt.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    src.connect(filt);
    filt.connect(ctx.destination);
    src.start(t);
  });
}

/** Room repaired */
export function playRepair() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    [0, 0.12].forEach(delay => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      o.type = "square";
      o.frequency.value = 300;
      filt.type = "highpass";
      filt.frequency.value = 800;
      g.gain.setValueAtTime(0.2, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.06);
      o.connect(filt);
      filt.connect(g);
      g.connect(ctx.destination);
      o.start(t + delay);
      o.stop(t + delay + 0.08);
    });
  });
}

/** Recruit colonist */
export function playRecruit() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(200, t);
    o.frequency.linearRampToValueAtTime(400, t + 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.65);
  });
}

/** Shelter alarm */
export function playShelterAlarm() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.4);
    filt.type = "lowpass";
    filt.frequency.value = 1500;
    g.gain.setValueAtTime(0.15, t);
    g.gain.setValueAtTime(0.15, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.55);
  });
}

/** Surface condition changed */
export function playSurfaceCondition() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 220;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.3);
    g.gain.setValueAtTime(0.08, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 1.1);
  });
}

/** Structural damage hit */
export function playStructuralDamage() {
  if (muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03)) * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(t);

  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.45);
}

/** Barricades block success */
export function playBarricadesHold() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.65);
  });
}

/** Arc turret burst */
export function playTurret() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    [0, 0.06, 0.12].forEach(delay => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      o.type = "square";
      o.frequency.value = 220;
      filt.type = "lowpass";
      filt.frequency.value = 1000;
      g.gain.setValueAtTime(0.2, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
      o.connect(filt);
      filt.connect(g);
      g.connect(ctx.destination);
      o.start(t + delay);
      o.stop(t + delay + 0.06);
    });
  });
}

/** EMP trigger */
export function playEMP() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(800, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.6);
    filt.type = "lowpass";
    filt.frequency.value = 1200;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.75);
  });
}

/** Optional autosave cue */
export function playAutosave() {
  sfxGuard(() => {
    const ctx = getCtx();
    const t = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const tt = t + i * 0.1;
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + 0.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(tt);
      o.stop(tt + 0.45);
    });
  });
}

/** Morale collapse warning */
export function playMoraleCollapse() {
  if (muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  [300, 317].forEach(freq => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    o.type = "sawtooth";
    o.frequency.value = freq;
    filt.type = "lowpass";
    filt.frequency.value = 1000;
    g.gain.setValueAtTime(0.1, t);
    g.gain.setValueAtTime(0.1, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.65);
  });
}
