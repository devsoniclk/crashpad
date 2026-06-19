// examples/arb-agent.ts — Arbitrage agent with Crashpad protection

import { CrashpadGuard, SafetyViolation } from '../src/guard';
import { Transaction } from '../src/rewardhack';

async function main() {
  // Maintain a rolling history for reward-hack detection
  const txHistory: Transaction[] = [];

  const guard = new CrashpadGuard({
    simRpc: process.env.RPC_URL || 'https://eth.llamarpc.com',
    rulesPath: './crashpad.yaml',
    txHistory,
  });

  // Simulate an arbitrage: buy on Uniswap, sell on Sushiswap
  const arbTx = {
    to: '0xYourArbContract',
    from: '0xYourAgentAddress',
    data: '0x...', // encoded arb calldata
    value: '0x0',
    expectedOut: '50000000', // expected profit: ~50 USDC
    usdValue: 500,           // total position value
    pair: 'WETH/USDC',
  };

  try {
    const result = await guard.guard(arbTx);

    switch (result.verdict) {
      case 'execute':
        console.log('✅ Arb passed safety checks — executing');
        // submitTransaction(arbTx)
        break;

      case 'route_private':
        console.log('🔒 Routing arb via private mempool');
        // submitViaFlashbots(arbTx)
        break;

      case 'block':
        // Shouldn't reach here since guard() throws on block by default
        console.log('🛑 Arb blocked');
        break;
    }

    // Record in history for future reward-hack detection
    txHistory.push({
      hash: '0x' + 'ab'.repeat(32),
      from: arbTx.from,
      to: arbTx.to,
      tokens: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
      timestamp: Math.floor(Date.now() / 1000),
      value: '0',
      method: 'executeArb',
    });

  } catch (err) {
    if (err instanceof SafetyViolation) {
      console.error('🛑 Arb BLOCKED:');
      for (const v of err.result.violations) {
        console.error(`  • [${v.rule}] ${v.message}`);
      }
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
