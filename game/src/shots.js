// The screenshot scenes behind ?shot=start|play|upgrade|end, plus the autopilot that flies
// them. Each scene starts a fresh seeded run and plays the real rules forward, steered by
// the pilot below, so a screenshot is a frame the game itself produced and the same seed
// always produces the same frame. main.js also uses the pilot for the title attract mode.

import { FIELD, STEP } from './config.js';
import { SCREEN } from './render.js';
import { PHASE } from './world.js';

/**
 * One frame of pilot input for the world's input interface: hover below the nearest
 * enemy and shoot it, break off for pickups when the sky is quiet, and sidestep bolts.
 */
export function pilotInput(state) {
  const player = state.player;
  let target = null;
  let targetDistance = Infinity;
  for (const enemy of state.enemies) {
    const d = (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2;
    if (d < targetDistance) {
      targetDistance = d;
      target = enemy;
    }
  }
  let pickup = null;
  let pickupDistance = Infinity;
  for (const item of state.pickups) {
    const d = (item.x - player.x) ** 2 + (item.y - player.y) ** 2;
    if (d < pickupDistance) {
      pickupDistance = d;
      pickup = item;
    }
  }

  let wantX = player.x;
  let wantY = FIELD.height - 150;
  if (target) {
    wantX = target.x;
    wantY = Math.min(FIELD.height - 90, target.y + 300);
    if (targetDistance < 150 * 150) {
      wantX = player.x + (player.x < target.x ? -190 : 190);
      wantY = player.y + 120;
    }
  }
  if (pickup && (!target || targetDistance > 320 * 320)) {
    wantX = pickup.x;
    wantY = pickup.y;
  }
  // Sidestep the closest incoming bolt.
  for (const bolt of state.hostileBolts) {
    const d = (bolt.x - player.x) ** 2 + (bolt.y - player.y) ** 2;
    if (d < 95 * 95) {
      wantX = player.x + (bolt.x < player.x ? 150 : -150);
      wantY = player.y + 60;
    }
  }
  const moveX = wantX > player.x + 14 ? 1 : wantX < player.x - 14 ? -1 : 0;
  const moveY = wantY > player.y + 14 ? 1 : wantY < player.y - 14 ? -1 : 0;
  const aimX = target ? target.x + target.vx * 0.12 : player.x;
  const aimY = target ? target.y + target.vy * 0.12 : player.y - 220;
  return { moveX, moveY, aimX, aimY, firing: Boolean(target) };
}

function fly(world, seconds, onDraft) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.phase === PHASE.WON || state.phase === PHASE.LOST) return;
    if (state.phase === PHASE.DRAFT) {
      if (onDraft) onDraft();
      else world.chooseUpgrade(0);
      continue;
    }
    if (state.phase === PHASE.ACTIVE && state.player.novas > 0 && state.hostileBolts.length > 6) world.useNova();
    world.step(STEP, pilotInput(state));
  }
}

/**
 * Set `world` to the named scene and return the screen main.js should draw over it.
 * Any name other than play/upgrade/end is the title scene.
 */
export function stageShot(name, world) {
  world.startRun();
  if (name === 'play') {
    // Fly until the fight is genuinely busy — several enemies on screen and bolts in
    // the air — so the cover frame shows the game at full stretch, not a lull.
    for (let chunk = 0; chunk < 100; chunk += 1) {
      fly(world, 0.5, () => world.chooseUpgrade(1));
      const state = world.state;
      const deep = state.enemies.filter((enemy) => enemy.y > 240).length;
      if (state.time > 10 && state.enemies.length >= 4 && deep >= 2 && state.bolts.length >= 4) break;
      if (state.phase === PHASE.WON || state.phase === PHASE.LOST) break;
    }
    return { screen: SCREEN.GAME };
  }
  if (name === 'upgrade') {
    fly(world, 300, () => {}); // stop at the first draft: leave it open for the frame
    return { screen: SCREEN.GAME };
  }
  if (name === 'end') {
    fly(world, 900, () => world.chooseUpgrade(2)); // fly the whole run to its win or loss
    if (world.state.phase !== PHASE.WON && world.state.phase !== PHASE.LOST) {
      // The pilot is still alive at the cap: freeze mid-fight rather than fake an ending.
      return { screen: SCREEN.GAME };
    }
    return { screen: SCREEN.GAME };
  }
  fly(world, 5, () => world.chooseUpgrade(0));
  return { screen: SCREEN.TITLE };
}
