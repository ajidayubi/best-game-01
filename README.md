# Whitewater — River Rush

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/best-game-01)
[![Built with make.fun](https://make.fun/badge-built.svg)](https://make.fun/bounty/best-game-01)
[![Play on make.fun](https://make.fun/badge-play.svg)](https://make.fun/bounty/best-game-01)

Steer a wooden raft down 2,000 m of wild river. Dodge rocks, logs and
whirlpools, grab gold coins, thread the buoy gates for combo bonuses, and
reach the Harbor — three hull hits and the raft is wrecked.

## Play

Serve `game/` with any static server and open `index.html` in desktop
Chrome. No network requests, no build step, all art and sound are
procedural.

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080
```

Controls: `←` `→` or mouse to steer, `SPACE` (hold) to paddle-boost,
`P` pause, `M` mute, `R` restart after a run ends.

## How it works

- `game/src/world.js` — the pure game model: river generation, raft
  physics, collisions, scoring, win/lose. Shared by the browser game and
  the node simulation test, so the rules are identical in both.
- `game/src/render.js` — all canvas drawing: river, banks, trees, raft,
  HUD, title and end screens.
- `game/src/rng.js` — seeded random helpers (mulberry32); every river row
  is a pure function of `(seed, row)`, so screenshots are reproducible.
- `game/src/audio.js` — tiny WebAudio synth for coins, gates, hits and
  jingles. No audio files.
- `game/src/game.js` — loop, input, state machine and the deterministic
  shot staging (`?shot=start|play|win|wreck&seed=1`).
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json` with the vendored make.fun library.

## Bounty

Built for [best-game-01 on make.fun](https://make.fun/bounty/best-game-01) —
make the best game, $1,000 prize pool. Entry by
[abdul-mazid](https://make.fun/r/cbk8hpf3) — referral code `cbk8hpf3`.
