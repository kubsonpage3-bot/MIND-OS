// Sound effects for MIND OS
// Uses Web Audio API for synthesized sounds (no external files needed)

let audioContext = null;

function playTone(frequency, duration, type = 'sine', volume = 0.1) {
  if (!audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playNoise(duration, volume = 0.05) {
  if (!audioContext) return;
  
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  noise.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  noise.start();
}

const playSoundEffects = {
  // Success sounds
  success: () => {
    playTone(523.25, 0.1, 'sine', 0.15);
    setTimeout(() => playTone(659.25, 0.15, 'sine', 0.12), 80);
  },
  
  critical: () => {
    playTone(523.25, 0.08, 'sine', 0.15);
    setTimeout(() => playTone(659.25, 0.08, 'sine', 0.12), 60);
    setTimeout(() => playTone(783.99, 0.12, 'sine', 0.1), 120);
    setTimeout(() => playTone(1046.50, 0.2, 'sine', 0.08), 180);
  },
  
  task_complete: () => {
    playTone(440, 0.08, 'sine', 0.12);
    setTimeout(() => playTone(554.37, 0.12, 'sine', 0.1), 100);
  },
  
  habit_positive: () => {
    playTone(392, 0.1, 'triangle', 0.1);
  },
  
  habit_negative: () => {
    playTone(196, 0.15, 'sawtooth', 0.08);
    setTimeout(() => playTone(164.81, 0.2, 'sawtooth', 0.06), 100);
  },
  
  rank_up: () => {
    playTone(523.25, 0.15, 'sine', 0.15);
    setTimeout(() => playTone(659.25, 0.15, 'sine', 0.12), 150);
    setTimeout(() => playTone(783.99, 0.2, 'sine', 0.1), 300);
    setTimeout(() => playTone(1046.50, 0.3, 'sine', 0.08), 450);
  },
  
  gold_earned: () => {
    playTone(1046.50, 0.08, 'sine', 0.08);
    setTimeout(() => playTone(1318.51, 0.12, 'sine', 0.06), 100);
  },
  
  damage: () => {
    playTone(146.83, 0.2, 'sawtooth', 0.1);
    setTimeout(() => playTone(130.81, 0.25, 'sawtooth', 0.08), 100);
  },
  
  boss_hit: () => {
    playNoise(0.3, 0.08);
    playTone(98, 0.25, 'square', 0.1);
  },
  
  boss_critical: () => {
    playNoise(0.4, 0.1);
    playTone(98, 0.2, 'square', 0.12);
    setTimeout(() => playTone(146.83, 0.3, 'square', 0.1), 150);
  },
  
  boss_idle_tick: () => {
    playNoise(0.1, 0.01);
    playTone(60, 0.1, 'sine', 0.02);
  },
  
  mana_restore: () => {
    playTone(783.99, 0.15, 'sine', 0.08);
    setTimeout(() => playTone(987.77, 0.2, 'sine', 0.06), 120);
  },
  
  click: () => {
    playTone(880, 0.03, 'sine', 0.05);
  },
  
  error: () => {
    playTone(196, 0.2, 'sawtooth', 0.1);
    setTimeout(() => playTone(164.81, 0.3, 'sawtooth', 0.08), 150);
    setTimeout(() => playTone(146.83, 0.4, 'sawtooth', 0.06), 300);
  },
  
  purchase: () => {
    playTone(440, 0.1, 'sine', 0.25);
    setTimeout(() => playTone(554.37, 0.1, 'sine', 0.25), 60);
    setTimeout(() => playTone(659.25, 0.2, 'sine', 0.3), 120);
  },
};

// Main playSound function that takes a string name
export function playSound(name) {
  if (playSoundEffects[name]) {
    playSoundEffects[name]();
  }
}

// Also export the object for direct access if needed
export { playSoundEffects };

// Initialize audio context on first user interaction (using capturing phase to handle early play calls)
if (typeof window !== 'undefined') {
  const initAudio = () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window['webkitAudioContext'])();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener('click', initAudio, true);
    window.removeEventListener('keydown', initAudio, true);
  };

  window.addEventListener('click', initAudio, true);
  window.addEventListener('keydown', initAudio, true);
}