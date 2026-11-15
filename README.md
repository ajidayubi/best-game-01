# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ajidayubi/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ajidayubi/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Ember Drift — a neon arcade survival game. Entry for the make.fun **best-game-01** bounty ("Make the best game", $1,000, top 10 share).

Pilot your skiff through an asteroid field. Blast rocks, grab ember cores to build a combo multiplier, survive escalating waves, and break the Void Maw boss every 5th wave. Three lives, power-ups (shield, slow-time, spread-shot), particles, screen shake, a parallax starfield, and a synthwave WebAudio soundtrack — all art drawn in code on canvas, all sound synthesised live. No external files, no network requests.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=cbk8hpf3&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## Play

- **Move:** Arrow keys / WASD, or move the mouse (the skiff follows the pointer)
- **Shoot:** Space, or click
- **Pause:** P or Esc · **Mute:** M · **Start / restart:** Enter or click

## The game

- **Goal:** survive as many waves as you can and chase the high score (kept in `localStorage`).
- **Ember cores:** every core you collect raises your combo multiplier (up to x8) — but the combo fades after 4 seconds without a pickup.
- **Asteroids:** small rocks (1 hit) and big brutes (3 hits) that split into two small rocks. Destroyed rocks spill ember cores and sometimes a power-up.
- **Boss:** every 5th wave the Void Maw arrives — a huge tumbling rock with a health bar that strafes across the top of the field and sheds shard asteroids.
- **Power-ups:** Shield (8s, smash through rocks), Slow-time (6s), Spread shot (10s).
- **Screenshots:** deterministic states at `?shot=start|play|boss|end&seed=1` — the same seed always renders the same scene.

## Layout

- `game/index.html` + `game/style.css` — the page and its frame
- `game/src/main.js` — game loop, state machine, scoring, collisions
- `game/src/config.js` — tuning numbers and palette
- `game/src/random.js` — seeded generator for deterministic shots
- `game/src/audio.js` — WebAudio sound effects and music
- `game/src/input.js` — keyboard + mouse
- `game/src/entities.js` — skiff, bullets, asteroids, embers, power-ups, boss, particles
- `game/src/waves.js` — wave pacing and boss scheduling
- `game/src/render.js` — all drawing: starfield, ships, HUD, screens
- `game/src/shots.js` — deterministic screenshot scenes
- `main.ts` — the make.fun entry program (copies `game/` + `screenshots/` to `/output`, writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — 4 real renders of the game (start, play, boss, game over)

## License

MIT — see [LICENSE](LICENSE).
