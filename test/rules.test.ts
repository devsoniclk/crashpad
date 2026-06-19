import { describe, it, expect } from 'vitest';
import { loadRules, validateRules, evaluateRules, CrashpadRules } from '../src/rules';
import { SimulationResult } from '../src/simulate';
import { resolve } from 'path';

const DEFAULT_RULES: CrashpadRules = {
  slippage: { max_bps: 50 },
  position: { max_usd: 1000 },
  loss: { max_per_action_usd: 25, max_per_day_usd: 100 },
  mev: { route_private_above_usd: 250 },
  rewardhack: { max_circular_flows: 3, max_self_deals_per_hour: 5 },
};

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

describe('Rules', () => {
  describe('loadRules', () => {
    it('loads from YAML file', () => {
      const rules = loadRules(resolve(__dirname, '../crashpad.yaml'));
      expect(rules.slippage.max_bps).toBe(50);
      expect(rules.position.max_usd).toBe(1000);
      expect(rules.loss.max_per_action_usd).toBe(25);
    });

    it('returns defaults for missing file', () => {
      const rules = loadRules('/nonexistent/path.yaml');
      expect(rules).toEqual(DEFAULT_RULES);
    });
  });

  describe('validateRules', () => {
    it('passes for valid rules', () => {
      const errors = validateRules(DEFAULT_RULES);
      expect(errors).toHaveLength(0);
    });

    it('fails for missing slippage', () => {
      const errors = validateRules({ ...DEFAULT_RULES, slippage: { max_bps: 0 } });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('slippage');
    });
  });

  describe('evaluateRules', () => {
    it('passes when all rules are met', () => {
      const result = evaluateRules(makeSimResult(), DEFAULT_RULES, {
        usdValue: 500,
        slippageBps: 30,
      });
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('fails when slippage exceeds max', () => {
      const result = evaluateRules(makeSimResult(), DEFAULT_RULES, {
        usdValue: 500,
        slippageBps: 100,
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'slippage')).toBe(true);
    });

    it('fails when position exceeds max', () => {
      const result = evaluateRules(makeSimResult(), DEFAULT_RULES, {
        usdValue: 5000,
        slippageBps: 30,
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'position')).toBe(true);
    });

    it('fails when loss per action exceeds max', () => {
      // priceImpact 500 bps on $1000 = $50 loss, max is $25
      const result = evaluateRules(makeSimResult({ priceImpact: 500 }), DEFAULT_RULES, {
        usdValue: 1000,
        slippageBps: 30,
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'loss_per_action')).toBe(true);
    });
  });
});
