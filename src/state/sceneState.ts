export type LightingMode = 'blood' | 'silver' | 'emerald' | 'eclipse';
export type WeatherMode = 'calm' | 'fog' | 'rain' | 'storm' | 'snow' | 'embers';

export interface SceneSettings {
  lighting: LightingMode;
  weather: WeatherMode;
  moonGlow: boolean;
  lanterns: boolean;
  cursorLight: boolean;
  strongWind: boolean;
  lightning: boolean;
  bats: boolean;
  paused: boolean;
  reducedMotion: boolean;
}

export type RgbTuple = [number, number, number];

export interface LightingPalette {
  /** Primary lunar / sky highlight tint in RGB [0..1] */
  moonTint: RgbTuple;
  /** Lower graveyard mist tint in RGB [0..1] */
  mistTint: RgbTuple;
  /** Deep shadow atmospheric tint in RGB [0..1] */
  shadowTint: RgbTuple;
  /** Base artwork sprite tint in RGB [0..1] */
  artworkTint: RgbTuple;
  /** Spectral will-o'-wisp hex tint */
  wispHex: number;
  /** Precomputed spectral will-o'-wisp RGB [0..1] */
  wispRgb: RgbTuple;
  /** Particle (snow/rain/motes) moonlit tint */
  particleHex: number;
  /** Precomputed particle RGB [0..1] */
  particleRgb: RgbTuple;
  /** How strongly to remap original painting colors (0 preserves blood original) */
  colorShift: number;
  /** Overall scene exposure multiplier */
  exposure: number;
  /** Eclipse darkness & fiery corona intensity [0..1] */
  eclipseAmount: number;
  /** CSS accent color matching lighting theme (high contrast on dark HUD) */
  uiAccent: string;
  /** Hex tint for additive moon halo sprites */
  moonHaloHex: number;
  /** Precomputed additive moon halo RGB [0..1] */
  moonHaloRgb: RgbTuple;
}

export const LIGHTING_PALETTES: Record<LightingMode, LightingPalette> = {
  blood: {
    moonTint: [1.0, 0.28, 0.14],
    mistTint: [0.24, 0.74, 0.80],
    shadowTint: [0.09, 0.04, 0.09],
    artworkTint: [1.0, 1.0, 1.0],
    wispHex: 0x7ef7eb,
    wispRgb: hexToRgbTuple(0x7ef7eb),
    particleHex: 0xffb3a7,
    particleRgb: hexToRgbTuple(0xffb3a7),
    colorShift: 0.0,
    exposure: 1.0,
    eclipseAmount: 0.0,
    uiAccent: '#ff4f3d',
    moonHaloHex: 0xff3b22,
    moonHaloRgb: hexToRgbTuple(0xff3b22),
  },
  silver: {
    moonTint: [0.80, 0.90, 1.0],
    mistTint: [0.42, 0.64, 0.88],
    shadowTint: [0.06, 0.09, 0.17],
    artworkTint: [0.66, 0.79, 1.0],
    wispHex: 0xb6e3ff,
    wispRgb: hexToRgbTuple(0xb6e3ff),
    particleHex: 0xd9ecff,
    particleRgb: hexToRgbTuple(0xd9ecff),
    colorShift: 0.92,
    exposure: 1.05,
    eclipseAmount: 0.0,
    uiAccent: '#76b5ff',
    moonHaloHex: 0x99ccff,
    moonHaloRgb: hexToRgbTuple(0x99ccff),
  },
  emerald: {
    moonTint: [0.22, 0.96, 0.56],
    mistTint: [0.18, 0.88, 0.66],
    shadowTint: [0.06, 0.05, 0.15],
    artworkTint: [0.46, 0.96, 0.72],
    wispHex: 0x6dffb3,
    wispRgb: hexToRgbTuple(0x6dffb3),
    particleHex: 0xa4ffd1,
    particleRgb: hexToRgbTuple(0xa4ffd1),
    colorShift: 0.94,
    exposure: 1.02,
    eclipseAmount: 0.0,
    uiAccent: '#33e68a',
    moonHaloHex: 0x2de887,
    moonHaloRgb: hexToRgbTuple(0x2de887),
  },
  eclipse: {
    moonTint: [1.0, 0.36, 0.12],
    mistTint: [0.20, 0.34, 0.54],
    shadowTint: [0.04, 0.03, 0.08],
    artworkTint: [0.78, 0.56, 0.58],
    wispHex: 0xffa654,
    wispRgb: hexToRgbTuple(0xffa654),
    particleHex: 0xffb685,
    particleRgb: hexToRgbTuple(0xffb685),
    colorShift: 0.42,
    exposure: 0.76,
    eclipseAmount: 1.0,
    uiAccent: '#ff8a3d',
    moonHaloHex: 0xff5a1f,
    moonHaloRgb: hexToRgbTuple(0xff5a1f),
  },
};

