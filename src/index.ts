// src/index.ts — Public API surface

export { Simulator, SimulationResult, TransactionRequest, SimConfig, StateChange } from './simulate';
export { SlippageGuard, SlippageCheckResult } from './slippage';
export { CrashpadRules, Violation, RuleResult, loadRules, validateRules, evaluateRules } from './rules';
export { MEVGuard, SandwichDetection, PrivateRouteResult } from './mev';
export { RewardHackDetector, RewardHackDetection, RewardHackConfig, Transaction } from './rewardhack';
export { CrashpadGuard, CrashpadGuardConfig, GuardResult, Verdict, SafetyViolation } from './guard';
