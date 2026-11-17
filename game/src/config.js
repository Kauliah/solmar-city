// Solmar City — every tuning number, palette entry and definition in one place.
// The city is a 600x600 m island of streets; the sea and beach run along the south edge.
export const STEP = 1 / 60;
export const CITY = { half: 300, roadHalf: 6, beachZ: 252, seaZ: 300 };
export const SAVE_KEY = 'solmar.save.v1';

// Avenues run north-south, streets east-west; blocks sit between them.
export const AVENUES = [-240, -120, 0, 120, 240];
export const STREETS = [-240, -120, 0, 120, 240];

export const PALETTE = {
  skyTop: '#7fb5d9', skyBottom: '#ffd9a0', fog: '#f2c98f',
  sea: '#2e86ab', sand: '#e8c890', asphalt: '#3a3f47', sidewalk: '#b8b0a0',
  grass: '#7fae62', building: ['#f2d8a7', '#e8a87c', '#a8c8d8', '#d8e8c8', '#e8c8c8'],
  accentCoral: '#ff6b4a', accentTeal: '#17a398', sun: '#ffe0a8',
  policeRed: '#ff2e2e', policeBlue: '#2e6bff', taxiYellow: '#f2c94c',
};

export const DISTRICTS = [
  { name: 'Marina Bay', x0: -300, z0: 60, x1: -120, z1: 252, style: 'marina' },
  { name: 'Old Town', x0: -300, z0: -120, x1: -60, z1: 60, style: 'oldtown' },
  { name: 'Harbor Docks', x0: 120, z0: 60, x1: 300, z1: 252, style: 'docks' },
  { name: 'Downtown', x0: -60, z0: -120, x1: 120, z1: 60, style: 'downtown' },
  { name: 'North Hills', x0: -300, z0: -300, x1: 300, z1: -180, style: 'hills' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return { name: 'Solmar', style: 'downtown' };
}

// Invented car models — nothing from any real brand or game.
export const CAR_MODELS = {
  alba: { name: 'Alba', topSpeed: 26, accel: 14, grip: 2.6, length: 3.4, width: 1.7, height: 1.1, durability: 60, colors: ['#e8a87c', '#a8c8d8', '#f2d8a7'] },
  meridian: { name: 'Meridian', topSpeed: 32, accel: 16, grip: 2.4, length: 4.2, width: 1.8, height: 1.2, durability: 80, colors: ['#3a5a7c', '#c8c8c8', '#7c3a3a'] },
  vela: { name: 'Vela GT', topSpeed: 42, accel: 22, grip: 2.0, length: 4.0, width: 1.9, height: 1.0, durability: 55, colors: ['#ff6b4a', '#17a398', '#f2c94c'] },
  hauler: { name: 'Hauler', topSpeed: 24, accel: 11, grip: 2.8, length: 5.2, width: 2.1, height: 1.9, durability: 140, colors: ['#8b93a3', '#5a6b7c'] },
  dune: { name: 'Dune Runner', topSpeed: 30, accel: 15, grip: 2.5, length: 4.4, width: 1.9, height: 1.4, durability: 100, colors: ['#c86b3a', '#4a7c3a'] },
  taxi: { name: 'Solmar Taxi', topSpeed: 30, accel: 15, grip: 2.4, length: 4.2, width: 1.8, height: 1.2, durability: 80, colors: ['#f2c94c'] },
  interceptor: { name: 'Interceptor', topSpeed: 40, accel: 24, grip: 2.2, length: 4.3, width: 1.9, height: 1.2, durability: 120, colors: ['#20242a'] },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.2, mag: Infinity, reserve: Infinity, rate: 0.45, spread: 0, auto: false },
  pistol: { name: 'P-9 Sparrow', damage: 26, range: 60, mag: 12, reserve: 120, rate: 0.22, spread: 0.012, auto: false },
  smg: { name: 'Hornet-9', damage: 16, range: 45, mag: 28, reserve: 196, rate: 0.09, spread: 0.03, auto: true },
  shotgun: { name: 'Boomstick', damage: 14, range: 22, mag: 6, reserve: 48, rate: 0.8, spread: 0.07, pellets: 6, auto: false },
};

export const WANTED = {
  decaySeconds: 20, // hidden out of sight this long clears one star
  gainSteal: 1, gainHitPed: 1, gainShoot: 1, gainKill: 2,
  maxPolice: [0, 1, 2, 3, 4, 5],
};

export const MISSION_DEFS = [
  { id: 1, name: 'First Fare', brief: 'Drive your Meridian to Iris\'s cafe in Old Town.', reward: 200 },
  { id: 2, name: 'Borrowed Wheels', brief: 'Steal a Vela GT from the Marina and deliver it to the Docks.', reward: 400 },
  { id: 3, name: 'Taxi Trouble', brief: 'Three taxi fares across the city, against the clock.', reward: 350 },
  { id: 4, name: 'The Drop', brief: 'Carry the package through Downtown on foot. The Harbor Kings are waiting.', reward: 500 },
  { id: 5, name: 'Harbor Heist', brief: 'Steal the Hauler full of cargo from the Docks. Lose the 3-star chase at the Hills lookout.', reward: 800 },
  { id: 6, name: "Kings' Gambit", brief: 'Shootout at Pier 9. Defeat 8 Harbor Kings gunmen, then escape by car.', reward: 900 },
  { id: 7, name: 'The Long Way Home', brief: 'Timed race around the ring road — spike strips and a helicopter included.', reward: 1000 },
  { id: 8, name: "Vale's Fall", brief: 'Storm the Solmar Tower garage, face Cassian Vale\'s crew, and get out clean.', reward: 2000 },
];

export const SHOP = {
  garagePrice: 150, // Tune-Up Garage: clear wanted + repair + respray
  pistolPrice: 300, smgPrice: 900, shotgunPrice: 700,
  carsForSale: { vela: 2500, dune: 1800, hauler: 2200 },
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
