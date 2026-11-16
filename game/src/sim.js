// The rules of Ember Drift: state, the fixed-step simulation, collisions,
// scoring, combo, lives, power-ups and the start / pause / game-over flow.
// Drawing lives in render.js; entity motion and looks live in entities.js.
import { CFG } from './config.js';
import { Rng } from './random.js';
import { Director } from './waves.js';
import {
  makePlayer,
  spawnFoe,
  spawnBullet,
  spawnEmber,
  spawnPower,
  spawnExplosion,
  spawnFloat,
  updateEntities,
} from './entities.js';

const BEST_KEY = 'ember-drift-best-v2';

export function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (e) {
    /* storage unavailable: best score just lives for the session */
  }
}

export function createGame(seed) {
  const rng = new Rng(seed);
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: rng.range(0, CFG.width),
      y: rng.range(0, CFG.height),
      z: rng.pick([0.25, 0.5, 1]),
      tw: rng.range(0, Math.PI * 2),
    });
  }
  const nebulae = [
    { x: 260, y: 170, r: 260, color: CFG.colors.nebulaViolet },
    { x: 1020, y: 480, r: 300, color: CFG.colors.nebulaTeal },
    { x: 700, y: 90, r: 200, color: CFG.colors.nebulaEmber },
  ];
  const g = {
    seed,
    rng,
    time: 0,
    tick: 0,
    mode: 'title',
    score: 0,
    best: loadBest(),
    combo: 1,
    comboTimer: 0,
    lives: CFG.player.startLives,
    wave: 1,
    phase: 'banner',
    phaseT: 0,
    speedScale: 1,
    player: null, // set below, once the state object exists
    bullets: [],
    foeBullets: [],
    foes: [],
    embers: [],
    powers: [],
    parts: [],
    floats: [],
    boss: null,
    stars,
    nebulae,
    shake: 0,
    flash: 0,
    banner: null,
    stats: { shots: 0, hits: 0, kills: 0, cores: 0, powers: 0 },
    end: null,
    director: null,
    muted: false,
  };
  g.player = makePlayer(g);
  g.director = new Director(g);
  // A few rocks drift behind the title screen so it feels alive.
  for (let i = 0; i < 6; i++) {
    spawnFoe(g, 'rock', rng.range(60, CFG.width - 60), rng.range(60, CFG.height - 120));
  }
  return g;
}

export function startGame(g, sfx) {
  const best = g.best;
  const muted = g.muted;
  const fresh = createGame(g.seed);
  fresh.best = best;
  fresh.muted = muted;
  Object.keys(fresh).forEach((k) => {
    g[k] = fresh[k];
  });
  // The fresh state's director points at the fresh object, not this one:
  // rebind it so wave flow mutates the live game.
  g.director = new Director(g);
  g.mode = 'playing';
  g.director.startWave(1);
  if (sfx) {
    sfx.start();
    sfx.startDrone();
  }
}

export function togglePause(g) {
  if (g.mode === 'playing') g.mode = 'paused';
  else if (g.mode === 'paused') g.mode = 'playing';
}

function addScore(g, base, x, y) {
  const gained = base * g.combo;
  g.score += gained;
  spawnFloat(g, x, y, `+${gained}`, g.combo >= 4 ? '#fbbf24' : '#f8fafc');
}

function killFoe(g, f, sfx) {
  g.stats.kills += 1;
  addScore(g, f.score, f.x, f.y);
  const color = f.kind === 'chaser' ? CFG.colors.chaser : f.kind === 'splitter' ? CFG.colors.splitter : f.kind === 'armored' ? CFG.colors.shieldRing : CFG.colors.rockRim;
  spawnExplosion(g, f.x, f.y, color, f.kind === 'splitter' ? 16 : 12, false);
  if (f.kind === 'splitter') {
    for (let i = 0; i < 3; i++) spawnFoe(g, 'shard', f.x, f.y);
  }
  if (g.rng.chance(CFG.drops.emberChance)) spawnEmber(g, f.x, f.y);
  if (g.rng.chance(CFG.drops.powerChance)) spawnPower(g, f.x, f.y);
  if (sfx) sfx.boom(false);
}

