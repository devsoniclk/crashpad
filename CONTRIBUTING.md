# Contributing to Crashpad

Thanks for your interest in contributing to Crashpad! This project is a safety-critical component for DeFi agents, so we take code quality and correctness seriously.

## Getting Started

```bash
git clone https://github.com/your-org/crashpad.git
cd crashpad
npm install
npm test
```

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run type checks: `npm run lint`
6. Commit with conventional commits: `git commit -m "feat: add X"`
7. Push and open a PR

## Code Style

- TypeScript with strict mode
- No `any` types unless absolutely necessary (document why)
- All public APIs must have JSDoc comments
- Error messages must be actionable (tell the user what to do)

## Testing

- All new features must have tests
- All bug fixes must have a regression test
- Tests should be deterministic — no reliance on network or timing
- Use mocks for RPC calls in tests

### Test Structure

```
test/
├── simulate.test.ts    # Simulator unit tests
├── slippage.test.ts    # SlippageGuard unit tests
├── rules.test.ts       # Rules loading & evaluation
├── guard.test.ts       # Integration tests for CrashpadGuard
└── fixtures/           # Test transaction fixtures
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `test:` Adding or updating tests
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `chore:` Tooling, CI, dependencies

## Safety-Critical Guidelines

Since Crashpad is a safety layer:

1. **Never weaken defaults** without discussion — the defaults protect users
2. **Fail closed** — if in doubt, block the transaction
3. **Log everything** — safety decisions must be auditable
4. **Test edge cases** — BigInt overflow, empty inputs, malformed data
5. **Document assumptions** — what does each heuristic assume about the market?

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Types check (`npm run lint`)
- [ ] New code has tests
- [ ] Public APIs have JSDoc
- [ ] Breaking changes documented
- [ ] Security implications considered

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
