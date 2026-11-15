// EMBER DRIFT — entities.js
// Every moving thing in the field: the skiff, bullets, asteroids, ember cores,
// power-ups, the boss, and the particle bursts that sell every hit.

import { PALETTE, PLAYER, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { range } from './random.js';

export function createPlayer() {
  return {
    x: VIEW_WIDTH / 2,
    y: VIEW_HEIGHT - 140,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    lives: PLAYER.maxLives,
    fireTimer: 0,
    invulnerableTimer: 0,
    shieldTimer: 0,
    slowTimer: 0,
    spreadTimer: 0,
    alive: true,
    respawnTimer: 0,
    tilt: 0,
    thrust: 0,
  };
}

export function createBullet(x, y, vx, vy) {
  return { x, y, vx, vy, radius: 4, dead: false, life: 1.6 };
}

export function fireBullets(player, bullets, sound) {
  const spread = player.spreadTimer > 0;
  const angles = spread ? [-0.22, 0, 0.22] : [0];
  for (const angle of angles) {
    const speed = PLAYER.bulletSpeed;
    bullets.push(createBullet(
      player.x + Math.sin(angle) * 10,
      player.y - 22,
      Math.sin(angle) * speed,
      -Math.cos(angle) * speed,
    ));
  }
  sound.shoot();
}

export function createAsteroid(random, wave, edge = 'top') {
  const big = random() < 0.25;
  const radius = big ? range(random, 34, 52) : range(random, 16, 32);
  const speed = range(random, 55, 110) + wave * 9;
  let x;
  let y;
  if (edge === 'top') {
    x = range(random, 40, VIEW_WIDTH - 40);
    y = -radius - range(random, 0, 200);
  } else if (edge === 'left') {
    x = -radius;
    y = range(random, 0, VIEW_HEIGHT * 0.6);
  } else {
    x = VIEW_WIDTH + radius;
    y = range(random, 0, VIEW_HEIGHT * 0.6);
  }
  const vertices = [];
  const points = big ? 11 : 9;
  for (let i = 0; i < points; i += 1) {
    vertices.push(range(random, 0.72, 1.18));
  }
  return {
    x, y,
    vx: range(random, -30, 30),
    vy: speed,
    radius,
    rotation: range(random, 0, Math.PI * 2),
    spin: range(random, -1.2, 1.2),
    vertices,
    health: big ? 3 : 1,
    maxHealth: big ? 3 : 1,
    dead: false,
    kind: big ? 'brute' : 'rock',
  };
}

export function createEmber(random, x, y) {
  return {
    x, y,
    vx: range(random, -25, 25),
    vy: range(random, 30, 70),
    radius: 9,
    pulse: range(random, 0, Math.PI * 2),
    dead: false,
    life: 9,
  };
}

export function createPowerup(random, x, y) {
  const kinds = ['shield', 'slow', 'spread'];
  return {
    x, y,
    vx: 0,
    vy: 55,
    radius: 16,
    kind: kinds[Math.floor(random() * kinds.length)],
    pulse: 0,
    dead: false,
    life: 12,
  };
}

export function createBoss(wave) {
  return {
    x: VIEW_WIDTH / 2,
    y: -90,
    vx: 70,
    vy: 0,
    radius: 74,
    health: 40 + wave * 6,
    maxHealth: 40 + wave * 6,
    rotation: 0,
    spin: 0.4,
    fireTimer: 1.2,
    strafeDirection: 1,
    dead: false,
    entering: true,
    kind: 'boss',
    vertices: [1, 0.85, 1.1, 0.8, 1.05, 0.9, 1, 0.82, 1.08, 0.9, 1, 0.86],
  };
}

export function createParticle(x, y, color, speed, life, size) {
  const angle = Math.random() * Math.PI * 2;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color,
    life,
    maxLife: life,
    size,
    dead: false,
  };
}

export function burstParticles(particles, x, y, color, count, speed = 220) {
  for (let i = 0; i < count; i += 1) {
    particles.push(createParticle(x, y, color, speed * (0.3 + Math.random() * 0.7), 0.4 + Math.random() * 0.5, 2 + Math.random() * 3));
  }
}

export function circlesCollide(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distance = Math.hypot(dx, dy);
  return distance < a.radius + b.radius;
}

export function clampToField(entity, margin) {
  entity.x = Math.max(margin, Math.min(VIEW_WIDTH - margin, entity.x));
  entity.y = Math.max(margin, Math.min(VIEW_HEIGHT - margin, entity.y));
}

export { PALETTE };
