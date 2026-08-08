// Sound effects for MIND OS
// Uses Web Audio API for synthesized sounds (no external files needed)

let audioContext = null;

// -- Core primitives ----------------------------------------------------------

function getCtx() {
  return audioContext;
}

function playTone(frequency, duration, type = "sine", volume = 0.1, startOffset = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  const start = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(volume, start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function playSweep(fromFreq, toFreq, duration, type = "sine", volume = 0.1, startOffset = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  const start = ctx.currentTime + startOffset;
  oscillator.frequency.setValueAtTime(fromFreq, start);
  oscillator.frequency.exponentialRampToValueAtTime(toFreq, start + duration);

  gainNode.gain.setValueAtTime(volume, start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function playNoise(duration, volume = 0.05, startOffset = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const gainNode = ctx.createGain();
  const start = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(volume, start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

  noise.connect(gainNode);
  gainNode.connect(ctx.destination);
  noise.start(start);
}

// Adds a reverb-like delay feedback layer for important events
function playToneWithReverb(frequency, duration, type = "sine", volume = 0.12, startOffset = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  playTone(frequency, duration, type, volume, startOffset);
  playTone(frequency * 0.998, duration * 0.8, type, volume * 0.30, startOffset + 0.12);
  playTone(frequency * 1.002, duration * 0.6, type, volume * 0.15, startOffset + 0.24);
}

// -- Sound library ------------------------------------------------------------

const playSoundEffects = {

  // TASK COMPLETION

  success: () => {
    playTone(523.25, 0.12, "sine", 0.14);
    playTone(659.25, 0.18, "sine", 0.11, 0.08);
  },

  task_complete: () => {
    playTone(440, 0.10, "sine", 0.13);
    playTone(554.37, 0.15, "sine", 0.10, 0.10);
  },

  daily_complete: () => {
    playTone(523.25, 0.25, "sine", 0.14);
    playTone(659.25, 0.25, "sine", 0.11, 0.04);
    playTone(783.99, 0.30, "sine", 0.09, 0.08);
    playTone(1046.50, 0.35, "sine", 0.07, 0.14);
  },

  checkin_done: () => {
    playTone(880, 0.08, "sine", 0.12);
    playTone(1108.73, 0.12, "sine", 0.09, 0.07);
  },

  critical: () => {
    playTone(523.25, 0.08, "sine", 0.18);
    playTone(659.25, 0.08, "sine", 0.15, 0.06);
    playTone(783.99, 0.12, "sine", 0.13, 0.12);
    playTone(1046.50, 0.25, "sine", 0.11, 0.18);
    playTone(1046.50, 0.20, "sine", 0.05, 0.45);
  },

  // HABITS

  habit_positive: () => {
    playTone(523.25, 0.08, "triangle", 0.11);
    playTone(659.25, 0.12, "triangle", 0.08, 0.07);
  },

  habit_negative: () => {
    playSweep(280, 196, 0.18, "sawtooth", 0.10);
    playSweep(196, 164.81, 0.22, "sawtooth", 0.08, 0.14);
  },

  // STREAKS

  streak_milestone: () => {
    playTone(392, 0.15, "sine", 0.12);
    playTone(523.25, 0.20, "sine", 0.11, 0.10);
    playTone(659.25, 0.25, "sine", 0.10, 0.20);
    playTone(783.99, 0.35, "sine", 0.09, 0.32);
    playTone(783.99, 0.30, "sine", 0.04, 0.55);
  },

  // PROGRESSION

  rank_up: () => {
    playToneWithReverb(523.25, 0.18, "sine", 0.15);
    playToneWithReverb(659.25, 0.18, "sine", 0.12, 0.15);
    playToneWithReverb(783.99, 0.22, "sine", 0.10, 0.30);
    playToneWithReverb(1046.50, 0.35, "sine", 0.09, 0.48);
    playTone(1318.51, 0.45, "sine", 0.07, 0.70);
  },

  level_up: () => {
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    notes.forEach((freq, i) => {
      playTone(freq, 0.20 + i * 0.03, "sine", 0.13 - i * 0.01, i * 0.10);
    });
    playTone(1046.50, 0.5, "sine", 0.08, 0.65);
  },

  // ACHIEVEMENT

  achievement: () => {
    playToneWithReverb(523.25, 0.15, "sine", 0.14);
    playToneWithReverb(783.99, 0.15, "sine", 0.13, 0.18);
    playToneWithReverb(1318.51, 0.20, "sine", 0.12, 0.36);
    playToneWithReverb(1046.50, 0.40, "sine", 0.10, 0.52);
    playTone(2093.00, 0.15, "sine", 0.04, 0.60);
  },

  // ECONOMY

  gold_earned: () => {
    playTone(1046.50, 0.08, "sine", 0.09);
    playTone(1318.51, 0.14, "sine", 0.07, 0.09);
    playTone(1567.98, 0.10, "sine", 0.05, 0.18);
  },

  purchase: () => {
    playTone(440, 0.09, "sine", 0.13);
    playTone(554.37, 0.09, "sine", 0.12, 0.06);
    playTone(659.25, 0.18, "sine", 0.11, 0.12);
    playNoise(0.08, 0.04, 0.10);
  },

  chest_open: () => {
    playTone(392, 0.08, "sine", 0.10);
    playTone(523.25, 0.08, "sine", 0.12, 0.06);
    playTone(659.25, 0.25, "sine", 0.13, 0.12);
    playTone(1046.50, 0.35, "sine", 0.11, 0.22);
    playNoise(0.15, 0.06, 0.30);
    playNoise(0.10, 0.04, 0.42);
    playNoise(0.08, 0.03, 0.52);
  },

  // COMBAT

  damage: () => {
    playSweep(200, 146.83, 0.20, "sawtooth", 0.12);
    playSweep(146.83, 110, 0.28, "sawtooth", 0.09, 0.14);
  },

  boss_hit: () => {
    playNoise(0.25, 0.09);
    playSweep(130, 65, 0.30, "square", 0.12);
  },

  boss_critical: () => {
    playNoise(0.35, 0.12);
    playSweep(196, 98, 0.25, "square", 0.14);
    playTone(146.83, 0.35, "square", 0.10, 0.15);
    playNoise(0.15, 0.06, 0.40);
  },

  boss_idle_tick: () => {
    playNoise(0.1, 0.012);
    playTone(60, 0.1, "sine", 0.025);
  },

  // MANA

  mana_restore: () => {
    playTone(659.25, 0.12, "sine", 0.09);
    playTone(830.61, 0.18, "sine", 0.07, 0.10);
    playTone(987.77, 0.25, "sine", 0.06, 0.22);
  },

  // DEATH (was called but missing!)

  death: () => {
    const notes = [523.25, 493.88, 440.00, 415.30, 392.00, 349.23, 261.63];
    notes.forEach((freq, i) => {
      playTone(freq, 0.35 + i * 0.05, "sawtooth", Math.max(0.02, 0.10 - i * 0.008), i * 0.14);
    });
    playTone(65.41, 1.2, "sine", 0.14, 0.50);
    playNoise(0.40, 0.08, 0.55);
  },

  // UI

  click: () => {
    playTone(880, 0.04, "sine", 0.06);
  },

  tab_switch: () => {
    playNoise(0.06, 0.03);
    playTone(660, 0.05, "sine", 0.05, 0.02);
  },

  error: () => {
    playSweep(280, 196, 0.20, "sawtooth", 0.11);
    playSweep(196, 164.81, 0.25, "sawtooth", 0.09, 0.15);
    playSweep(164.81, 146.83, 0.30, "sawtooth", 0.07, 0.30);
  },
};

// -- Public API ---------------------------------------------------------------

export function playSound(name) {
  if (playSoundEffects[name]) {
    playSoundEffects[name]();
  }
}

export { playSoundEffects };

// -- AudioContext init (lazy, on first interaction) ---------------------------

if (typeof window !== "undefined") {
  const initAudio = () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window["webkitAudioContext"])();
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener("click", initAudio, true);
    window.removeEventListener("keydown", initAudio, true);
    window.removeEventListener("touchstart", initAudio, true);
  };

  window.addEventListener("click", initAudio, true);
  window.addEventListener("keydown", initAudio, true);
  window.addEventListener("touchstart", initAudio, true);
}