export interface WeatherTargets {
  windStrength: number;
  fogDensity: number;
  cloudOpacity: number;
  rainDensity: number;
  snowDensity: number;
  embersDensity: number;
  calmMotes: number;
  stormDarken: number;
}

const WEATHER_PRESETS: Record<WeatherMode, WeatherTargets> = {
  calm: {
    windStrength: 0.30,
    fogDensity: 0.34,
    cloudOpacity: 0.24,
    rainDensity: 0.0,
    snowDensity: 0.0,
    embersDensity: 0.0,
    calmMotes: 1.0,
    stormDarken: 0.0,
  },
  fog: {
    windStrength: 0.24,
    fogDensity: 1.0,
    cloudOpacity: 0.44,
    rainDensity: 0.0,
    snowDensity: 0.0,
    embersDensity: 0.0,
    calmMotes: 0.45,
    stormDarken: 0.14,
  },
  rain: {
    windStrength: 0.58,
    fogDensity: 0.50,
    cloudOpacity: 0.38,
    rainDensity: 0.78,
    snowDensity: 0.0,
    embersDensity: 0.0,
    calmMotes: 0.0,
    stormDarken: 0.18,
  },
  storm: {
    windStrength: 1.0,
    fogDensity: 0.62,
    cloudOpacity: 0.58,
    rainDensity: 1.0,
    snowDensity: 0.0,
    embersDensity: 0.0,
    calmMotes: 0.0,
    stormDarken: 0.34,
  },
  snow: {
    windStrength: 0.38,
    fogDensity: 0.42,
    cloudOpacity: 0.30,
    rainDensity: 0.0,
    snowDensity: 1.0,
    embersDensity: 0.0,
    calmMotes: 0.25,
    stormDarken: 0.08,
  },
  embers: {
    windStrength: 0.48,
    fogDensity: 0.28,
    cloudOpacity: 0.32,
    rainDensity: 0.0,
    snowDensity: 0.0,
    embersDensity: 1.0,
    calmMotes: 0.0,
    stormDarken: 0.10,
  },
};

/** Smoothly interpolated runtime state consumed by scene layers. */
export interface ResolvedSceneState {
  moonTint: RgbTuple;
  mistTint: RgbTuple;
  shadowTint: RgbTuple;
  artworkTint: RgbTuple;
  wispRgb: RgbTuple;
  particleRgb: RgbTuple;
  moonHaloRgb: RgbTuple;
  colorShift: number;
  exposure: number;
  eclipseAmount: number;
  moonGlow: number;
  lanterns: number;
  cursorLight: number;
  bats: number;
  lightning: number;
  windStrength: number;
  fogDensity: number;
  cloudOpacity: number;
  rainDensity: number;
  snowDensity: number;
  embersDensity: number;
  calmMotes: number;
  stormDarken: number;
}

