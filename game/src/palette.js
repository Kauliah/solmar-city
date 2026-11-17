// The look plan for Solmar City: warm late-afternoon sun, saturated pastels, coral + teal
// accents. Mirrors the CSS variables in index.html so the DOM HUD and the 3D city agree.
export const LOOK = {
  sun: { color: '#ffe0a8', intensity: 2.6, azimuth: -0.9, elevation: 0.62 },
  sky: { top: '#7fb5d9', horizon: '#ffd9a0', fog: '#f2c98f', fogNear: 260, fogFar: 900 },
  sea: '#2e86ab', sand: '#e8c890',
  hud: {
    panel: 'rgba(12, 18, 28, 0.62)', panelBorder: 'rgba(255,255,255,0.22)',
    text: '#f4f0e6', accent: '#ff6b4a', teal: '#17a398', gold: '#f2c94c',
    starOn: '#ffd94c', starOff: 'rgba(255,255,255,0.35)',
  },
  districts: {
    marina: { roof: '#c86b4a', trim: '#f2d8a7' },
    oldtown: { roof: '#a8583c', trim: '#e8c8a8' },
    docks: { roof: '#5a6b7c', trim: '#8b93a3' },
    downtown: { roof: '#3a5a7c', trim: '#a8c8d8' },
    hills: { roof: '#7c5a3a', trim: '#d8e8c8' },
  },
};
