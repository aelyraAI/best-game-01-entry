// STARFORGE SIEGE — the simulation. Every rule of the game lives here and nowhere else:
// waves, enemies, bullets, collisions, pickups, the upgrade draft, combo scoring and the
// win/lose conditions. It renders nothing and reads no DOM; main.js feeds it input shaped
// like { moveX, moveY, aimX, aimY, firing } and render.js draws the state it produces.
// All randomness comes from one seeded generator, so a seed always replays the same run.

import { COMBO, ENEMY, FIELD, HOSTILE_BOLT, PLAYER, UPGRADES, WAVE_COUNT } from './config.js';
import { intRange, makeRandom, pick, range } from './random.js';

export const PHASE = {
  INTRO: 'intro', // wave banner, brief and safe
  ACTIVE: 'active', // fighting
  DRAFT: 'draft', // between waves: choose 1 of 3 upgrades
  WON: 'won',
  LOST: 'lost',
};

const DRAFT_SIZE = 3;

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createWorld(seed) {
  const next = makeRandom(seed);
  const state = {
    time: 0,
    phase: PHASE.INTRO,
    phaseTime: 0,
    wave: 0,
    score: 0,
    bestCombo: 0,
    kills: 0,
    combo: { count: 0, timer: 0, multiplier: 1 },
    player: null,
    enemies: [],
    bolts: [],
    hostileBolts: [],
    particles: [],
    pickups: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    draftOptions: [],
    shake: 0,
    flash: 0,
    boss: null,
    events: [],
  };

  function freshPlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height - 150,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      hull: PLAYER.hull,
      maxHull: PLAYER.hull,
      shield: 0,
      maxShield: 0,
      fireTimer: 0,
      invulnerable: 0,
      rapidTimer: 0,
      novas: 1,
      angle: -Math.PI / 2,
      stats: { speedMul: 1, damageMul: 1, fireMul: 1, streams: 1, magnet: 90 },
      taken: {}, // upgrade id -> times taken
    };
  }
  state.player = freshPlayer();

  function emit(name, data) {
    state.events.push({ name, data });
  }

  /** Build the spawn queue for a wave: a list of { kind, delay } in seconds from wave start. */
  function buildWave(wave) {
    const queue = [];
    const add = (kind, count, first, gap) => {
      for (let i = 0; i < count; i += 1) queue.push({ kind, delay: first + i * gap + range(next, 0, 0.35) });
    };
    if (wave === 1) {
      add('drone', 8, 0.6, 1.05);
    } else if (wave === 2) {
      add('drone', 9, 0.6, 0.95);
      add('weaver', 3, 3.5, 3.4);
    } else if (wave === 3) {
      add('drone', 8, 0.6, 0.9);
      add('weaver', 4, 2.6, 3.0);
      add('lancer', 2, 6.0, 4.5);
      add('bulwark', 1, 11.0, 1);
    } else if (wave === 4) {
      add('drone', 12, 0.5, 0.8);
      add('weaver', 5, 2.2, 2.6);
      add('lancer', 3, 5.0, 3.8);
      add('bulwark', 2, 9.0, 6.0);
    } else {
      queue.push({ kind: 'boss', delay: 1.2 });
      add('drone', 4, 8.0, 7.0); // the boss's first escorts; it summons more itself
    }
    queue.sort((a, b) => a.delay - b.delay);
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWave(wave);
    state.spawnTimer = 0;
    state.phase = PHASE.INTRO;
    state.phaseTime = 0;
    if (state.player.taken.novacharge) state.player.novas = Math.min(3, state.player.novas + 1);
    if (wave === WAVE_COUNT) emit('alarm');
  }

  function spawnEnemy(kind) {
    const spec = ENEMY[kind];
    const enemy = {
      kind,
      x: range(next, 90, FIELD.width - 90),
      y: -spec.radius - 10,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      hull: spec.hull,
      maxHull: spec.hull,
      t: range(next, 0, Math.PI * 2), // personal phase for sway and timers
      fireTimer: range(next, 1.4, 2.6),
      mode: 'enter',
      modeTime: 0,
      dashX: 0,
      dashY: 0,
      flash: 0,
      dead: false,
    };
    if (kind === 'boss') {
      enemy.x = FIELD.width / 2;
      enemy.y = -90;
    }
    if (kind === 'bulwark') enemy.y = -60;
    state.enemies.push(enemy);
    if (kind === 'boss') state.boss = enemy;
    return enemy;
  }

  function burst(x, y, colour, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = next() * Math.PI * 2;
      const velocity = range(next, speed * 0.25, speed);
      state.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: range(next, life * 0.5, life),
        maxLife: life,
        size: range(next, size * 0.5, size),
        colour,
      });
    }
  }

  function ring(x, y, colour, maxRadius) {
    state.particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.38, maxLife: 0.38, size: maxRadius, colour });
  }

  function floatText(x, y, text, colour, size = 17) {
    state.texts.push({ x, y, vy: -46, life: 0.95, maxLife: 0.95, text, colour, size });
  }

  function dropPickup(x, y) {
    const roll = next();
    let kind = 'repair';
    if (roll < 0.3) kind = 'nova';
    else if (roll < 0.58) kind = 'shield';
    else if (roll < 0.82) kind = 'rapid';
    if (state.player.hull > state.player.maxHull * 0.75 && kind === 'repair' && next() < 0.5) kind = 'shield';
    state.pickups.push({ kind, x, y, vx: range(next, -25, 25), vy: range(next, 20, 55), t: 0, radius: 13 });
  }

  function damagePlayer(amount) {
    const player = state.player;
    if (player.invulnerable > 0 || state.phase === PHASE.WON || state.phase === PHASE.LOST) return;
    player.invulnerable = PLAYER.invulnerableSeconds;
    let remaining = amount;
    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, remaining);
      player.shield -= absorbed;
      remaining -= absorbed;
      floatText(player.x, player.y - 30, 'SHIELD', '#5cd6ff', 14);
    }
    if (remaining > 0) {
      player.hull -= remaining;
      state.shake = Math.min(16, state.shake + 8);
      state.flash = 0.55;
      emit('hurt');
      burst(player.x, player.y, '#ff5d73', 14, 260, 0.45, 3.4);
    }
    if (player.hull <= 0) {
      player.hull = 0;
      state.phase = PHASE.LOST;
      state.phaseTime = 0;
      state.shake = 22;
      burst(player.x, player.y, '#ffd166', 60, 420, 0.9, 4.2);
      burst(player.x, player.y, '#ff5d73', 40, 300, 1.1, 3.4);
      ring(player.x, player.y, '#ffe74d', 190);
      emit('lose');
    }
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    state.kills += 1;
    const combo = state.combo;
    combo.count += 1;
    combo.timer = COMBO.windowSeconds;
    combo.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(combo.count / 4));
    state.bestCombo = Math.max(state.bestCombo, combo.multiplier);
    const gained = ENEMY[enemy.kind].score * combo.multiplier;
    state.score += gained;
    floatText(enemy.x, enemy.y, `+${gained}`, combo.multiplier > 1 ? '#ffe74d' : '#eaf2ff', combo.multiplier > 3 ? 21 : 16);
    const big = enemy.kind === 'bulwark' || enemy.kind === 'boss';
    burst(enemy.x, enemy.y, ENEMY[enemy.kind].colour, big ? 46 : 20, big ? 360 : 280, big ? 0.8 : 0.55, 3.6);
    burst(enemy.x, enemy.y, '#ffffff', big ? 16 : 7, 200, 0.3, 2.4);
    ring(enemy.x, enemy.y, ENEMY[enemy.kind].colour, big ? 130 : 62);
    state.shake = Math.min(14, state.shake + (big ? 9 : 3));
    emit(big ? 'bigExplosion' : 'explosion');
    if (enemy.kind === 'bulwark') {
      for (let i = 0; i < 2; i += 1) {
        const child = spawnEnemy('drone');
        child.x = enemy.x + (i === 0 ? -34 : 34);
        child.y = enemy.y;
        child.mode = 'hunt';
      }
    }
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.phase = PHASE.WON;
      state.phaseTime = 0;
      state.score += 1000;
      floatText(enemy.x, enemy.y - 40, 'DREADNOUGHT DOWN +1000', '#57ff9a', 26);
      emit('win');
    } else if (next() < (enemy.kind === 'weaver' ? 0.16 : 0.11)) {
      dropPickup(enemy.x, enemy.y);
    }
  }

  function fireHostile(enemy, angle, speed = HOSTILE_BOLT.speed) {
    state.hostileBolts.push({
      x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
      y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: HOSTILE_BOLT.radius,
      damage: HOSTILE_BOLT.damage,
    });
  }

  function angleTo(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  function stepEnemy(enemy, dt) {
    const player = state.player;
    enemy.t += dt;
    enemy.modeTime += dt;
    if (enemy.flash > 0) enemy.flash -= dt * 6;
    const spec = ENEMY[enemy.kind];

    if (enemy.kind === 'drone') {
      const angle = angleTo(enemy, player);
      const wobble = Math.sin(enemy.t * 3.1) * 0.45;
      enemy.vx = Math.cos(angle + wobble) * spec.speed;
      enemy.vy = Math.sin(angle + wobble) * spec.speed;
    } else if (enemy.kind === 'weaver') {
      enemy.vy = spec.speed;
      enemy.vx = Math.sin(enemy.t * 2.2) * 130;
      if (enemy.y > 120) enemy.vy = spec.speed * 0.35;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && enemy.y > 0 && enemy.y < player.y - 60) {
        enemy.fireTimer = range(next, 2.0, 2.9);
        fireHostile(enemy, angleTo(enemy, player));
      }
    } else if (enemy.kind === 'lancer') {
      if (enemy.mode === 'enter' || enemy.mode === 'stalk') {
        const angle = angleTo(enemy, { x: player.x, y: Math.max(120, player.y - 300) });
        enemy.vx = Math.cos(angle) * spec.speed;
        enemy.vy = Math.sin(angle) * spec.speed;
        if (enemy.modeTime > range(next, 1.1, 1.5)) {
          enemy.mode = 'aim';
          enemy.modeTime = 0;
        }
      } else if (enemy.mode === 'aim') {
        enemy.vx *= 0.86;
        enemy.vy *= 0.86;
        if (enemy.modeTime > 0.55) {
          const angle = angleTo(enemy, player);
          enemy.dashX = Math.cos(angle) * 640;
          enemy.dashY = Math.sin(angle) * 640;
          enemy.mode = 'dash';
          enemy.modeTime = 0;
        }
      } else if (enemy.mode === 'dash') {
        enemy.vx = enemy.dashX;
        enemy.vy = enemy.dashY;
        if (enemy.modeTime > 0.42) {
          enemy.mode = 'stalk';
          enemy.modeTime = 0;
        }
      }
    } else if (enemy.kind === 'bulwark') {
      if (enemy.y < 165) {
        enemy.vy = spec.speed;
        enemy.vx = 0;
      } else {
        enemy.vy = Math.sin(enemy.t * 0.7) * 16;
        enemy.vx = Math.sin(enemy.t * 0.45) * 62;
      }
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && enemy.y > 40) {
        enemy.fireTimer = range(next, 2.6, 3.4);
        const base = angleTo(enemy, player);
        [-0.22, 0, 0.22].forEach((offset) => fireHostile(enemy, base + offset));
      }
    } else if (enemy.kind === 'boss') {
      if (enemy.mode === 'enter') {
        enemy.vy = 68;
        enemy.vx = 0;
        if (enemy.y >= 168) {
          enemy.mode = 'fight';
          enemy.modeTime = 0;
        }
      } else {
        const enraged = enemy.hull < enemy.maxHull * 0.5;
        enemy.y = 168 + Math.sin(enemy.t * 0.8) * 26;
        enemy.vx = Math.sin(enemy.t * (enraged ? 0.62 : 0.42)) * (enraged ? 120 : 84);
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = enraged ? 1.35 : 1.8;
          const attack = intRange(next, 0, 2);
          if (attack === 0) {
            const base = angleTo(enemy, player);
            [-0.3, -0.15, 0, 0.15, 0.3].forEach((offset) => fireHostile(enemy, base + offset, 300));
          } else if (attack === 1) {
            for (let i = 0; i < 14; i += 1) fireHostile(enemy, (i / 14) * Math.PI * 2 + enemy.t, 225);
          } else {
            const escorts = state.enemies.filter((other) => other !== enemy && !other.dead).length;
            if (escorts < 3) {
              const child = spawnEnemy('drone');
              child.x = enemy.x - 90;
              child.y = enemy.y + 30;
              const second = spawnEnemy('drone');
              second.x = enemy.x + 90;
              second.y = enemy.y + 30;
            } else {
              const base = angleTo(enemy, player);
              [-0.12, 0, 0.12].forEach((offset) => fireHostile(enemy, base + offset, 330));
            }
          }
          emit('bossShoot');
        }
      }
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
    if (enemy.kind !== 'boss') enemy.y = Math.min(FIELD.height + 90, enemy.y);
  }

  function stepPlayer(dt, input) {
    const player = state.player;
    const speed = PLAYER.speed * player.stats.speedMul;
    const length = Math.hypot(input.moveX, input.moveY) || 1;
    const targetVx = (input.moveX / length) * speed * (input.moveX || input.moveY ? 1 : 0);
    const targetVy = (input.moveY / length) * speed * (input.moveX || input.moveY ? 1 : 0);
    player.vx += (targetVx - player.vx) * Math.min(1, dt * 11);
    player.vy += (targetVy - player.vy) * Math.min(1, dt * 11);
    player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x + player.vx * dt));
    player.y = Math.max(player.radius + 60, Math.min(FIELD.height - player.radius, player.y + player.vy * dt));
    player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.rapidTimer > 0) player.rapidTimer -= dt;
    if (player.shield > 0 && player.taken.aegis) {
      player.shield = Math.min(player.maxShield, player.shield + dt * 2.2);
    }

    // Engine trail.
    if (Math.abs(player.vx) + Math.abs(player.vy) > 40 && next() < 0.75) {
      state.particles.push({
        kind: 'glow',
        x: player.x - Math.cos(player.angle) * 14 + range(next, -3, 3),
        y: player.y - Math.sin(player.angle) * 14 + range(next, -3, 3),
        vx: -player.vx * 0.25 + range(next, -14, 14),
        vy: -player.vy * 0.25 + range(next, 6, 26),
        life: range(next, 0.2, 0.4), maxLife: 0.4, size: range(next, 2, 4.4), colour: '#5cd6ff',
      });
    }

    // Firing.
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0 && state.phase === PHASE.ACTIVE) {
      const interval = PLAYER.fireInterval * player.stats.fireMul * (player.rapidTimer > 0 ? 0.55 : 1);
      player.fireTimer = interval;
      const streams = player.stats.streams;
      const offsets = streams === 1 ? [0] : streams === 2 ? [-0.07, 0.07] : [-0.13, 0, 0.13];
      offsets.forEach((offset) => {
        const angle = player.angle + offset;
        state.bolts.push({
          x: player.x + Math.cos(player.angle) * 20,
          y: player.y + Math.sin(player.angle) * 20,
          vx: Math.cos(angle) * PLAYER.boltSpeed,
          vy: Math.sin(angle) * PLAYER.boltSpeed,
          radius: PLAYER.boltRadius,
          damage: PLAYER.boltDamage * player.stats.damageMul,
        });
      });
      state.shake = Math.min(14, state.shake + 0.25);
      emit('shoot');
    }
  }

  function stepBolts(dt) {
    const player = state.player;
    state.bolts = state.bolts.filter((bolt) => {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) return false;
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (distanceSquared(bolt, enemy) < (bolt.radius + enemy.radius) ** 2) {
          enemy.hull -= bolt.damage;
          enemy.flash = 1;
          burst(bolt.x, bolt.y, '#ffe74d', 3, 170, 0.25, 2.2);
          emit('hit');
          if (enemy.hull <= 0) killEnemy(enemy);
          return false;
        }
      }
      return true;
    });
    state.hostileBolts = state.hostileBolts.filter((bolt) => {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) return false;
      if (state.phase === PHASE.ACTIVE && distanceSquared(bolt, player) < (bolt.radius + player.radius) ** 2) {
        damagePlayer(bolt.damage);
        return false;
      }
      return true;
    });
  }

  function stepEnemies(dt) {
    for (const enemy of state.enemies) stepEnemy(enemy, dt);
    // Contact damage.
    if (state.phase === PHASE.ACTIVE) {
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (distanceSquared(enemy, state.player) < (enemy.radius + state.player.radius - 3) ** 2) {
          damagePlayer(ENEMY[enemy.kind].damage);
          if (enemy.kind === 'drone' || enemy.kind === 'lancer') killEnemy(enemy);
        }
      }
    }
    state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.y < FIELD.height + 120);
  }

  function stepPickups(dt) {
    const player = state.player;
    state.pickups = state.pickups.filter((pickup) => {
      pickup.t += dt;
      const within = distanceSquared(pickup, player) < player.stats.magnet ** 2;
      if (within && state.phase === PHASE.ACTIVE) {
        const angle = angleTo(pickup, player);
        pickup.vx = Math.cos(angle) * 300;
        pickup.vy = Math.sin(angle) * 300;
      } else {
        pickup.vy = Math.min(60, pickup.vy + dt * 12);
      }
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      if (pickup.y > FIELD.height + 24 || pickup.t > 14) return false;
      if (state.phase === PHASE.ACTIVE && distanceSquared(pickup, player) < (pickup.radius + player.radius + 6) ** 2) {
        if (pickup.kind === 'repair') player.hull = Math.min(player.maxHull, player.hull + 22);
        if (pickup.kind === 'nova') player.novas = Math.min(3, player.novas + 1);
        if (pickup.kind === 'shield') {
          player.maxShield = Math.max(player.maxShield, 30);
          player.shield = Math.min(player.maxShield, player.shield + 30);
        }
        if (pickup.kind === 'rapid') player.rapidTimer = 8;
        floatText(player.x, player.y - 34, pickup.kind.toUpperCase(), '#57ff9a', 15);
        burst(player.x, player.y, '#57ff9a', 10, 170, 0.4, 2.6);
        emit('pickup');
        return false;
      }
      return true;
    });
  }

  function stepFx(dt) {
    state.particles = state.particles.filter((particle) => {
      particle.life -= dt;
      if (particle.life <= 0) return false;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - dt * 1.6;
      particle.vy *= 1 - dt * 1.6;
      return true;
    });
    state.texts = state.texts.filter((text) => {
      text.life -= dt;
      text.y += text.vy * dt;
      return text.life > 0;
    });
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
    if (state.combo.timer > 0) {
      state.combo.timer -= dt;
      if (state.combo.timer <= 0) {
        state.combo.count = 0;
        state.combo.multiplier = 1;
      }
    }
  }

  function openDraft() {
    state.phase = PHASE.DRAFT;
    state.phaseTime = 0;
    const pool = UPGRADES.filter((upgrade) => upgrade.id !== 'split' || state.player.stats.streams < 3);
    const options = [];
    while (options.length < DRAFT_SIZE && pool.length > 0) {
      const index = Math.floor(next() * pool.length);
      options.push(pool.splice(index, 1)[0]);
    }
    state.draftOptions = options;
    emit('draft');
  }

  const world = {
    state,
    /** Begin a fresh run from wave 1 with a clean player. */
    startRun() {
      state.score = 0;
      state.kills = 0;
      state.bestCombo = 0;
      state.combo = { count: 0, timer: 0, multiplier: 1 };
      state.enemies = [];
      state.bolts = [];
      state.hostileBolts = [];
      state.pickups = [];
      state.texts = [];
      state.boss = null;
      state.player = freshPlayer();
      startWave(1);
    },
    /** Advance the whole world one fixed step under the given input. */
    step(dt, input) {
      state.time += dt;
      state.phaseTime += dt;
      if (state.phase === PHASE.INTRO) {
        stepPlayer(dt, { ...input, firing: false });
        stepFx(dt);
        if (state.phaseTime > 1.7) {
          state.phase = PHASE.ACTIVE;
          state.phaseTime = 0;
        }
        return;
      }
      if (state.phase !== PHASE.ACTIVE) {
        stepFx(dt);
        return;
      }
      // Spawning.
      state.spawnTimer += dt;
      while (state.spawnQueue.length > 0 && state.spawnQueue[0].delay <= state.spawnTimer) {
        spawnEnemy(state.spawnQueue.shift().kind);
      }
      stepPlayer(dt, input);
      stepBolts(dt);
      stepEnemies(dt);
      stepPickups(dt);
      stepFx(dt);
      // Wave cleared?
      if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.phase === PHASE.ACTIVE) {
        if (state.wave >= WAVE_COUNT) {
          state.phase = PHASE.WON; // boss wave with the boss already gone
          state.phaseTime = 0;
        } else {
          state.score += 150 * state.wave;
          emit('waveClear');
          openDraft();
        }
      }
    },
    /** Apply the draft option at `index` and launch the next wave. */
    chooseUpgrade(index) {
      if (state.phase !== PHASE.DRAFT) return;
      const chosen = state.draftOptions[index];
      if (!chosen) return;
      const player = state.player;
      player.taken[chosen.id] = (player.taken[chosen.id] || 0) + 1;
      if (chosen.id === 'rapid') player.stats.fireMul *= 0.82;
      if (chosen.id === 'heavy') player.stats.damageMul *= 1.35;
      if (chosen.id === 'split') player.stats.streams = Math.min(3, player.stats.streams + 1);
      if (chosen.id === 'plating') {
        player.maxHull += 25;
        player.hull = Math.min(player.maxHull, player.hull + 25);
      }
      if (chosen.id === 'aegis') {
        player.maxShield = Math.max(player.maxShield, 40);
        player.shield = player.maxShield;
      }
      if (chosen.id === 'thrusters') player.stats.speedMul *= 1.12;
      if (chosen.id === 'magnet') player.stats.magnet += 70;
      emit('upgrade');
      startWave(state.wave + 1);
    },
    /** Detonate a nova bomb: clears hostile fire and mauls everything on screen. */
    useNova() {
      const player = state.player;
      if (state.phase !== PHASE.ACTIVE || player.novas <= 0) return;
      player.novas -= 1;
      state.hostileBolts = [];
      state.shake = 18;
      ring(player.x, player.y, '#ffe74d', 460);
      ring(player.x, player.y, '#ffffff', 300);
      for (const enemy of [...state.enemies]) {
        enemy.hull -= 130;
        enemy.flash = 1;
        if (enemy.hull <= 0 && !enemy.dead) killEnemy(enemy);
      }
      emit('nova');
    },
    /** Drain the events emitted since the last step (main.js turns them into sound). */
    takeEvents() {
      const events = state.events;
      state.events = [];
      return events;
    },
  };
  return world;
}