function killBoss(g, sfx) {
  const boss = g.boss;
  g.stats.kills += 1;
  addScore(g, boss.score, boss.x, boss.y);
  spawnExplosion(g, boss.x, boss.y, CFG.colors.boss, 40, true);
  spawnExplosion(g, boss.x, boss.y, CFG.colors.bossCore, 24, true);
  for (let i = 0; i < CFG.drops.bossEmbers; i++) spawnEmber(g, boss.x + g.rng.range(-60, 60), boss.y + g.rng.range(-30, 30));
  spawnPower(g, boss.x, boss.y + 40, 'shield');
  g.boss = null;
  g.shake = 18;
  if (sfx) sfx.boom(true);
}

function damagePlayer(g, sfx) {
  const p = g.player;
  if (!p.alive || p.invuln > 0) return;
  if (p.shield) {
    p.shield = false;
    p.invuln = 1.5;
    spawnFloat(g, p.x, p.y - 30, 'SHIELD DOWN', '#38bdf8');
    if (sfx) sfx.hit();
    return;
  }
  g.lives -= 1;
  g.combo = 1;
  g.comboTimer = 0;
  g.flash = 1;
  g.shake = 16;
  spawnExplosion(g, p.x, p.y, CFG.colors.player, 26, true);
  if (sfx) sfx.hit();
  if (g.lives <= 0) {
    gameOver(g, sfx);
    return;
  }
  p.alive = false;
  p.respawnT = 1.2;
}

function gameOver(g, sfx) {
  g.mode = 'over';
  const isBest = g.score > g.best;
  if (isBest) {
    g.best = g.score;
    saveBest(g.best);
  }
  g.end = {
    score: g.score,
    wave: g.wave,
    kills: g.stats.kills,
    cores: g.stats.cores,
    best: g.best,
    isBest,
  };
  if (sfx) {
    sfx.gameOver();
    sfx.stopDrone();
  }
}

function collideCircles(a, b, shrink) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.r + b.r) * (shrink || 1);
  return dx * dx + dy * dy < r * r;
}

