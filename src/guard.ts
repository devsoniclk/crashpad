// src/guard.ts — Main CrashpadGuard: orchestrates all safety checks

import { Simulator, TransactionRequest, SimulationResult, SimConfig } from './simulate';
import { SlippageGuard, SlippageCheckResult } from './slippage';
import { MEVGuard, SandwichDetection, PrivateRouteResult } from './mev';
import { RewardHackDetector, RewardHackDetection, Transaction } from './rewardhack';
import { CrashpadRules, loadRules, evaluateRules, RuleResult, Violation } from './rules';

export type Verdict = 'execute' | 'block' | 'route_private';

export interface GuardResult {
  verdict: Verdict;
  simulation: SimulationResult;
  slippage?: SlippageCheckResult;
  rules?: RuleResult;
  sandwich?: SandwichDetection;
  rewardHack?: RewardHackDetection;
  violations: Violation[];
  reason?: string;
  privateRoute?: PrivateRouteResult;
}

export class SafetyViolation extends Error {
  public result: GuardResult;

  constructor(result: GuardResult) {
    super(result.reason || 'Transaction blocked by Crashpad safety rails');
    this.name = 'SafetyViolation';
    this.result = result;
  }
}

export interface CrashpadGuardConfig {
  /** Path to YAML rules file */
  rulesPath?: string;
  /** Pre-loaded rules (overrides rulesPath) */
  rules?: CrashpadRules;
  /** RPC endpoint for fork simulation */
  simRpc: string;
  /** Private routing endpoint */
  privateEndpoint?: string;
  /** Transaction history for reward-hack detection */
  txHistory?: Transaction[];
}

/**
 * CrashpadGuard — the main safety wrapper.
 *
 * Flow: simulate → slippage check → rules check → MEV check → reward-hack → verdict
 */
export class CrashpadGuard {
  private simulator: Simulator;
  private slippageGuard: SlippageGuard;
  private mevGuard: MEVGuard;
  private rewardHackDetector: RewardHackDetector;
  private rules: CrashpadRules;
  private txHistory: Transaction[];

  constructor(config: CrashpadGuardConfig) {
    this.rules = config.rules || loadRules(config.rulesPath);
    this.simulator = new Simulator({ rpcUrl: config.simRpc });
    this.slippageGuard = new SlippageGuard();
    this.mevGuard = new MEVGuard({ privateEndpoint: config.privateEndpoint });
    this.rewardHackDetector = new RewardHackDetector({
      maxCircularFlows: this.rules.rewardhack.max_circular_flows,
      maxSelfDealsPerHour: this.rules.rewardhack.max_self_deals_per_hour,
    });
    this.txHistory = config.txHistory || [];
  }

  /**
   * Guard a transaction through all safety checks.
   * Returns a GuardResult with verdict, or throws SafetyViolation if blocked.
   */
  async guard(
    tx: TransactionRequest,
    options?: { throwOnBlock?: boolean }
  ): Promise<GuardResult> {
    const violations: Violation[] = [];
    let verdict: Verdict = 'execute';

    // Step 1: Simulate
    const simulation = await this.simulator.simulate(tx);

    // Step 2: Slippage check
    const slippageCheck = tx.expectedOut
      ? this.slippageGuard.check(simulation, tx.expectedOut, this.rules.slippage.max_bps)
      : undefined;

    if (slippageCheck && !slippageCheck.ok) {
      violations.push({
        rule: 'slippage',
        message: slippageCheck.reason!,
        severity: 'block',
        actual: slippageCheck.actualSlippage,
        limit: slippageCheck.maxSlippage,
      });
    }

    // Step 3: Rules evaluation
    const rulesResult = evaluateRules(simulation, this.rules, {
      usdValue: tx.usdValue,
      slippageBps: slippageCheck?.actualSlippage,
    });

    if (!rulesResult.passed) {
      violations.push(...rulesResult.violations);
    }

    // Step 4: MEV / sandwich detection
    const sandwich = this.mevGuard.detectSandwich(simulation, tx);
    if (sandwich.detected) {
      violations.push({
        rule: 'mev_sandwich',
        message: `Sandwich detected (confidence: ${(sandwich.confidence * 100).toFixed(0)}%): ${sandwich.details}`,
        severity: 'block',
      });
    }

    // Step 5: Reward-hack detection
    let rewardHack: RewardHackDetection | undefined;
    if (this.txHistory.length > 0) {
      rewardHack = this.rewardHackDetector.detect(this.txHistory);
      if (rewardHack.detected) {
        violations.push({
          rule: 'rewardhack',
          message: `Reward hack detected: ${rewardHack.reason}`,
          severity: 'block',
        });
      }
    }

    // Step 6: Determine verdict
    if (violations.some((v) => v.severity === 'block')) {
      verdict = 'block';
    } else if (
      tx.usdValue &&
      this.mevGuard.shouldRoutePrivate(tx.usdValue, this.rules.mev.route_private_above_usd)
    ) {
      verdict = 'route_private';
    }

    // Build result
    const result: GuardResult = {
      verdict,
      simulation,
      slippage: slippageCheck,
      rules: rulesResult,
      sandwich,
      rewardHack,
      violations,
      reason:
        verdict === 'block'
          ? `Blocked: ${violations.map((v) => v.message).join('; ')}`
          : verdict === 'route_private'
            ? `High-value tx ($${tx.usdValue}) — routing privately for MEV protection`
            : undefined,
    };

    // Route privately if needed
    if (verdict === 'route_private') {
      result.privateRoute = await this.mevGuard.routePrivate(tx);
    }

    // Throw on block if requested
    if (verdict === 'block' && options?.throwOnBlock !== false) {
      throw new SafetyViolation(result);
    }

    return result;
  }

  /**
   * Access the underlying rules engine.
   */
  getRules(): CrashpadRules {
    return this.rules;
  }

  /**
   * Update transaction history (for reward-hack detection).
   */
  setTxHistory(history: Transaction[]): void {
    this.txHistory = history;
  }
}
