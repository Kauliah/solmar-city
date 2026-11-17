// The look plan for Solmar City: one place where the warm late-afternoon palette
// lives, mirrored by the CSS variables in index.html so the HUD and the 3D city agree.
import { PALETTE } from './config.js';

// Hex strings the DOM side uses, in one object for the stylesheet to read from.
export const CSS = {
  '--sky': PALETTE.skyHorizon,
  '--sea': PALETTE.sea,
  '--sand': PALETTE.sand,
  '--coral': PALETTE.accentCoral,
  '--teal': PALETTE.accentTeal,
  '--text': PALETTE.text,
  '--muted': PALETTE.muted,
  '--panel': PALETTE.hudPanel,
  '--star': PALETTE.star,
};

/** Warm late-afternoon light: sun low in the west, long shadows, amber fog. */
export function sunDirection() {
  return { x: -0.55, y: 0.62, z: 0.35 };
}

export function skyColors() {
  return { top: PALETTE.skyTop, horizon: PALETTE.skyHorizon, fog: PALETTE.fog };
}
