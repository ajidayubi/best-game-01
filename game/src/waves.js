// EMBER DRIFT — waves.js
// Wave pacing: how many asteroids a wave throws, when the wave is cleared,
// and the boss that arrives every fifth wave.

import { WAVES } from './config.js';
import { createAsteroid, createBoss } from './entities.js';

export function asteroidsForWave(wave) {
  return Math.min(
    WAVES.maxAsteroids,
    WAVES.baseAsteroids + (wave - 1) * WAVES.asteroidsPerWave,
  );
}

export function isBossWave(wave) {
  return wave % WAVES.bossEvery === 0;
}

export function spawnWave(random, wave, asteroids) {
  const count = asteroidsForWave(wave);
  for (let i = 0; i < count; i += 1) {
    asteroids.push(createAsteroid(random, wave, 'top'));
  }
  return count;
}

export function spawnBoss(random, wave, asteroids, bossSlot) {
  const boss = createBoss(wave);
  bossSlot.current = boss;
  asteroids.push(boss);
  for (let i = 0; i < 4; i += 1) {
    asteroids.push(createAsteroid(random, wave, i % 2 === 0 ? 'left' : 'right'));
  }
  return boss;
}

export function waveIsCleared(asteroids, bossSlot) {
  if (bossSlot.current && !bossSlot.current.dead) return false;
  return asteroids.every((asteroid) => asteroid.dead);
}
