// Solmar City — every tuning number in one place. The city is a 600 x 600 m
// square centred on the origin; roads run on a grid, buildings fill the blocks.

export const STEP = 1 / 60;
export const CITY_HALF = 300;
export const ROAD_HALF = 7;
export const SAVE_KEY = 'solmar.save.v1';

// Grid roads run at these coordinates on both axes (avenues + streets).
export const ROADS = [-240, -120, 0, 120, 240];

export const PLAYER = {
  radius: 0.55,
  walkSpeed: 6,
  sprintSpeed: 10,
  jumpSpeed: 7.5,
  gravity: 22,
  health: 100,
  regenDelay: 6,
  regenRate: 4,
};

export const CARS = {
  alba:    { name: 'Alba',        topSpeed: 26, accel: 14, brake: 30, steer: 1.9, grip: 0.92, hp: 60,  color: 0xf2d8a7, price: 0 },
  meridian:{ name: 'Meridian',    topSpeed: 34, accel: 17, brake: 34, steer: 1.7, grip: 0.94, hp: 80,  color: 0x7fb5d9, price: 1200 },
  vela:    { name: 'Vela GT',     topSpeed: 46, accel: 24, brake: 38, steer: 1.5, grip: 0.96, hp: 70,  color: 0xff6b4a, price: 5200 },
  hauler:  { name: 'Hauler',      topSpeed: 24, accel: 11, brake: 26, steer: 1.4, grip: 0.9,  hp: 140, color: 0xd8e8c8, price: 2600 },
  dune:    { name: 'Dune Runner', topSpeed: 30, accel: 15, brake: 30, steer: 1.8, grip: 0.9,  hp: 100, color: 0xe8a87c, price: 3400 },
  taxi:    { name: 'Solmar Taxi', topSpeed: 32, accel: 16, brake: 34, steer: 1.7, grip: 0.94, hp: 80,  color: 0xf2c94c, price: 900 },
  police:  { name: 'Interceptor', topSpeed: 44, accel: 26, brake: 40, steer: 1.9, grip: 0.97, hp: 120, color: 0x1b2a4a, price: 0 },
};

export const WEAPONS = {
  fists:  { name: 'Fists',       mag: Infinity, reserve: Infinity, damage: 12, rate: 0.45, spread: 0,    range: 2.2,  auto: false, price: 0 },
  pistol: { name: 'P-9 Sparrow', mag: 12, reserve: 96,  damage: 22, rate: 0.28, spread: 0.02, range: 60,   auto: false, price: 350 },
  smg:    { name: 'Hornet-9',    mag: 28, reserve: 168, damage: 14, rate: 0.09, spread: 0.06, range: 45,   auto: true,  price: 1400 },
  shotgun:{ name: 'Boomstick',   mag: 6,  reserve: 36,  damage: 16, rate: 0.8,  spread: 0.12, range: 22,   auto: false, price: 2100, pellets: 6 },
};

export const WANTED = {
  decaySeconds: 20,      // out of sight this long drops one star
  maxStars: 5,
  policePerStar: [0, 1, 2, 3, 4, 5],
  bustedRadius: 3.5,
  garageFee: 150,
};

export const DISTRICTS = [
  { name: 'Marina Bay',   cx: -180, cz: 180,  color: 0x2e86ab, style: 'marina' },
  { name: 'Old Town',     cx: -180, cz: -180, color: 0xf2d8a7, style: 'old' },
  { name: 'Harbor Docks', cx: 180,  cz: 180,  color: 0x8b93a3, style: 'docks' },
  { name: 'Downtown',     cx: 180,  cz: -180, color: 0xa8c8d8, style: 'downtown' },
  { name: 'North Hills',  cx: 0,    cz: -260, color: 0xd8e8c8, style: 'hills' },
];

export const PALETTE = {
  skyTop: '#7fb5d9',
  skyHorizon: '#ffd9a0',
  fog: '#f2c98f',
  sea: '#2e86ab',
  sand: '#e8c890',
  asphalt: '#3a3f47',
  sidewalk: '#9a938a',
  grass: '#7fae6e',
  coral: '#ff6b4a',
  teal: '#17a398',
  sun: '#ffd9a0',
  text: '#f4efe6',
  muted: '#c9bfae',
  panel: 'rgba(20, 24, 34, 0.72)',
};

