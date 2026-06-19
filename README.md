# Crashpad

> Autonomous DeFi agents act at machine speed on irreversible transactions. Crashpad simulates every move and refuses the ones that blow up.

Crashpad is a guardrail layer for autonomous DeFi agents. It intercepts every transaction before it hits the chain, simulates it against forked state, and enforces hard safety limits — slippage caps, MEV protection, position limits, and sanity rules.

## Protections

| Protection | What it does |
|---|---|
| **Fork Simulation** | Runs every tx against a forked chain before execution — no guessing |
| **Slippage Enforcement** | Rejects trades that exceed your max slippage in basis points |
| **Position Caps** | Blocks any single action over your max USD threshold |
| **Loss Limits** | Per-action and per-day loss caps to prevent runaway bleeding |
| **MEV Guard** | Detects sandwich patterns; routes high-value txs through private mempools (Flashbots/bloxroute) |
| **Reward-Hack Detection** | Catches circular flows, self-dealing, and degenerate farming loops |
| **Verdict Engine** | Returns `execute`, `block`, or `route_private` with full violation details |

## Quick Start

```bash
npm install crashpad
```

### Wrap a transaction in guard()

```typescript
import { CrashpadGuard, SafetyViolation } from 'crashpad';

const guard = new CrashpadGuard({
  simRpc: 'https://eth.llamarpc.com',
  rulesPath: './crashpad.yaml',
});

const swapTx = {
  to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  data: '0x38ed1739...',
  expectedOut: '1800000000', // ~1800 USDC
  usdValue: 1800,
};

try {
  const result = await guard.guard(swapTx);

  switch (result.verdict) {
    case 'execute':
      // Safe — submit to chain
      break;
    case 'route_private':
      // Submit via Flashbots for MEV protection
      break;
  }
} catch (err) {
  if (err instanceof SafetyViolation) {
    console.error('BLOCKED:', err.result.violations);
  }
}
```

### CLI Usage

```bash
# Simulate a transaction
npx crashpad simulate --tx tx.json --rpc https://eth.llamarpc.com

# Full safety check
npx crashpad guard --tx tx.json --rules crashpad.yaml --rpc https://eth.llamarpc.com

# Validate a rules file
npx crashpad rules check crashpad.yaml
```

## Rules Reference

Create a `crashpad.yaml` in your project root:

```yaml
slippage:
  max_bps: 50           # Max slippage in basis points (50 = 0.5%)

position:
  max_usd: 1000         # Max single-position size in USD

loss:
  max_per_action_usd: 25   # Max loss per individual action
  max_per_day_usd: 100     # Max cumulative daily loss

mev:
  route_private_above_usd: 250  # Route via private mempool above this amount

rewardhack:
  max_circular_flows: 3        # Max circular token flows before flagging
  max_self_deals_per_hour: 5   # Max self-dealing txs per hour
```

## Architecture

```
Transaction Request
       │
       ▼
 ┌─────────────┐
 │  Simulator   │  Fork simulation via eth_call
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  Slippage    │  Check predicted vs expected output
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  Rules       │  Position caps, loss limits
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  MEV Guard   │  Sandwich detection, private routing
 └──────┬──────┘
        │
        ▼
 ┌──────────────┐
 │ Reward-Hack  │  Circular flows, self-dealing, farming loops
 └──────┬───────┘
        │
        ▼
   ┌────────┐
   │ Verdict │  execute | block | route_private
   └────────┘
```

## Roadmap

- [ ] v0.2: Real fork simulation via `debug_traceCall` + storage diffs
- [ ] v0.3: Flashbots/bloxroute integration for private routing
- [ ] v0.4: Cumulative daily loss tracking with persistent state
- [ ] v0.5: On-chain price oracle cross-checks
- [ ] v0.6: Multi-chain support (Arbitrum, Optimism, Base)
- [ ] v1.0: Production-grade MEV detection with mempool monitoring
- [ ] v1.1: Agent behavior profiling and anomaly detection
- [ ] v1.2: Plugin system for custom safety rules

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in dev mode
npm run dev
```

## License

MIT — see [LICENSE](./LICENSE)

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.
