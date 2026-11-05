/**
 * Deterministic pseudo-random numbers for the in-silico testbench.
 * mulberry32 is mirrored bit-for-bit in simulation/pfas_sentinel_core.py so the app and the
 * Python reference produce the same synthetic observations and sensor noise.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw (Box-Muller, cosine branch only, so each call consumes exactly two uniforms). */
export function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const SEED_PRIMES = [7919, 104729, 1299709, 15485863, 32452843, 49979687, 86028121, 122949823];

/**
 * Combines non-negative integers into a seed; identical integer arithmetic in TS and Python.
 * Each part is reduced below 1,000,003 first so every product stays far below 2^53.
 */
export function seedFrom(...parts: number[]): number {
  let acc = 0;
  parts.forEach((p, i) => {
    acc = (acc + (Math.floor(Math.abs(p)) % 1000003) * SEED_PRIMES[i % SEED_PRIMES.length]) % 2147483647;
  });
  return acc;
}

/** Rounds to a fixed number of hundredths the same way in TS and Python (floor(x * 100 + 0.5)). */
export function hundredths(x: number): number {
  return Math.floor(x * 100 + 0.5);
}
