import { describe, it, expect } from 'vitest';
import { Simulator } from '../src/simulate';

describe('Simulator', () => {
  it('should instantiate with a config', () => {
    const sim = new Simulator({ rpcUrl: 'https://eth.llamarpc.com' });
    expect(sim).toBeDefined();
  });

  it('calculatePriceImpact returns 0 when expected is empty', () => {
    const sim = new Simulator({ rpcUrl: 'https://eth.llamarpc.com' });
    expect(sim.calculatePriceImpact(undefined, '1000')).toBe(0);
  });

  it('calculatePriceImpact returns 0 when expected is 0', () => {
    const sim = new Simulator({ rpcUrl: 'https://eth.llamarpc.com' });
    expect(sim.calculatePriceImpact('0', '1000')).toBe(0);
  });

  it('calculatePriceImpact computes correct bps', () => {
    const sim = new Simulator({ rpcUrl: 'https://eth.llamarpc.com' });
    // 1% slippage: expected 10000, actual 9900 → 100 bps
    expect(sim.calculatePriceImpact('10000', '9900')).toBe(100);
  });

  it('calculatePriceImpact for 0.5% slippage', () => {
    const sim = new Simulator({ rpcUrl: 'https://eth.llamarpc.com' });
    // expected 20000, actual 19900 → 50 bps
    expect(sim.calculatePriceImpact('20000', '19900')).toBe(50);
  });

  it('calculatePriceImpact handles actual > expected', () => {
    const sim = new Simulator({ rpcUrl: 'https://eth.llamarpc.com' });
    // actual better than expected: 10000 vs 10100 → 100 bps
    expect(sim.calculatePriceImpact('10000', '10100')).toBe(100);
  });

  it('simulate returns error result on invalid RPC', async () => {
    const sim = new Simulator({ rpcUrl: 'http://localhost:99999' });
    const result = await sim.simulate({
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
