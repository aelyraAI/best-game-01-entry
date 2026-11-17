// STARFORGE SIEGE — the renderer. Draws the world state and every screen (title, wave
// banner, upgrade draft, victory, defeat, pause) onto the canvas. It owns no game rules:
// it reads world state and paints it, with a parallax starfield and nebula behind the action.
// The draft card layout is exported so main.js can hit-test clicks against the same boxes.

import { ENEMY, FIELD, PALETTE, PICKUP, WAVE_COUNT } from './config.js';
import { PHASE } from './world.js';
import { makeRandom } from './random.js';

export const SCREEN = { TITLE: 'title', GAME: 'game' };

const WAVE_LINES = [
  'Drone swarm inbound — hold the line.',
  'Weavers on approach. Watch their guns.',
  'Lancers diving, and something big behind them.',
  'Full siege. Everything they have.',
  'DREADNOUGHT signature detected. End this.',
];

/** The three upgrade cards of the draft screen, in field coordinates. */
export function draftCardRects() {
  const width = 308;
  const height = 316;
  const gap = 28;
  const total = width * 3 + gap * 2;
  const startX = (FIELD.width - total) / 2;
  const y = 268;
  return [0, 1, 2].map((i) => ({ x: startX + i * (width + gap), y, width, height }));
}

function makeStarfield() {
  const next = makeRandom(20261115);
  const layers = [];
  const counts = [130, 80, 40];
  const speeds = [9, 22, 44];
  for (let layer = 0; layer < 3; layer += 1) {
    const stars = [];
    for (let i = 0; i < counts[layer]; i += 1) {
      stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, r: 0.7 + layer * 0.7 + next() * 0.8, speed: speeds[layer] });
    }
    layers.push(stars);
  }
  return layers;
}

