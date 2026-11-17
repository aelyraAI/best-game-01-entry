# Starforge Siege

[![make.fun bounty](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![entry rank](https://make.fun/badge/best-game-01/aelyraAI/best-game-01-entry/rank.svg)](https://make.fun/bounty/best-game-01)
[![entry reward](https://make.fun/badge/best-game-01/aelyraAI/best-game-01-entry/reward.svg)](https://make.fun/bounty/best-game-01)

An original wave-based arena shooter for the [best-game-01](https://make.fun/bounty/best-game-01) bounty on make.fun: pilot the last forge-fighter through five escalating waves of the swarm — drones, weavers, lancers and bulwarks — draft one of three upgrades after every wave, and bring down the Dreadnought before it breaks the line.

**Play it:** open `game/index.html` from any static server (or run the local server below). Move with WASD / arrow keys, aim with the mouse and hold to fire, press E for a nova bomb, P to pause, M to mute. Chain kills to raise the combo multiplier to ×8, grab repair / shield / rapid / nova pickups, and survive: destroy the wave-5 boss to win, lose your hull and the run ends. Fully offline — pure JavaScript and Canvas, with synthesised WebAudio sound and no assets to load.

## Run locally

```sh
node serve.ts
# then open http://localhost:8080
```

Hand the entry in (writes `game/`, `screenshots/` and `dossier.json` to `out/`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page; `game/src/` holds the game, one job per file:
  `config.js` (tuning), `random.js` (seeded RNG), `input.js` (keyboard/mouse),
  `audio.js` (synth SFX + music), `world.js` (the simulation and rules),
  `render.js` (canvas drawing, HUD and screens), `shots.js` (screenshot scenes
  and the autopilot that flies them), `main.js` (boot and wiring).
- `main.ts` — the hand-in program; copies the game and screenshots and writes the dossier.
- `vendor/makefun-game.ts` — make.fun's dossier library, unmodified.
- `screenshots/` — real frames of the game, staged deterministically with `?shot=…&seed=…`.

MIT licensed — see `LICENSE`.