// The 8 story missions. pos = [x, z] of the objective marker; reward in $.
export const MISSIONS = [
  { id: 1, title: 'First Fare', short: 'Drive to Iris\u2019s caf\u00e9 in Old Town',
    steps: [{ type: 'driveTo', pos: [-180, -111], label: 'Reach Iris\u2019s caf\u00e9' }],
    reward: 200, intro: 'Iris Delgado is waiting at her caf\u00e9. Drive over and hear her out.' },
  { id: 2, title: 'Borrowed Wheels', short: 'Steal a Vela GT from the Marina',
    steps: [
      { type: 'steal', model: 'vela', pos: [-200, 130], label: 'Steal the Vela GT at the Marina' },
      { type: 'driveTo', pos: [200, 130], label: 'Deliver it to the Docks' },
    ],
    reward: 400, intro: 'Iris wants a Vela GT. Borrow one from the Marina \u2014 permanently.' },
  { id: 3, title: 'Taxi Trouble', short: 'Three fares against the clock',
    steps: [
      { type: 'pickup', pos: [129, -111], label: 'Pick up the fare in Downtown' },
      { type: 'dropoff', pos: [-111, 129], label: 'Drop them off at the Marina' },
      { type: 'pickup', pos: [9, 249], label: 'Pick up the second fare' },
      { type: 'dropoff', pos: [249, -231], label: 'Drop them off in North Hills' },
    ],
    reward: 350, intro: 'Cover for a sick driver. Three fares, one meter, no excuses.' },
  { id: 4, title: 'The Drop', short: 'Carry the package through Downtown on foot',
    steps: [
      { type: 'pickup', pos: [129, -111], label: 'Collect the package' },
      { type: 'deliver', pos: [249, -111], label: 'Deliver it on foot \u2014 Kings are watching' },
    ],
    reward: 500, intro: 'A package, a walk through Downtown, and Kings gunmen who want it.' },
  { id: 5, title: 'Harbor Heist', short: 'Steal the Hauler and escape to the Hills',
    steps: [
      { type: 'steal', model: 'hauler', pos: [200, 130], label: 'Steal the Hauler at the Docks' },
      { type: 'driveTo', pos: [0, -260], label: 'Escape to the Hills lookout' },
    ],
    reward: 800, intro: 'A Hauler full of cargo is sitting at the Docks. Take it. Lose the heat.' },
  { id: 6, title: 'Kings\u2019 Gambit', short: 'Shootout at Pier 9',
    steps: [{ type: 'defeat', pos: [-240, 260], label: 'Defeat 8 Harbor Kings at Pier 9', count: 8 }],
    reward: 900, intro: 'The Kings are moving on Iris\u2019s crew at Pier 9. Hold the pier.' },
  { id: 7, title: 'The Long Way Home', short: 'Timed race around the ring road',
    steps: [
      { type: 'driveTo', pos: [249, 249], label: 'Reach the ring-road gate', time: 75 },
      { type: 'driveTo', pos: [-249, -249], label: 'Race to the far gate', time: 90 },
    ],
    reward: 1000, intro: 'A race the Kings set up \u2014 and a chase they didn\u2019t tell you about.' },
  { id: 8, title: 'Vale\u2019s Fall', short: 'Confront Cassian Vale at Solmar Tower',
    steps: [
      { type: 'driveTo', pos: [200, -111], label: 'Reach the Solmar Tower garage' },
      { type: 'defeat', pos: [200, -111], label: 'Defeat Vale\u2019s crew (10 gunmen)', count: 10 },
      { type: 'driveTo', pos: [-200, 130], label: 'Getaway to the Marina' },
    ],
    reward: 2000, intro: 'End it. Vale\u2019s crew is holed up in the Solmar Tower garage.' },
];

export const PACKAGES = 20;      // hidden packages across the city, $50 each
export const PACKAGE_BONUS = 500; // for finding all 20
export const GARAGE_POS = [69, 249];   // Tune-Up Garage (clears wanted, repairs)
export const HARDWARE_POS = [231, 200]; // Harbor Hardware (weapons)
export const MOTORS_POS = [-200, 231];  // Marina Motors (buy cars)
export const HOSPITAL_POS = [-111, -60]; // respawn point
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
