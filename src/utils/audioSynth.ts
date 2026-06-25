/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Safe browser AudioContext retriever
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  
  // Resume context if suspended by browser autoplay policy
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  return audioCtx;
}

/**
 * Play a woody cricket-defensive dot ball "tup" sound
 */
export const playDotBallSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // A dry wood-block-like square/triangle mix
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.12);
};

/**
 * Play a bright metal-on-willow bat contact sound
 * Scaled arpeggios based on the run magnitude (e.g. 4s and 6s have grander chimes!)
 */
export const playRunHitSound = (runs: number) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (runs === 0) {
    playDotBallSound();
    return;
  }

  // Helper to trigger a single chime note with metallic characteristics
  const playNote = (pitch: number, delay: number, duration: number, volume: number) => {
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Primary bright chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now + delay);
    
    // Sub-harmonic for metallic rich texture
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(pitch * 1.5, now + delay);

    gainNode.gain.setValueAtTime(0, now + delay);
    gainNode.gain.linearRampToValueAtTime(volume, now + delay + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.005, now + delay + duration);

    osc.connect(gainNode);
    subOsc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + delay);
    subOsc.start(now + delay);

    osc.stop(now + delay + duration);
    subOsc.stop(now + delay + duration);
  };

  if (runs === 4) {
    // Elegant swift double-ping arpeggio
    playNote(680, 0, 0.25, 0.2);
    playNote(880, 0.08, 0.35, 0.25);
  } else if (runs === 6) {
    // Majestic retro three-tone fanfare with beautiful high decay
    playNote(523.25, 0, 0.2, 0.15); // C5
    playNote(659.25, 0.07, 0.2, 0.18); // E5
    playNote(783.99, 0.14, 0.45, 0.22); // G5
    playNote(1046.50, 0.21, 0.6, 0.25); // C6
  } else {
    // Normal single contact tick (1, 2, 3, or 5 runs)
    const basePitch = 440 + runs * 50;
    playNote(basePitch, 0, 0.22, 0.18);
  }
};

/**
 * Play a funny sliding buzzer/wickets-crashing sound for Wickets
 */
export const playWicketSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Funny "falling slide block" oscillator
  const osc = ctx.createOscillator();
  const noiseOsc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  // Descending slide pitch
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.55);

  // Noise modulation for wickets clatter effect
  noiseOsc.type = 'square';
  noiseOsc.frequency.setValueAtTime(80, now);
  noiseOsc.frequency.linearRampToValueAtTime(10, now + 0.55);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

  osc.connect(gain);
  noiseOsc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  noiseOsc.start(now);

  osc.stop(now + 0.6);
  noiseOsc.stop(now + 0.6);
};

/**
 * Play an elegant ascending arpeggio fanfare for Victory celebration!
 */
export const playVictorySound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major scale arpeggio

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.1);

    const isLast = idx === notes.length - 1;
    const duration = isLast ? 0.9 : 0.35;
    const peakVolume = isLast ? 0.25 : 0.15;

    gain.gain.setValueAtTime(0, now + idx * 0.1);
    gain.gain.linearRampToValueAtTime(peakVolume, now + idx * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.1 + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.1);
    osc.stop(now + idx * 0.1 + duration);
  });
};

/**
 * Play a lighthearted, comedic minor descending triplet for Defeat (Lose)
 */
export const playLoseSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // A minor falling triad (e.g. A4 -> Ab4 -> G4 -> F4)
  const notes = [392.00, 349.23, 311.13, 246.94]; // G4, F4, Eb4 (minor), B3

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + idx * 0.15);

    const isLast = idx === notes.length - 1;
    const duration = isLast ? 0.8 : 0.25;
    const volume = isLast ? 0.2 : 0.14;

    gain.gain.setValueAtTime(0, now + idx * 0.15);
    gain.gain.linearRampToValueAtTime(volume, now + idx * 0.15 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.15 + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.15);
    osc.stop(now + idx * 0.15 + duration);
  });
};
