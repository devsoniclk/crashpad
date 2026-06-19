// src/cli.ts — CLI: simulate, guard, rules check

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { Simulator, TransactionRequest } from './simulate';
import { CrashpadGuard } from './guard';
import { loadRules, validateRules } from './rules';

// chalk v4 is CJS, handle ESM/CJS interop
let chalk: any;
try {
  chalk = require('chalk');
} catch {
  chalk = {
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    cyan: (s: string) => s,
    gray: (s: string) => s,
  };
}

const program = new Command();

program
  .name('crashpad')
  .description('DeFi agent safety rails — simulate-before-execute')
  .version('0.1.0');

program
  .command('simulate')
  .description('Simulate a transaction and show predicted outcome')
  .requiredOption('--tx <path>', 'Path to transaction JSON file')
  .requiredOption('--rpc <url>', 'RPC endpoint URL')
  .action(async (opts: { tx: string; rpc: string }) => {
    try {
      const txData = loadTxFile(opts.tx);
      const simulator = new Simulator({ rpcUrl: opts.rpc });
      const result = await simulator.simulate(txData);

      console.log(chalk.bold('\n⚡ Simulation Result\n'));
      console.log(`  Success:        ${result.success ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  Predicted Out:  ${result.predictedOut}`);
      console.log(`  Price Impact:   ${result.priceImpact} bps`);
      console.log(`  Gas Used:       ${result.gasUsed}`);
      if (result.error) {
        console.log(`  ${chalk.red('Error:')} ${result.error}`);
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('guard')
  .description('Full safety check: simulate → slippage → rules → MEV → verdict')
  .requiredOption('--tx <path>', 'Path to transaction JSON file')
  .requiredOption('--rules <path>', 'Path to YAML rules file')
  .requiredOption('--rpc <url>', 'RPC endpoint URL')
  .option('--no-throw', 'Do not throw on block, just print result')
  .action(
    async (opts: { tx: string; rules: string; rpc: string; throw?: boolean }) => {
      try {
        const txData = loadTxFile(opts.tx);
        const guard = new CrashpadGuard({
          rulesPath: opts.rules,
          simRpc: opts.rpc,
        });

        let result;
        try {
          result = await guard.guard(txData, { throwOnBlock: opts.throw !== false });
        } catch (err: any) {
          if (err.name === 'SafetyViolation') {
            result = err.result;
          } else {
            throw err;
          }
        }

        console.log(chalk.bold('\n🛡️  Crashpad Guard Result\n'));

        const verdictColor =
          result.verdict === 'execute'
            ? chalk.green
            : result.verdict === 'route_private'
              ? chalk.yellow
              : chalk.red;

        console.log(`  Verdict:  ${verdictColor(result.verdict.toUpperCase())}`);

        if (result.simulation) {
          console.log(`  Simulation: ${result.simulation.success ? chalk.green('success') : chalk.red('failed')}`);
          console.log(`  Predicted Out: ${result.simulation.predictedOut}`);
          console.log(`  Price Impact:  ${result.simulation.priceImpact} bps`);
        }

        if (result.slippage) {
          console.log(`  Slippage:  ${result.slippage.actualSlippage} bps (max: ${result.slippage.maxSlippage})`);
        }

        if (result.sandwich?.detected) {
          console.log(`  ${chalk.red('⚠ Sandwich:')} confidence ${(result.sandwich.confidence * 100).toFixed(0)}%`);
        }

        if (result.violations.length > 0) {
          console.log(chalk.red('\n  Violations:'));
          for (const v of result.violations) {
            console.log(`    • [${v.rule}] ${v.message}`);
          }
        }

        if (result.reason) {
          console.log(`\n  ${chalk.gray('Reason:')} ${result.reason}`);
        }

        console.log();
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  );

const rulesCmd = program.command('rules').description('Rules management');

rulesCmd
  .command('check')
  .description('Validate a rules YAML file')
  .argument('<path>', 'Path to YAML rules file')
  .action((path: string) => {
    try {
      if (!existsSync(path)) {
        console.error(chalk.red(`File not found: ${path}`));
        process.exit(1);
      }

      const rules = loadRules(path);
      const errors = validateRules(rules);

      if (errors.length === 0) {
        console.log(chalk.green(`✓ Rules file is valid: ${path}\n`));
        console.log(JSON.stringify(rules, null, 2));
      } else {
        console.log(chalk.red(`✗ Rules file has ${errors.length} error(s):\n`));
        for (const err of errors) {
          console.log(`  • ${err}`);
        }
        process.exit(1);
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

function loadTxFile(path: string): TransactionRequest {
  if (!existsSync(path)) {
    console.error(chalk.red(`Transaction file not found: ${path}`));
    process.exit(1);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as TransactionRequest;
}

program.parse();
