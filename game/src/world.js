// Whitewater world model: pure game logic, no DOM, no canvas.
// The browser game and the node simulation test share this module, so the
// rules stay identical in both. Everything is deterministic for a given
// (seed, input) pair: river rows are generated per row index from a hash,
// never from frame timing.

import { mulberry32, hash2, range, clamp } from './rng.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const ROW_H = 46;
export const PX_PER_M = 50;
export const FINISH_M = 2000;
export const RAFT_Y = 560;
export const MAX_HULL = 3;
export const MAX_LEVEL = 8;

export function levelAt(distanceM) {
  return Math.min(MAX_LEVEL, 1 + Math.floor(distanceM / 250));
}

// River centre x at a given travelled distance (px). Gentle S-curves.
export function riverCenter(distancePx) {
  return (
    VIEW_W / 2 +
    110 * Math.sin(distancePx * 0.00022) +
    45 * Math.sin(distancePx * 0.00051 + 1.7)
  );
}

export function riverHalfWidth(distanceM) {
  return Math.max(190, 300 - 12 * (levelAt(distanceM) - 1));
}

function rowRng(seed, rowIndex) {
  return mulberry32(hash2(seed, rowIndex + 1));
}

// Build one river row. Rows are 46 px tall; row r covers travelled
// distance [r*46, (r+1)*46) px. Content is a pure function of (seed, r).
export function buildRow(seed, rowIndex) {
  const rng = rowRng(seed, rowIndex);
  const dPx = rowIndex * ROW_H;
  const dM = dPx / PX_PER_M;
  const level = levelAt(dM);
  const cx = riverCenter(dPx);
  const half = riverHalfWidth(dM);
  const row = { index: rowIndex, rocks: [], logs: [], whirls: [], coins: [], ring: null, gate: null };

  // Opening stretch (first 12 rows): calm water with a few coins only,
  // so the player never spawns into a rock.
  if (rowIndex >= 0 && rowIndex < 12) {
    if (rowIndex >= 2 && rowIndex % 3 === 0) {
      const baseX = cx + range(rng, -80, 80);
      for (let i = 0; i < 3; i++) {
        row.coins.push({ x: baseX + (i - 1) * 44, y: dPx - i * 30, taken: false });
      }
    }
    return row;
  }

  // Gates: one every ~180 m, never in the first 120 m.
  if (rowIndex > 0 && rowIndex % 196 === 0) {
    const gx = cx + range(rng, -70, 70);
    row.gate = { x: gx, halfSpan: 95, passed: false, y: dPx };
    // A gate row is clear of rocks so the gate itself is the challenge.
    return row;
  }

  // Rescue ring: rare, about once every 600 m.
  if (rowIndex > 200 && rowIndex % 552 === 0) {
    row.ring = { x: cx + range(rng, -half + 70, half - 70), y: dPx, taken: false };
  }

  const density = 0.34 + level * 0.045; // rows with a hazard
  if (rng() < density) {
    const kind = rng();
    const x = cx + range(rng, -half + 55, half - 55);
    if (kind < 0.55) {
      row.rocks.push({ x, y: dPx + range(rng, -12, 12), r: range(rng, 20, 34), hit: false, nearMiss: false });
      if (rng() < 0.3) {
        row.rocks.push({
          x: clamp(x + range(rng, -220, 220), cx - half + 55, cx + half - 55),
          y: dPx + range(rng, -12, 12),
          r: range(rng, 18, 28),
          hit: false,
          nearMiss: false,
        });
      }
    } else if (kind < 0.82) {
      row.logs.push({ x, y: dPx, len: range(rng, 90, 150), drift: range(rng, -14, 14), hit: false, nearMiss: false });
    } else {
      row.whirls.push({ x, y: dPx, r: range(rng, 34, 46), hit: false });
    }
  }

  // Coins: lines and arcs, about every third row.
  if (rng() < 0.34) {
    const baseX = cx + range(rng, -half + 80, half - 80);
    const n = 3 + Math.floor(rng() * 3);
    const arc = rng() < 0.5;
    for (let i = 0; i < n; i++) {
      const off = arc ? Math.sin((i / (n - 1)) * Math.PI) * 55 : 0;
      row.coins.push({
        x: clamp(baseX + (arc ? (i - (n - 1) / 2) * 44 : 0) + off * 0.4, cx - half + 40, cx + half - 40),
        y: dPx - i * 34,
        taken: false,
      });
    }
  }

  return row;
}

