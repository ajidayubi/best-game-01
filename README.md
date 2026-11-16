# Ember Drift — Neon Arcade Survival

Pilot a skiff through an asteroid field. Collect ember cores to build your
combo multiplier, dodge and shoot asteroids, and break the Ember Warden —
a boss with real attack patterns — every 5 waves. Three lives, escalating
waves, power-ups (shield, slow-time, spread-shot), particles, screen shake
and a parallax starfield. All art is drawn in code on canvas and all sound
is synthesized with WebAudio: no assets, no network, no build step.

## Play

Serve `game/` with any static server and open `index.html` in a desktop
browser, or run `node serve.ts` and open http://localhost:8080.

- **Move** — Arrow keys / WASD, or steer with the mouse
- **Shoot** — Space (hold) or mouse click
- **Pause** — P or Esc
- **Mute** — M
- **Start / restart** — Enter or click

High score is kept in `localStorage`.

## Enemy field

- **Drifting rocks** — slow, tumbling, the backbone of every wave
- **Chaser drones** — small, magenta, home in on your ship
- **Splitter rocks** — break into three fast shards when destroyed
- **Armored rocks** — three hits, with a shield ring showing their health
- **Ember Warden** (every 5th wave) — radial bullet bursts, aimed shots,
  chaser spawns, and a health bar across the top of the screen

## Files

- `game/index.html` — page shell and canvas
- `game/src/main.js` — bootstrap, fixed-step loop, deterministic shots
- `game/src/sim.js` — game rules: state, collisions, scoring, combo, lives
- `game/src/entities.js` — every entity: factories, movement, AI, drawing
- `game/src/waves.js` — wave director and difficulty curve
- `game/src/render.js` — starfield, HUD, banners, title/pause/game-over
- `game/src/audio.js` — WebAudio sound effects and drone, synthesized
- `game/src/input.js` — keyboard/mouse state and scripted shot inputs
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/src/config.js` — all tuning: palette, speeds, scoring, waves
- `game/src/shots.js` — deterministic screenshot scenes (?shot=&seed=)
- `main.ts` — entrypoint: copies game/ + screenshots/ and writes dossier.json
- `shots.json` — the four screenshots (start, play, boss, end)

## License

MIT — see `LICENSE`.
