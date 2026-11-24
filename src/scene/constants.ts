export const WORLD_W = 1024;
export const WORLD_H = 576;
export const LOOP_DURATION = 24.0;
export const TWO_PI = Math.PI * 2;

export const MOON_CENTER = { x: 515, y: 40 } as const;
export const MOON_UV = {
  x: MOON_CENTER.x / WORLD_W,
  y: MOON_CENTER.y / WORLD_H,
} as const;
export const MOON_RADIUS = 156.0;
export const MOON_RADIUS_NORM_H = MOON_RADIUS / WORLD_H;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/** Measured foreground gravestone / cross bases for candle & bounce light placement. */
export const GRAVESTONE_SPOTS: readonly Point2D[] = [
  { x: 76, y: 548 },   // Left Celtic cross base
  { x: 158, y: 526 },  // Left stone cross base
  { x: 722, y: 544 },  // Right small wooden crosses
  { x: 912, y: 552 },  // Right skull tombstone base
];

export const MIST_BAND = {
  topY: 268,
  peakY: 528,
  bottomY: WORLD_H,
} as const;
