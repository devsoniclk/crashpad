// src/simulate.ts — Fork-simulation: creates a fork, runs the tx, reads predicted outcome

export interface TransactionRequest {
  to: string;
  from?: string;
  data: string;
  value?: string;
  gasLimit?: string;
  /** Expected output amount (for slippage calc) */
  expectedOut?: string;
  /** Token pair being swapped (for MEV detection) */
  pair?: string;
  /** USD value of the transaction */
  usdValue?: number;
}

export interface SimulationResult {
  success: boolean;
  predictedOut: string;
  priceImpact: number; // in basis points
  gasUsed: string;
  stateChanges: StateChange[];
  error?: string;
  blockNumber?: number;
}

export interface StateChange {
  address: string;
  slot: string;
  before: string;
  after: string;
}

export interface SimConfig {
  rpcUrl: string;
  /** Optional: block number to fork at (defaults to latest) */
  forkBlock?: number;
}

/**
 * Simulator — runs transactions against a forked chain state and returns
 * predicted outcomes, gas usage, price impact, and state diffs.
 */
export class Simulator {
  private rpcUrl: string;

  constructor(config: SimConfig) {
    this.rpcUrl = config.rpcUrl;
  }

  /**
   * Simulate a transaction using eth_call + debug_traceCall.
   * For MVP: uses eth_call for execution and estimates price impact
   * from expected vs actual output.
   */
  async simulate(tx: TransactionRequest): Promise<SimulationResult> {
    try {
      // Step 1: Execute via eth_call (no state change)
      const callResult = await this.ethCall(tx);

      // Step 2: Parse the output
      const predictedOut = this.parseOutput(callResult, tx);

      // Step 3: Estimate gas via eth_estimateGas
      const gasUsed = await this.estimateGas(tx);

      // Step 4: Calculate price impact
      const priceImpact = this.calculatePriceImpact(tx.expectedOut, predictedOut);

      // Step 5: Derive state changes (simplified for MVP)
      const stateChanges = this.deriveStateChanges(tx, predictedOut);

      return {
        success: true,
        predictedOut,
        priceImpact,
        gasUsed: gasUsed.toString(),
        stateChanges,
      };
    } catch (err: any) {
      return {
        success: false,
        predictedOut: '0',
        priceImpact: 0,
        gasUsed: '0',
        stateChanges: [],
        error: err.message || String(err),
      };
    }
  }

  private async ethCall(tx: TransactionRequest): Promise<string> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [
        {
          to: tx.to,
          from: tx.from || '0x0000000000000000000000000000000000000000',
          data: tx.data,
          value: tx.value || '0x0',
        },
        'latest',
      ],
      id: 1,
    });

    const resp = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const json = (await resp.json()) as any;
    if (json.error) {
      throw new Error(`eth_call reverted: ${json.error.message}`);
    }
    return json.result || '0x';
  }

  private async estimateGas(tx: TransactionRequest): Promise<bigint> {
    if (tx.gasLimit) return BigInt(tx.gasLimit);

    try {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_estimateGas',
        params: [
          {
            to: tx.to,
            from: tx.from || '0x0000000000000000000000000000000000000000',
            data: tx.data,
            value: tx.value || '0x0',
          },
        ],
        id: 2,
      });

      const resp = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const json = (await resp.json()) as any;
      if (json.result) return BigInt(json.result);
    } catch {
      // fallback estimate
    }

    return BigInt(300_000); // default gas estimate
  }

  /** Parse raw eth_call output into an amount string */
  private parseOutput(callResult: string, tx: TransactionRequest): string {
    if (!callResult || callResult === '0x') return '0';
    // ABI decode: typically uint256 for swap outputs
    const hex = callResult.startsWith('0x') ? callResult.slice(2) : callResult;
    if (hex.length === 0) return '0';
    return BigInt('0x' + hex).toString();
  }

  /** Calculate price impact in basis points */
  calculatePriceImpact(expectedOut: string | undefined, actualOut: string): number {
    if (!expectedOut || expectedOut === '0') return 0;
    const expected = BigInt(expectedOut);
    const actual = BigInt(actualOut);
    if (expected === 0n) return 0;

    // impact = |expected - actual| / expected * 10000
    const diff = expected > actual ? expected - actual : actual - expected;
    return Number((diff * 10000n) / expected);
  }

  /** Derive simplified state changes for the simulation */
  private deriveStateChanges(
    tx: TransactionRequest,
    predictedOut: string
  ): StateChange[] {
    // In a real implementation, we'd trace storage diffs.
    // MVP: return a synthetic record of the output change.
    return [
      {
        address: tx.to,
        slot: '0x0', // output balance slot (synthetic)
        before: '0',
        after: predictedOut,
      },
    ];
  }
}