function makeNebula() {
  const nebula = document.createElement('canvas');
  nebula.width = FIELD.width;
  nebula.height = FIELD.height;
  const ctx = nebula.getContext('2d');
  ctx.fillStyle = PALETTE.space;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const blobs = [
    [300, 190, 420, PALETTE.nebulaA],
    [980, 300, 480, PALETTE.nebulaB],
    [620, 640, 520, '#123524'],
    [1080, 660, 340, PALETTE.nebulaA],
    [140, 620, 300, PALETTE.nebulaB],
  ];
  for (const [x, y, r, colour] of blobs) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, 'rgba(7,10,26,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  return nebula;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const starLayers = makeStarfield();
  const nebula = makeNebula();

  function drawBackground(state) {
    ctx.drawImage(nebula, 0, 0);
    const player = state.player;
    starLayers.forEach((stars, layer) => {
      ctx.fillStyle = layer === 2 ? 'rgba(255,255,255,0.95)' : 'rgba(190,210,255,0.65)';
      for (const star of stars) {
        const drift = (state.time * star.speed + (player ? player.y * layer * 0.012 : 0)) % FIELD.height;
        const y = (star.y + drift) % FIELD.height;
        const x = star.x - (player ? player.x * layer * 0.008 : 0) % FIELD.width;
        ctx.beginPath();
        ctx.arc((x + FIELD.width) % FIELD.width, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawShip(player, time) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle + Math.PI / 2);
    if (player.invulnerable > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    // Engine flame.
    const flame = 13 + Math.sin(time * 34) * 4 + Math.hypot(player.vx, player.vy) * 0.02;
    ctx.fillStyle = '#ffb84d';
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(0, 14 + flame);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();
    // Wings.
    ctx.fillStyle = '#2b6cb0';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(20, 16);
    ctx.lineTo(8, 18);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 18);
    ctx.lineTo(-20, 16);
    ctx.closePath();
    ctx.fill();
    // Hull.
    const body = ctx.createLinearGradient(0, -20, 0, 16);
    body.addColorStop(0, '#bfe9ff');
    body.addColorStop(0.5, '#5cd6ff');
    body.addColorStop(1, '#1d6fb8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(7, 4);
    ctx.lineTo(5, 15);
    ctx.lineTo(-5, 15);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eaf2ff';
    ctx.beginPath();
    ctx.arc(0, -6, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield bubble.
    if (player.shield > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(92,214,255,${0.35 + 0.2 * Math.sin(time * 5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDrone(enemy) {
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2 || 0);
    ctx.fillStyle = ENEMY.drone.colour;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(11, -8);
    ctx.lineTo(4, -13);
    ctx.lineTo(-4, -13);
    ctx.lineTo(-11, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b0a12';
    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWeaver(enemy, time) {
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = ENEMY.weaver.colour;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a00';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    const blink = Math.sin(time * 6 + enemy.t) > 0 ? 2.6 : 1.2;
    ctx.beginPath();
    ctx.arc(-8, -3, blink, 0, Math.PI * 2);
    ctx.arc(8, -3, blink, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ENEMY.weaver.colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(-30, 8 + Math.sin(time * 9 + enemy.t) * 4, -24, 16);
    ctx.moveTo(20, 0);
    ctx.quadraticCurveTo(30, 8 - Math.sin(time * 9 + enemy.t) * 4, 24, 16);
    ctx.stroke();
  }

  function drawLancer(enemy) {
    ctx.translate(enemy.x, enemy.y);
    const angle = enemy.mode === 'dash' || enemy.mode === 'aim'
      ? Math.atan2(enemy.dashY || enemy.vy, enemy.dashX || enemy.vx)
      : Math.atan2(enemy.vy, enemy.vx);
    ctx.rotate(angle + Math.PI / 2);
    if (enemy.mode === 'aim') {
      ctx.strokeStyle = `rgba(199,146,255,${0.5 + 0.5 * Math.sin(enemy.t * 26)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(0, 74);
      ctx.stroke();
    }
    ctx.fillStyle = ENEMY.lancer.colour;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(6, -4);
    ctx.lineTo(15, -16);
    ctx.lineTo(4, -12);
    ctx.lineTo(0, -6);
    ctx.lineTo(-4, -12);
    ctx.lineTo(-15, -16);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(0, 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBulwark(enemy, time) {
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = '#5c2e1e';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ENEMY.bulwark.colour;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + enemy.t * 0.3;
      const r = enemy.radius;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d1408';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,209,102,${0.6 + 0.4 * Math.sin(time * 7 + enemy.t)})`;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoss(enemy, time) {
    ctx.translate(enemy.x, enemy.y);
    const w = 190;
    const h = 92;
    // Side pods.
    ctx.fillStyle = '#571c2c';
    ctx.fillRect(-w / 2 - 26, -18, 30, 52);
    ctx.fillRect(w / 2 - 4, -18, 30, 52);
    ctx.fillStyle = ENEMY.boss.colour;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 18);
    ctx.lineTo(-w / 2 + 34, -h / 2);
    ctx.lineTo(w / 2 - 34, -h / 2);
    ctx.lineTo(w / 2, -h / 2 + 18);
    ctx.lineTo(w / 2 - 18, h / 2);
    ctx.lineTo(-w / 2 + 18, h / 2);
    ctx.closePath();
    ctx.fill();
    const core = ctx.createRadialGradient(0, 6, 2, 0, 6, 30);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, '#ffd166');
    core.addColorStop(1, 'rgba(255,77,109,0.15)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 6, 26 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b0a12';
    [-64, 64].forEach((offset) => {
      ctx.beginPath();
      ctx.arc(offset, 22, 9, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ffd166';
    [-64, 64].forEach((offset) => {
      ctx.beginPath();
      ctx.arc(offset, 22, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawEnemy(enemy, time) {
    ctx.save();
    if (enemy.kind === 'drone') drawDrone(enemy);
    else if (enemy.kind === 'weaver') drawWeaver(enemy, time);
    else if (enemy.kind === 'lancer') drawLancer(enemy);
    else if (enemy.kind === 'bulwark') drawBulwark(enemy, time);
    else if (enemy.kind === 'boss') drawBoss(enemy, time);
    ctx.restore();
    if (enemy.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.75, enemy.flash);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Hull pip for the tough enemies.
    if ((enemy.kind === 'bulwark' || enemy.kind === 'weaver') && enemy.hull < enemy.maxHull) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(10,14,28,0.8)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 13, width, 5);
      ctx.fillStyle = PALETTE.good;
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 13, width * (enemy.hull / enemy.maxHull), 5);
    }
  }

  function drawPickup(pickup, time) {
    const spec = PICKUP[pickup.kind];
    const bob = Math.sin(time * 4 + pickup.x) * 3;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = spec.colour;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.fillStyle = '#0a0f22';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.label, 0, 1);
    ctx.restore();
  }

  function drawWorld(state) {
    const time = state.time;
    for (const pickup of state.pickups) drawPickup(pickup, time);
    // Player bolts.
    for (const bolt of state.bolts) {
      ctx.save();
      ctx.strokeStyle = '#aef3ff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#5cd6ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(bolt.x - bolt.vx * 0.016, bolt.y - bolt.vy * 0.016);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();
      ctx.restore();
    }
    // Hostile bolts.
    for (const bolt of state.hostileBolts) {
      ctx.save();
      ctx.fillStyle = '#ff7ad9';
      ctx.shadowColor = '#ff4dd2';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    if (state.phase !== PHASE.LOST) drawShip(state.player, time);
    // Particles.
    for (const particle of state.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (particle.kind === 'ring') {
        ctx.strokeStyle = particle.colour;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (1 - alpha) + 8, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = particle.colour;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Floating texts.
    for (const text of state.texts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
      ctx.fillStyle = text.colour;
      ctx.font = `bold ${text.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    }
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,60,80,${state.flash * 0.22})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function bar(x, y, width, height, fraction, colour, back = 'rgba(10,16,34,0.78)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
    ctx.strokeStyle = 'rgba(160,190,240,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  function drawHud(state) {
    const player = state.player;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Hull + shield, top-left.
    ctx.fillStyle = PALETTE.dim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HULL', 24, 30);
    bar(70, 18, 230, 14, player.hull / player.maxHull, player.hull > 30 ? PALETTE.good : PALETTE.bad);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(player.hull)} / ${player.maxHull}`, 308, 30);
    if (player.maxShield > 0) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('AEGIS', 24, 56);
      bar(70, 44, 230, 10, player.shield / player.maxShield, PALETTE.accent);
    }
    // Wave, top-centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(state.phase === PHASE.INTRO || state.wave > 0 ? `WAVE ${Math.max(1, state.wave)} / ${WAVE_COUNT}` : '', FIELD.width / 2, 34);
    // Score + combo, top-right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.dim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('SCORE', FIELD.width - 24, 30);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(String(state.score), FIELD.width - 24, 60);
    if (state.combo.multiplier > 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(`COMBO ×${state.combo.multiplier}`, FIELD.width - 24, 90);
      bar(FIELD.width - 154, 98, 130, 6, state.combo.timer / 2.6, PALETTE.gold);
    }
    // Novas, bottom-left; hints, bottom-right.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`✸ NOVA [E] × ${player.novas}`, 24, FIELD.height - 20);
    if (player.rapidTimer > 0) {
      ctx.fillStyle = '#ff9df3';
      ctx.fillText(`RAPID ${player.rapidTimer.toFixed(0)}s`, 210, FIELD.height - 20);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(143,163,200,0.8)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move · mouse aim · hold to fire · E nova · P pause · M mute', FIELD.width - 24, FIELD.height - 20);
    ctx.restore();
    // Boss bar.
    if (state.boss) {
      const boss = state.boss;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.bad;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('— DREADNOUGHT —', FIELD.width / 2, 64);
      bar(FIELD.width / 2 - 260, 72, 520, 12, boss.hull / boss.maxHull, PALETTE.bad);
      ctx.restore();
    }
  }

  function centreText(text, y, font, colour, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, y);
    ctx.restore();
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(5,8,20,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centreText('STARFORGE', 240, 'bold 96px system-ui, sans-serif', PALETTE.ink);
    centreText('S I E G E', 318, 'bold 44px system-ui, sans-serif', PALETTE.accent);
    centreText('Five waves of the swarm stand between you and the forge.', 384, '21px system-ui, sans-serif', PALETTE.dim);
    centreText('Break them all — then bring down the DREADNOUGHT.', 416, '21px system-ui, sans-serif', PALETTE.dim);
    const lines = [
      'MOVE  WASD / arrow keys',
      'AIM + FIRE  mouse, hold to shoot',
      'NOVA BOMB  E — clears bullets, mauls everything',
      'SURVIVE  grab pickups, chain kills for combo ×8',
      'UPGRADE  after every wave, draft 1 of 3',
    ];
    ctx.save();
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 486 + i * 30));
    ctx.restore();
    const pulse = 0.72 + 0.28 * Math.sin(state.time * 3.4);
    centreText('CLICK OR PRESS ENTER TO LAUNCH', 692, 'bold 25px system-ui, sans-serif', PALETTE.gold, pulse);
    if (best > 0) centreText(`BEST SCORE ${best}`, 736, '17px system-ui, sans-serif', PALETTE.dim);
  }

  function drawIntro(state) {
    const alpha = Math.min(1, state.phaseTime / 0.3, (1.7 - state.phaseTime) / 0.4 + 0.2);
    centreText(`WAVE ${state.wave}`, 330, 'bold 74px system-ui, sans-serif', PALETTE.ink, Math.max(0, alpha));
    centreText(WAVE_LINES[state.wave - 1] || '', 384, '23px system-ui, sans-serif', PALETTE.accent, Math.max(0, alpha));
  }

  function drawDraft(state) {
    ctx.fillStyle = 'rgba(5,8,20,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centreText(`WAVE ${state.wave} CLEARED`, 148, 'bold 46px system-ui, sans-serif', PALETTE.good);
    centreText('The forge offers one upgrade. Choose well — the swarm adapts.', 196, '20px system-ui, sans-serif', PALETTE.dim);
    centreText(`SCORE ${state.score}`, 232, 'bold 19px system-ui, sans-serif', PALETTE.gold);
    const rects = draftCardRects();
    state.draftOptions.forEach((upgrade, i) => {
      const rect = rects[i];
      ctx.save();
      ctx.fillStyle = 'rgba(16,24,52,0.96)';
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '54px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(upgrade.icon, rect.x + rect.width / 2, rect.y + 84);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = 'bold 25px system-ui, sans-serif';
      const words = upgrade.name.split(' ');
      words.forEach((word, line) => ctx.fillText(word, rect.x + rect.width / 2, rect.y + 138 + line * 30));
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '17px system-ui, sans-serif';
      const blurb = upgrade.blurb.split(' ');
      let line = '';
      let lineY = rect.y + 138 + words.length * 30 + 12;
      for (const word of blurb) {
        if ((line + ' ' + word).trim().length > 24) {
          ctx.fillText(line.trim(), rect.x + rect.width / 2, lineY);
          lineY += 24;
          line = word;
        } else line += ' ' + word;
      }
      if (line.trim()) ctx.fillText(line.trim(), rect.x + rect.width / 2, lineY);
      const taken = state.player.taken[upgrade.id] || 0;
      if (taken > 0) {
        ctx.fillStyle = PALETTE.accent;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(`OWNED ×${taken}`, rect.x + rect.width / 2, rect.y + rect.height - 52);
      }
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText(`PRESS ${i + 1} OR CLICK`, rect.x + rect.width / 2, rect.y + rect.height - 20);
      ctx.restore();
    });
  }

  function drawEnd(state, won) {
    ctx.fillStyle = won ? 'rgba(6,20,14,0.68)' : 'rgba(24,6,12,0.68)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (won) {
      centreText('VICTORY', 268, 'bold 88px system-ui, sans-serif', PALETTE.good);
      centreText('The Dreadnought burns. The forge is yours.', 330, '23px system-ui, sans-serif', PALETTE.ink);
    } else {
      centreText('SHIP DESTROYED', 268, 'bold 80px system-ui, sans-serif', PALETTE.bad);
      centreText(`The swarm took you on wave ${state.wave}. The forge remembers.`, 330, '23px system-ui, sans-serif', PALETTE.ink);
    }
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    const stats = [
      `FINAL SCORE  ${state.score}`,
      `KILLS  ${state.kills}      BEST COMBO  ×${state.bestCombo}`,
      `TIME  ${minutes}:${seconds}`,
    ];
    ctx.save();
    ctx.font = 'bold 25px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    stats.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 420 + i * 42));
    ctx.restore();
    const pulse = 0.72 + 0.28 * Math.sin(state.time * 3.4);
    centreText('PRESS R OR CLICK TO FLY AGAIN', 592, 'bold 23px system-ui, sans-serif', PALETTE.ink, pulse);
  }

  return {
    /** Draw one frame: `ui` is { screen, paused, best } from main.js. */
    draw(state, ui) {
      ctx.save();
      if (state.shake > 0.2) {
        const magnitude = state.shake;
        ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
      }
      drawBackground(state);
      drawWorld(state);
      ctx.restore();
      if (ui.screen === SCREEN.TITLE) {
        drawTitle(state, ui.best);
        return;
      }
      drawHud(state);
      if (state.phase === PHASE.INTRO) drawIntro(state);
      if (state.phase === PHASE.DRAFT) drawDraft(state);
      if (state.phase === PHASE.WON) drawEnd(state, true);
      if (state.phase === PHASE.LOST) drawEnd(state, false);
      if (ui.paused) {
        ctx.fillStyle = 'rgba(5,8,20,0.6)';
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
        centreText('PAUSED', 380, 'bold 64px system-ui, sans-serif', PALETTE.ink);
        centreText('Press P to resume', 436, '21px system-ui, sans-serif', PALETTE.dim);
      }
    },
  };
}
