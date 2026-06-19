# crashpad

DeFi transactions are irreversible. An autonomous agent executing at machine speed with a bad slippage parameter, or one that got sandwiched, has no recourse.

Crashpad intercepts every transaction before it hits the chain, simulates it against forked state, and enforces hard limits. Trades that would blow past your slippage cap get blocked. Large transactions get routed through private mempools. Circular reward flows that look like farming loops get flagged.

```bash
npm install crashpad
```

```typescript
import { CrashpadGuard, SafetyViolation } from 'crashpad';

const guard = new CrashpadGuard({
  simRpc: 'https://eth.llamarpc.com',
  rulesPath: './crashpad.yaml',
});

try {
  const result = await guard.guard({
    to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    data: '0x38ed1739...',
    expectedOut: '1800000000',
    usdValue: 1800,
  });

  if (result.verdict === 'execute') {
    // safe — submit
  } else if (result.verdict === 'route_private') {
    // submit via Flashbots
  }
} catch (err) {
  if (err instanceof SafetyViolation) {
    console.error(err.result.violations);
  }
}
```

## Rules file

```yaml
# crashpad.yaml
slippage:
  max_bps: 50              # 0.5% max slippage

position:
  max_usd: 1000            # max single position size

loss:
  max_per_action_usd: 25
  max_per_day_usd: 100

mev:
  route_private_above_usd: 250   # Flashbots/bloxroute above this

rewardhack:
  max_circular_flows: 3
  max_self_deals_per_hour: 5
```

## What each check does

**Fork simulation.** Runs the transaction against a forked chain state via `eth_call` before submission. If the simulated outcome would violate slippage, it never reaches the chain.

**Slippage enforcement.** Compares predicted output from simulation against `expectedOut`. Blocks if the difference exceeds `max_bps`.

**Position caps.** Flat USD limit per transaction. Blocks anything over `max_usd` regardless of slippage.

**Loss limits.** Per-action and cumulative daily loss caps. Stops a bad strategy from bleeding out over a full day.

**MEV guard.** Looks for sandwich patterns in the mempool signature. Routes high-value transactions through private mempools instead of broadcasting publicly.

**Reward hack detection.** Flags circular token flows, self-dealing, and degenerate farming loops that look profitable on paper but are actually extracting from the protocol.

## CLI

```bash
npx crashpad simulate --tx tx.json --rpc https://eth.llamarpc.com
npx crashpad guard --tx tx.json --rules crashpad.yaml --rpc https://eth.llamarpc.com
npx crashpad rules check crashpad.yaml
```

## Status

Fork simulation currently uses `eth_call` approximation. Full `debug_traceCall` with storage diffs is v0.2. Flashbots integration is stubbed, not live. Real-mempool MEV detection is v1.0 work. The slippage enforcement, position caps, and loss limits are implemented and tested.

## License

MIT
