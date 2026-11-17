// Whitewater renderer: draws the world onto a canvas. Browser only.
// Every visual is procedural (no images, no network), and every animated
// element is a pure function of world state, so a simulated shot renders
// identically on every run.

import { VIEW_W, VIEW_H, RAFT_Y, FINISH_M, riverCenter, riverHalfWidth, screenY, worldScore } from './world.js';
import { hash2, clamp } from './rng.js';

const TEAL_DEEP = '#0b4a5c';
const TEAL = '#0e6b7a';
const TEAL_LIGHT = '#1595a3';
const SAND = '#d9b380';
const SAND_DARK = '#c49a68';
const GRASS = '#5da24a';
const GRASS_DARK = '#47873a';
const ROCK = '#8b93a1';
const ROCK_DARK = '#5f6673';
const WOOD = '#8a5a33';
const WOOD_DARK = '#6b4423';
const ORANGE = '#e8722a';
const ORANGE_DARK = '#b8541c';
const GOLD = '#ffd23f';
const CREAM = '#fff6e0';
const INK = '#10222b';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBanks(ctx, w) {
  // Water first: full canvas gradient.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, TEAL_DEEP);
  g.addColorStop(0.55, TEAL);
  g.addColorStop(1, TEAL_LIGHT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Flowing streaks: positions are a function of scrollY only.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const h = hash2(11, i);
    const x = 60 + (h % 1160);
    const len = 26 + (h % 60);
    const y = (((h % 720) + w.scrollY * 0.9) % 760) - 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y + len);
    ctx.stroke();
  }

  // Banks: winding polygons following the river centre.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side < 0 ? 0 : VIEW_W, -10);
    for (let y = -10; y <= VIEW_H + 10; y += 14) {
      const dPx = w.scrollY + 780 - y;
      const cx = riverCenter(dPx);
      const half = riverHalfWidth(dPx / 50);
      ctx.lineTo(cx + side * half, y);
    }
    ctx.lineTo(side < 0 ? 0 : VIEW_W, VIEW_H + 10);
    ctx.closePath();
    ctx.fillStyle = SAND;
    ctx.fill();
    // Grass strip hugging the water edge.
    ctx.beginPath();
    for (let y = -10; y <= VIEW_H + 10; y += 14) {
      const dPx = w.scrollY + 780 - y;
      const cx = riverCenter(dPx);
      const half = riverHalfWidth(dPx / 50);
      const x = cx + side * (half - 16);
      if (y === -10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let y = VIEW_H + 10; y >= -10; y -= 14) {
      const dPx = w.scrollY + 780 - y;
      const cx = riverCenter(dPx);
      const half = riverHalfWidth(dPx / 50);
      ctx.lineTo(cx + side * half, y);
    }
    ctx.closePath();
    ctx.fillStyle = GRASS;
    ctx.fill();
  }

  // Bank trees and stones, seeded per row so they never jump around.
  const firstRow = Math.max(0, Math.floor((w.scrollY - 120) / 46));
  const lastRow = Math.floor((w.scrollY + 900) / 46);
  for (let r = firstRow; r <= lastRow; r++) {
    const dPx = r * 46;
    const sy = screenY(w, dPx);
    if (sy < -40 || sy > VIEW_H + 40) continue;
    const cx = riverCenter(dPx);
    const half = riverHalfWidth(dPx / 50);
    for (const side of [-1, 1]) {
      const h = hash2(r, side < 0 ? 5 : 9);
      if (h % 3 === 0) {
        const tx = cx + side * (half + 34 + (h % 70));
        const ty = sy + (h % 30) - 15;
        const s = 16 + (h % 14);
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(tx - 2, ty, 4, 12);
        ctx.fillStyle = h % 2 ? '#2f7d3a' : '#3f9e4d';
        ctx.beginPath();
        ctx.arc(tx, ty - 6, s, 0, Math.PI * 2);
        ctx.arc(tx - s * 0.55, ty + 2, s * 0.7, 0, Math.PI * 2);
        ctx.arc(tx + s * 0.55, ty + 2, s * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (h % 3 === 1) {
        const tx = cx + side * (half + 24 + (h % 90));
        ctx.fillStyle = ROCK_DARK;
        ctx.beginPath();
        ctx.arc(tx, sy + (h % 24) - 12, 8 + (h % 8), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Foam where water meets the banks.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < VIEW_H; y += 26) {
    const dPx = w.scrollY + 780 - y;
    const cx = riverCenter(dPx);
    const half = riverHalfWidth(dPx / 50);
    const wob = Math.sin(y * 0.05 + w.scrollY * 0.01) * 4;
    ctx.beginPath();
    ctx.arc(cx - half + wob, y + ((y * 7) % 13), 3, 0, Math.PI * 2);
    ctx.arc(cx + half - wob, y + ((y * 11) % 17), 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRock(ctx, x, y, r) {
  ctx.fillStyle = ROCK_DARK;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, r, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ROCK;
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 2, r * 0.92, r * 0.72, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // White water ring at the base.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.55, r * 1.05, r * 0.4, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawLog(ctx, x, y, len) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = WOOD_DARK;
  rr(ctx, -len / 2, -11, len, 22, 10);
  ctx.fill();
  ctx.fillStyle = WOOD;
  rr(ctx, -len / 2, -14, len, 18, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-len / 2 + 8, -4);
  ctx.lineTo(len / 2 - 8, -4);
  ctx.moveTo(-len / 2 + 12, 4);
  ctx.lineTo(len / 2 - 12, 4);
  ctx.stroke();
  ctx.fillStyle = '#a97a45';
  ctx.beginPath();
  ctx.arc(-len / 2 + 4, -3, 7, 0, Math.PI * 2);
  ctx.arc(len / 2 - 4, -3, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWhirl(ctx, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    const a0 = t * 1.8 + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.45 + k * 0.22), a0, a0 + Math.PI * 1.1);
    ctx.stroke();
  }
  ctx.fillStyle = '#062a36';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoin(ctx, x, y, t) {
  const bob = Math.sin(t * 3 + x * 0.05) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#c98f1b';
  ctx.beginPath();
  ctx.arc(0, 2, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff0a8';
  ctx.beginPath();
  ctx.arc(-4, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6410';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 1);
  ctx.restore();
}

function drawRing(ctx, x, y, t) {
  const bob = Math.sin(t * 2.4 + x * 0.04) * 4;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, 15, a, a + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGate(ctx, x, y, halfSpan, t) {
  // Dashed guide line between the two buoys.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(x - halfSpan, y);
  ctx.lineTo(x + halfSpan, y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const side of [-1, 1]) {
    const bx = x + side * halfSpan;
    const bob = Math.sin(t * 2.2 + bx * 0.03) * 3;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(bx, y + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, y + bob, 13, Math.PI * 0.9, Math.PI * 1.9);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GATE', bx, y + bob - 26);
  }
}

function drawRaft(ctx, x, y, tilt, invuln, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  if (invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  // Wake foam.
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.beginPath();
  ctx.ellipse(0, 34, 34 + Math.sin(t * 6) * 4, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Raft planks.
  ctx.fillStyle = ORANGE_DARK;
  rr(ctx, -34, -26, 68, 56, 12);
  ctx.fill();
  ctx.fillStyle = ORANGE;
  rr(ctx, -32, -28, 64, 52, 11);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-32, i * 16);
    ctx.lineTo(32, i * 16);
    ctx.stroke();
  }
  // Paddler: round head, shoulders, paddle.
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(0, -12, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f6fb2';
  ctx.beginPath();
  ctx.arc(0, 4, 13, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-13, 2, 26, 8);
  ctx.strokeStyle = '#7a4a22';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const paddleSwing = Math.sin(t * 5) * 10;
  ctx.beginPath();
  ctx.moveTo(10, -2);
  ctx.lineTo(30 + paddleSwing, 26);
  ctx.stroke();
  ctx.fillStyle = '#a9713d';
  ctx.beginPath();
  ctx.ellipse(32 + paddleSwing, 30, 6, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, w) {
  for (const p of w.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(255,210,63,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'wood') {
      ctx.fillStyle = `rgba(138,90,51,${a})`;
      ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
    } else {
      ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFloats(ctx, w) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of w.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHeart(ctx, x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? '#ff5a3c' : 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-11, -2, -7, -11, 0, -5);
  ctx.bezierCurveTo(7, -11, 11, -2, 0, 7);
  ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, w) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,32,42,0.62)';
  rr(ctx, 0, 0, VIEW_W, 64, 0);
  ctx.fill();
  ctx.textBaseline = 'middle';
  // Score, left.
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SCORE', 20, 16);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(String(worldScore(w)), 20, 42);
  // Combo under the score.
  if (w.combo > 0) {
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`COMBO x${w.combo}`, 150, 42);
  }
  // Distance + progress to the Harbor, centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('DISTANCE TO HARBOR', VIEW_W / 2, 14);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${Math.floor(w.distance)} m  /  ${FINISH_M} m`, VIEW_W / 2, 38);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, VIEW_W / 2 - 130, 52, 260, 6, 3);
  ctx.fill();
  ctx.fillStyle = GOLD;
  rr(ctx, VIEW_W / 2 - 130, 52, 260 * clamp(w.distance / FINISH_M, 0, 1), 6, 3);
  ctx.fill();
  // Hull + level, right.
  ctx.textAlign = 'right';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`RAPIDS LV ${w.level}`, VIEW_W - 20, 16);
  for (let i = 0; i < 3; i++) {
    drawHeart(ctx, VIEW_W - 34 - i * 30, 42, i < w.hull);
  }
  // Paddle stamina, bottom-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(6,32,42,0.55)';
  rr(ctx, 16, VIEW_H - 34, 190, 20, 6);
  ctx.fill();
  ctx.fillStyle = w.stamina > 25 ? '#7dff8a' : '#ffb03a';
  rr(ctx, 18, VIEW_H - 32, 186 * clamp(w.stamina / 100, 0, 1), 16, 5);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('PADDLE  [SPACE = BOOST]', 214, VIEW_H - 24);
  ctx.restore();
}

function drawBanner(ctx, w) {
  if (!w.banner || w.bannerT <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(w.bannerT, 0, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 7;
  ctx.strokeText(w.banner, VIEW_W / 2, 150);
  ctx.fillText(w.banner, VIEW_W / 2, 150);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6,26,34,0.82)';
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,63,0.55)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 18);
  ctx.stroke();
}

function statLine(ctx, label, value, x, y) {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,246,224,0.75)';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(value, x + 330, y);
}

export function drawWorld(ctx, w) {
  ctx.save();
  if (w.shake > 0) {
    ctx.translate((Math.sin(w.time * 47) * w.shake) | 0, (Math.cos(w.time * 39) * w.shake) | 0);
  }
  drawBanks(ctx, w);
  const firstRow = Math.max(0, Math.floor((w.scrollY - 120) / 46));
  const lastRow = Math.floor((w.scrollY + 900) / 46);
  for (let r = firstRow; r <= lastRow; r++) {
    const row = w.rows.get(r);
    if (!row) continue;
    if (row.gate) {
      const sy = screenY(w, row.gate.y);
      if (sy > -60 && sy < VIEW_H + 60) drawGate(ctx, row.gate.x, sy, row.gate.halfSpan, w.time);
    }
    for (const rock of row.rocks) {
      const sy = screenY(w, rock.y);
      if (sy > -60 && sy < VIEW_H + 60) drawRock(ctx, rock.x, sy, rock.r);
    }
    for (const log of row.logs) {
      const sy = screenY(w, log.y);
      if (sy > -60 && sy < VIEW_H + 60) drawLog(ctx, log.x, sy, log.len);
    }
    for (const whirl of row.whirls) {
      const sy = screenY(w, whirl.y);
      if (sy > -80 && sy < VIEW_H + 80) drawWhirl(ctx, whirl.x, sy, whirl.r, w.time);
    }
    for (const coin of row.coins) {
      if (coin.taken) continue;
      const sy = screenY(w, coin.y);
      if (sy > -40 && sy < VIEW_H + 40) drawCoin(ctx, coin.x, sy, w.time);
    }
    if (row.ring && !row.ring.taken) {
      const sy = screenY(w, row.ring.y);
      if (sy > -40 && sy < VIEW_H + 40) drawRing(ctx, row.ring.x, sy, w.time);
    }
  }
  drawRaft(ctx, w.raft.x, RAFT_Y, w.raft.tilt, w.invuln, w.time);
  drawParticles(ctx, w);
  drawFloats(ctx, w);
  ctx.restore();
  drawHUD(ctx, w);
  drawBanner(ctx, w);
}

export function drawTitle(ctx, w) {
  drawWorld(ctx, w);
  ctx.fillStyle = 'rgba(4,20,28,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 340, 108, 680, 440);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 74px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 8;
  ctx.strokeText('WHITEWATER', VIEW_W / 2, 178);
  ctx.fillText('WHITEWATER', VIEW_W / 2, 178);
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('— RIVER RUSH —', VIEW_W / 2, 228);
  ctx.fillStyle = 'rgba(255,246,224,0.9)';
  ctx.font = '20px sans-serif';
  ctx.fillText('Steer your raft down 2,000 m of wild river.', VIEW_W / 2, 282);
  ctx.fillText('Dodge rocks, logs and whirlpools. Grab coins,', VIEW_W / 2, 312);
  ctx.fillText('thread the buoy gates, and reach the Harbor.', VIEW_W / 2, 342);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('← → or MOUSE to steer   •   SPACE to paddle-boost', VIEW_W / 2, 396);
  ctx.fillText('3 hull hits and the raft is wrecked', VIEW_W / 2, 424);
  const blink = Math.floor(w.time * 1.6) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('PRESS SPACE OR CLICK TO START', VIEW_W / 2, 492);
  }
  ctx.fillStyle = 'rgba(255,246,224,0.6)';
  ctx.font = '15px sans-serif';
  ctx.fillText('P pause   •   M mute   •   R restart', VIEW_W / 2, 528);
}

export function drawEnd(ctx, w, won) {
  drawWorld(ctx, w);
  ctx.fillStyle = 'rgba(4,20,28,0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 300, 96, 600, 470);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (won) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText('HARBOR REACHED!', VIEW_W / 2, 160);
    ctx.fillStyle = CREAM;
    ctx.font = '22px sans-serif';
    ctx.fillText('You rode the whole river and made it home.', VIEW_W / 2, 205);
  } else {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText('WRECKED!', VIEW_W / 2, 160);
    ctx.fillStyle = CREAM;
    ctx.font = '22px sans-serif';
    ctx.fillText('The river wins this time. The raft can be rebuilt.', VIEW_W / 2, 205);
  }
  const x0 = VIEW_W / 2 - 165;
  let y = 258;
  statLine(ctx, 'FINAL SCORE', String(worldScore(w)), x0, y);
  y += 38;
  statLine(ctx, 'DISTANCE', `${Math.floor(w.distance)} m`, x0, y);
  y += 38;
  statLine(ctx, 'COINS', String(w.coins), x0, y);
  y += 38;
  statLine(ctx, 'GATES', `${w.gatesPassed} passed`, x0, y);
  y += 38;
  statLine(ctx, 'BEST COMBO', `x${w.bestCombo}`, x0, y);
  y += 38;
  statLine(ctx, 'TIME', `${w.time.toFixed(1)} s`, x0, y);
  const blink = Math.floor(w.time * 1.6) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PRESS R OR CLICK TO RUN AGAIN', VIEW_W / 2, 522);
  }
}
