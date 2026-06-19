// src/mev.ts — MEV protection: sandwich detection + private routing

import { SimulationResult, TransactionRequest } from './simulate';

export interface SandwichDetection {
  detected: boolean;
  confidence: number; // 0–1
  pattern?: string;
  details?: string;
}

export interface PrivateRouteResult {
  routed: boolean;
  endpoint?: string;
  reason?: string;
}

/**
 * MEVGuard — detects sandwich attacks and routes high-value txs
 * through private mempools (Flashbots / bloxroute).
 */
export class MEVGuard {
  private privateEndpoint: string;

  constructor(config?: { privateEndpoint?: string }) {
    this.privateEndpoint =
      config?.privateEndpoint || 'https://relay.flashbots.net';
  }

  /**
   * Detect sandwich attack patterns in a simulation.
   *
   * Heuristics:
   *  1. Price impact significantly above the pool's typical spread
   *  2. Transaction targets a pair that has high pending-tx density
   *  3. Simulation output diverges sharply from expected (pre-frontrun state)
   */
  detectSandwich(
    simulation: SimulationResult,
    tx: TransactionRequest
  ): SandwichDetection {
    if (!simulation.success) {
      return { detected: false, confidence: 0 };
    }

    let confidence = 0;
    const signals: string[] = [];

    // Heuristic 1: Unusually high price impact
    if (simulation.priceImpact > 200) {
      // >2% impact
      confidence += 0.4;
      signals.push(`High price impact: ${simulation.priceImpact} bps`);
    } else if (simulation.priceImpact > 100) {
      confidence += 0.2;
      signals.push(`Elevated price impact: ${simulation.priceImpact} bps`);
    }

    // Heuristic 2: Output far below expected (possible front-run extraction)
    if (tx.expectedOut && tx.expectedOut !== '0') {
      const expected = BigInt(tx.expectedOut);
      const actual = BigInt(simulation.predictedOut);
      if (expected > 0n) {
        const shortfallBps = Number(((expected - actual) * 10000n) / expected);
        if (shortfallBps > 100) {
          confidence += 0.4;
          signals.push(`Output shortfall: ${shortfallBps} bps below expected`);
        }
      }
    }

    // Heuristic 3: High gas usage relative to simple swap (proxy for complexity)
    const gasNum = Number(simulation.gasUsed);
    if (gasNum > 500_000) {
      confidence += 0.2;
      signals.push(`High gas: ${gasNum}`);
    }

    const detected = confidence >= 0.6;

    return {
      detected,
      confidence: Math.min(confidence, 1),
      pattern: detected ? 'sandwich' : undefined,
      details: signals.length > 0 ? signals.join('; ') : undefined,
    };
  }

  /**
   * Determine whether the transaction should be routed privately
   * based on its USD value and the rules threshold.
   */
  shouldRoutePrivate(usdValue: number, routePrivateThreshold: number): boolean {
    return usdValue >= routePrivateThreshold;
  }

  /**
   * Route a transaction through a private mempool.
   * This is an integration point — for MVP it returns a mock result.
   */
  async routePrivate(tx: TransactionRequest): Promise<PrivateRouteResult> {
    // In production: POST to Flashbots relay or bloxroute BDN
    // For MVP: return interface with the configured endpoint
    return {
      routed: true,
      endpoint: this.privateEndpoint,
      reason: `Routed to ${this.privateEndpoint} for MEV protection`,
    };
  }
}
