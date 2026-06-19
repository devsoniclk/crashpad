import { describe, it, expect, vi } from 'vitest';
import { CrashpadGuard, SafetyViolation } from '../src/guard';
import { SimulationResult } from '../src/simulate';
import { resolve } from 'path';

// Mock the Simulator to avoid real RPC calls
vi.mock('../src/simulate', async () => {
  const actual = await vi.importActual<typeof import('../src/simulate')>('../src/simulate');
  return {
    ...actual,
    Simulator: class MockSimulator {
      private mockResult: SimulationResult;

      constructor(_config: any) {
        this.mockResult = {
          success: true,
          predictedOut: '9950',
          priceImpact: 50,
          gasUsed: '150000',
          stateChanges: [],
        };
      }

      async simulate(_tx: any): Promise<SimulationResult> {
        return this.mockResult;
      }

      calculatePriceImpact(expected: string | undefined, actual: string): number {
        return actual.Calculate?.(expected) ?? 50;
      }
    },
  };
});

describe('CrashpadGuard', () => {
  const baseTx = {
    to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    from: '0x1234567890abcdef1234567890abcdef12345678',
    data: '0x38ed1739',
    expectedOut: '10000',
    usdValue: 500,
  };

  it('instantiates with default rules', () => {
    const guard = new CrashpadGuard({
      simRpc: 'http://localhost:8545',
    });
    expect(guard).toBeDefined();
    expect(guard.getRules().slippage.max_bps).toBe(50);
  });

  it('instantiates with custom rules file', () => {
    const guard = new CrashpadGuard({
      simRpc: 'http://localhost:8545',
      rulesPath: resolve(__dirname, '../crashpad.yaml'),
    });
    expect(guard.getRules().position.max_usd).toBe(1000);
  });

  it('guard() returns result with verdict', async () => {
    const guard = new CrashpadGuard({
      simRpc: 'http://localhost:8545',
      rules: {
        slippage: { max_bps: 100 },
        position: { max_usd: 5000 },
        loss: { max_per_action_usd: 100, max_per_day_usd: 500 },
        mev: { route_private_above_usd: 10000 },
        rewardhack: { max_circular_flows: 10, max_self_deals_per_hour: 20 },
      },
    });

    const result = await guard.guard(baseTx);
    expect(result.verdict).toBeDefined();
    expect(result.simulation).toBeDefined();
    expect(result.violations).toBeDefined();
  });

  it('SafetyViolation is throwable', () => {
    const err = new SafetyViolation({
      verdict: 'block',
      simulation: {
        success: false,
        predictedOut: '0',
        priceImpact: 0,
        gasUsed: '0',
        stateChanges: [],
        error: 'test',
      },
      violations: [{ rule: 'test', message: 'test violation', severity: 'block' }],
      reason: 'Blocked for testing',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SafetyViolation');
    expect(err.result.verdict).toBe('block');
  });
});
