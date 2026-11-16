// Deterministic screenshot scenes for Ember Drift. Each scene builds a
// game state from a seed with fixed 1/60 s steps and scripted inputs only —
// no wall clock, no Math.random — so the same seed always renders the same
// frame, and the renderer can set window.__shotReady on it.
import { createGame, startGame, stepGame } from './sim.js';
import { scriptedInput } from './input.js';
import { spawnFoe, spawnEmber, spawnBoss } from './entities.js';
import { Sfx } from './audio.js';

const STEP = 1 / 60;

// Keep the scripted pilot alive through a scene: if it dies, put it back
// in the field instead of letting the scene end on a game-over screen.
function keepPilotAlive(g) {
  const p = g.player;
  if (g.mode !== 'playing') return;
  if (!p.alive) {
    p.alive = true;
    p.x = 640;
    p.y = 600;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 0;
    p.shield = true;
  }
  if (g.lives <= 0) g.lives = 3;
}

export function buildShot(kind, seed) {
  const sfx = new Sfx(); // never unlocked: every call is a silent no-op

  if (kind === 'start') {
    return createGame(seed);
  }

  if (kind === 'play') {
    const g = createGame(seed);
    startGame(g, sfx);
    g.director.startWave(3);
    g.phase = 'fight';
    g.phaseT = 0;
    g.director.toSpawn = 40; // keep the field busy for the whole scene
    spawnFoe(g, 'rock', 300, 140);
    spawnFoe(g, 'chaser', 700, 120);
    spawnFoe(g, 'splitter', 980, 200);
    spawnFoe(g, 'armored', 500, 90);
    spawnFoe(g, 'rock', 150, 300);
    spawnFoe(g, 'chaser', 1100, 260);
    spawnEmber(g, 420, 320);
    spawnEmber(g, 860, 380);
    spawnEmber(g, 640, 240);
    for (let t = 0; t < 480; t++) {
      stepGame(g, STEP, scriptedInput(t), sfx);
      keepPilotAlive(g);
    }
    return g;
  }

  if (kind === 'boss') {
    const g = createGame(seed);
    startGame(g, sfx);
    g.director.startWave(5);
    g.phase = 'boss';
    g.phaseT = 0;
    spawnBoss(g, 5);
    spawnFoe(g, 'chaser', 300, 200);
    spawnFoe(g, 'rock', 900, 160);
    for (let t = 0; t < 360; t++) {
      stepGame(g, STEP, scriptedInput(t), sfx);
      keepPilotAlive(g);
    }
    if (!g.boss) {
      spawnBoss(g, 5);
      g.boss.hp = Math.floor(g.boss.maxHp * 0.6);
    }
    return g;
  }

  // end: a game-over screen over a quiet, drifting field.
  const g = createGame(seed);
  g.mode = 'over';
  g.score = 12450;
  g.wave = 7;
  g.player.alive = false;
  g.end = { score: 12450, wave: 7, kills: 86, cores: 41, best: 12450, isBest: true };
  for (let i = 0; i < 4; i++) {
    spawnFoe(g, 'rock', g.rng.range(100, 1180), g.rng.range(80, 420));
  }
  return g;
}
