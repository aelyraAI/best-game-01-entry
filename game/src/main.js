// STARFORGE SIEGE — boot and wiring. Owns the page-level state the world does not:
// the title/game screens, pause, mute, the best score, and turning world events into
// sound. The simulation itself is world.js; everything drawn is render.js.
// With ?shot=<scene>&seed=<n> it instead stages one deterministic screenshot scene
// (shots.js) and draws a single frame — that is how the entry's screenshots are taken.

import { STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer, draftCardRects, SCREEN } from './render.js';
import { pilotInput, stageShot } from './shots.js';
import { createWorld, PHASE } from './world.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '7') >>> 0;
const world = createWorld(seed);

let best = 0;
try {
  best = Number(window.localStorage.getItem('starforge-siege-best') || '0') || 0;
} catch {
  best = 0;
}

const ui = { screen: SCREEN.TITLE, paused: false, best };

function saveBest() {
  if (world.state.score > best) {
    best = world.state.score;
    ui.best = best;
    try {
      window.localStorage.setItem('starforge-siege-best', String(best));
    } catch {
      // Private modes may refuse storage; the in-memory best still stands.
    }
  }
}

const EVENT_SOUNDS = {
  shoot: () => audio.shoot(),
  hit: () => audio.enemyHit(),
  explosion: () => audio.explosion(false),
  bigExplosion: () => audio.explosion(true),
  bossShoot: () => audio.enemyHit(),
  hurt: () => audio.playerHurt(),
  pickup: () => audio.pickup(),
  nova: () => audio.nova(),
  waveClear: () => audio.waveClear(),
  alarm: () => audio.alarm(),
  draft: () => audio.upgrade(),
  upgrade: () => audio.upgrade(),
  win: () => audio.victory(),
  lose: () => audio.gameOver(),
};

function playEvents() {
  for (const event of world.takeEvents()) {
    const sound = EVENT_SOUNDS[event.name];
    if (sound) sound();
  }
}

function startRun() {
  audio.unlock();
  world.startRun();
  ui.screen = SCREEN.GAME;
  ui.paused = false;
}

function handlePressesAndClicks() {
  const state = world.state;
  if (input.takePress('KeyM')) {
    audio.setMuted(!audio.isMuted());
  }
  if (ui.screen === SCREEN.TITLE) {
    if (input.takePress('Enter') || input.takePress('Space') || input.clicked) startRun();
    input.clicked = null;
    input.clearPresses();
    return;
  }
  if (input.takePress('KeyP') || input.takePress('Escape')) ui.paused = !ui.paused;
  if (ui.paused) {
    input.clicked = null;
    input.clearPresses();
    return;
  }
  if (state.phase === PHASE.DRAFT) {
    let choice = -1;
    if (input.takePress('Digit1')) choice = 0;
    if (input.takePress('Digit2')) choice = 1;
    if (input.takePress('Digit3')) choice = 2;
    if (choice === -1 && input.clicked) {
      const rects = draftCardRects();
      choice = rects.findIndex((rect) => input.clicked.x >= rect.x && input.clicked.x <= rect.x + rect.width
        && input.clicked.y >= rect.y && input.clicked.y <= rect.y + rect.height);
    }
    if (choice >= 0) world.chooseUpgrade(choice);
  } else if (state.phase === PHASE.WON || state.phase === PHASE.LOST) {
    if (input.takePress('KeyR') || input.takePress('Enter') || input.clicked) startRun();
  } else {
    if (input.takePress('KeyE')) world.useNova();
    if (input.takePress('KeyR') && state.phase === PHASE.ACTIVE) startRun();
  }
  input.clicked = null;
  input.clearPresses();
}

function announce() {
  const state = world.state;
  if (!status) return;
  status.textContent = ui.screen === SCREEN.TITLE
    ? 'Starforge Siege. Press Enter to launch.'
    : `Wave ${state.wave} of 5. Hull ${Math.ceil(state.player.hull)}. Score ${state.score}.`;
}

// Screenshot mode: stage the scene, draw exactly one frame, and say so in the status line.
const shot = params.get('shot');
if (shot) {
  const staged = stageShot(shot, world);
  ui.screen = staged.screen;
  renderer.draw(world.state, ui);
  if (status) status.textContent = `shot ${shot} ready`;
} else {
  world.startRun(); // the attract run behind the title; startRun() replaces it on launch
  let last = performance.now();
  let accumulator = 0;
  let announceTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    accumulator += elapsed;
    input.poll();
    handlePressesAndClicks();
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (!ui.paused) {
        if (ui.screen === SCREEN.TITLE) {
          const state = world.state;
          if (state.phase === PHASE.DRAFT) world.chooseUpgrade(0);
          else if (state.phase === PHASE.WON || state.phase === PHASE.LOST) world.startRun();
          else world.step(STEP, pilotInput(state));
        } else {
          world.step(STEP, {
            moveX: input.moveX,
            moveY: input.moveY,
            aimX: input.aimX,
            aimY: input.aimY,
            firing: input.firing(),
          });
        }
      }
    }
    playEvents();
    saveBest();
    renderer.draw(world.state, ui);
    announceTimer += elapsed;
    if (announceTimer > 1) {
      announceTimer = 0;
      announce();
    }
  }
  requestAnimationFrame(frame);
}
