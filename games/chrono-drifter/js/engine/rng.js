/* Seeded RNG. Battles are reproducible from a seed, which is what lets the test
   suite replay a match that misbehaved instead of chasing it. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = () => (Math.random() * 0xFFFFFFFF) >>> 0;

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

/** Draw `n` items without replacement. Does not mutate `arr`. */
export function sample(rng, arr, n) {
  const pool = [...arr], out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}
