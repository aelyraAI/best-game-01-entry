// A tiny seeded random number generator (mulberry32).
// The world never calls Math.random: every run with the same seed makes the same waves,
// which keeps the screenshot scenes in shots.js perfectly reproducible.

export function makeRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** Random integer in [min, max], both ends included. */
export function intRange(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}

/** Pick one element of a non-empty array. */
export function pick(next, items) {
  return items[Math.floor(next() * items.length)];
}