export function createWorld(seed) {
  return {
    seed,
    state: 'title', // title | playing | win | wreck
    scrollY: 0,
    distance: 0,
    bonus: 0,
    coins: 0,
    gatesPassed: 0,
    gatesMissed: 0,
    combo: 0,
    bestCombo: 0,
    hull: MAX_HULL,
    level: 1,
    speed: 0,
    stamina: 100,
    time: 0,
    raft: { x: VIEW_W / 2, vx: 0, tilt: 0 },
    rows: new Map(),
    particles: [],
    floats: [],
    shake: 0,
    invuln: 0,
    banner: null,
    bannerT: 0,
    nearMisses: 0,
    hits: 0,
    rowsGenerated: 0,
  };
}

export function worldScore(w) {
  return Math.floor(w.distance * 2) + w.bonus;
}

function getRow(w, index) {
  let row = w.rows.get(index);
  if (!row) {
    row = buildRow(w.seed, index);
    w.rows.set(index, row);
    w.rowsGenerated++;
    // Keep memory bounded: drop rows far behind the raft.
    if (w.rows.size > 90) {
      const min = index - 80;
      for (const k of w.rows.keys()) if (k < min) w.rows.delete(k);
    }
  }
  return row;
}

// Screen y of a world point: objects flow down the screen as we travel.
export function screenY(w, worldYPx) {
  return w.scrollY - worldYPx + 780;
}

function addParticles(w, x, y, kind, n) {
  const rng = mulberry32(hash2(w.seed, Math.floor(w.time * 60) + n * 7919 + (kind === 'splash' ? 3 : 7)));
  for (let i = 0; i < n; i++) {
    w.particles.push({
      x: x + range(rng, -18, 18),
      y: y + range(rng, -10, 10),
      vx: range(rng, -90, 90),
      vy: range(rng, -140, -20),
      life: range(rng, 0.35, 0.7),
      maxLife: 0.7,
      size: range(rng, 2, 5),
      kind,
    });
  }
}

function addFloat(w, x, y, text, color) {
  // Stagger simultaneous popups so a coin "+25" never prints on top of a
  // "CLOSE! +15" at the same spot.
  const stack = w.floats.filter((f) => f.life > 0.7).length;
  w.floats.push({ x, y: y - (stack % 3) * 24, text, life: 1.1, color });
}

function hitRaft(w, x, y) {
  if (w.invuln > 0 || w.state !== 'playing') return;
  w.hull--;
  w.hits++;
  w.combo = 0;
  w.invuln = 1.4;
  w.shake = 14;
  w.speed *= 0.55;
  w.raft.vx += (w.raft.x >= x ? 1 : -1) * 320;
  addParticles(w, w.raft.x, RAFT_Y, 'splash', 22);
  addFloat(w, w.raft.x, RAFT_Y - 60, 'HULL -1', '#ff6b5e');
  if (w.hull <= 0) {
    w.state = 'wreck';
    addParticles(w, w.raft.x, RAFT_Y, 'splash', 40);
    addParticles(w, w.raft.x, RAFT_Y, 'wood', 16);
  }
}

