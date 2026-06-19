// src/rules.ts — YAML rules loader + evaluation engine

import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { SimulationResult } from './simulate';

export interface CrashpadRules {
  slippage: { max_bps: number };
  position: { max_usd: number };
  loss: { max_per_action_usd: number; max_per_day_usd: number };
  mev: { route_private_above_usd: number };
  rewardhack: { max_circular_flows: number; max_self_deals_per_hour: number };
}

export interface Violation {
  rule: string;
  message: string;
  severity: 'warn' | 'block';
  actual?: number;
  limit?: number;
}

export interface RuleResult {
  passed: boolean;
  violations: Violation[];
}

const DEFAULT_RULES: CrashpadRules = {
  slippage: { max_bps: 50 },
  position: { max_usd: 1000 },
  loss: { max_per_action_usd: 25, max_per_day_usd: 100 },
  mev: { route_private_above_usd: 250 },
  rewardhack: { max_circular_flows: 3, max_self_deals_per_hour: 5 },
};

/**
 * Load safety rules from a YAML file.
 * Falls back to built-in defaults if the file doesn't exist.
 */
export function loadRules(yamlPath?: string): CrashpadRules {
  if (yamlPath && existsSync(yamlPath)) {
    const raw = readFileSync(yamlPath, 'utf-8');
    const parsed = parseYaml(raw);
    return { ...DEFAULT_RULES, ...parsed };
  }
  return { ...DEFAULT_RULES };
}

/**
 * Validate a rules object — ensure all required fields are present
 * and values are sane.
 */
export function validateRules(rules: Partial<CrashpadRules>): string[] {
  const errors: string[] = [];

  if (!rules.slippage?.max_bps || rules.slippage.max_bps <= 0) {
    errors.push('slippage.max_bps must be a positive integer');
  }
  if (!rules.position?.max_usd || rules.position.max_usd <= 0) {
    errors.push('position.max_usd must be a positive number');
  }
  if (!rules.loss?.max_per_action_usd || rules.loss.max_per_action_usd <= 0) {
    errors.push('loss.max_per_action_usd must be a positive number');
  }
  if (!rules.loss?.max_per_day_usd || rules.loss.max_per_day_usd <= 0) {
    errors.push('loss.max_per_day_usd must be a positive number');
  }
  if (rules.mev?.route_private_above_usd === undefined) {
    errors.push('mev.route_private_above_usd is required');
  }
  if (!rules.rewardhack?.max_circular_flows || rules.rewardhack.max_circular_flows < 0) {
    errors.push('rewardhack.max_circular_flows must be >= 0');
  }
  if (
    !rules.rewardhack?.max_self_deals_per_hour ||
    rules.rewardhack.max_self_deals_per_hour < 0
  ) {
    errors.push('rewardhack.max_self_deals_per_hour must be >= 0');
  }

  return errors;
}

/**
 * Evaluate a simulation against the loaded rules.
 * Returns violations for each rule that fails.
 */
export function evaluateRules(
  simulation: SimulationResult,
  rules: CrashpadRules,
  context?: { usdValue?: number; slippageBps?: number }
): RuleResult {
  const violations: Violation[] = [];

  // Slippage check (if slippage is provided via context or simulation)
  if (context?.slippageBps !== undefined) {
    if (context.slippageBps > rules.slippage.max_bps) {
      violations.push({
        rule: 'slippage',
        message: `Slippage ${context.slippageBps} bps exceeds max ${rules.slippage.max_bps} bps`,
        severity: 'block',
        actual: context.slippageBps,
        limit: rules.slippage.max_bps,
      });
    }
  }

  // Position size check
  if (context?.usdValue !== undefined) {
    if (context.usdValue > rules.position.max_usd) {
      violations.push({
        rule: 'position',
        message: `Position $${context.usdValue} exceeds max $${rules.position.max_usd}`,
        severity: 'block',
        actual: context.usdValue,
        limit: rules.position.max_usd,
      });
    }
  }

  // Price impact / loss per action check
  if (simulation.priceImpact > 0 && context?.usdValue !== undefined) {
    const estimatedLoss = (context.usdValue * simulation.priceImpact) / 10000;
    if (estimatedLoss > rules.loss.max_per_action_usd) {
      violations.push({
        rule: 'loss_per_action',
        message: `Estimated loss $${estimatedLoss.toFixed(2)} exceeds max $${rules.loss.max_per_action_usd}`,
        severity: 'block',
        actual: estimatedLoss,
        limit: rules.loss.max_per_action_usd,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
