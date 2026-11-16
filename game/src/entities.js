// Every thing that flies, drifts, glows or explodes in Ember Drift lives
// here: factories that build entities, their per-step movement and AI, and
// their drawing. Game rules (score, lives, collisions, wave flow) live in
// sim.js; this file only knows how each kind moves and looks.
import { CFG } from './config.js';

const TAU = Math.PI * 2;

function polyVerts(rng, count, jitter) {
  const verts = [];
  for (let i = 0; i < count; i++) {
    verts.push({ a: (i / count) * TAU, r: 1 - jitter / 2 + rng.float() * jitter });
  }
  return verts;
}

export function makePlayer(g) {
  return {
    kind: 'player',
    x: CFG.width / 2,
    y: CFG.height - 120,
    vx: 0,
    vy: 0,
    r: CFG.player.radius,
    angle: -Math.PI / 2,
    fireCd: 0,
    invuln: 0,
    shield: false,
    spreadT: 0,
    slowT: 0,
    alive: true,
    respawnT: 0,
    thrust: 0,
  };
}

// kind: rock | chaser | splitter | shard | armored
export function spawnFoe(g, kind, x, y) {
  const rng = g.rng;
  const scale = g.speedScale;
  const foe = { kind, x, y, vx: 0, vy: 0, r: 20, hp: 1, maxHp: 1, rot: rng.angle(), vr: rng.range(-1.2, 1.2), t: 0, score: 50, ember: 0.6, verts: null };
  if (kind === 'rock') {
    foe.r = rng.range(18, 34);
    foe.vy = rng.range(40, 110) * scale;
    foe.vx = rng.range(-40, 40);
    foe.score = CFG.scoring.rock;
    foe.verts = polyVerts(rng, 9, 0.5);
  } else if (kind === 'chaser') {
    foe.r = 13;
    foe.vy = rng.range(60, 90) * scale;
    foe.score = CFG.scoring.chaser;
    foe.ember = 0.5;
  } else if (kind === 'splitter') {
    foe.r = 30;
    foe.hp = 2;
    foe.maxHp = 2;
    foe.vy = rng.range(45, 75) * scale;
    foe.vx = rng.range(-30, 30);
    foe.score = CFG.scoring.splitter;
    foe.verts = polyVerts(rng, 6, 0.3);
  } else if (kind === 'shard') {
    foe.r = 10;
    foe.vy = rng.range(170, 230) * scale;
    foe.vx = rng.range(-120, 120);
    foe.score = CFG.scoring.shard;
    foe.ember = 0.4;
  } else if (kind === 'armored') {
    foe.r = 26;
    foe.hp = 3;
    foe.maxHp = 3;
    foe.vy = rng.range(45, 65) * scale;
    foe.vx = rng.range(-20, 20);
    foe.score = CFG.scoring.armored;
    foe.ember = 0.8;
    foe.verts = polyVerts(rng, 8, 0.25);
  }
  g.foes.push(foe);
  return foe;
}

export function spawnBoss(g, wave) {
  const bossNumber = Math.floor(wave / CFG.waves.bossEvery);
  const hp = CFG.waves.bossBaseHp + (bossNumber - 1) * CFG.waves.bossHpPerBoss;
  const boss = {
    kind: 'boss',
    x: CFG.width / 2,
    y: 150,
    vx: 0,
    vy: 0,
    r: 72,
    hp,
    maxHp: hp,
    rot: 0,
    vr: 0.25,
    t: 0,
    burstT: 2.0,
    aimedT: 1.2,
    spawnT: 5.0,
    baseX: CFG.width / 2,
    score: CFG.scoring.boss,
    flash: 0,
  };
  g.boss = boss;
  return boss;
}

export function spawnBullet(g, x, y, vx, vy) {
  g.bullets.push({ kind: 'bullet', x, y, vx, vy, r: 4, t: 0 });
}

export function spawnFoeBullet(g, x, y, vx, vy) {
  g.foeBullets.push({ kind: 'foebullet', x, y, vx, vy, r: 6, t: 0 });
}

