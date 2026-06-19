// src/rewardhack.ts — Degenerate-loop heuristics for reward-hack detection

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  tokens: string[];     // token addresses involved
  timestamp: number;    // unix seconds
  value: string;        // wei
  method?: string;      // function name if known
}

export interface RewardHackDetection {
  detected: boolean;
  pattern?: 'circular_flow' | 'self_dealing' | 'reward_loop';
  confidence: number; // 0–1
  reason?: string;
  transactions?: string[]; // hashes of suspicious txs
}

export interface RewardHackConfig {
  maxCircularFlows: number;
  maxSelfDealsPerHour: number;
}

/**
 * RewardHackDetector — identifies degenerate patterns that indicate
 * an agent is gaming reward mechanisms rather than performing genuine activity.
 */
export class RewardHackDetector {
  private config: RewardHackConfig;

  constructor(config?: Partial<RewardHackConfig>) {
    this.config = {
      maxCircularFlows: config?.maxCircularFlows ?? 3,
      maxSelfDealsPerHour: config?.maxSelfDealsPerHour ?? 5,
    };
  }

  /**
   * Analyze a transaction history for degenerate patterns.
   */
  detect(history: Transaction[]): RewardHackDetection {
    if (history.length < 2) {
      return { detected: false, confidence: 0 };
    }

    // Check circular flows
    const circularFlow = this.detectCircularFlows(history);
    if (circularFlow.detected) return circularFlow;

    // Check self-dealing
    const selfDeal = this.detectSelfDealing(history);
    if (selfDeal.detected) return selfDeal;

    // Check reward farming loops
    const rewardLoop = this.detectRewardLoops(history);
    if (rewardLoop.detected) return rewardLoop;

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect circular token flows: A→B→C→A within a short window.
   */
  private detectCircularFlows(history: Transaction[]): RewardHackDetection {
    // Build a flow graph: from → to → tokens
    // Look for cycles of length 3+ within 1-hour windows
    const oneHour = 3600;
    const recentTxs = history.filter(
      (tx) => tx.timestamp >= history[history.length - 1].timestamp - oneHour
    );

    if (recentTxs.length < 3) {
      return { detected: false, confidence: 0 };
    }

    // Build adjacency: from -> [(to, tx)]
    const adj = new Map<string, Array<{ to: string; tx: Transaction }>>();
    for (const tx of recentTxs) {
      if (!adj.has(tx.from)) adj.set(tx.from, []);
      adj.get(tx.from)!.push({ to: tx.to, tx });
    }

    // Simple cycle detection (DFS, depth limit 5)
    const cycles: Transaction[][] = [];
    const visited = new Set<string>();

    for (const start of adj.keys()) {
      if (visited.has(start)) continue;
      this.findCycles(start, start, adj, new Set(), [], cycles, 5);
      visited.add(start);
    }

    if (cycles.length > this.config.maxCircularFlows) {
      return {
        detected: true,
        pattern: 'circular_flow',
        confidence: Math.min(0.5 + cycles.length * 0.1, 1),
        reason: `Found ${cycles.length} circular flows (max: ${this.config.maxCircularFlows})`,
        transactions: cycles.flat().map((tx) => tx.hash),
      };
    }

    return { detected: false, confidence: 0 };
  }

  private findCycles(
    current: string,
    start: string,
    adj: Map<string, Array<{ to: string; tx: Transaction }>>,
    path: Set<string>,
    pathTxs: Transaction[],
    results: Transaction[][],
    maxDepth: number
  ): void {
    if (maxDepth <= 0) return;
    if (path.has(current) && current !== start) return;

    const neighbors = adj.get(current) || [];
    for (const { to, tx } of neighbors) {
      if (to === start && path.size >= 2) {
        // Found a cycle
        results.push([...pathTxs, tx]);
      } else if (!path.has(to)) {
        path.add(to);
        this.findCycles(to, start, adj, path, [...pathTxs, tx], results, maxDepth - 1);
        path.delete(to);
      }
    }
  }

  /**
   * Detect self-dealing: agent interacting with its own contracts.
   */
  private detectSelfDealing(history: Transaction[]): RewardHackDetection {
    const oneHour = 3600;
    const now = history[history.length - 1].timestamp;
    const recentTxs = history.filter((tx) => tx.timestamp >= now - oneHour);

    // Group by unique (from, to) pairs
    const pairCounts = new Map<string, { count: number; txs: Transaction[] }>();
    for (const tx of recentTxs) {
      const key = [tx.from, tx.to].sort().join(':');
      if (!pairCounts.has(key)) pairCounts.set(key, { count: 0, txs: [] });
      const entry = pairCounts.get(key)!;
      entry.count++;
      entry.txs.push(tx);
    }

    for (const [key, entry] of pairCounts) {
      if (entry.count >= this.config.maxSelfDealsPerHour) {
        return {
          detected: true,
          pattern: 'self_dealing',
          confidence: Math.min(0.5 + entry.count * 0.05, 1),
          reason: `${entry.count} txs between ${key} in 1 hour (max: ${this.config.maxSelfDealsPerHour})`,
          transactions: entry.txs.map((tx) => tx.hash),
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect reward farming loops: repetitive deposit→claim→withdraw cycles.
   */
  private detectRewardLoops(history: Transaction[]): RewardHackDetection {
    const methodPattern = /(deposit|stake|claim|withdraw|harvest)/i;
    const recentMethods = history
      .slice(-20)
      .map((tx) => tx.method?.toLowerCase() || '')
      .filter((m) => methodPattern.test(m));

    if (recentMethods.length < 6) {
      return { detected: false, confidence: 0 };
    }

    // Check for repeating 3-step sequences
    for (let len = 2; len <= 4; len++) {
      const seq = recentMethods.slice(0, len).join(',');
      let count = 0;
      for (let i = 0; i <= recentMethods.length - len; i++) {
        if (recentMethods.slice(i, i + len).join(',') === seq) count++;
      }
      if (count >= 3) {
        return {
          detected: true,
          pattern: 'reward_loop',
          confidence: Math.min(0.4 + count * 0.1, 1),
          reason: `Repeating ${len}-step sequence "${seq}" found ${count} times`,
        };
      }
    }

    return { detected: false, confidence: 0 };
  }
}
