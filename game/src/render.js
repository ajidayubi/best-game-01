// EMBER DRIFT — render.js
// Everything the player sees: the parallax starfield, the neon skiff, tumbling
// asteroids, glowing ember cores, the boss, particles, screen shake, the HUD,
// and the start / pause / game-over screens. All art is drawn in code.

import { PALETTE, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';

export function createStarfield(random, layers = 3) {
  const stars = [];
  for (let layer = 0; layer < layers; layer += 1) {
    const count = 46 - layer * 10;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: random() * VIEW_WIDTH,
        y: random() * VIEW_HEIGHT,
        layer,
        size: 1 + (2 - layer) * 0.7,
        twinkle: random() * Math.PI * 2,
      });
    }
  }
  return stars;
}

export function drawBackground(ctx, stars, time, shakeX, shakeY) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, PALETTE.backgroundTop);
  gradient.addColorStop(1, PALETTE.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // Distant nebula glows.
  drawNebula(ctx, 220, 150, 260, 'rgba(139, 92, 255, 0.16)');
  drawNebula(ctx, 1080, 560, 300, 'rgba(255, 77, 46, 0.10)');
  drawNebula(ctx, 900, 110, 200, 'rgba(55, 230, 255, 0.08)');

  ctx.save();
  ctx.translate(shakeX, shakeY);
  for (const star of stars) {
    const speed = (star.layer + 1) * 14;
    const y = (star.y + time * speed) % VIEW_HEIGHT;
    const alpha = 0.45 + 0.4 * Math.sin(time * 2 + star.twinkle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.layer === 0 ? '#ffffff' : star.layer === 1 ? '#bfe9ff' : '#ffd9a0';
    ctx.beginPath();
    ctx.arc(star.x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawNebula(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPlayer(ctx, player, time) {
  if (!player.alive) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  const blink = player.invulnerableTimer > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.rotate(player.tilt * 0.35);

  // Engine flame.
  const flame = 16 + Math.sin(time * 28) * 5 + player.thrust * 10;
  const flameGradient = ctx.createLinearGradient(0, 14, 0, 14 + flame);
  flameGradient.addColorStop(0, PALETTE.emberGold);
  flameGradient.addColorStop(1, 'rgba(255, 77, 46, 0)');
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(-7, 14);
  ctx.lineTo(0, 14 + flame);
  ctx.lineTo(7, 14);
  ctx.closePath();
  ctx.fill();

  // Skiff hull: a swept neon dart.
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#0e2a3d';
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(15, 12);
  ctx.lineTo(6, 8);
  ctx.lineTo(0, 14);
  ctx.lineTo(-6, 8);
  ctx.lineTo(-15, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cockpit ember.
  ctx.fillStyle = PALETTE.emberOrange;
  ctx.beginPath();
  ctx.arc(0, -6, 5, 0, Math.PI * 2);
  ctx.fill();

  // Shield bubble.
  if (player.shieldTimer > 0) {
    ctx.strokeStyle = 'rgba(77, 255, 166, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAsteroid(ctx, asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);
  const isBoss = asteroid.kind === 'boss';
  ctx.shadowColor = isBoss ? PALETTE.magenta : 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = isBoss ? 26 : 8;
  ctx.fillStyle = isBoss ? '#3d1030' : '#3a415c';
  ctx.strokeStyle = isBoss ? PALETTE.magenta : PALETTE.asteroidGrey;
  ctx.lineWidth = isBoss ? 3 : 2;
  ctx.beginPath();
  const points = asteroid.vertices.length;
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const radius = asteroid.radius * asteroid.vertices[i];
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Craters.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(-asteroid.radius * 0.3, -asteroid.radius * 0.2, asteroid.radius * 0.22, 0, Math.PI * 2);
  ctx.arc(asteroid.radius * 0.35, asteroid.radius * 0.3, asteroid.radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  if (isBoss) {
    // Boss core eye.
    ctx.fillStyle = PALETTE.emberRed;
    ctx.shadowColor = PALETTE.emberRed;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (asteroid.maxHealth > 1) {
    // Cracked brute: show damage as a glowing fissure.
    ctx.strokeStyle = PALETTE.emberOrange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-asteroid.radius * 0.5, 0);
    ctx.lineTo(0, asteroid.radius * 0.3);
    ctx.lineTo(asteroid.radius * 0.5, -asteroid.radius * 0.2);
    ctx.stroke();
  }
  ctx.restore();

  if (isBoss) {
    drawBossHealthBar(ctx, asteroid);
  }
}

export function drawBossHealthBar(ctx, boss) {
  const width = 420;
  const x = (VIEW_WIDTH - width) / 2;
  const y = 70;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - 8, y - 20, width + 16, 34);
  ctx.fillStyle = PALETTE.magenta;
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VOID MAW — WAVE BOSS', VIEW_WIDTH / 2, y - 6);
  ctx.fillStyle = '#2a0a24';
  ctx.fillRect(x, y, width, 10);
  const fraction = Math.max(0, boss.health / boss.maxHealth);
  const barGradient = ctx.createLinearGradient(x, 0, x + width, 0);
  barGradient.addColorStop(0, PALETTE.magenta);
  barGradient.addColorStop(1, PALETTE.emberRed);
  ctx.fillStyle = barGradient;
  ctx.fillRect(x, y, width * fraction, 10);
  ctx.restore();
}

export function drawBullet(ctx, bullet) {
  ctx.save();
  ctx.shadowColor = PALETTE.emberGold;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = PALETTE.emberGold;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bullet.x, bullet.y + 10);
  ctx.lineTo(bullet.x, bullet.y - 8);
  ctx.stroke();
  ctx.restore();
}

export function drawEmber(ctx, ember, time) {
  const glow = 0.7 + 0.3 * Math.sin(time * 6 + ember.pulse);
  ctx.save();
  ctx.translate(ember.x, ember.y);
  ctx.shadowColor = PALETTE.emberOrange;
  ctx.shadowBlur = 16 * glow;
  const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, ember.radius + 4);
  gradient.addColorStop(0, '#fff7d6');
  gradient.addColorStop(0.45, PALETTE.emberGold);
  gradient.addColorStop(1, PALETTE.emberRed);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  // A four-point ember star.
  ctx.moveTo(0, -ember.radius - 3);
  ctx.quadraticCurveTo(3, -3, ember.radius + 3, 0);
  ctx.quadraticCurveTo(3, 3, 0, ember.radius + 3);
  ctx.quadraticCurveTo(-3, 3, -ember.radius - 3, 0);
  ctx.quadraticCurveTo(-3, -3, 0, -ember.radius - 3);
  ctx.fill();
  ctx.restore();
}

export function drawPowerup(ctx, powerup, time) {
  const colors = { shield: PALETTE.mint, slow: PALETTE.cyan, spread: PALETTE.magenta };
  const labels = { shield: 'SHIELD', slow: 'SLOW', spread: 'SPREAD' };
  const color = colors[powerup.kind] || PALETTE.white;
  ctx.save();
  ctx.translate(powerup.x, powerup.y + Math.sin(time * 3 + powerup.pulse) * 3);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(7, 3, 18, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labels[powerup.kind] || '?', 0, 1);
  ctx.restore();
}

export function drawParticles(ctx, particles) {
  for (const particle of particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawHud(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, VIEW_WIDTH, 56);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, 20, 36);

  ctx.fillStyle = PALETTE.emberGold;
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  const comboText = state.combo > 1 ? `COMBO x${state.combo}` : 'COMBO x1';
  ctx.fillText(comboText, 300, 34);

  ctx.fillStyle = PALETTE.cyan;
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave}`, VIEW_WIDTH / 2, 34);

  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.dimWhite;
  ctx.font = '16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`BEST ${state.best.toLocaleString('en-US')}`, VIEW_WIDTH - 20, 30);

  // Lives as little skiffs.
  for (let i = 0; i < state.player.lives; i += 1) {
    const x = VIEW_WIDTH - 170 + i * 26;
    drawLifeIcon(ctx, x, 46);
  }

  // Active power-up timers.
  let timerY = 76;
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  if (state.player.shieldTimer > 0) {
    ctx.fillStyle = PALETTE.mint;
    ctx.fillText(`SHIELD ${Math.ceil(state.player.shieldTimer)}s`, 20, timerY);
    timerY += 20;
  }
  if (state.player.slowTimer > 0) {
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillText(`SLOW-TIME ${Math.ceil(state.player.slowTimer)}s`, 20, timerY);
    timerY += 20;
  }
  if (state.player.spreadTimer > 0) {
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText(`SPREAD SHOT ${Math.ceil(state.player.spreadTimer)}s`, 20, timerY);
  }
  ctx.restore();
}

export function drawLifeIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PALETTE.cyan;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCenterPanel(ctx, title, titleColor, lines, footer) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 2, 12, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 30;
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 84px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(title, VIEW_WIDTH / 2, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.white;
  ctx.font = '22px "Segoe UI", system-ui, sans-serif';
  let y = 310;
  for (const line of lines) {
    ctx.fillText(line, VIEW_WIDTH / 2, y);
    y += 36;
  }
  if (footer) {
    ctx.fillStyle = PALETTE.emberGold;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(footer, VIEW_WIDTH / 2, y + 30);
  }
  ctx.restore();
}

export function drawStartScreen(ctx, best, time) {
  drawCenterPanel(ctx, 'EMBER DRIFT', PALETTE.emberOrange, [
    'Pilot your skiff through the asteroid field.',
    'Blast rocks, grab ember cores, build your combo —',
    'survive the waves and break the Void Maw every 5th wave.',
    '',
    'MOVE  Arrows / WASD or mouse      SHOOT  Space or click',
    'PAUSE  P or Esc      MUTE  M      3 lives — good luck, pilot.',
  ], best > 0 ? `BEST SCORE  ${best.toLocaleString('en-US')}` : 'PRESS ENTER OR CLICK TO LAUNCH');
  ctx.save();
  ctx.fillStyle = `rgba(255, 210, 62, ${0.55 + 0.35 * Math.sin(time * 3)})`;
  ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▶  PRESS ENTER TO LAUNCH', VIEW_WIDTH / 2, 630);
  ctx.restore();
}

export function drawPauseScreen(ctx) {
  drawCenterPanel(ctx, 'PAUSED', PALETTE.cyan, [
    'Take a breath, pilot. The field waits for no one —',
    'except right now, apparently.',
  ], 'PRESS P OR ESC TO RESUME');
}

export function drawGameOverScreen(ctx, state) {
  const isBest = state.score > 0 && state.score >= state.best;
  drawCenterPanel(ctx, 'GAME OVER', PALETTE.emberRed, [
    `FINAL SCORE  ${state.score.toLocaleString('en-US')}`,
    isBest ? '★ NEW BEST SCORE ★' : `BEST  ${state.best.toLocaleString('en-US')}`,
    `WAVES SURVIVED  ${Math.max(0, state.wave - 1)}      EMBERS  ${state.embersCollected}`,
    `BEST COMBO  x${state.bestCombo}`,
    '',
    'The drift claims another skiff. The embers remember you.',
  ], 'PRESS ENTER OR CLICK TO FLY AGAIN');
}

export function drawWaveBanner(ctx, text, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.shadowColor = PALETTE.emberOrange;
  ctx.shadowBlur = 24;
  ctx.fillStyle = PALETTE.emberGold;
  ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(text, VIEW_WIDTH / 2, 200);
  ctx.restore();
}
