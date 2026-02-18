// ─── Speranza Audio Manager ───────────────────────────────────────────────────
// Background music: HTMLAudioElement playlist (music1–4.mp3 in /public)
// Sound effects:    Web Audio API (synthesized, no files)

// ── Playlist ─────────────────────────────────────────────────────────────────
const TRACKS = [
  "music1.mp3",
  "music2.mp3",
  "music3.mp3",
  "music4.mp3",
];

// ── State ─────────────────────────────────────────────────────────────────────
let audioCtx    = null;
let muted       = false;
let musicEl     = null;   // current HTMLAudioElement
let trackIdx    = 0;
let musicStarted = false;

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
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
  el.volume = muted ? 0 : 0.40;
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
  if (musicEl) musicEl.volume = muted ? 0 : 0.40;
}

export function getMuted() { return muted; }

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
  g.connect(ctx.destination);
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
  g.connect(ctx.destination);
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
  if (musicEl) musicEl.volume = 0.10;
}

/** Restore music after raid */
export function unduckMusic() {
  if (musicEl) musicEl.volume = muted ? 0 : 0.40;
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
