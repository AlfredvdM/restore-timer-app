import { describe, it, expect } from 'vitest';
import { getTimerColour } from './colour-calculator';

describe('getTimerColour', () => {
  // ── Boundary values ──────────────────────────

  it('returns green (#22c55e) at 0% elapsed', () => {
    const result = getTimerColour(0);
    expect(result.background.toLowerCase()).toBe('#22c55e');
    expect(result.text).toBe('#FFFFFF');
  });

  it('returns lime (#84cc16) at exactly the yellow threshold (60%)', () => {
    const result = getTimerColour(0.6);
    expect(result.background.toLowerCase()).toBe('#84cc16');
  });

  it('returns amber (#f59e0b) at exactly the red threshold (90%)', () => {
    const result = getTimerColour(0.9);
    expect(result.background.toLowerCase()).toBe('#f59e0b');
  });

  it('returns deep red (#dc2626) at 100% (overtime)', () => {
    const result = getTimerColour(1.0);
    expect(result.background.toLowerCase()).toBe('#dc2626');
  });

  it('returns deep red (#dc2626) for values above 100%', () => {
    const result = getTimerColour(1.5);
    expect(result.background.toLowerCase()).toBe('#dc2626');
  });

  // ── Interpolation sanity checks ──────────────

  it('interpolates in the green band (30% — midpoint of 0→60%)', () => {
    const result = getTimerColour(0.3);
    // Midpoint between GREEN #22C55E and LIME #84CC16
    // r: (0x22+0x84)/2 = 0x53, g: (0xC5+0xCC)/2 ≈ 0xC9, b: (0x5E+0x16)/2 = 0x3A
    expect(result.background.toLowerCase()).toBe('#53c93a');
  });

  it('interpolates in the yellow band', () => {
    const result = getTimerColour(0.75); // midpoint of 0.6→0.9
    // At t=0.5 of yellow band → should be exactly YELLOW #EAB308
    expect(result.background.toLowerCase()).toBe('#eab308');
  });

  it('interpolates in the red band', () => {
    const result = getTimerColour(0.95); // midpoint of 0.9→1.0
    // Midpoint between AMBER #F59E0B and RED #EF4444
    // Rounding means we accept either #f27127 or #f27128
    const bg = result.background.toLowerCase();
    expect(bg === '#f27127' || bg === '#f27128').toBe(true);
  });

  // ── Custom thresholds ────────────────────────

  it('respects custom yellowThreshold', () => {
    // Yellow at 40% instead of 60%
    const result = getTimerColour(0.4, 0.4, 0.9);
    expect(result.background.toLowerCase()).toBe('#84cc16'); // lime at yellow boundary
  });

  it('respects custom redThreshold', () => {
    const result = getTimerColour(0.8, 0.6, 0.8);
    expect(result.background.toLowerCase()).toBe('#f59e0b'); // amber at red boundary
  });

  // ── Always returns white text ────────────────

  it('always returns white text colour', () => {
    const samples = [0, 0.3, 0.6, 0.75, 0.9, 0.95, 1.0, 1.5];
    for (const pct of samples) {
      expect(getTimerColour(pct).text).toBe('#FFFFFF');
    }
  });

  // ── Edge: 0% thresholds don't crash ──────────

  it('handles edge case of 0 thresholds without crashing', () => {
    const result = getTimerColour(0.5, 0, 0);
    expect(result.background).toBeTruthy();
    expect(result.text).toBe('#FFFFFF');
  });
});
