// EMBER DRIFT — shots.js
// Deterministic screenshot states: ?shot=start|play|boss|end&seed=1 builds a
// fixed scene from a seeded generator and a fixed simulated clock, so every
// screenshot is a real render of the game's own code, reproducible shot to shot.

import { createSeededRandom, range } from './random.js';
import { createAsteroid, createBoss, createEmber, createPlayer } from './entities.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { createStarfield } from './render.js';

export function buildShotScene(shot, seed) {
  const random = createSeededRandom(seed);
  const stars = createStarfield(random);
  const player = createPlayer();
  const scene = {
    shot,
    stars,
    player,
    asteroids: [],
    bullets: [],
    embers: [],
    powerups: [],
    particles: [],
    score: 0,
    combo: 1,
    wave: 1,
    best: 12480,
    embersCollected: 0,
    bestCombo: 1,
    time: 0,
    bannerText: '',
    bannerAlpha: 0,
  };

  if (shot === 'start') {
    scene.time = 2.4;
    scene.stars = stars;
    for (let i = 0; i < 7; i += 1) {
      const asteroid = createAsteroid(random, 1, 'top');
      asteroid.y = range(random, 80, VIEW_HEIGHT - 80);
      scene.asteroids.push(asteroid);
    }
    for (let i = 0; i < 5; i += 1) {
      scene.embers.push(createEmber(random, range(random, 200, VIEW_WIDTH - 200), range(random, 150, 500)));
    }
    return scene;
  }

  if (shot === 'play') {
    scene.wave = 3;
    scene.score = 8450;
    scene.combo = 4;
    scene.bestCombo = 5;
    scene.embersCollected = 23;
    scene.time = 6.5;
    scene.bannerText = 'WAVE 3';
    scene.bannerAlpha = 0.9;
    player.x = VIEW_WIDTH / 2 - 60;
    player.y = VIEW_HEIGHT - 180;
    for (let i = 0; i < 11; i += 1) {
      const asteroid = createAsteroid(random, 3, 'top');
      asteroid.y = range(random, 60, VIEW_HEIGHT - 260);
      scene.asteroids.push(asteroid);
    }
    for (let i = 0; i < 6; i += 1) {
      scene.embers.push(createEmber(random, range(random, 150, VIEW_WIDTH - 150), range(random, 120, 480)));
    }
    scene.bullets = [
      { x: player.x - 4, y: player.y - 90, vx: 0, vy: -720, radius: 4, dead: false, life: 1 },
      { x: player.x + 30, y: player.y - 150, vx: 0, vy: -720, radius: 4, dead: false, life: 1 },
      { x: player.x - 44, y: player.y - 200, vx: 0, vy: -720, radius: 4, dead: false, life: 1 },
    ];
    scene.powerups = [{ x: 980, y: 300, vx: 0, vy: 55, radius: 16, kind: 'shield', pulse: 0, dead: false, life: 12 }];
    return scene;
  }

  if (shot === 'boss') {
    scene.wave = 5;
    scene.score = 18200;
    scene.combo = 6;
    scene.bestCombo = 8;
    scene.embersCollected = 51;
    scene.time = 9.2;
    scene.bannerText = 'VOID MAW';
    scene.bannerAlpha = 0.85;
    player.x = VIEW_WIDTH / 2;
    player.y = VIEW_HEIGHT - 160;
    player.shieldTimer = 5;
    const boss = createBoss(5);
    boss.x = VIEW_WIDTH / 2 + 80;
    boss.y = 300;
    boss.entering = false;
    boss.health = Math.floor(boss.maxHealth * 0.62);
    scene.asteroids.push(boss);
    for (let i = 0; i < 6; i += 1) {
      const asteroid = createAsteroid(random, 5, 'top');
      asteroid.y = range(random, 260, VIEW_HEIGHT - 240);
      scene.asteroids.push(asteroid);
    }
    for (let i = 0; i < 4; i += 1) {
      scene.embers.push(createEmber(random, range(random, 200, VIEW_WIDTH - 200), range(random, 300, 520)));
    }
    scene.bullets = [
      { x: player.x, y: player.y - 120, vx: 0, vy: -720, radius: 4, dead: false, life: 1 },
      { x: player.x - 26, y: player.y - 190, vx: -160, vy: -700, radius: 4, dead: false, life: 1 },
      { x: player.x + 26, y: player.y - 190, vx: 160, vy: -700, radius: 4, dead: false, life: 1 },
    ];
    return scene;
  }

  // end
  scene.wave = 4;
  scene.score = 21950;
  scene.combo = 1;
  scene.bestCombo = 8;
  scene.embersCollected = 64;
  scene.best = 21950;
  scene.time = 3.1;
  player.alive = false;
  player.lives = 0;
  for (let i = 0; i < 8; i += 1) {
    const asteroid = createAsteroid(random, 4, 'top');
    asteroid.y = range(random, 60, VIEW_HEIGHT - 120);
    scene.asteroids.push(asteroid);
  }
  return scene;
}
