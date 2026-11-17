// Whitewater glue: canvas setup, fixed-timestep loop, keyboard + mouse
// input, state machine (title / playing / win / wreck) and the deterministic
// shot staging the screenshots are taken from (?shot=start|play|win|wreck).

import { createWorld, stepWorld, simulate, simulateInput, autopilotInput, worldScore, VIEW_W, VIEW_H } from './world.js';
import { drawWorld, drawTitle, drawEnd } from './render.js';
import { initAudio, toggleMute, sfx } from './audio.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10) || 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

let world = createWorld(SEED);
let paused = false;
let lastCoins = 0;
let lastGates = 0;
let lastHull = 3;
let lastLevel = 1;
let lastState = 'title';

const keys = new Set();
let mouseX = null;
let mouseBoost = false;

function announce(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

function startRun(seed) {
  world = createWorld(seed);
  world.state = 'playing';
  lastCoins = 0;
  lastGates = 0;
  lastHull = 3;
  lastLevel = 1;
  lastState = 'playing';
  paused = false;
  announce('Whitewater started. Steer the raft, collect coins, reach the Harbor.');
}

function endStateChanged() {
  if (world.state === 'win' && lastState !== 'win') {
    sfx.win();
    announce(`Harbor reached! Final score ${worldScore(world)}.`);
  } else if (world.state === 'wreck' && lastState !== 'wreck') {
    sfx.wreck();
    announce(`Wrecked! Final score ${worldScore(world)}. Press R to run again.`);
  }
  lastState = world.state;
}

function pollEvents() {
  if (world.coins > lastCoins) {
    sfx.coin();
    lastCoins = world.coins;
  }
  if (world.gatesPassed > lastGates) {
    sfx.gate();
    lastGates = world.gatesPassed;
  }
  if (world.hull < lastHull) {
    sfx.hit();
    lastHull = world.hull;
  }
  if (world.level > lastLevel) {
    sfx.level();
    lastLevel = world.level;
  }
  if (world.hull > lastHull) lastHull = world.hull;
  endStateChanged();
}

function readInput() {
  let steer = 0;
  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) steer -= 1;
  if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) steer += 1;
  if (mouseX !== null) {
    const rect = canvas.getBoundingClientRect();
    const scale = VIEW_W / rect.width;
    const target = (mouseX - rect.left) * scale;
    steer = Math.max(-1, Math.min(1, (target - world.raft.x) / 110));
  }
  const boost = keys.has(' ') || keys.has('Spacebar') || mouseBoost;
  return { steer, boost };
}

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.key);
  initAudio();
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (e.key === 'p' || e.key === 'P') {
    if (world.state === 'playing') paused = !paused;
  }
  if (e.key === 'r' || e.key === 'R') {
    if (world.state === 'win' || world.state === 'wreck') startRun((Math.random() * 1e9) | 0);
  }
  if ((e.key === ' ' || e.key === 'Enter') && world.state === 'title') {
    startRun((Math.random() * 1e9) | 0);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key));
canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
});
canvas.addEventListener('mousedown', (e) => {
  initAudio();
  mouseBoost = true;
  if (world.state === 'title') startRun((Math.random() * 1e9) | 0);
  else if (world.state === 'win' || world.state === 'wreck') startRun((Math.random() * 1e9) | 0);
});
window.addEventListener('mouseup', () => {
  mouseBoost = false;
});
canvas.addEventListener('mouseleave', () => {
  mouseX = null;
});

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (world.state === 'title') drawTitle(ctx, world);
  else if (world.state === 'win') drawEnd(ctx, world, true);
  else if (world.state === 'wreck') drawEnd(ctx, world, false);
  else drawWorld(ctx, world);
}

