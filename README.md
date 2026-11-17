# solmar-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kauliah/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kauliah/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is a sun-soaked open-world crime game built with three.js. You are **Juno Reyes**, a former courier driver who owes a debt to fixer **Iris Delgado** — work it off across 8 story missions against the rival **Harbor Kings**, in a coastal city you can explore on foot and by car.

## What you can do

- **Explore Solmar** — five districts (Marina Bay, Old Town, Harbor Docks, Downtown, North Hills), a beach, a pier, a lighthouse and the Solmar Tower, all in warm late-afternoon light.
- **Drive and steal** — seven invented car models (Alba, Meridian, Vela GT, Hauler, Dune Runner, Solmar Taxi, police Interceptor). Walk up to any car and press **E** to take it; locked cars need a 2-second hotwire.
- **Outrun the law** — a 1–5 star wanted system. Police Interceptors chase, ram and box you in; a helicopter joins at 3 stars. Hide out of sight to cool down, or pay $150 at the Tune-Up Garage to clear your name and fix your car.
- **8 story missions** — from "First Fare" (a simple drive to Iris's cafe) to the finale "Vale's Fall" at the Solmar Tower garage, with taxi fares, a harbor heist, a Pier 9 shootout and a timed ring-road race in between.
- **Combat** — fists, the P-9 Sparrow pistol, the Hornet-9 SMG and the Boomstick shotgun (buy weapons at Harbor Hardware), against Harbor Kings gunmen who take cover and shoot back.
- **Side jobs** — 20 hidden packages ($50 each, $500 bonus for all), taxi fares, and street races on the ring road. Cash, cars, weapons, missions and best times save in your browser.
- **Feel** — chase-cam with speed FOV kick, skid marks and tyre smoke, screen shake, a live minimap, damage vignette, and fully procedural WebAudio (engine hum, sirens, gunshots, gulls by the beach).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse | Look (click to lock) |
| Shift | Sprint / boost |
| Space | Jump / handbrake |
| E | Enter, steal or hotwire a car; use shops and start missions |
| F | Punch |
| Click | Shoot |
| R | Reload |
| 1–4 | Fists / pistol / SMG / shotgun |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network — the game runs entirely from `game/` (three.js is vendored under `game/vendor/three/`).

## How it is built

One job per file under `game/src/`: `city.js` builds Solmar, `vehicles.js` drives and steals cars, `traffic.js` and `pedestrians.js` keep the streets alive, `police.js` runs the wanted system, `missions.js` tells the story, `combat.js` handles weapons and gunmen, `hud.js` draws the HUD and minimap, `camera.js` / `effects.js` / `audio.js` handle feel, and `save.js` persists progress. `main.ts` copies `game/` and `screenshots/` to the output and writes the judge dossier with the vendored make.fun library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1807xzra&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
