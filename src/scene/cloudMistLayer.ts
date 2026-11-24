import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { LOOP_DURATION, WORLD_H, WORLD_W } from './constants';
import { rgbTupleToHex, type ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

export interface CloudMistLayerController {
  normalContainer: Container;
  addContainer: Container;
  update(dt: number, theta: number, state: ResolvedSceneState): void;
  destroy(): void;
}

interface ScrollBand {
  spriteA: Sprite;
  spriteB: Sprite;
  texA: Texture;
  texB: Texture;
  atlasX: number;
  atlasY: number;
  atlasW: number;
  atlasH: number;
  bandWidth: number;
  baseCyclesPerLoop: number;
  verticalAmp: number;
  verticalFreq: number;
  baseY: number;
  offsetX: number;
  kind: 'cloud' | 'mist';
  baseAlpha: number;
  fogScale: number;
}

export function createCloudMistLayer(textures: SceneTextures): CloudMistLayerController {
  const normalContainer = new Container();
  const addContainer = new Container();
  const bands: ScrollBand[] = [];

  const addBand = (opts: {
    target: Container;
    baseTex: Texture;
    blendMode: 'normal' | 'add';
    y: number;
    height: number;
    baseCyclesPerLoop: number;
    verticalAmp: number;
    verticalFreq: number;
    offsetX: number;
    kind: 'cloud' | 'mist';
    baseAlpha: number;
    fogScale: number;
  }): void => {
    const f = opts.baseTex.frame;
    const source = opts.baseTex.source;

    const texA = new Texture({
      source,
      frame: new Rectangle(f.x, f.y, f.width * 0.5, f.height),
      dynamic: true,
    });
    const texB = new Texture({
      source,
      frame: new Rectangle(f.x + f.width * 0.5, f.y, f.width * 0.5, f.height),
      dynamic: true,
    });

    const spriteA = new Sprite(texA);
    spriteA.height = opts.height;
    spriteA.blendMode = opts.blendMode;

    const spriteB = new Sprite(texB);
    spriteB.height = opts.height;
    spriteB.blendMode = opts.blendMode;

    opts.target.addChild(spriteA, spriteB);

    bands.push({
      spriteA,
      spriteB,
      texA,
      texB,
      atlasX: f.x,
      atlasY: f.y,
      atlasW: f.width,
      atlasH: f.height,
      bandWidth: WORLD_W,
      baseCyclesPerLoop: opts.baseCyclesPerLoop,
      verticalAmp: opts.verticalAmp,
      verticalFreq: opts.verticalFreq,
      baseY: opts.y,
      offsetX: opts.offsetX,
      kind: opts.kind,
      baseAlpha: opts.baseAlpha,
      fogScale: opts.fogScale,
    });
  };

  // Upper sky cloud bands
  addBand({
    target: normalContainer,
    baseTex: textures.cloudBand,
    blendMode: 'normal',
    y: -10,
    height: 280,
    baseCyclesPerLoop: 1,
    verticalAmp: 5,
    verticalFreq: 1,
    offsetX: 0,
    kind: 'cloud',
    baseAlpha: 0.22,
    fogScale: 0.45,
  });

  addBand({
    target: addContainer,
    baseTex: textures.cloudBand,
    blendMode: 'add',
    y: 72,
    height: 240,
    baseCyclesPerLoop: -2,
    verticalAmp: 6,
    verticalFreq: 2,
    offsetX: 320,
    kind: 'cloud',
    baseAlpha: 0.11,
    fogScale: 0.24,
  });

  // Depth-layered rolling graveyard mist bands
  addBand({
    target: normalContainer,
    baseTex: textures.mistBand,
    blendMode: 'normal',
    y: 268,
    height: 220,
    baseCyclesPerLoop: 1,
    verticalAmp: 4,
    verticalFreq: 1,
    offsetX: 110,
    kind: 'mist',
    baseAlpha: 0.24,
    fogScale: 0.72,
  });

  addBand({
    target: addContainer,
    baseTex: textures.mistBand,
    blendMode: 'add',
    y: 348,
    height: 230,
    baseCyclesPerLoop: -1,
    verticalAmp: 7,
    verticalFreq: 2,
    offsetX: 512,
    kind: 'mist',
    baseAlpha: 0.18,
    fogScale: 0.53,
  });

  addBand({
    target: addContainer,
    baseTex: textures.mistBand,
    blendMode: 'add',
    y: WORLD_H - 188,
    height: 200,
    baseCyclesPerLoop: 2,
    verticalAmp: 8,
    verticalFreq: 1,
    offsetX: 780,
    kind: 'mist',
    baseAlpha: 0.20,
    fogScale: 0.58,
  });

  return {
    normalContainer,
    addContainer,
    update(dt, theta, state) {
      const moonHex = rgbTupleToHex(state.moonTint);
      const mistHex = rgbTupleToHex(state.mistTint);
      const windSpeedMul = 0.65 + state.windStrength * 1.35;

      for (const b of bands) {
        const baseVel = (b.baseCyclesPerLoop * b.bandWidth) / LOOP_DURATION;
        b.offsetX = (b.offsetX + baseVel * windSpeedMul * dt) % b.bandWidth;
        if (b.offsetX < 0) b.offsetX += b.bandWidth;

        const y = b.baseY + Math.sin(theta * b.verticalFreq + b.baseY * 0.03) * b.verticalAmp;
        const uFrac = b.offsetX / b.bandWidth;
        const leftW = b.offsetX;
        const rightW = b.bandWidth - b.offsetX;

        if (leftW > 0.5) {
          b.spriteA.visible = true;
          b.texA.frame.x = b.atlasX + b.atlasW * (1 - uFrac);
          b.texA.frame.width = Math.max(0.5, b.atlasW * uFrac);
          b.texA.update();
          b.spriteA.position.set(0, y);
          b.spriteA.width = leftW;
        } else {
          b.spriteA.visible = false;
        }

        if (rightW > 0.5) {
          b.spriteB.visible = true;
          b.texB.frame.x = b.atlasX;
          b.texB.frame.width = Math.max(0.5, b.atlasW * (1 - uFrac));
          b.texB.update();
          b.spriteB.position.set(leftW, y);
          b.spriteB.width = rightW;
        } else {
          b.spriteB.visible = false;
        }

        let tint: number;
        let alpha: number;
        if (b.kind === 'cloud') {
          tint = state.stormDarken > 0.2 ? 0x62708a : moonHex;
          const breath = 0.88 + 0.12 * Math.cos(theta * 2 + b.baseY * 0.05);
          alpha = (b.baseAlpha + state.cloudOpacity * b.fogScale) * breath * (1 - state.stormDarken * 0.18);
        } else {
          tint = mistHex;
          const breath = 0.88 + 0.12 * Math.sin(theta * 2 + b.baseY * 0.02);
          alpha = Math.min(0.92, (b.baseAlpha * 0.55 + state.fogDensity * b.fogScale) * breath);
        }

        b.spriteA.tint = tint;
        b.spriteB.tint = tint;
        b.spriteA.alpha = alpha;
        b.spriteB.alpha = alpha;
      }
    },
    destroy() {
      for (const b of bands) {
        b.texA.destroy(false);
        b.texB.destroy(false);
      }
    },
  };
}
