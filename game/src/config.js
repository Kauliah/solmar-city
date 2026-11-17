// Solmar City — every tuning number, palette entry, car/weapon/mission definition.
// The city is 600 x 600 m centred on the origin; x runs east, z runs south.
// Roads sit on a 120 m grid (avenues at -240, -120, 0, 120, 240) plus a ring road at +-280.

export const STEP = 1 / 60;
export const WORLD = { half: 300, beachZ: 268, seaZ: 296, ring: 280 };
export const ROAD_AXES = [-240, -120, 0, 120, 240];
export const ROAD_HALF = 5.5;
export const SAVE_KEY = 'solmar.save.v1';

export const PALETTE = {
  skyTop: '#7fb5d9',
  skyHorizon: '#ffd9a0',
  fog: '#f2c48d',
  sun: '#ffe0b0',
  sea: '#2e86ab',
  sand: '#e8c890',
  grass: '#7fae62',
  asphalt: '#3a3f47',
  sidewalk: '#9a938a',
  curb: '#c8c0b4',
  building: ['#f2d8a7', '#e8a87c', '#a8c8d8', '#d8e8c8', '#e8c8c8', '#c8b8d8'],
  glass: ['#6fa8c8', '#5a98b8', '#7fb8c8'],
  accentCoral: '#ff6b4a',
  accentTeal: '#17a398',
  text: '#f4efe6',
  muted: '#c9bda8',
  hudPanel: 'rgba(20, 24, 32, 0.72)',
  star: '#ffd23f',
  police: '#2f6fd8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Invented car models — no real brands, no GTA models. */
export const CARS = {
  alba: { name: 'Alba', kind: 'hatch', topSpeed: 26, accel: 14, grip: 2.6, durability: 60, price: 1200, colors: [0xe8e4d8, 0x7fb5a8, 0xd86a5a] },
  meridian: { name: 'Meridian', kind: 'sedan', topSpeed: 32, accel: 16, grip: 2.4, durability: 80, price: 3500, colors: [0x3a5a8c, 0xc8c8c8, 0x8c2f2f] },
  vela: { name: 'Vela GT', kind: 'sports', topSpeed: 44, accel: 22, grip: 2.1, durability: 55, price: 9000, colors: [0xff6b4a, 0x1a1a22, 0xf2c94c] },
  hauler: { name: 'Hauler', kind: 'van', topSpeed: 24, accel: 11, grip: 2.8, durability: 140, price: 5200, colors: [0xd8d0c0, 0x5a7a4a, 0x8a6a3a] },
  dune: { name: 'Dune Runner', kind: 'pickup', topSpeed: 30, accel: 15, grip: 2.5, durability: 110, price: 6800, colors: [0xc88a3a, 0x4a6a8a, 0x7a4a3a] },
  taxi: { name: 'Solmar Taxi', kind: 'taxi', topSpeed: 30, accel: 15, grip: 2.4, durability: 75, price: 0, colors: [0xf2c94c] },
  interceptor: { name: 'Interceptor', kind: 'police', topSpeed: 40, accel: 24, grip: 2.3, durability: 120, price: 0, colors: [0x1a2a44] },
};

export const WEAPONS = {
  fist: { name: 'Fists', damage: 12, rate: 2.2, range: 2.2, mag: Infinity, auto: false, spread: 0, sound: 'punch' },
  pistol: { name: 'P-9 Sparrow', damage: 26, rate: 3.5, range: 60, mag: 12, auto: false, spread: 0.012, price: 300, sound: 'pistol' },
  smg: { name: 'Hornet-9', damage: 16, rate: 11, range: 48, mag: 28, auto: true, spread: 0.035, price: 1200, sound: 'smg' },
  shotgun: { name: 'Boomstick', damage: 18, pellets: 6, rate: 1.1, range: 22, mag: 6, auto: false, spread: 0.09, price: 1800, sound: 'shotgun' },
};

export const PLAYER = {
  walkSpeed: 6, sprintSpeed: 10, crouchSpeed: 3, jumpSpeed: 8.5,
  health: 100, armour: 0, regenDelay: 6, regenRate: 4,
  radius: 0.55, eyeHeight: 1.62,
};

/** Points of interest, in world coordinates. */
export const POIS = {
  cafe: { x: -178, z: -112, name: "Iris's Cafe" },
  marina: { x: -215, z: 205, name: 'Marina Bay' },
  docks: { x: 205, z: -205, name: 'Harbor Docks' },
  tower: { x: 28, z: -28, name: 'Solmar Tower' },
  pier9: { x: -235, z: 245, name: 'Pier 9' },
  lighthouse: { x: -272, z: 250, name: 'Old Lighthouse' },
  stadium: { x: 205, z: 205, name: 'Estadio del Sol' },
  garage: { x: 68, z: 248, name: 'Tune-Up Garage' },
  motors: { x: -205, z: 175, name: 'Marina Motors' },
  hardware: { x: 175, z: -175, name: 'Harbor Hardware' },
  hospital: { x: -60, z: 235, name: 'Solmar General' },
  lookout: { x: 0, z: -272, name: 'North Hills Lookout' },
  plaza: { x: 0, z: 0, name: 'Plaza del Sol' },
};

export const DISTRICTS = [
  { name: 'Marina Bay', x0: -300, z0: 120, x1: -120, z1: 268, tint: 0x7fb5d9 },
  { name: 'Old Town', x0: -300, z0: -300, x1: -120, z1: -120, tint: 0xf2d8a7 },
  { name: 'Harbor Docks', x0: 120, z0: -300, x1: 300, z1: -120, tint: 0x8a94a0 },
  { name: 'Downtown', x0: -120, z0: -120, x1: 120, z1: 120, tint: 0x6fa8c8 },
  { name: 'North Hills', x0: -300, z0: -300, x1: 300, z1: -240, tint: 0x7fae62 },
];

/** The 8 story missions. Steps are interpreted by missions.js. */
export const MISSIONS = [
  {
    id: 1, title: 'First Fare', intro: 'Iris Delgado wants you at her cafe in Old Town. Drive your Meridian there — easy money, easy start.',
    reward: 200,
    steps: [
      { type: 'driveTo', x: POIS.cafe.x, z: POIS.cafe.z, radius: 10, label: 'Drive to Iris\'s Cafe in Old Town' },
    ],
  },
  {
    id: 2, title: 'Borrowed Wheels', intro: 'A Vela GT is parked at the Marina. Take it, bring it to the Docks. The owner will notice. The police will too.',
    reward: 400,
    steps: [
      { type: 'steal', model: 'vela', label: 'Steal a Vela GT at the Marina' },
      { type: 'deliver', x: POIS.docks.x, z: POIS.docks.z, radius: 12, label: 'Deliver the Vela GT to the Harbor Docks' },
    ],
  },
  {
    id: 3, title: 'Taxi Trouble', intro: 'Three fares, one clock. Pick them up across the city and drop them off. Tips if you are fast.',
    reward: 350,
    steps: [
      { type: 'taxi', count: 3, label: 'Pick up 3 taxi fares around the city' },
    ],
  },
  {
    id: 4, title: 'The Drop', intro: 'Carry the package on foot through Downtown. The Harbor Kings know you have it — they will come for it.',
    reward: 500,
    steps: [
      { type: 'carry', x: 60, z: 40, radius: 8, label: 'Carry the package to the Downtown drop point' },
    ],
  },
  {
    id: 5, title: 'Harbor Heist', intro: 'A Hauler full of cargo sits in the Docks. Take it, then lose the 3-star chase at the North Hills lookout.',
    reward: 800,
    steps: [
      { type: 'steal', model: 'hauler', label: 'Steal the Hauler from the Docks' },
      { type: 'deliver', x: POIS.lookout.x, z: POIS.lookout.z, radius: 12, label: 'Escape to the North Hills lookout' },
    ],
  },
  {
    id: 6, title: "Kings' Gambit", intro: 'The Harbor Kings are hitting Pier 9. Hold the pier — eight gunmen, no backup, no mercy.',
    reward: 900,
    steps: [
      { type: 'shootout', count: 8, x: POIS.pier9.x, z: POIS.pier9.z, radius: 26, label: 'Defeat 8 Harbor Kings gunmen at Pier 9' },
    ],
  },
  {
    id: 7, title: 'The Long Way Home', intro: 'One lap of the ring road, against the clock, with the whole Solmar police force on your tail.',
    reward: 1000,
    steps: [
      { type: 'race', checkpoints: [[-280, -280], [280, -280], [280, 280], [-280, 280]], timeLimit: 150, label: 'Race the ring road — 4 checkpoints, beat the clock' },
    ],
  },
  {
    id: 8, title: "Vale's Fall", intro: 'Cassian Vale is in the Solmar Tower garage. End it. Ten gunmen, then the getaway. Solmar is watching.',
    reward: 2000,
    steps: [
      { type: 'shootout', count: 10, x: POIS.tower.x, z: POIS.tower.z, radius: 30, label: 'Defeat 10 of Vale\'s crew in the Tower garage' },
      { type: 'driveTo', x: POIS.lookout.x, z: POIS.lookout.z, radius: 12, label: 'Getaway — reach the North Hills lookout' },
    ],
  },
];

/** 20 hidden package spots, $50 each. */
export const PACKAGE_SPOTS = [
  [-250, 230], [-200, 90], [-250, -60], [-160, -210], [-90, -250], [-40, -180],
  [40, -250], [120, -210], [210, -120], [250, -40], [250, 90], [180, 210],
  [90, 250], [20, 180], [-60, 120], [-130, 40], [-30, -60], [110, -40],
  [-210, -170], [230, 250],
];

/** Three checkpoint street races, best time saved. */
export const RACES = [
  { id: 'marina-sprint', name: 'Marina Sprint', checkpoints: [[-220, 230], [-240, 0], [-240, -240]], reward: 250 },
  { id: 'downtown-loop', name: 'Downtown Loop', checkpoints: [[-120, -120], [120, -120], [120, 120], [-120, 120]], reward: 300 },
  { id: 'hills-run', name: 'Hills Run', checkpoints: [[0, -280], [240, -240], [240, 0]], reward: 350 },
];

export const GARAGE_PRICE = 150;
export const BUSTED_FINE = 250;
export const WASTED_LOSS = 0.1;
export const WANTED_DECAY_SECONDS = 20;