// One fixed step of the game. Input is an object with axisX(), axisY(),
// firing(), mouseTarget(), wasPressed(code) and endStep().
export function stepGame(g, dt, input, sfx) {
  g.time += dt;
  g.tick += 1;
  if (g.banner) {
    g.banner.t += dt;
    if (g.banner.t >= g.banner.dur) g.banner = null;
  }
  g.shake = Math.max(0, g.shake - dt * 30);
  g.flash = Math.max(0, g.flash - dt * 2.2);

  if (g.mode === 'title') {
    updateEntities(g, dt);
    return;
  }
  if (g.mode === 'paused' || g.mode === 'over') {
    updateEntities(g, dt);
    return;
  }

  // --- playing ---
  const p = g.player;

  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 1;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.spreadT = Math.max(0, p.spreadT - dt);
  p.slowT = Math.max(0, p.slowT - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);

  if (!p.alive) {
    p.respawnT -= dt;
    if (p.respawnT <= 0 && g.lives > 0) {
      p.alive = true;
      p.x = CFG.width / 2;
      p.y = CFG.height - 120;
      p.vx = 0;
      p.vy = 0;
      p.invuln = CFG.player.invulnSeconds;
    }
  } else {
    const ax = input.axisX();
    const ay = input.axisY();
    const target = input.mouseTarget();
    if ((ax !== 0 || ay !== 0) && target) {
      // Keys win over the mouse while held.
      p.vx += ax * CFG.player.accel * dt;
      p.vy += ay * CFG.player.accel * dt;
    } else if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 10) {
        p.vx += (dx / d) * CFG.player.accel * dt;
        p.vy += (dy / d) * CFG.player.accel * dt;
      }
    } else {
      p.vx += ax * CFG.player.accel * dt;
      p.vy += ay * CFG.player.accel * dt;
    }
    p.vx -= p.vx * CFG.player.drag * dt;
    p.vy -= p.vy * CFG.player.drag * dt;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > CFG.player.maxSpeed) {
      p.vx = (p.vx / speed) * CFG.player.maxSpeed;
      p.vy = (p.vy / speed) * CFG.player.maxSpeed;
    }
    p.x = Math.max(20, Math.min(CFG.width - 20, p.x + p.vx * dt));
    p.y = Math.max(20, Math.min(CFG.height - 20, p.y + p.vy * dt));
    p.thrust = Math.min(1, speed / CFG.player.maxSpeed);

    if (input.firing() && p.fireCd <= 0) {
      p.fireCd = CFG.player.fireCooldown;
      g.stats.shots += 1;
      const bx = p.x;
      const by = p.y - 20;
      if (p.spreadT > 0) {
        spawnBullet(g, bx, by, -140, -CFG.player.bulletSpeed);
        spawnBullet(g, bx, by, 0, -CFG.player.bulletSpeed);
        spawnBullet(g, bx, by, 140, -CFG.player.bulletSpeed);
      } else {
        spawnBullet(g, bx, by, 0, -CFG.player.bulletSpeed);
      }
      if (sfx) sfx.shoot();
    }
  }

  g.director.update(dt);
  if (g.director.cleared()) {
    const bonus = CFG.waves.clearBonusPerWave * g.wave;
    g.score += bonus;
    spawnFloat(g, CFG.width / 2, CFG.height / 2 - 60, `WAVE BONUS +${bonus}`, '#4ade80');
    if (sfx) sfx.waveClear();
    g.director.startWave(g.wave + 1);
  }

  updateEntities(g, dt);

  // Bullets vs foes.
  for (const b of [...g.bullets]) {
    let spent = false;
    for (const f of [...g.foes]) {
      if (collideCircles(b, f, 0.95)) {
        spent = true;
        g.stats.hits += 1;
        f.hp -= 1;
        spawnExplosion(g, b.x, b.y, CFG.colors.bullet, 3, false);
        if (f.hp <= 0) {
          g.foes = g.foes.filter((x) => x !== f);
          killFoe(g, f, sfx);
        }
        break;
      }
    }
    if (spent) {
      g.bullets = g.bullets.filter((x) => x !== b);
      continue;
    }
    const boss = g.boss;
    if (boss && collideCircles(b, boss, 0.85)) {
      g.stats.hits += 1;
      boss.hp -= 1;
      boss.flash = 1;
      spawnExplosion(g, b.x, b.y, CFG.colors.bullet, 3, false);
      g.bullets = g.bullets.filter((x) => x !== b);
      if (sfx) sfx.bossHit();
      if (boss.hp <= 0) killBoss(g, sfx);
    }
  }

  // Foes and foe bullets vs the player.
  if (p.alive && p.invuln <= 0) {
    for (const f of [...g.foes]) {
      if (collideCircles(f, p, 0.85)) {
        g.foes = g.foes.filter((x) => x !== f);
        spawnExplosion(g, f.x, f.y, CFG.colors.rockRim, 10, false);
        damagePlayer(g, sfx);
        break;
      }
    }
    if (p.alive && p.invuln <= 0) {
      for (const b of [...g.foeBullets]) {
        if (collideCircles(b, p, 0.8)) {
          g.foeBullets = g.foeBullets.filter((x) => x !== b);
          damagePlayer(g, sfx);
          break;
        }
      }
    }
  }

  // Embers and power-ups vs the player.
  if (p.alive) {
    for (const e of [...g.embers]) {
      if (collideCircles(e, p, 1.4)) {
        g.embers = g.embers.filter((x) => x !== e);
        g.stats.cores += 1;
        g.combo = Math.min(CFG.combo.max, g.combo + 1);
        g.comboTimer = CFG.combo.windowSeconds;
        g.score += CFG.combo.emberScore * g.combo;
        spawnExplosion(g, e.x, e.y, CFG.colors.ember, 5, false);
        if (sfx) sfx.pickup(g.combo);
      }
    }
    for (const pw of [...g.powers]) {
      if (collideCircles(pw, p, 1.3)) {
        g.powers = g.powers.filter((x) => x !== pw);
        g.stats.powers += 1;
        if (pw.ptype === 'shield') {
          p.shield = true;
          spawnFloat(g, p.x, p.y - 34, 'SHIELD UP', '#38bdf8');
        } else if (pw.ptype === 'slow') {
          p.slowT = CFG.powers.slowSeconds;
          spawnFloat(g, p.x, p.y - 34, 'SLOW TIME', '#c084fc');
        } else {
          p.spreadT = CFG.powers.spreadSeconds;
          spawnFloat(g, p.x, p.y - 34, 'SPREAD SHOT', '#4ade80');
        }
        if (sfx) sfx.power();
      }
    }
  }
}