// Autopilot: a rollout planner. It samples candidate x positions across
// the channel, then simulates the raft steering toward each one for the
// next 0.75 s (same lateral dynamics as the real game) and checks for
// collisions with every hazard as it descends. A candidate is usable only
// if the rollout survives it; among usable candidates it prefers coins,
// gates, and staying near the current position. Pure function of world
// state, so shot-mode runs are deterministic.
export function autopilotInput(w) {
  const cxAhead = riverCenter(w.scrollY + 260);
  const half = riverHalfWidth(w.distance);
  const minX = cxAhead - half + 55;
  const maxX = cxAhead + half - 55;
  const hazards = [];
  let coinTarget = null;
  let coinDy = 1e9;
  let gateTarget = null;
  for (let r = Math.floor((w.scrollY - 100) / ROW_H); r < Math.floor((w.scrollY + 900) / ROW_H); r++) {
    const row = getRow(w, r);
    for (const rock of row.rocks) {
      const sy = screenY(w, rock.y);
      if (sy > 80 && sy < 640) hazards.push({ x: rock.x, sy, r: rock.r + 26, kind: 'rock' });
    }
    for (const log of row.logs) {
      const sy = screenY(w, log.y);
      if (sy > 80 && sy < 640) hazards.push({ x: log.x, sy, r: log.len / 2 + 22, kind: 'log', len: log.len });
    }
    for (const whirl of row.whirls) {
      const sy = screenY(w, whirl.y);
      if (sy > 80 && sy < 640) hazards.push({ x: whirl.x, sy, r: whirl.r, kind: 'whirl' });
    }
    if (row.gate && !row.gate.passed) {
      const sy = screenY(w, row.gate.y);
      if (sy > 60 && sy < 600) gateTarget = row.gate;
    }
  }
  // Coins: only chase one that is not parked next to a hazard.
  for (let r = Math.floor((w.scrollY - 100) / ROW_H); r < Math.floor((w.scrollY + 900) / ROW_H); r++) {
    const row = getRow(w, r);
    for (const c of row.coins) {
      if (c.taken) continue;
      const sy = screenY(w, c.y);
      if (sy <= 60 || sy >= 420 || Math.abs(c.x - w.raft.x) >= 260 || sy >= coinDy) continue;
      let safe = true;
      for (const hz of hazards) {
        if (Math.hypot(c.x - hz.x, sy - hz.sy) < hz.r + 60) {
          safe = false;
          break;
        }
      }
      if (safe) {
        coinDy = sy;
        coinTarget = c;
      }
    }
  }

  const dt = 1 / 60;
  const TICKS = 45;
  function rollout(targetX) {
    let x = w.raft.x;
    let vx = w.raft.vx;
    for (let i = 1; i <= TICKS; i++) {
      const steer = clamp((targetX - x) / 90, -1, 1);
      vx += steer * 2600 * dt;
      vx *= Math.max(0, 1 - dt * 4.2);
      vx = clamp(vx, -540, 540);
      x += vx * dt;
      if (x < minX) {
        x = minX;
        vx = Math.abs(vx) * 0.4;
      } else if (x > maxX) {
        x = maxX;
        vx = -Math.abs(vx) * 0.4;
      }
      for (const hz of hazards) {
        const sy = hz.sy + w.speed * dt * i;
        const dy = sy - 560;
        if (dy < -70 || dy > 70) continue;
        const dx = hz.x - x;
        if (hz.kind === 'log') {
          if (Math.abs(dx) < hz.len / 2 + 22 && Math.abs(dy) < 30) return i;
        } else if (hz.kind === 'whirl') {
          if (Math.hypot(dx, dy) < hz.r * 0.55) return i;
          // Whirlpools also drag the raft toward them.
          const dist = Math.hypot(dx, dy);
          if (dist < 200 && dist > 1) x += (dx / dist) * 130 * dt * (1 - dist / 220);
        } else if (Math.hypot(dx, dy) < hz.r + 6) {
          return i;
        }
      }
    }
    return TICKS + 1; // survived the whole lookahead
  }

  let bestX = w.raft.x;
  let bestScore = -1e9;
  for (let x = minX; x <= maxX; x += 30) {
    const survived = rollout(x);
    let score;
    if (survived <= TICKS) {
      score = -10000 + survived * 10; // prefer surviving longer
    } else {
      score = 0;
      score -= Math.abs(x - w.raft.x) * 0.15;
      score -= Math.abs(x - cxAhead) * 0.05;
      if (coinTarget) score -= Math.abs(x - coinTarget.x) * 0.08;
      if (gateTarget && Math.abs(x - gateTarget.x) < gateTarget.halfSpan - 15) score += 40;
    }
    if (score > bestScore) {
      bestScore = score;
      bestX = x;
    }
  }
  const steer = clamp((bestX - w.raft.x) / 90, -1, 1);
  return { steer, boost: false };
}

