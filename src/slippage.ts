// src/slippage.ts — Slippage enforcement

import { SimulationResult } from './simulate';

export interface SlippageCheckResult {
  ok: boolean;
  actualSlippage: number; // in basis points
  maxSlippage: number; // in basis points
  reason?: string;
}

/**
 * SlippageGuard — compares simulated output against expected output
 * and rejects if slippage exceeds the configured cap.
 */
export class SlippageGuard {
  /**
   * Check whether the simulation's slippage is within limits.
   * @param simulation  The simulation result containing predictedOut & priceImpact
   * @param expectedOut The amount the agent expected to receive
   * @param maxSlippageBps  Maximum acceptable slippage in basis points
   */
  check(
    simulation: SimulationResult,
    expectedOut: string,
    maxSlippageBps: number
  ): SlippageCheckResult {
    // If simulation failed, slippage check is moot
    if (!simulation.success) {
      return {
        ok: false,
        actualSlippage: 0,
        maxSlippage: maxSlippageBps,
        reason: `Simulation failed: ${simulation.error || 'unknown error'}`,
      };
    }

    const actualSlippage = this.calculateSlippage(
      expectedOut,
      simulation.predictedOut
    );

    const ok = actualSlippage <= maxSlippageBps;

    return {
      ok,
      actualSlippage,
      maxSlippage: maxSlippageBps,
      reason: ok
        ? undefined
        : `Slippage ${actualSlippage} bps exceeds max ${maxSlippageBps} bps`,
    };
  }

  /**
   * Calculate slippage in basis points between expected and actual amounts.
   * slippage = |expected - actual| / expected * 10000
   */
  calculateSlippage(expected: string, actual: string): number {
    if (!expected || expected === '0') return 0;
    const expectedBn = BigInt(expected);
    const actualBn = BigInt(actual);
    if (expectedBn === 0n) return 0;

    const diff = expectedBn > actualBn ? expectedBn - actualBn : actualBn - expectedBn;
    return Number((diff * 10000n) / expectedBn);
  }
}
