// examples/swap-guard.ts — Wrapped swap agent using Crashpad

import { CrashpadGuard, SafetyViolation } from '../src/guard';

async function main() {
  // Initialize Crashpad with your RPC and rules
  const guard = new CrashpadGuard({
    simRpc: process.env.RPC_URL || 'https://eth.llamarpc.com',
    rulesPath: './crashpad.yaml',
  });

  // Example: Uniswap V2 swap 1 ETH → USDC
  const swapTx = {
    to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
    from: '0xYourAgentAddress',
    data: '0x38ed1739' + // swapExactTokensForTokens
      '0000000000000000000000000000000000000000000000000de0b6b3a7640000' + // amountIn: 1 ETH
      '0000000000000000000000000000000000000000000000000000000000000000', // minOut: 0 (unsafe!)
    value: '0x0',
    expectedOut: '1800000000', // ~1800 USDC (6 decimals)
    usdValue: 1800,
  };

  try {
    const result = await guard.guard(swapTx);

    if (result.verdict === 'execute') {
      console.log('✅ Guard passed — executing swap');
      // ... submit tx to chain
    } else if (result.verdict === 'route_private') {
      console.log('🔒 Routing via Flashbots for MEV protection');
      // ... submit via private relay
    }
  } catch (err) {
    if (err instanceof SafetyViolation) {
      console.error('🛑 Transaction BLOCKED by Crashpad:');
      for (const v of err.result.violations) {
        console.error(`  • [${v.rule}] ${v.message}`);
      }
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
