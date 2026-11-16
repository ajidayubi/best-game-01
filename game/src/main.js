// Bootstrap for Ember Drift: wire the canvas, the input and the sound to
// the simulation, run it on a fixed 1/60 s step, and render every frame.
// With ?shot=start|play|boss|end&seed=N it instead builds one deterministic
// scene, renders it once and raises window.__shotReady for screenshots.
import { CFG } from './config.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { createGame, startGame, stepGame, togglePause } from './sim.js';
import { drawScene } from './render.js';
import { buildShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || '1');

if (shot) {
  try {
    const scene = buildShot(shot, seed);
    drawScene(ctx, scene);
    window.__shotReady = true;
  } catch (err) {
    window.__shotError = String((err && err.message) || err);
    throw err;
  }
} else {
  const sfx = new Sfx();
  const input = new Input(canvas);
  const game = createGame(20261116);
  window.__game = game;

  const unlockAudio = () => sfx.unlock();
  window.addEventListener('keydown', unlockAudio);
  canvas.addEventListener('mousedown', unlockAudio);

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(100, now - last);
    last = now;
    acc += elapsed / 1000;
    let steps = 0;
    while (acc >= CFG.step && steps < 5) {
      if (input.wasPressed('Enter') && (game.mode === 'title' || game.mode === 'over')) {
        startGame(game, sfx);
      }
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) togglePause(game);
      if (input.wasPressed('KeyM')) {
        game.muted = !game.muted;
        sfx.setMuted(game.muted);
      }
      if (input.mouseClicked && (game.mode === 'title' || game.mode === 'over')) {
        startGame(game, sfx);
      }
      stepGame(game, CFG.step, input, sfx);
      input.endStep();
      acc -= CFG.step;
      steps += 1;
    }
    if (steps === 5) acc = 0;
    drawScene(ctx, game);
    requestAnimationFrame(frame);
  }
  drawScene(ctx, game);
  requestAnimationFrame(frame);
}