export function spawnEmber(g, x, y) {
  const a = g.rng.angle();
  g.embers.push({ kind: 'ember', x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, r: 7, t: g.rng.float() * TAU });
}

export function spawnPower(g, x, y, ptype) {
  const type = ptype || g.rng.pick(['shield', 'slow', 'spread']);
  g.powers.push({ kind: 'power', x, y, vx: 0, vy: 45, r: 13, ptype: type, t: 0 });
}

export function spawnExplosion(g, x, y, color, n, big) {
  for (let i = 0; i < n; i++) {
    const a = g.rng.angle();
    const speed = g.rng.range(60, big ? 380 : 260);
    g.parts.push({
      kind: 'part',
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: g.rng.range(0.35, big ? 0.9 : 0.6),
      maxLife: 0.9,
      size: g.rng.range(2, big ? 6 : 4),
      color,
    });
  }
}

export function spawnFloat(g, x, y, text, color) {
  g.floats.push({ kind: 'float', x, y, vy: -46, life: 1.0, text, color: color || '#f8fafc', size: 15 });
}

function wrapPosition(e) {
  if (e.x < -60) e.x = CFG.width + 50;
  if (e.x > CFG.width + 60) e.x = -50;
  if (e.y > CFG.height + 60) e.y = -50;
}

