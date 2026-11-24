import { Container, TilingSprite } from 'pixi.js';
import { LOOP_DURATION, TWO_PI, WORLD_H, WORLD_W } from './constants';
import { rgbTupleToHex, type ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

export interface CloudMistLayerController {
  container: Container;
  update(dt: number, theta: number, state: ResolvedSceneState): void;
}

interface DriftLayer {
  sprite: TilingSprite;
  baseCyclesPerLoop: number;
  windFactor: number;
  verticalAmp: number;
  verticalFreq: number;
  baseY: number;
  tileWidth: number;
  offsetX: number;
}

export function createCloudMistLayer(textures: SceneTextures): CloudMistLayerController {
  const container = new Container();

  const layers: Array<{
    drift: DriftLayer;
    kind: 'cloud' | 'mist';
    baseAlpha: number;
    fogScale: number;
    stormTintWeight: number;
  }> = [];

  // 2 seamless upper sky cloud layers (512px periodic FBM tile)
  const cloudBack = new TilingSprite({
    texture: textures.cloudTile,
    width: WORLD_W,
    height: 280,
  });
  cloudBack.position.set(0, -10);
  cloudBack.tileScale.set(1.25, 1.15);
  layers.push({
    drift: {
      sprite: cloudBack,
      baseCyclesPerLoop: 1, // 1 full 512*1.25 tile cycle per 24s loop -> seamless!
      windFactor: 1.4,
      verticalAmp: 5,
      verticalFreq: 1,
      baseY: -10,
      tileWidth: 512 * 1.25,
      offsetX: 0,
    },
    kind: 'cloud',
    baseAlpha: 0.22,
    fogScale: 0.45,
    stormTintWeight: 0.35,
  });

  const cloudFront = new TilingSprite({
    texture: textures.cloudTile,
    width: WORLD_W,
    height: 240,
  });
  cloudFront.position.set(0, 72);
  cloudFront.tileScale.set(1.0, 0.95);
  cloudFront.blendMode = 'screen';
  layers.push({
    drift: {
      sprite: cloudFront,
      baseCyclesPerLoop: -2,
      windFactor: 1.7,
      verticalAmp: 6,
      verticalFreq: 2,
      baseY: 72,
      tileWidth: 512,
      offsetX: 180,
    },
    kind: 'cloud',
    baseAlpha: 0.16,
    fogScale: 0.35,
    stormTintWeight: 0.25,
  });

  // 3 depth-layered rolling graveyard mist bands (y = 265..576)
  const mistFar = new TilingSprite({
    texture: textures.mistTile,
    width: WORLD_W,
    height: 220,
  });
  mistFar.position.set(0, 268);
  mistFar.tileScale.set(1.4, 0.92);
  layers.push({
    drift: {
      sprite: mistFar,
      baseCyclesPerLoop: 1,
      windFactor: 1.2,
      verticalAmp: 4,
      verticalFreq: 1,
      baseY: 268,
      tileWidth: 512 * 1.4,
      offsetX: 64,
    },
    kind: 'mist',
    baseAlpha: 0.24,
    fogScale: 0.72,
    stormTintWeight: 0.15,
  });

  const mistMid = new TilingSprite({
    texture: textures.mistTile,
    width: WORLD_W,
    height: 230,
  });
  mistMid.position.set(0, 348);
  mistMid.tileScale.set(1.0, 0.95);
  mistMid.blendMode = 'screen';
  layers.push({
    drift: {
      sprite: mistMid,
      baseCyclesPerLoop: -1,
      windFactor: 1.5,
      verticalAmp: 7,
      verticalFreq: 2,
      baseY: 348,
      tileWidth: 512,
      offsetX: 256,
    },
    kind: 'mist',
    baseAlpha: 0.26,
    fogScale: 0.78,
    stormTintWeight: 0.15,
  });

  const mistNear = new TilingSprite({
    texture: textures.mistTile,
    width: WORLD_W,
    height: 200,
  });
  mistNear.position.set(0, WORLD_H - 188);
  mistNear.tileScale.set(1.2, 0.88);
  mistNear.blendMode = 'screen';
  layers.push({
    drift: {
      sprite: mistNear,
      baseCyclesPerLoop: 2,
      windFactor: 1.9,
      verticalAmp: 8,
      verticalFreq: 1,
      baseY: WORLD_H - 188,
      tileWidth: 512 * 1.2,
      offsetX: 410,
    },
    kind: 'mist',
    baseAlpha: 0.30,
    fogScale: 0.85,
    stormTintWeight: 0.10,
  });

  for (const item of layers) {
    container.addChild(item.drift.sprite);
  }

  return {
    container,
    update(dt, theta, state) {
      const moonHex = rgbTupleToHex(state.moonTint);
      const mistHex = rgbTupleToHex(state.mistTint);
      // Incremental velocity integration prevents backward phase jumps on wind toggle,
      // while matching integer tile cycles per 24s loop in steady state!
      const windSpeedMul = 0.65 + state.windStrength * 1.35;

      for (const item of layers) {
        const d = item.drift;
        const baseVel = (d.baseCyclesPerLoop * d.tileWidth) / LOOP_DURATION;
        d.offsetX = (d.offsetX + baseVel * windSpeedMul * dt) % d.tileWidth;
        if (d.offsetX < 0) d.offsetX += d.tileWidth;
        d.sprite.tilePosition.x = d.offsetX;
        d.sprite.y = d.baseY + Math.sin(theta * d.verticalFreq + d.baseY * 0.03) * d.verticalAmp;

        if (item.kind === 'cloud') {
          d.sprite.tint = state.stormDarken > 0.2 ? 0x62708a : moonHex;
          const breath = 0.88 + 0.12 * Math.cos(theta * 2 + d.baseY * 0.05);
          d.sprite.alpha = (item.baseAlpha + state.cloudOpacity * item.fogScale) * breath * (1 - state.stormDarken * 0.18);
        } else {
          d.sprite.tint = mistHex;
          const breath = 0.88 + 0.12 * Math.sin(theta * 2 + d.baseY * 0.02);
          d.sprite.alpha = Math.min(
            0.92,
            (item.baseAlpha * 0.55 + state.fogDensity * item.fogScale) * breath
          );
        }
      }

      // Silence unused TWO_PI import check via subtle reference if needed
      void TWO_PI;
    },
  };
}
