import type { ColourResult } from '../types';

// ──────────────────────────────────────────────
// Colour palette from the spec (section 4.2)
// ──────────────────────────────────────────────
//
// 0 %  ─── green  #22C55E
// 60 % ─── lime   #84CC16  (end of green / start of yellow band)
// 75 % ─── yellow #EAB308  (mid-yellow)
// 90 % ─── amber  #F59E0B  (end of yellow / start of red band)
// 100% ─── red    #EF4444
// >100% ── deep red #DC2626  (overtime — solid)

interface RGB { r: number; g: number; b: number }

const GREEN: RGB   = { r: 0x22, g: 0xC5, b: 0x5E }; // #22C55E
const LIME: RGB    = { r: 0x84, g: 0xCC, b: 0x16 }; // #84CC16
const YELLOW: RGB  = { r: 0xEA, g: 0xB3, b: 0x08 }; // #EAB308
const AMBER: RGB   = { r: 0xF5, g: 0x9E, b: 0x0B }; // #F59E0B
const RED: RGB     = { r: 0xEF, g: 0x44, b: 0x44 }; // #EF4444
const DEEP_RED: RGB = { r: 0xDC, g: 0x26, b: 0x26 }; // #DC2626

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

function toHex(c: RGB): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

/**
 * Returns the interpolated background and text colours for the timer widget.
 *
 * @param percentElapsed  0‑1+ value (can exceed 1 in overtime)
 * @param yellowThreshold fraction (default 0.6) where green→yellow begins
 * @param redThreshold    fraction (default 0.9) where yellow→red begins
 */
export function getTimerColour(
  percentElapsed: number,
  yellowThreshold = 0.6,
  redThreshold = 0.9,
): ColourResult {
  // Overtime — solid deep red
  if (percentElapsed >= 1) {
    return { background: toHex(DEEP_RED), text: '#FFFFFF' };
  }

  let bg: RGB;

  if (percentElapsed <= yellowThreshold) {
    // Green band: GREEN → LIME
    const t = yellowThreshold > 0 ? percentElapsed / yellowThreshold : 0;
    bg = lerpRGB(GREEN, LIME, clamp01(t));
  } else if (percentElapsed <= redThreshold) {
    // Yellow band: LIME → YELLOW → AMBER
    const range = redThreshold - yellowThreshold;
    const t = range > 0 ? (percentElapsed - yellowThreshold) / range : 0;
    const clamped = clamp01(t);
    if (clamped <= 0.5) {
      bg = lerpRGB(LIME, YELLOW, clamped * 2);
    } else {
      bg = lerpRGB(YELLOW, AMBER, (clamped - 0.5) * 2);
    }
  } else {
    // Red band: AMBER → RED
    const range = 1 - redThreshold;
    const t = range > 0 ? (percentElapsed - redThreshold) / range : 0;
    bg = lerpRGB(AMBER, RED, clamp01(t));
  }

  return { background: toHex(bg), text: '#FFFFFF' };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