export function stepWorld(w, input, dt) {
  if (w.state !== 'playing') return;
  w.time += dt;
  if (w.invuln > 0) w.invuln -= dt;
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 26);
  if (w.bannerT > 0) w.bannerT -= dt;

  const level = levelAt(w.distance);
  if (level !== w.level) {
    w.level = level;
    w.banner = `RAPIDS LEVEL ${level}`;
    w.bannerT = 1.6;
  }

  const boosting = input.boost && w.stamina > 1;
  const targetSpeed = (240 + (w.level - 1) * 30) * (boosting ? 1.45 : 1);
  w.speed += (targetSpeed - w.speed) * Math.min(1, dt * 2.2);
  if (boosting) w.stamina = Math.max(0, w.stamina - dt * 30);
  else w.stamina = Math.min(100, w.stamina + dt * 18);

  w.scrollY += w.speed * dt;
  w.distance = w.scrollY / PX_PER_M;

  // Raft steering.
  const steer = clamp(input.steer || 0, -1, 1);
  w.raft.vx += steer * 2600 * dt;
  w.raft.vx *= Math.max(0, 1 - dt * 4.2);
  w.raft.vx = clamp(w.raft.vx, -540, 540);
  w.raft.x += w.raft.vx * dt;
  w.raft.tilt += (clamp(w.raft.vx / 540, -1, 1) * 0.22 - w.raft.tilt) * Math.min(1, dt * 10);

  // Banks block the raft: scrape, slow, shake, no hull damage.
  const cx = riverCenter(w.scrollY + 220);
  const half = riverHalfWidth(w.distance);
  const minX = cx - half + 46;
  const maxX = cx + half - 46;
  if (w.raft.x < minX) {
    w.raft.x = minX;
    w.raft.vx = Math.abs(w.raft.vx) * 0.4;
    w.speed *= 0.995;
  } else if (w.raft.x > maxX) {
    w.raft.x = maxX;
    w.raft.vx = -Math.abs(w.raft.vx) * 0.4;
    w.speed *= 0.995;
  }

  // Rows in view: worldY from just behind the raft to the top of the
  // screen (larger worldY is further ahead, i.e. higher on screen).
  const firstRow = Math.max(0, Math.floor((w.scrollY - 120) / ROW_H));
  const lastRow = Math.floor((w.scrollY + 900) / ROW_H);
  for (let r = firstRow; r <= lastRow; r++) {
    const row = getRow(w, r);
    for (const rock of row.rocks) {
      const sy = screenY(w, rock.y);
      const dx = rock.x - w.raft.x;
      const dy = sy - RAFT_Y;
      const dist = Math.hypot(dx, dy);
      if (dist < rock.r + 26) {
        if (!rock.hit) {
          rock.hit = true;
          hitRaft(w, rock.x, sy);
        }
      } else if (!rock.nearMiss && sy > RAFT_Y + 10 && sy < RAFT_Y + 90 && dist < rock.r + 62) {
        rock.nearMiss = true;
        w.nearMisses++;
        w.bonus += 15;
        addFloat(w, w.raft.x, RAFT_Y - 70, 'CLOSE! +15', '#ffd23f');
      }
    }
    for (const log of row.logs) {
      const sy = screenY(w, log.y);
      const dx = Math.abs(log.x - w.raft.x);
      const dy = Math.abs(sy - RAFT_Y);
      if (dx < log.len / 2 + 22 && dy < 30) {
        if (!log.hit) {
          log.hit = true;
          hitRaft(w, log.x, sy);
        }
      } else if (!log.nearMiss && sy > RAFT_Y + 10 && sy < RAFT_Y + 80 && dx < log.len / 2 + 60 && dy < 70) {
        log.nearMiss = true;
        w.nearMisses++;
        w.bonus += 15;
        addFloat(w, w.raft.x, RAFT_Y - 70, 'CLOSE! +15', '#ffd23f');
      }
    }
    for (const whirl of row.whirls) {
      const sy = screenY(w, whirl.y);
      const dx = whirl.x - w.raft.x;
      const dy = sy - RAFT_Y;
      const dist = Math.hypot(dx, dy);
      if (dist < 200 && dist > 1) {
        // Whirlpools drag the raft toward their centre.
        w.raft.x += (dx / dist) * 130 * dt * (1 - dist / 220);
      }
      if (dist < whirl.r * 0.55) {
        if (!whirl.hit) {
          whirl.hit = true;
          hitRaft(w, whirl.x, sy);
        }
      }
    }
    for (const coin of row.coins) {
      if (coin.taken) continue;
      const sy = screenY(w, coin.y);
      if (Math.hypot(coin.x - w.raft.x, sy - RAFT_Y) < 42) {
        coin.taken = true;
        w.coins++;
        w.bonus += 25;
        addParticles(w, coin.x, sy, 'spark', 8);
        addFloat(w, coin.x, sy - 24, '+25', '#ffd23f');
      }
    }
    if (row.ring && !row.ring.taken) {
      const sy = screenY(w, row.ring.y);
      if (Math.hypot(row.ring.x - w.raft.x, sy - RAFT_Y) < 46) {
        row.ring.taken = true;
        w.hull = Math.min(MAX_HULL, w.hull + 1);
        w.bonus += 50;
        addFloat(w, row.ring.x, sy - 24, 'HULL +1', '#7dff8a');
      }
    }
    if (row.gate && !row.gate.passed) {
      const sy = screenY(w, row.gate.y);
      if (sy > RAFT_Y) {
        row.gate.passed = true;
        if (Math.abs(w.raft.x - row.gate.x) < row.gate.halfSpan) {
          w.gatesPassed++;
          w.combo = Math.min(5, w.combo + 1);
          w.bestCombo = Math.max(w.bestCombo, w.combo);
          const pts = 100 * w.combo;
          w.bonus += pts;
          addFloat(w, w.raft.x, RAFT_Y - 70, `GATE! +${pts}`, '#7dff8a');
          addParticles(w, w.raft.x, RAFT_Y - 20, 'spark', 12);
        } else {
          w.gatesMissed++;
          w.combo = 0;
        }
      }
    }
  }

  // Paddle splash particles while moving.
  if (Math.floor(w.time * 20) !== Math.floor((w.time - dt) * 20)) {
    addParticles(w, w.raft.x + (w.raft.vx > 0 ? -24 : 24), RAFT_Y + 34, 'wake', 1);
  }

  // Update particles and floating texts.
  for (const p of w.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= dt;
  }
  w.particles = w.particles.filter((p) => p.life > 0);
  for (const f of w.floats) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  w.floats = w.floats.filter((f) => f.life > 0);

  // Win: reach the Harbor at 2000 m.
  if (w.distance >= FINISH_M && w.state === 'playing') {
    w.state = 'win';
    w.bonus += w.hull * 250;
    addParticles(w, w.raft.x, RAFT_Y, 'spark', 40);
  }
}

// Run a fixed number of ticks with the autopilot; returns ticks run.
export function simulate(w, ticks, dt = 1 / 60) {
  let run = 0;
  for (let i = 0; i < ticks && w.state === 'playing'; i++) {
    stepWorld(w, autopilotInput(w), dt);
    run++;
  }
  return run;
}

// Run a fixed number of ticks with a constant input (used to stage a
// wreck: the raft holds its line and runs into the rock ahead).
export function simulateInput(w, ticks, input, dt = 1 / 60) {
  let run = 0;
  for (let i = 0; i < ticks && w.state === 'playing'; i++) {
    stepWorld(w, input, dt);
    run++;
  }
  return run;
}

// Deterministic snapshot for equality checks in tests.
export function snapshot(w) {
  return JSON.stringify({
    d: Math.round(w.distance * 100) / 100,
    s: worldScore(w),
    c: w.coins,
    h: w.hull,
    x: Math.round(w.raft.x * 100) / 100,
    st: w.state,
    g: w.gatesPassed,
    n: w.nearMisses,
  });
}
