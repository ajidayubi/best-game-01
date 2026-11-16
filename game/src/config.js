// All tuning for Ember Drift in one place: canvas size, palette, speeds,
// spawn pacing, scoring and the difficulty curve. Nothing here is read from
// anywhere else, so balancing the game means editing this file alone.
export const CFG = {
  width: 1280,
  height: 720,
  step: 1 / 60,

  // Palette: deep space, neon cyan ship, ember orange pickups.
  colors: {
    spaceTop: '#04040f',
    spaceBottom: '#0b0b26',
    nebulaViolet: '#6b21a8',
    nebulaTeal: '#0e7490',
    nebulaEmber: '#ff6b1a',
    player: '#22d3ee',
    playerCore: '#ecfeff',
    flame: '#fb923c',
    bullet: '#a5f3fc',
    foeBullet: '#f87171',
    ember: '#ffb703',
    emberCore: '#fff7cc',
    rock: '#94a3b8',
    rockRim: '#f97316',
    chaser: '#e879f9',
    splitter: '#fbbf24',
    shard: '#fcd34d',
    armored: '#64748b',
    shieldRing: '#38bdf8',
    boss: '#ef4444',
    bossCore: '#fbbf24',
    hud: '#f8fafc',
    hudDim: '#94a3b8',
    danger: '#f87171',
  },

  player: {
    radius: 14,
    accel: 1500,
    maxSpeed: 430,
    drag: 2.6,
    fireCooldown: 0.14,
    bulletSpeed: 760,
    invulnSeconds: 2.0,
    startLives: 3,
  },

  combo: {
    max: 8,
    windowSeconds: 4.0,
    emberScore: 25,
  },

  waves: {
    // Wave 1 is gentle on purpose: slow rocks only, so the first 30 seconds
    // feel good. Density and speed ramp up from there.
    baseBudget: 6,
    budgetPerWave: 3,
    spawnIntervalStart: 1.25,
    spawnIntervalMin: 0.42,
    speedScalePerWave: 0.06,
    maxSpeedScale: 1.65,
    clearBonusPerWave: 250,
    bossEvery: 5,
    bossBaseHp: 55,
    bossHpPerBoss: 25,
  },

  drops: {
    emberChance: 0.6,
    powerChance: 0.08,
    bossEmbers: 6,
  },

  powers: {
    slowSeconds: 5,
    spreadSeconds: 8,
  },

  scoring: {
    rock: 50,
    chaser: 100,
    splitter: 80,
    shard: 30,
    armored: 150,
    boss: 2000,
  },
};
