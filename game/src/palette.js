// Solmar City — the look plan. These values mirror the CSS variables in
// index.html so the page chrome and the 3D scene share one warm palette.

export const PALETTE_CSS = {
  '--sky-top': '#7fb5d9',
  '--sky-horizon': '#ffd9a0',
  '--sea': '#2e86ab',
  '--sand': '#e8c890',
  '--asphalt': '#3a3f47',
  '--coral': '#ff6b4a',
  '--teal': '#17a398',
  '--sun': '#ffd9a0',
  '--text': '#f4efe6',
  '--muted': '#c9bfae',
  '--panel': 'rgba(20, 24, 34, 0.72)',
  '--gold': '#f2c94c',
};

// District ground tints, used by the minimap and by building palettes.
export const DISTRICT_COLORS = {
  marina: '#7fb5d9',
  old: '#f2d8a7',
  docks: '#8b93a3',
  downtown: '#a8c8d8',
  hills: '#d8e8c8',
};

// Building facade palettes per district style: pastel walls, darker roofs.
export const FACADE = {
  marina: ['#f2e8d5', '#cfe3ea', '#e8c8a0', '#ffffff'],
  old: ['#f2d8a7', '#e8a87c', '#d8b48f', '#e8c8c0'],
  docks: ['#9aa0a8', '#7d838c', '#b0a89a', '#6e757d'],
  downtown: ['#a8c8d8', '#c8d8e8', '#8fb5c9', '#d8e0e8'],
  hills: ['#e8d8c8', '#f2e8d5', '#d8c8b0', '#ffffff'],
};

// Pedestrian shirt colours — bright, varied, sun-soaked.
export const PED_COLORS = [
  0xff6b4a, 0x17a398, 0xf2c94c, 0x7fb5d9, 0xe8a87c,
  0xa8c8d8, 0xd8e8c8, 0xf2d8a7, 0xc98bd8, 0x5ac8a0,
];

// Traffic car paint colours (never police black/white — that is reserved).
export const TRAFFIC_COLORS = [
  0xd94f3d, 0x3d7fd9, 0x3dd9a0, 0xf2c94c, 0xe8e8e8,
  0x8a5ac8, 0x5a8a3d, 0xd98a3d, 0x7fb5d9, 0xc8c8c8,
];

export function applyPaletteToDocument() {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(PALETTE_CSS)) root.style.setProperty(key, value);
}
