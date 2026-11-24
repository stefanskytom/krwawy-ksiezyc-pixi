import { Container, Sprite } from 'pixi.js';
import { MOON_CENTER, MOON_RADIUS } from './constants';
import { rgbTupleToHex, type ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

export interface MoonLayerController {
  container: Container;
  update(theta: number, state: ResolvedSceneState): void;
}

export function createMoonLayer(textures: SceneTextures): MoonLayerController {
  const container = new Container();

  // Wide atmospheric lunar halo
  const outerHalo = new Sprite(textures.glow);
  outerHalo.anchor.set(0.5);
  outerHalo.position.set(MOON_CENTER.x, MOON_CENTER.y + 18);
  outerHalo.blendMode = 'add';

  // Tight luminous rim halo
  const innerHalo = new Sprite(textures.glow);
  innerHalo.anchor.set(0.5);
  innerHalo.position.set(MOON_CENTER.x, MOON_CENTER.y);
  innerHalo.blendMode = 'add';

  // Slow-breathing crepuscular light rays radiating downward from behind clouds
  const rays: Array<{
    sprite: Sprite;
    baseAngle: number;
    angleAmp: number;
    freq: number;
    phase: number;
    baseScaleX: number;
    baseScaleY: number;
    baseAlpha: number;
  }> = [];

  const rayConfigs = [
    { angle: -0.46, amp: 0.03, freq: 1, phase: 0.0, sx: 1.05, sy: 1.75, alpha: 0.14 },
    { angle: -0.14, amp: 0.025, freq: 2, phase: 1.4, sx: 1.25, sy: 1.95, alpha: 0.16 },
    { angle: 0.18, amp: 0.028, freq: 1, phase: 2.8, sx: 1.15, sy: 1.85, alpha: 0.15 },
    { angle: 0.48, amp: 0.032, freq: 2, phase: 4.1, sx: 0.95, sy: 1.68, alpha: 0.13 },
  ];

  for (const cfg of rayConfigs) {
    const ray = new Sprite(textures.rayFan);
    ray.anchor.set(0.5, 0.0);
    ray.position.set(MOON_CENTER.x, MOON_CENTER.y + 10);
    ray.blendMode = 'add';
    container.addChild(ray);
    rays.push({
      sprite: ray,
      baseAngle: cfg.angle,
      angleAmp: cfg.amp,
      freq: cfg.freq,
      phase: cfg.phase,
      baseScaleX: cfg.sx,
      baseScaleY: cfg.sy,
      baseAlpha: cfg.alpha,
    });
  }

  // Eclipse diamond-ring glints on the lower lunar rim
  const diamondGlint = new Sprite(textures.glow);
  diamondGlint.anchor.set(0.5);
  diamondGlint.position.set(
    MOON_CENTER.x + MOON_RADIUS * 0.62,
    MOON_CENTER.y + MOON_RADIUS * 0.78
  );
  diamondGlint.blendMode = 'add';
  diamondGlint.tint = 0xffdd99;

  container.addChild(outerHalo, innerHalo, diamondGlint);

  return {
    container,
    update(theta, state) {
      const glow = state.moonGlow;
      const haloTint = rgbTupleToHex(state.moonHaloRgb);
      const mistTint = rgbTupleToHex(state.mistTint);
      const pulse = 0.90 + 0.10 * Math.sin(theta * 2);
      const pulseSlow = 0.93 + 0.07 * Math.cos(theta);

      // Attenuate moon glow mildly during heavy fog/storm overcast
      const weatherAtten = 1 - state.stormDarken * 0.35 - Math.max(0, state.fogDensity - 0.5) * 0.25;
      const visibility = glow * Math.max(0.35, weatherAtten);

      outerHalo.tint = haloTint;
      outerHalo.width = 660 * pulseSlow;
      outerHalo.height = 560 * pulseSlow;
      outerHalo.alpha = (0.34 + 0.14 * state.eclipseAmount) * visibility;

      innerHalo.tint = haloTint;
      innerHalo.width = (MOON_RADIUS * 2.75) * pulse;
      innerHalo.height = (MOON_RADIUS * 2.75) * pulse;
      innerHalo.alpha = (0.30 + 0.26 * state.eclipseAmount) * visibility;

      for (const r of rays) {
        const breath = 0.72 + 0.28 * Math.sin(theta * r.freq + r.phase);
        r.sprite.rotation = r.baseAngle + Math.sin(theta * r.freq + r.phase) * r.angleAmp;
        r.sprite.scale.set(r.baseScaleX, r.baseScaleY);
        r.sprite.tint = state.eclipseAmount > 0.5 ? haloTint : (r.freq === 2 ? mistTint : haloTint);
        r.sprite.alpha = r.baseAlpha * breath * visibility * (1 - state.eclipseAmount * 0.35);
      }

      const glintPulse = 0.7 + 0.3 * Math.sin(theta * 3 + 0.5);
      diamondGlint.width = 96 * glintPulse;
      diamondGlint.height = 96 * glintPulse;
      diamondGlint.alpha = state.eclipseAmount * 0.52 * glintPulse * Math.max(0.25, glow);
    },
  };
}