export function hexToRgbTuple(hex: number): RgbTuple {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

export function rgbTupleToHex(rgb: RgbTuple): number {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
  return (r << 16) | (g << 8) | b;
}

export function createInitialSettings(reducedMotion: boolean): SceneSettings {
  return {
    lighting: 'blood',
    weather: 'calm',
    moonGlow: true,
    lanterns: true,
    cursorLight: false,
    strongWind: false,
    lightning: false,
    bats: true,
    paused: false,
    reducedMotion,
  };
}

export function createInitialResolvedState(settings: SceneSettings): ResolvedSceneState {
  const pal = LIGHTING_PALETTES[settings.lighting];
  const wx = WEATHER_PRESETS[settings.weather];
  return {
    moonTint: [...pal.moonTint],
    mistTint: [...pal.mistTint],
    shadowTint: [...pal.shadowTint],
    artworkTint: [...pal.artworkTint],
    wispRgb: [...pal.wispRgb],
    particleRgb: [...pal.particleRgb],
    moonHaloRgb: [...pal.moonHaloRgb],
    colorShift: pal.colorShift,
    exposure: pal.exposure,
    eclipseAmount: pal.eclipseAmount,
    moonGlow: settings.moonGlow ? 1 : 0,
    lanterns: settings.lanterns ? 1 : 0,
    cursorLight: settings.cursorLight ? 1 : 0,
    bats: settings.bats ? 1 : 0,
    lightning: settings.lightning ? 1 : 0,
    windStrength: settings.strongWind ? Math.max(wx.windStrength, 0.95) : wx.windStrength,
    fogDensity: wx.fogDensity,
    cloudOpacity: wx.cloudOpacity,
    rainDensity: wx.rainDensity,
    snowDensity: wx.snowDensity,
    embersDensity: wx.embersDensity,
    calmMotes: wx.calmMotes,
    stormDarken: wx.stormDarken,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(target: RgbTuple, dest: RgbTuple, t: number): void {
  target[0] = lerp(target[0], dest[0], t);
  target[1] = lerp(target[1], dest[1], t);
  target[2] = lerp(target[2], dest[2], t);
}

export function stepResolvedState(
  current: ResolvedSceneState,
  settings: SceneSettings,
  dt: number
): void {
  const alpha = 1 - Math.exp(-3.8 * Math.min(dt, 0.1));
  const pal = LIGHTING_PALETTES[settings.lighting];
  const wx = WEATHER_PRESETS[settings.weather];

  lerpRgb(current.moonTint, pal.moonTint, alpha);
  lerpRgb(current.mistTint, pal.mistTint, alpha);
  lerpRgb(current.shadowTint, pal.shadowTint, alpha);
  lerpRgb(current.artworkTint, pal.artworkTint, alpha);
  lerpRgb(current.wispRgb, pal.wispRgb, alpha);
  lerpRgb(current.particleRgb, pal.particleRgb, alpha);
  lerpRgb(current.moonHaloRgb, pal.moonHaloRgb, alpha);

  current.colorShift = lerp(current.colorShift, pal.colorShift, alpha);
  current.exposure = lerp(current.exposure, pal.exposure, alpha);
  current.eclipseAmount = lerp(current.eclipseAmount, pal.eclipseAmount, alpha);

  current.moonGlow = lerp(current.moonGlow, settings.moonGlow ? 1 : 0, alpha);
  current.lanterns = lerp(current.lanterns, settings.lanterns ? 1 : 0, alpha);
  current.cursorLight = lerp(current.cursorLight, settings.cursorLight ? 1 : 0, alpha);
  current.bats = lerp(current.bats, settings.bats ? 1 : 0, alpha);
  current.lightning = lerp(current.lightning, settings.lightning ? 1 : 0, alpha);

  const windTarget = settings.strongWind
    ? Math.max(wx.windStrength, 0.96)
    : wx.windStrength * 0.85;
  current.windStrength = lerp(current.windStrength, windTarget, alpha);
  current.fogDensity = lerp(current.fogDensity, wx.fogDensity, alpha);
  current.cloudOpacity = lerp(current.cloudOpacity, wx.cloudOpacity, alpha);
  current.rainDensity = lerp(current.rainDensity, wx.rainDensity, alpha);
  current.snowDensity = lerp(current.snowDensity, wx.snowDensity, alpha);
  current.embersDensity = lerp(current.embersDensity, wx.embersDensity, alpha);
  current.calmMotes = lerp(current.calmMotes, wx.calmMotes, alpha);
  current.stormDarken = lerp(current.stormDarken, wx.stormDarken, alpha);
}
