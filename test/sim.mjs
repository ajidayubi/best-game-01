// Whitewater node simulation test: exercises the pure world model
// (game/src/world.js) without a browser. Fails loudly on any assertion.
import {
  createWorld,
  stepWorld,
  simulate,
  simulateInput,
  autopilotInput,
  worldScore,
  buildRow,
  snapshot,
} from '../game/src/world.js';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

console.log('== determinism ==');
const a1 = createWorld(1);
a1.state = 'playing';
simulate(a1, 600);
const a2 = createWorld(1);
a2.state = 'playing';
simulate(a2, 600);
check('same seed + same input -> identical snapshot', snapshot(a1) === snapshot(a2), `${snapshot(a1)} vs ${snapshot(a2)}`);
check('row generation is pure', JSON.stringify(buildRow(1, 100)) === JSON.stringify(buildRow(1, 100)));
check('different seeds differ', JSON.stringify(buildRow(1, 100)) !== JSON.stringify(buildRow(2, 100)));

console.log('== full loop: 60 s of autopilot ==');
const w = createWorld(1);
w.state = 'playing';
const ran = simulate(w, 3600);
console.log(`  ran ${ran} ticks, state=${w.state}, dist=${Math.floor(w.distance)}m, score=${worldScore(w)}, coins=${w.coins}, gates=${w.gatesPassed}/${w.gatesPassed + w.gatesMissed}, hull=${w.hull}, level=${w.level}, nearMiss=${w.nearMisses}`);
check('survived 60 s', w.state === 'playing', `state=${w.state}`);
check('travelled > 250 m', w.distance > 250);
check('score grew', worldScore(w) > 500);
check('collected coins', w.coins > 0);
check('met a gate', w.gatesPassed + w.gatesMissed > 0);
check('level rose', w.level > 1);

console.log('== win path ==');
const win = createWorld(7);
win.state = 'playing';
win.scrollY = 1990 * 50;
win.distance = 1990;
win.hull = 3;
simulate(win, 900);
console.log(`  state=${win.state}, dist=${Math.floor(win.distance)}m, score=${worldScore(win)}`);
check('reached the Harbor', win.state === 'win', `state=${win.state}`);

console.log('== lose path ==');
const lose = createWorld(3);
lose.state = 'playing';
lose.scrollY = 300 * 50;
lose.distance = 300;
lose.hull = 1;
lose.bonus = 1250;
const ri = Math.floor((lose.scrollY + 560) / 46);
lose.rows.set(ri, { index: ri, rocks: [{ x: lose.raft.x, y: ri * 46, r: 30, hit: false, nearMiss: false }], logs: [], whirls: [], coins: [], ring: null, gate: null });
// Fixed input (no steering): the raft holds its line into the rock.
simulateInput(lose, 300, { steer: 0, boost: false });
console.log(`  state=${lose.state}, hull=${lose.hull}`);
check('wrecked on final hull hit', lose.state === 'wreck', `state=${lose.state}`);

console.log('== steering responds ==');
const s1 = createWorld(9);
s1.state = 'playing';
const x0 = s1.raft.x;
for (let i = 0; i < 60; i++) stepWorld(s1, { steer: 1, boost: false }, 1 / 60);
check('steer right moves raft right', s1.raft.x > x0 + 100, `x ${x0} -> ${s1.raft.x}`);
const s2 = createWorld(9);
s2.state = 'playing';
const sp0 = s2.speed;
for (let i = 0; i < 120; i++) stepWorld(s2, { steer: 0, boost: true }, 1 / 60);
check('boost raises speed', s2.speed > 150, `speed ${s2.speed}`);
check('boost drains stamina', s2.stamina < 100, `stamina ${s2.stamina}`);

console.log(failures === 0 ? 'SIM OK' : `SIM FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
