// EMBER DRIFT — main.js
// The game loop and state machine: start → playing → paused → game over →
// restart. Owns scoring, the combo multiplier, wave progression, collisions,
// lives and the high score in localStorage. In ?shot= mode it renders one
// deterministic scene and raises window.__shotReady for the screenshot taker.

import { COMBO, PALETTE, PLAYER, POWERUPS, VIEW_HEIGHT, VIEW_WIDTH, WAVES } from './config.js';
import { createSeededRandom, range } from './random.js';
import { SoundEngine } from './audio.js';
import { InputState } from './input.js';
import {
  burstParticles,
  circlesCollide,
  clampToField,
  createAsteroid,
  createEmber,
  createPlayer,
  createPowerup,
  fireBullets,
} from './entities.js';
import { isBossWave, spawnBoss, spawnWave, waveIsCleared } from './waves.js';
import {
  createStarfield,
  drawAsteroid,
  drawBackground,
  drawBullet,
  drawEmber,
  drawGameOverScreen,
  drawHud,
  drawParticles,
  drawPauseScreen,
  drawPlayer,
  drawPowerup,
  drawStartScreen,
  drawWaveBanner,
} from './render.js';
import { buildShotScene } from './shots.js';

const BEST_KEY = 'ember-drift-best-score';

export function loadBestScore() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode or blocked storage: the session best still shows.
  }
}

function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 1) || 1;
  return { shot, seed };
}

class EmberDriftGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.input = new InputState(canvas);
    this.random = createSeededRandom((Date.now() % 2147483647) || 1);
    this.stars = createStarfield(createSeededRandom(20261116));
    this.state = 'start';
    this.time = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.slowFactor = 1;
    this.resetRun();
    this.best = loadBestScore();
    this.bannerText = '';
    this.bannerAlpha = 0;
    this.bannerTimer = 0;
    this.wavePauseTimer = 0;
    this.bossSlot = { current: null };
    this.attachControls();
    this.lastTimestamp = 0;
  }

  resetRun() {
    this.player = createPlayer();
    this.bullets = [];
    this.asteroids = [];
    this.embers = [];
    this.powerups = [];
    this.particles = [];
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestCombo = 1;
    this.embersCollected = 0;
    this.wave = 1;
    this.waveSpawned = 0;
    this.wavePauseTimer = 0;
    this.bossSlot = { current: null };
  }

  attachControls() {
    this.input.onPause = () => {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.sound.stopMusic();
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.sound.startMusic();
      }
    };
    this.input.onConfirm = () => {
      if (this.state === 'start' || this.state === 'over') this.startRun();
    };
    this.input.onMute = () => {
      this.sound.unlock();
      this.sound.toggleMute();
    };
    this.canvas.addEventListener('click', () => {
      this.sound.unlock();
      if (this.state === 'start' || this.state === 'over') this.startRun();
    });
  }

  startRun() {
    this.sound.unlock();
    this.resetRun();
    this.best = loadBestScore();
    this.state = 'playing';
    this.showBanner(`WAVE ${this.wave}`);
    this.beginWave();
    this.sound.startMusic();
    this.sound.waveClear();
  }

  showBanner(text) {
    this.bannerText = text;
    this.bannerAlpha = 1;
    this.bannerTimer = 2.2;
  }

  beginWave() {
    this.waveSpawned = isBossWave(this.wave)
      ? 1
      : spawnWave(this.random, this.wave, this.asteroids);
    if (isBossWave(this.wave)) {
      spawnBoss(this.random, this.wave, this.asteroids, this.bossSlot);
      this.sound.bossAlarm();
      this.showBanner('VOID MAW APPROACHES');
    }
  }

  addScore(base) {
    const gained = base * this.combo;
    this.score += gained;
    return gained;
  }

  bumpCombo() {
    this.combo = Math.min(COMBO.maxMultiplier, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = COMBO.windowSeconds;
  }

  updatePlaying(delta) {
    const player = this.player;
    const slow = player.slowTimer > 0;
    this.slowFactor = slow ? 0.45 : 1;
    const dt = delta * this.slowFactor;

    // Movement: keyboard thrust, or the skiff chases the mouse.
    const move = this.input.moveVector();
    if (move.x !== 0 || move.y !== 0) {
      player.vx += move.x * PLAYER.accel * delta;
      player.vy += move.y * PLAYER.accel * delta;
      player.thrust = 1;
      this.input.mouseActive = false;
    } else if (this.input.mouseActive && this.input.mouseX !== null) {
      const dx = this.input.mouseX - player.x;
      const dy = this.input.mouseY - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 6) {
        player.vx = (dx / distance) * PLAYER.speed;
        player.vy = (dy / distance) * PLAYER.speed;
      } else {
        player.vx *= 0.8;
        player.vy *= 0.8;
      }
      player.thrust = distance > 40 ? 1 : 0.3;
    } else {
      player.vx *= PLAYER.friction;
      player.vy *= PLAYER.friction;
      player.thrust = 0;
    }
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = (player.vx / speed) * PLAYER.speed;
      player.vy = (player.vy / speed) * PLAYER.speed;
    }
    player.x += player.vx * delta;
    player.y += player.vy * delta;
    player.tilt = Math.max(-1, Math.min(1, player.vx / PLAYER.speed));
    clampToField(player, 26);

    // Timers.
    player.fireTimer -= delta;
    player.invulnerableTimer = Math.max(0, player.invulnerableTimer - delta);
    player.shieldTimer = Math.max(0, player.shieldTimer - delta);
    player.slowTimer = Math.max(0, player.slowTimer - delta);
    player.spreadTimer = Math.max(0, player.spreadTimer - delta);
    this.comboTimer -= delta;
    if (this.comboTimer <= 0) this.combo = 1;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= delta;
      this.bannerAlpha = Math.max(0, this.bannerTimer / 2.2);
    }

    // Shooting.
    if (this.input.isShooting() && player.fireTimer <= 0 && player.alive) {
      player.fireTimer = PLAYER.fireCooldown;
      fireBullets(player, this.bullets, this.sound);
    }

    this.updateBullets(dt);
    this.updateAsteroids(dt);
    this.updateEmbers(dt);
    this.updatePowerups(dt);
    this.updateParticles(dt);
    this.checkCollisions();

    // Wave cleared: bonus, banner, next wave.
    if (this.wavePauseTimer > 0) {
      this.wavePauseTimer -= delta;
      if (this.wavePauseTimer <= 0) {
        this.wave += 1;
        this.showBanner(isBossWave(this.wave) ? 'VOID MAW APPROACHES' : `WAVE ${this.wave}`);
        this.beginWave();
      }
    } else if (waveIsCleared(this.asteroids, this.bossSlot)) {
      this.addScore(WAVES.waveClearBonus);
      this.sound.waveClear();
      this.showBanner(`WAVE ${this.wave} CLEAR  +${WAVES.waveClearBonus * this.combo}`);
      this.wavePauseTimer = 2.0;
    }

    // Respawn after a hit.
    if (!player.alive) {
      player.respawnTimer -= delta;
      if (player.respawnTimer <= 0 && player.lives > 0) {
        player.alive = true;
        player.x = VIEW_WIDTH / 2;
        player.y = VIEW_HEIGHT - 140;
        player.vx = 0;
        player.vy = 0;
        player.invulnerableTimer = PLAYER.invulnerableSeconds;
      }
    }
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.y < -20 || bullet.x < -20 || bullet.x > VIEW_WIDTH + 20 || bullet.life <= 0) {
        bullet.dead = true;
      }
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.dead);
  }

  updateAsteroids(dt) {
    for (const asteroid of this.asteroids) {
      if (asteroid.dead) continue;
      asteroid.rotation += asteroid.spin * dt;
      if (asteroid.kind === 'boss') {
        this.updateBoss(asteroid, dt);
      } else {
        asteroid.x += asteroid.vx * dt;
        asteroid.y += asteroid.vy * dt;
        if (asteroid.y > VIEW_HEIGHT + asteroid.radius + 40) {
          asteroid.dead = true;
        }
      }
    }
    this.asteroids = this.asteroids.filter((asteroid) => !asteroid.dead);
  }

  updateBoss(boss, dt) {
    if (boss.entering) {
      boss.y += 60 * dt;
      if (boss.y >= 150) {
        boss.y = 150;
        boss.entering = false;
      }
      return;
    }
    boss.x += boss.vx * boss.strafeDirection * dt;
    if (boss.x < 140) boss.strafeDirection = 1;
    if (boss.x > VIEW_WIDTH - 140) boss.strafeDirection = -1;
    boss.fireTimer -= dt;
    if (boss.fireTimer <= 0) {
      boss.fireTimer = range(this.random, 1.4, 2.2);
      const shard = createAsteroid(this.random, this.wave, 'top');
      shard.x = boss.x + range(this.random, -50, 50);
      shard.y = boss.y + boss.radius * 0.6;
      shard.vy = 190;
      shard.radius = 18;
      shard.health = 1;
      shard.maxHealth = 1;
      this.asteroids.push(shard);
    }
  }

  updateEmbers(dt) {
    for (const ember of this.embers) {
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      ember.pulse += dt;
      ember.life -= dt;
      if (ember.life <= 0 || ember.y > VIEW_HEIGHT + 20) ember.dead = true;
    }
    this.embers = this.embers.filter((ember) => !ember.dead);
  }

  updatePowerups(dt) {
    for (const powerup of this.powerups) {
      powerup.y += powerup.vy * dt;
      powerup.pulse += dt;
      powerup.life -= dt;
      if (powerup.life <= 0 || powerup.y > VIEW_HEIGHT + 20) powerup.dead = true;
    }
    this.powerups = this.powerups.filter((powerup) => !powerup.dead);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= dt;
      if (particle.life <= 0) particle.dead = true;
    }
    this.particles = this.particles.filter((particle) => !particle.dead);
  }

  checkCollisions() {
    const player = this.player;
    // Bullets vs asteroids (boss included).
    for (const bullet of this.bullets) {
      for (const asteroid of this.asteroids) {
        if (asteroid.dead || bullet.dead) continue;
        if (circlesCollide(bullet, asteroid)) {
          bullet.dead = true;
          asteroid.health -= 1;
          burstParticles(this.particles, bullet.x, bullet.y, PALETTE.emberGold, 5, 160);
          if (asteroid.health <= 0) {
            this.destroyAsteroid(asteroid);
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.dead);
    this.asteroids = this.asteroids.filter((asteroid) => !asteroid.dead);

    // Embers vs player.
    for (const ember of this.embers) {
      if (ember.dead || !player.alive) continue;
      if (circlesCollide(ember, player)) {
        ember.dead = true;
        this.embersCollected += 1;
        this.bumpCombo();
        this.addScore(WAVES.emberScore);
        this.sound.collect(this.combo);
        burstParticles(this.particles, ember.x, ember.y, PALETTE.emberGold, 8, 180);
      }
    }
    this.embers = this.embers.filter((ember) => !ember.dead);

    // Power-ups vs player.
    for (const powerup of this.powerups) {
      if (powerup.dead || !player.alive) continue;
      if (circlesCollide(powerup, player)) {
        powerup.dead = true;
        this.applyPowerup(powerup.kind);
      }
    }
    this.powerups = this.powerups.filter((powerup) => !powerup.dead);

    // Asteroids vs player.
    if (player.alive && player.invulnerableTimer <= 0) {
      for (const asteroid of this.asteroids) {
        if (asteroid.dead) continue;
        if (circlesCollide(asteroid, player)) {
          if (player.shieldTimer > 0) {
            this.destroyAsteroid(asteroid);
            this.sound.explosion();
          } else {
            this.hitPlayer(asteroid);
          }
          break;
        }
      }
    }
  }

  destroyAsteroid(asteroid) {
    asteroid.dead = true;
    const isBoss = asteroid.kind === 'boss';
    this.addScore(isBoss ? WAVES.bossScore : WAVES.asteroidScore);
    this.sound.explosion(isBoss);
    this.shake = isBoss ? 18 : 7;
    burstParticles(this.particles, asteroid.x, asteroid.y, isBoss ? PALETTE.magenta : PALETTE.emberOrange, isBoss ? 60 : 18, isBoss ? 320 : 240);
    burstParticles(this.particles, asteroid.x, asteroid.y, '#ffffff', 6, 180);
    if (isBoss) {
      this.bossSlot.current = null;
      for (let i = 0; i < 5; i += 1) {
        this.embers.push(createEmber(this.random, asteroid.x + range(this.random, -70, 70), asteroid.y + range(this.random, -40, 40)));
      }
      this.showBanner('VOID MAW DESTROYED');
    } else {
      // Embers spill from shattered rocks; sometimes a power-up too.
      const emberCount = asteroid.kind === 'brute' ? 2 : 1;
      for (let i = 0; i < emberCount; i += 1) {
        this.embers.push(createEmber(this.random, asteroid.x, asteroid.y));
      }
      if (this.random() < POWERUPS.dropChance) {
        this.powerups.push(createPowerup(this.random, asteroid.x, asteroid.y));
      }
      // Big rocks split into two small ones.
      if (asteroid.kind === 'brute') {
        for (let i = 0; i < 2; i += 1) {
          const shard = createAsteroid(this.random, this.wave, 'top');
          shard.x = asteroid.x + range(this.random, -30, 30);
          shard.y = asteroid.y;
          shard.radius = 17;
          shard.health = 1;
          shard.maxHealth = 1;
          shard.kind = 'rock';
          this.asteroids.push(shard);
        }
      }
    }
  }

  applyPowerup(kind) {
    const player = this.player;
    if (kind === 'shield') player.shieldTimer = POWERUPS.shieldSeconds;
    if (kind === 'slow') player.slowTimer = POWERUPS.slowSeconds;
    if (kind === 'spread') player.spreadTimer = POWERUPS.spreadSeconds;
    this.sound.powerup();
    burstParticles(this.particles, player.x, player.y, PALETTE.mint, 16, 200);
  }

  hitPlayer(asteroid) {
    const player = this.player;
    player.lives -= 1;
    player.alive = false;
    player.respawnTimer = PLAYER.respawnSeconds;
    this.combo = 1;
    this.shake = 16;
    this.sound.hit();
    this.sound.explosion();
    burstParticles(this.particles, player.x, player.y, PALETTE.cyan, 40, 300);
    burstParticles(this.particles, player.x, player.y, PALETTE.emberOrange, 24, 240);
    asteroid.dead = true;
    if (player.lives <= 0) {
      this.endRun();
    }
  }

  endRun() {
    this.state = 'over';
    this.sound.stopMusic();
    this.sound.explosion(true);
    if (this.score > this.best) {
      this.best = this.score;
      saveBestScore(this.score);
    }
  }

  update(delta) {
    this.time += delta;
    this.shake = Math.max(0, this.shake - delta * 30);
    this.shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    if (this.state === 'playing') this.updatePlaying(delta);
    this.input.clearPressed();
  }

  render() {
    const ctx = this.ctx;
    drawBackground(ctx, this.stars, this.time, this.shakeX, this.shakeY);
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    for (const ember of this.embers) drawEmber(ctx, ember, this.time);
    for (const powerup of this.powerups) drawPowerup(ctx, powerup, this.time);
    for (const asteroid of this.asteroids) drawAsteroid(ctx, asteroid);
    for (const bullet of this.bullets) drawBullet(ctx, bullet);
    drawParticles(ctx, this.particles);
    drawPlayer(ctx, this.player, this.time);
    ctx.restore();
    if (this.state === 'playing' || this.state === 'paused') {
      drawHud(ctx, this);
      drawWaveBanner(ctx, this.bannerText, this.bannerAlpha);
      if (this.state === 'paused') drawPauseScreen(ctx);
    } else if (this.state === 'start') {
      drawStartScreen(ctx, this.best, this.time);
    } else if (this.state === 'over') {
      drawHud(ctx, this);
      drawGameOverScreen(ctx, this);
    }
  }

  renderShotScene(scene) {
    const ctx = this.ctx;
    drawBackground(ctx, scene.stars, scene.time, 0, 0);
    for (const ember of scene.embers) drawEmber(ctx, ember, scene.time);
    for (const powerup of scene.powerups) drawPowerup(ctx, powerup, scene.time);
    for (const asteroid of scene.asteroids) drawAsteroid(ctx, asteroid);
    for (const bullet of scene.bullets) drawBullet(ctx, bullet);
    drawPlayer(ctx, scene.player, scene.time);
    if (scene.shot === 'start') {
      drawStartScreen(ctx, scene.best, scene.time);
    } else if (scene.shot === 'end') {
      drawHud(ctx, scene);
      drawGameOverScreen(ctx, scene);
    } else {
      drawHud(ctx, scene);
      drawWaveBanner(ctx, scene.bannerText, scene.bannerAlpha);
    }
  }

  frame(timestamp) {
    const delta = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000 || 0.016);
    this.lastTimestamp = timestamp;
    this.update(delta);
    this.render();
    window.requestAnimationFrame((next) => this.frame(next));
  }

  start() {
    window.requestAnimationFrame((timestamp) => {
      this.lastTimestamp = timestamp;
      this.frame(timestamp);
    });
  }
}

function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const { shot, seed } = readShotParams();
  if (shot) {
    // Deterministic screenshot mode: build the fixed scene, paint it a few
    // frames so glows and text settle, then signal the screenshot taker.
    const scene = buildShotScene(shot, seed);
    const game = new EmberDriftGame(canvas);
    game.renderShotScene(scene);
    window.requestAnimationFrame(() => {
      game.renderShotScene(scene);
      window.requestAnimationFrame(() => {
        game.renderShotScene(scene);
        window.__shotReady = true;
        window.__shotScene = shot;
      });
    });
    return;
  }
  const game = new EmberDriftGame(canvas);
  game.start();
  // Exposed for automated play-testing only (menu, shooting, waves, restart).
  window.__game = game;
}

boot();
