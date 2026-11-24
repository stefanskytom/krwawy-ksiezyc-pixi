import { Container, Graphics, Sprite } from 'pixi.js';
import { GRAVESTONE_SPOTS, WORLD_H, WORLD_W } from './constants';
import { rgbTupleToHex, type ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

interface CandleUnit {
  wax: Graphics;
  flame: Sprite;
  halo: Sprite;
  baseX: number;
  baseY: number;
  freqA: number;
  freqB: number;
  phase: number;
}

interface WispUnit {
  halo: Sprite;
  core: Sprite;
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  freqX: number;
  freqY: number;
  phase: number;
  pulseFreq: number;
  baseScale: number;
}

export interface LightsLayerController {
  container: Container;
  update(theta: number, state: ResolvedSceneState, cursorUV: [number, number]): void;
}

export function createLightsLayer(textures: SceneTextures): LightsLayerController {
  const container = new Container();

  const candles: CandleUnit[] = GRAVESTONE_SPOTS.map((spot, idx) => {
    const wax = new Graphics();
    wax
      .roundRect(-2.5, -10, 5, 11, 1.5)
      .fill({ color: 0xd9cbb8, alpha: 0.9 })
      .rect(-0.5, -13, 1, 3.5)
      .fill({ color: 0x2b221e });
    wax.position.set(spot.x, spot.y);

    const halo = new Sprite(textures.glow);
    halo.anchor.set(0.5);
    halo.position.set(spot.x, spot.y - 16);
    halo.blendMode = 'add';
    halo.tint = 0xff7b29;

    const flame = new Sprite(textures.candleFlame);
    flame.anchor.set(0.5, 0.85);
    flame.position.set(spot.x, spot.y - 12);
    flame.blendMode = 'add';

    container.addChild(halo, wax, flame);

    return {
      wax,
      flame,
      halo,
      baseX: spot.x,
      baseY: spot.y,
      freqA: 7 + idx,
      freqB: 11 + idx * 2,
      phase: idx * 1.45,
    };
  });

  // 7 spectral will-o'-wisps drifting smoothly in periodic figure-8 orbits
  const wispConfigs = [
    { x: 245, y: 472, ax: 28, ay: 14, fx: 1, fy: 2, ph: 0.2, pf: 3, sc: 0.85 },
    { x: 355, y: 446, ax: 36, ay: 18, fx: 2, fy: 3, ph: 1.4, pf: 4, sc: 0.95 },
    { x: 465, y: 488, ax: 42, ay: 16, fx: 1, fy: 2, ph: 2.7, pf: 3, sc: 1.05 },
    { x: 585, y: 455, ax: 34, ay: 19, fx: 2, fy: 1, ph: 3.9, pf: 5, sc: 0.90 },
    { x: 690, y: 432, ax: 30, ay: 15, fx: 1, fy: 3, ph: 4.8, pf: 4, sc: 0.82 },
    { x: 810, y: 478, ax: 38, ay: 17, fx: 2, fy: 2, ph: 5.6, pf: 3, sc: 0.96 },
    { x: 145, y: 438, ax: 24, ay: 13, fx: 1, fy: 2, ph: 2.1, pf: 4, sc: 0.78 },
  ];

  const wisps: WispUnit[] = wispConfigs.map((cfg) => {
    const halo = new Sprite(textures.glow);
    halo.anchor.set(0.5);
    halo.blendMode = 'add';

    const core = new Sprite(textures.particleSoft);
    core.anchor.set(0.5);
    core.blendMode = 'add';

    container.addChild(halo, core);
    return {
      halo,
      core,
      baseX: cfg.x,
      baseY: cfg.y,
      ampX: cfg.ax,
      ampY: cfg.ay,
      freqX: cfg.fx,
      freqY: cfg.fy,
      phase: cfg.ph,
      pulseFreq: cfg.pf,
      baseScale: cfg.sc,
    };
  });

  // Soft additive lantern glow tracking pointer when cursorLight is enabled
  const cursorGlow = new Sprite(textures.glow);
  cursorGlow.anchor.set(0.5);
  cursorGlow.blendMode = 'add';
  cursorGlow.tint = 0xffba66;
  cursorGlow.width = 230;
  cursorGlow.height = 230;
  container.addChild(cursorGlow);

  return {
    container,
    update(theta, state, cursorUV) {
      const lanternsAlpha = state.lanterns;
      const wispHex = rgbTupleToHex(state.wispRgb);
      const windSway = state.windStrength * 0.28;

      for (const c of candles) {
        c.wax.visible = lanternsAlpha > 0.02;
        c.flame.visible = lanternsAlpha > 0.02;
        c.halo.visible = lanternsAlpha > 0.02;
        if (!c.wax.visible) continue;

        const flicker =
          0.86 +
          0.09 * Math.sin(theta * c.freqA + c.phase) +
          0.05 * Math.cos(theta * c.freqB + c.phase * 1.7);

        c.wax.alpha = lanternsAlpha;
        c.flame.alpha = lanternsAlpha * flicker;
        c.flame.scale.set(0.32 * (0.9 + 0.14 * flicker), 0.36 * flicker);
        c.flame.rotation = (0.06 + windSway) * Math.sin(theta * (c.freqA - 2) + c.phase);

        c.halo.alpha = lanternsAlpha * 0.42 * flicker;
        c.halo.width = 115 * (0.94 + 0.10 * flicker);
        c.halo.height = 98 * (0.94 + 0.10 * flicker);
      }

      for (const w of wisps) {
        w.halo.visible = lanternsAlpha > 0.02;
        w.core.visible = lanternsAlpha > 0.02;
        if (!w.halo.visible) continue;

        const x = w.baseX + Math.sin(theta * w.freqX + w.phase) * w.ampX;
        const y = w.baseY + Math.sin(theta * w.freqY + w.phase * 1.3) * w.ampY;
        const pulse = 0.62 + 0.38 * Math.sin(theta * w.pulseFreq + w.phase);

        w.halo.position.set(x, y);
        w.halo.tint = wispHex;
        w.halo.width = 58 * w.baseScale * (0.85 + 0.25 * pulse);
        w.halo.height = 58 * w.baseScale * (0.85 + 0.25 * pulse);
        w.halo.alpha = lanternsAlpha * 0.36 * pulse;

        w.core.position.set(x, y);
        w.core.tint = 0xffffff;
        w.core.width = 10 * w.baseScale * (0.82 + 0.25 * pulse);
        w.core.height = 10 * w.baseScale * (0.82 + 0.25 * pulse);
        w.core.alpha = lanternsAlpha * 0.78 * pulse;
      }

      cursorGlow.visible = state.cursorLight > 0.01;
      if (cursorGlow.visible) {
        cursorGlow.position.set(cursorUV[0] * WORLD_W, cursorUV[1] * WORLD_H);
        const lanternPulse = 0.94 + 0.06 * Math.sin(theta * 8);
        cursorGlow.alpha = state.cursorLight * 0.24 * lanternPulse;
      }
    },
  };
}
