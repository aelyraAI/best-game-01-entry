// STARFORGE SIEGE — tuning constants for the whole game.
// Everything gameplay-related that a designer would reach for lives here, in one place,
// so world.js, render.js and shots.js all read the same numbers.

/** Logical playfield. The canvas always renders this field, letterboxed to the window. */
export const FIELD = { width: 1280, height: 800 };

/** Fixed simulation step (seconds). The world only ever advances in these slices. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 335, // px per second
  hull: 100, // starting (and base maximum) hit points
  fireInterval: 0.16, // seconds between bolts at level 1
  boltSpeed: 780,
  boltDamage: 10,
  boltRadius: 5,
  invulnerableSeconds: 0.6, // grace after taking a hit
};

/** How long a kill keeps the combo chain alive, and the highest multiplier it can reach. */
export const COMBO = { windowSeconds: 2.6, maxMultiplier: 8 };

export const WAVE_COUNT = 5; // wave 5 is the boss wave

/** Enemy archetypes. `score` is paid out (times the combo multiplier) on a kill. */
export const ENEMY = {
  drone: { radius: 15, hull: 20, speed: 118, damage: 12, score: 50, colour: '#ff5d73' },
  weaver: { radius: 17, hull: 34, speed: 92, damage: 14, score: 90, colour: '#ffb84d' },
  lancer: { radius: 14, hull: 26, speed: 150, damage: 18, score: 120, colour: '#c792ff' },
  bulwark: { radius: 34, hull: 130, speed: 44, damage: 22, score: 260, colour: '#ff8a5c' },
  boss: { radius: 64, hull: 1150, speed: 36, damage: 26, score: 2500, colour: '#ff4d6d' },
};

/** Enemy bullets: one speed and size for every gun, so dodging reads fairly. */
export const HOSTILE_BOLT = { speed: 265, radius: 6, damage: 9 };

/** Pickup kinds and the colours the renderer paints them with. */
export const PICKUP = {
  repair: { colour: '#57ff9a', label: '+' },
  nova: { colour: '#ffe74d', label: 'N' },
  shield: { colour: '#5cd6ff', label: 'S' },
  rapid: { colour: '#ff9df3', label: 'R' },
};

/** The upgrade pool the between-wave draft draws three distinct cards from. */
export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Cannons', blurb: 'Fire 18% faster. Stacks forever.', icon: '»' },
  { id: 'heavy', name: 'Heavy Bolts', blurb: '+35% bolt damage.', icon: '◆' },
  { id: 'split', name: 'Split Cannon', blurb: '+1 bolt per shot (max 3 streams).', icon: '⋔' },
  { id: 'plating', name: 'Hull Plating', blurb: '+25 max hull and repair 25 now.', icon: '♥' },
  { id: 'aegis', name: 'Aegis Shield', blurb: 'Gain a shield that recharges.', icon: '⛨' },
  { id: 'thrusters', name: 'Ion Thrusters', blurb: '+12% movement speed.', icon: '➤' },
  { id: 'magnet', name: 'Shard Magnet', blurb: 'Pickups drift to you from farther.', icon: '◎' },
  { id: 'novacharge', name: 'Nova Charger', blurb: 'Start every wave with a nova bomb.', icon: '✸' },
];

/** Colours shared by the renderer (background, HUD, screens). */
export const PALETTE = {
  space: '#070a1a',
  nebulaA: '#1b1050',
  nebulaB: '#0a2e4f',
  ink: '#eaf2ff',
  dim: '#8fa3c8',
  accent: '#5cd6ff',
  good: '#57ff9a',
  bad: '#ff5d73',
  gold: '#ffe74d',
};
