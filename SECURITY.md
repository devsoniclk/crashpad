# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Crashpad, please report it responsibly.

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, email: security@crashpad.dev (placeholder — replace with actual contact)

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix & release**: Depends on severity (critical issues within 72 hours)

## Security Considerations

Crashpad is a safety-critical component. Keep in mind:

1. **RPC Endpoint Trust**: Crashpad simulates via your RPC endpoint. If the endpoint is compromised, simulations may be unreliable. Use trusted, dedicated RPC providers.

2. **Rules Configuration**: The safety rules YAML file is the source of truth for limits. Ensure it's:
   - Version controlled
   - Reviewed before changes
   - Not writable by the agent process itself

3. **Private Key Separation**: Crashpad never handles private keys. Transaction signing should happen in a separate, hardened process.

4. **Simulation ≠ Guarantee**: Fork simulation approximates on-chain behavior but cannot account for:
   - Mempool state changes between simulation and inclusion
   - Block-level reorgs
   - Oracle manipulation at the exact block of inclusion

5. **MEV Protection**: Private routing reduces but does not eliminate MEV risk. Relay operators are trusted parties.

## Scope

The following are in scope for security reports:

- Bypass of safety checks (slippage, position limits, loss caps)
- Injection via YAML rules files
- Crash or denial of service via crafted transaction input
- Incorrect price impact or slippage calculations
- Reward-hack detection evasion

## Out of Scope

- Social engineering attacks
- Compromised RPC endpoints (report to the provider)
- Issues in upstream dependencies (report to them directly)
