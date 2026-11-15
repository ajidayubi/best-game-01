// EMBER DRIFT — config.js
// Every tunable number and colour of the game lives here, in one place.

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

export const PALETTE = {
  backgroundTop: '#070312',
  backgroundBottom: '#12082e',
  emberOrange: '#ff9a1f',
  emberGold: '#ffd23e',
  emberRed: '#ff4d2e',
  cyan: '#37e6ff',
  magenta: '#ff4fd8',
  violet: '#8b5cff',
  mint: '#4dffa6',
  white: '#f4f6ff',
  dimWhite: '#9aa3c7',
  asteroidGrey: '#8d93ad',
  asteroidDark: '#565d78',
};

export const PLAYER = {
  radius: 18,
  speed: 340,
  accel: 2400,
  friction: 0.88,
  fireCooldown: 0.16,
  bulletSpeed: 720,
  maxLives: 3,
  invulnerableSeconds: 2.0,
  respawnSeconds: 1.2,
};

export const WAVES = {
  baseAsteroids: 6,
  asteroidsPerWave: 3,
  maxAsteroids: 42,
  bossEvery: 5,
  waveClearBonus: 250,
  emberScore: 25,
  asteroidScore: 50,
  bossScore: 1500,
};

export const POWERUPS = {
  shieldSeconds: 8,
  slowSeconds: 6,
  spreadSeconds: 10,
  dropChance: 0.22,
};

export const COMBO = {
  windowSeconds: 4,
  maxMultiplier: 8,
};
