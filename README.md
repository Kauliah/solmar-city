# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kauliah/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kauliah/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is a sun-soaked open-world crime game built with three.js for make.fun's "Make GTA 6" bounty. You are **Juno Reyes**, a former courier driver who owes a debt to fixer **Iris Delgado** — work it off across 8 story missions against the rival **Harbor Kings**, or just take the city for yourself.

## The city

Solmar is a 600 × 600 m coastal city with five districts: **Marina Bay** (yachts and boardwalk), **Old Town** (pastel blocks and a plaza), **Harbor Docks** (warehouses, containers, cranes), **Downtown** (glass towers around Plaza del Sol), and **North Hills** (villas and a lookout over the bay). A beach strip and pier run along the south edge; the Solmar Tower, the Old Lighthouse and Estadio del Sol mark the skyline.

## What you can do

- **On foot and by car** — third-person walking with sprint, jump and crouch; arcade driving with handbrake drifts, boost and speed FOV kick.
- **Steal any car** — walk up and press E. Parked cars, traffic cars, even the Vela GT at the Marina. Locked cars take 2 seconds to hotwire.
- **Traffic and pedestrians** — 14 cars keep their lanes and honk when stuck; 24 walkers stroll the sidewalks and flee when shots ring out.
- **Wanted level 1–5** — steal, crash and shoot and the Solmar police respond: patrol cars, roadblocks, a helicopter spotlight at 3 stars. Hide to cool down, or pay $150 at the **Tune-Up Garage** to clear the heat.
- **8 story missions** — a first fare, a stolen sports car, taxi trouble, a package run through Downtown, a harbor heist, a shootout at Pier 9, a ring-road race against the clock, and the finale against Cassian Vale in the Solmar Tower garage.
- **Side jobs** — taxi fares, 20 hidden packages ($50 each, $500 for all), and 3 checkpoint street races with best times saved.
- **Combat** — fists, the P-9 Sparrow pistol, the Hornet-9 SMG and the Boomstick shotgun (buy them at **Harbor Hardware**), against Harbor Kings gunmen who take cover and shoot in bursts.
- **Progression** — cash buys cars at **Marina Motors** and weapons at Harbor Hardware; progress saves to the browser (cash, cars, weapons, missions, packages, race bests).
- **HUD + minimap** — wanted stars, cash and clock, health and armour, speed and car name, mission objective with distance, and a live minimap with police, markers and shops.
- **Procedural audio** — engine hum, sirens, gunshots, skids, stings and gulls, all synthesized in WebAudio. No external files anywhere.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint / boost |
| Space | Jump / handbrake |
| Mouse drag | Look around |
| E | Enter / steal a car |
| Click | Shoot |
| F | Punch |
| R | Reload |
| 1–4 | Switch weapon |
| C | Crouch |
| P / Esc | Pause |
| M | Mute |

## Tech

- three.js 0.187.0, vendored under `game/vendor/three/` (no network at runtime).
- Fixed-step 60 Hz simulation, seeded RNG for deterministic screenshot scenes.
- Source split by job: `city`, `vehicles`, `traffic`, `pedestrians`, `police`, `player`, `combat`, `missions`, `hud`, `camera`, `effects`, `audio`, `save`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1807xzra&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