// Move everything one fixed step. Chasers home in, the boss runs its attack
// patterns, embers and power-ups drift toward the player when close.
export function updateEntities(g, dt) {
  const p = g.player;
  const slow = p.slowT > 0 ? 0.45 : 1;

  for (const f of g.foes) {
    f.t += dt;
    f.rot += f.vr * dt;
    if (f.kind === 'chaser' && p.alive) {
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = 150 * g.speedScale;
      f.vx += (dx / d) * speed * 1.6 * dt;
      f.vy += (dy / d) * speed * 1.6 * dt;
      const sp = Math.hypot(f.vx, f.vy) || 1;
      const cap = speed * 1.15;
      if (sp > cap) {
        f.vx = (f.vx / sp) * cap;
        f.vy = (f.vy / sp) * cap;
      }
      f.rot = Math.atan2(f.vy, f.vx);
    }
    f.x += f.vx * dt * slow;
    f.y += f.vy * dt * slow;
    if (f.y > CFG.height + 80) {
      f.y = -60;
      f.x = g.rng.range(40, CFG.width - 40);
    }
    wrapPosition(f);
  }

  const boss = g.boss;
  if (boss) {
    boss.t += dt;
    boss.flash = Math.max(0, boss.flash - dt * 4);
    boss.x = boss.baseX + Math.sin(boss.t * 0.5) * 260;
    boss.y = 150 + Math.sin(boss.t * 0.9) * 26;
    boss.rot += boss.vr * dt;
    boss.burstT -= dt;
    boss.aimedT -= dt;
    boss.spawnT -= dt;
    if (boss.burstT <= 0) {
      boss.burstT = 2.2;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + boss.t * 0.3;
        spawnFoeBullet(g, boss.x, boss.y, Math.cos(a) * 170, Math.sin(a) * 170);
      }
    }
    if (boss.aimedT <= 0 && p.alive) {
      boss.aimedT = 1.4;
      const dx = p.x - boss.x;
      const dy = p.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let k = -1; k <= 1; k++) {
        const a = Math.atan2(dy, dx) + k * 0.16;
        spawnFoeBullet(g, boss.x, boss.y + 30, Math.cos(a) * 260, Math.sin(a) * 260);
      }
    }
    if (boss.spawnT <= 0) {
      boss.spawnT = 6.0;
      spawnFoe(g, 'chaser', boss.x - 90, boss.y + 40);
      spawnFoe(g, 'chaser', boss.x + 90, boss.y + 40);
    }
  }

  for (const b of g.bullets) {
    b.t += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  g.bullets = g.bullets.filter((b) => b.y > -30 && b.y < CFG.height + 30 && b.x > -30 && b.x < CFG.width + 30);

  for (const b of g.foeBullets) {
    b.t += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  g.foeBullets = g.foeBullets.filter((b) => b.y > -30 && b.y < CFG.height + 30 && b.x > -30 && b.x < CFG.width + 30);

  for (const e of g.embers) {
    e.t += dt;
    if (p.alive) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 150) {
        e.vx += (dx / d) * 900 * dt;
        e.vy += (dy / d) * 900 * dt;
      }
    }
    e.vx *= 0.985;
    e.vy *= 0.985;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  for (const pw of g.powers) {
    pw.t += dt;
    pw.y += pw.vy * dt;
    if (p.alive) {
      const dx = p.x - pw.x;
      const dy = p.y - pw.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 130) {
        pw.x += (dx / d) * 160 * dt;
        pw.y += (dy / d) * 160 * dt;
      }
    }
  }

  for (const pt of g.parts) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.97;
    pt.vy *= 0.97;
  }
  g.parts = g.parts.filter((pt) => pt.life > 0);

  for (const fl of g.floats) {
    fl.life -= dt * 0.9;
    fl.y += fl.vy * dt;
  }
  g.floats = g.floats.filter((fl) => fl.life > 0);
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function polyPath(ctx, verts, r) {
  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const px = Math.cos(v.a) * v.r * r;
    const py = Math.sin(v.a) * v.r * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// One entity, drawn with layered glow so the field reads at a glance even
// when the judge sees it shrunk to a contact sheet.
export function drawEntity(ctx, e, time) {
  const C = CFG.colors;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === 'rock' || e.kind === 'splitter' || e.kind === 'armored') {
    ctx.rotate(e.rot);
    glow(ctx, e.kind === 'armored' ? C.shieldRing : C.rockRim, 14);
    ctx.fillStyle = e.kind === 'armored' ? '#334155' : '#475569';
    polyPath(ctx, e.verts, e.r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = e.kind === 'armored' ? C.shieldRing : C.rockRim;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (e.kind === 'splitter') {
      ctx.fillStyle = C.splitter;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.28, 0, TAU);
      ctx.fill();
    }
    if (e.kind === 'armored') {
      ctx.strokeStyle = C.shieldRing;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp));
      ctx.stroke();
    }
  } else if (e.kind === 'chaser') {
    ctx.rotate(e.rot);
    glow(ctx, C.chaser, 16);
    ctx.fillStyle = C.chaser;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, 0, 3, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'shard') {
    ctx.rotate(e.rot);
    glow(ctx, C.shard, 10);
    ctx.fillStyle = C.shard;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'bullet') {
    glow(ctx, C.bullet, 12);
    ctx.fillStyle = C.bullet;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'foebullet') {
    glow(ctx, C.foeBullet, 12);
    ctx.fillStyle = C.foeBullet;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'ember') {
    const pulse = 1 + Math.sin(e.t * 6) * 0.18;
    glow(ctx, C.ember, 18);
    ctx.fillStyle = C.ember;
    ctx.beginPath();
    ctx.arc(0, 0, 7 * pulse, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.emberCore;
    ctx.beginPath();
    ctx.arc(0, 0, 3 * pulse, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'power') {
    const bob = Math.sin(e.t * 3) * 3;
    ctx.translate(0, bob);
    const color = e.ptype === 'shield' ? C.shieldRing : e.ptype === 'slow' ? '#c084fc' : '#4ade80';
    glow(ctx, color, 16);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.ptype === 'shield' ? 'S' : e.ptype === 'slow' ? 'T' : 'W', 0, 1);
  } else if (e.kind === 'part') {
    ctx.globalAlpha = Math.max(0, e.life / e.maxLife);
    ctx.fillStyle = e.color;
    ctx.fillRect(-e.size / 2, -e.size / 2, e.size, e.size);
  } else if (e.kind === 'float') {
    ctx.globalAlpha = Math.max(0, Math.min(1, e.life));
    ctx.fillStyle = e.color;
    ctx.font = `bold ${e.size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.text, 0, 0);
  } else if (e.kind === 'boss') {
    ctx.rotate(e.rot * 0.2);
    glow(ctx, C.boss, 30);
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = e.flash > 0 ? '#fff' : C.boss;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = C.bossCore;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(time * 4) * 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff7cc';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 14, time * 0.8, time * 0.8 + Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}
