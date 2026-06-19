import { describe, it, expect } from 'vitest';
import { SlippageGuard } from '../src/slippage';
import { SimulationResult } from '../src/simulate';

function makeSimResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    success: true,
    predictedOut: '9900',
    priceImpact: 100,
    gasUsed: '150000',
    stateChanges: [],
    ...overrides,
  };
}

describe('SlippageGuard', () => {
  const guard = new SlippageGuard();

  it('passes when slippage is within limit', () => {
    // expected 10000, actual 9950 → 50 bps, max 50 bps
    const result = guard.check(makeSimResult({ predictedOut: '9950' }), '10000', 50);
    expect(result.ok).toBe(true);
    expect(result.actualSlippage).toBe(50);
  });

  it('fails when slippage exceeds limit', () => {
    // expected 10000, actual 9800 → 200 bps, max 50 bps
    const result = guard.check(makeSimResult({ predictedOut: '9800' }), '10000', 50);
    expect(result.ok).toBe(false);
    expect(result.actualSlippage).toBe(200);
    expect(result.reason).toContain('exceeds max');
  });

  it('fails when simulation failed', () => {
    const result = guard.check(makeSimResult({ success: false, error: 'revert' }), '10000', 50);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Simulation failed');
  });

  it('returns 0 slippage for empty expected', () => {
    const result = guard.check(makeSimResult(), '', 50);
    expect(result.ok).toBe(true);
    expect(result.actualSlippage).toBe(0);
  });

  it('calculateSlippage handles zero expected gracefully', () => {
    expect(guard.calculateSlippage('0', '100')).toBe(0);
  });

  it('calculateSlippage computes correctly', () => {
    // expected 20000, actual 19800 → 100 bps
    expect(guard.calculateSlippage('20000', '19800')).toBe(100);
  });
});
