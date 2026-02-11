/**
 * Chime generator using the Web Audio API.
 *
 * Three distinctive bell sounds — all subtle and medical-appropriate.
 * Plays ONCE, never loops.
 */

export type ChimeType = 'gentle-bell' | 'singing-bowl' | 'soft-chime';

export const CHIME_OPTIONS: { id: ChimeType; label: string }[] = [
  { id: 'gentle-bell', label: 'Gentle Bell' },
  { id: 'singing-bowl', label: 'Singing Bowl' },
  { id: 'soft-chime', label: 'Soft Chime' },
];

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Gentle Bell — a warm, round bell strike with natural harmonics.
 * Two layered sine tones with a soft attack and long decay.
 */
function playGentleBell(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume * 0.25, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  master.connect(ctx.destination);

  // Fundamental — warm tone
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523, now); // C5
  osc1.frequency.exponentialRampToValueAtTime(520, now + 1.0);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(1.0, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  osc1.connect(g1).connect(master);
  osc1.start(now);
  osc1.stop(now + 1.2);

  // Overtone — adds shimmer
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1047, now); // C6 (octave above)
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.3, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(g2).connect(master);
  osc2.start(now);
  osc2.stop(now + 0.7);

  // Third harmonic — very faint brightness
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(1568, now); // G6
  const g3 = ctx.createGain();
  g3.gain.setValueAtTime(0.08, now);
  g3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc3.connect(g3).connect(master);
  osc3.start(now);
  osc3.stop(now + 0.4);
}

/**
 * Singing Bowl — a meditative, resonant tone with slow beating.
 * Two closely-tuned sine waves create a natural "wobble" effect.
 */
function playSingingBowl(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume * 0.2, now);
  master.gain.setValueAtTime(volume * 0.2, now + 0.3);
  master.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  master.connect(ctx.destination);

  // Two slightly detuned tones — creates natural beating
  const freqA = 396; // G4-ish (solfeggio frequency, calming)
  const freqB = 398; // Slight detune — 2 Hz beating

  const oscA = ctx.createOscillator();
  oscA.type = 'sine';
  oscA.frequency.setValueAtTime(freqA, now);
  const gA = ctx.createGain();
  gA.gain.setValueAtTime(1.0, now);
  gA.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  oscA.connect(gA).connect(master);
  oscA.start(now);
  oscA.stop(now + 2.0);

  const oscB = ctx.createOscillator();
  oscB.type = 'sine';
  oscB.frequency.setValueAtTime(freqB, now);
  const gB = ctx.createGain();
  gB.gain.setValueAtTime(1.0, now);
  gB.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  oscB.connect(gB).connect(master);
  oscB.start(now);
  oscB.stop(now + 2.0);

  // Upper harmonic for "ring"
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(792, now); // Octave
  const g3 = ctx.createGain();
  g3.gain.setValueAtTime(0.15, now);
  g3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc3.connect(g3).connect(master);
  osc3.start(now);
  osc3.stop(now + 1.0);
}

/**
 * Soft Chime — a bright but gentle two-note wind chime.
 * Two sequential tones, like a small tubular bell being struck.
 */
function playSoftChime(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume * 0.22, now);
  master.connect(ctx.destination);

  // First note — higher, shorter
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now); // A5
  osc1.frequency.exponentialRampToValueAtTime(875, now + 0.5);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(1.0, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc1.connect(g1).connect(master);
  osc1.start(now);
  osc1.stop(now + 0.6);

  // Second note — lower, delayed, longer ring
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659, now + 0.15); // E5
  osc2.frequency.exponentialRampToValueAtTime(655, now + 0.9);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.linearRampToValueAtTime(0.8, now + 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  osc2.connect(g2).connect(master);
  osc2.start(now);
  osc2.stop(now + 1.0);

  // Faint shimmer on the first strike
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(1760, now); // A6
  const g3 = ctx.createGain();
  g3.gain.setValueAtTime(0.12, now);
  g3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc3.connect(g3).connect(master);
  osc3.start(now);
  osc3.stop(now + 0.25);
}

/**
 * Play a chime sound.
 *
 * @param volume 0–1 (default 0.5)
 * @param type which chime to play (default 'gentle-bell')
 */
export function playChime(volume = 0.5, type: ChimeType = 'gentle-bell'): void {
  const ctx = getAudioContext();
  const safeVolume = Math.max(0, Math.min(1, volume));

  switch (type) {
    case 'singing-bowl':
      playSingingBowl(ctx, safeVolume);
      break;
    case 'soft-chime':
      playSoftChime(ctx, safeVolume);
      break;
    case 'gentle-bell':
    default:
      playGentleBell(ctx, safeVolume);
      break;
  }
}