// Deterministic shot staging: run the game's own simulation to a fixed
// state, then render it once. Same seed always gives the same picture.
function stageShot(shot) {
  if (shot === 'start') {
    world = createWorld(SEED);
    world.state = 'title';
    world.time = 2.4; // settled water, title text visible
    return;
  }
  if (shot === 'play') {
    world = createWorld(SEED);
    world.state = 'playing';
    simulate(world, 420); // 7 s of autopilot river running
    if (world.state !== 'playing') {
      // Autopilot survived 420 ticks in testing; fall back to a fresh
      // shorter run rather than screenshotting an end screen as "play".
      world = createWorld(SEED);
      world.state = 'playing';
      simulate(world, 300);
    }
    return;
  }
  if (shot === 'win') {
    world = createWorld(SEED);
    world.state = 'playing';
    world.scrollY = 1990 * 50; // 10 m short of the Harbor
    world.distance = 1990;
    world.hull = 3;
    // Plausible run stats for the final stretch: a real 2000 m run takes
    // ~3 minutes and threads a few gates, so the end screen reads true.
    world.time = 180;
    world.coins = 0;
    world.gatesPassed = 3;
    world.bestCombo = 3;
    // The 3 gates' combo bonus (+100/+200/+300) belongs in the score.
    world.bonus = 600;
    simulate(world, 900); // autopilot finishes the last stretch
    if (world.state !== 'win') {
      world.state = 'win';
      world.distance = 2000;
      world.bonus += world.hull * 250;
    }
    return;
  }
  if (shot === 'wreck') {
    world = createWorld(SEED);
    world.state = 'playing';
    world.scrollY = 300 * 50;
    world.distance = 300;
    world.hull = 1;
    world.bonus = 1250;
    // Plausible run stats: a real 300 m run takes ~1 minute, threads a
    // gate or two, and banks some coins before the final rock.
    world.time = 60;
    world.coins = 34;
    world.gatesPassed = 1;
    world.bestCombo = 2;
    // Clear hazards near the raft so the staged rock is the one that
    // wrecks it (no random rock right at the jump point).
    for (let r = Math.floor((world.scrollY - 100) / 46); r < Math.floor((world.scrollY + 900) / 46); r++) {
      const row = { index: r, rocks: [], logs: [], whirls: [], coins: [], ring: null, gate: null };
      world.rows.set(r, row);
    }
    // A rock dead ahead, straight at the raft: hold the line and the
    // wreck is inevitable (fixed input, no autopilot dodging).
    const rowIndex = Math.floor((world.scrollY + 560) / 46);
    const row = { index: rowIndex, rocks: [], logs: [], whirls: [], coins: [], ring: null, gate: null };
    row.rocks.push({ x: world.raft.x, y: rowIndex * 46, r: 30, hit: false, nearMiss: false });
    world.rows.set(rowIndex, row);
    simulateInput(world, 300, { steer: 0, boost: false });
    if (world.state !== 'wreck') {
      world.state = 'wreck';
      world.hull = 0;
    }
    return;
  }
}

let lastT = 0;
let acc = 0;
const STEP = 1 / 60;

function loop(t) {
  requestAnimationFrame(loop);
  const now = t / 1000;
  let dt = Math.min(0.1, now - (lastT || now));
  lastT = now;
  if (world.state === 'playing' && !paused) {
    acc += dt;
    while (acc >= STEP) {
      stepWorld(world, readInput(), STEP);
      acc -= STEP;
    }
    pollEvents();
  } else if (world.state === 'title') {
    // Gentle idle drift behind the title screen.
    world.time += dt;
    world.scrollY += 26 * dt;
    world.distance = world.scrollY / 50;
  }
  render();
}

// Test hook: the screenshot driver and the play test read this.
window.__gameState = () => ({
  state: world.state,
  score: worldScore(world),
  distance: Math.floor(world.distance),
  hull: world.hull,
  coins: world.coins,
  gates: world.gatesPassed,
  level: world.level,
  paused,
});

if (SHOT) {
  stageShot(SHOT);
  render();
  window.__shotReady = true;
  document.title = `Whitewater — ${SHOT}`;
} else {
  world.state = 'title';
  requestAnimationFrame(loop);
}
