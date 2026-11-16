// The wave director for Ember Drift: how many foes a wave throws at the
// player, which kinds unlock when, how fast they arrive, and when the boss
// shows up. The curve is tuned so wave 1 is a warm-up and every wave after
// feels denser than the last.
import { CFG } from './config.js';
import { spawnFoe, spawnBoss } from './entities.js';

export class Director {
  constructor(g) {
    this.g = g;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.bossSpawned = false;
  }

  startWave(n) {
    const g = this.g;
    g.wave = n;
    g.phase = 'banner';
    g.phaseT = 0;
    g.speedScale = Math.min(CFG.waves.maxSpeedScale, 1 + (n - 1) * CFG.waves.speedScalePerWave);
    this.bossSpawned = false;
    if (n % CFG.waves.bossEvery === 0) {
      this.toSpawn = 0;
    } else {
      this.toSpawn = CFG.waves.baseBudget + (n - 1) * CFG.waves.budgetPerWave;
    }
    this.spawnTimer = 0.6;
    const isBoss = n % CFG.waves.bossEvery === 0;
    g.banner = {
      title: isBoss ? 'EMBER WARDEN' : `WAVE ${n}`,
      sub: isBoss ? 'The field boss has arrived' : this.waveHint(n),
      t: 0,
      dur: 2.2,
    };
  }

  waveHint(n) {
    if (n === 1) return 'Collect embers — build your combo';
    if (n === 2) return 'Chaser drones have joined the field';
    if (n === 3) return 'Splitters break into shards — watch the pieces';
    if (n === 4) return 'Armored rocks take three hits';
    return 'Hold the line, pilot';
  }

  // Kinds available at this wave, weighted so rocks stay the backbone and
  // the nastier kinds arrive gradually.
  pickKind(n) {
    const rng = this.g.rng;
    const roll = rng.float();
    if (n >= 4 && roll < 0.14) return 'armored';
    if (n >= 3 && roll < 0.32) return 'splitter';
    if (n >= 2 && roll < 0.55) return 'chaser';
    return 'rock';
  }

  spawnOne() {
    const g = this.g;
    const kind = this.pickKind(g.wave);
    const edge = g.rng.float();
    let x;
    let y;
    if (edge < 0.6) {
      x = g.rng.range(40, CFG.width - 40);
      y = -40;
    } else if (edge < 0.8) {
      x = -40;
      y = g.rng.range(40, CFG.height * 0.45);
    } else {
      x = CFG.width + 40;
      y = g.rng.range(40, CFG.height * 0.45);
    }
    spawnFoe(g, kind, x, y);
    this.toSpawn -= 1;
  }

  interval() {
    const n = this.g.wave;
    return Math.max(
      CFG.waves.spawnIntervalMin,
      CFG.waves.spawnIntervalStart - (n - 1) * 0.09,
    );
  }

  update(dt) {
    const g = this.g;
    if (g.phase === 'banner') {
      g.phaseT += dt;
      if (g.phaseT >= 1.6) {
        if (g.wave % CFG.waves.bossEvery === 0 && !this.bossSpawned) {
          this.bossSpawned = true;
          g.phase = 'boss';
          spawnBoss(g, g.wave);
        } else {
          g.phase = 'fight';
        }
        g.phaseT = 0;
      }
      return;
    }
    if (g.phase === 'fight') {
      if (this.toSpawn > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = this.interval();
          this.spawnOne();
        }
      }
    }
  }

  // True when the wave is fully cleared: nothing left to spawn, no foes,
  // and no boss alive.
  cleared() {
    const g = this.g;
    return this.toSpawn <= 0 && g.foes.length === 0 && !g.boss && (g.phase === 'fight' || g.phase === 'boss');
  }
}
