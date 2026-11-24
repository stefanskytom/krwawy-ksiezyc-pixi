import { Container, Sprite, Texture } from 'pixi.js';
import { MOON_CENTER, MOON_RADIUS, WORLD_H, WORLD_W } from './constants';
import { rgbTupleToHex, type ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

export interface ArtworkLayerController {
  normalContainer: Container;
  addContainer: Container;
  update(
    theta: number,
    state: ResolvedSceneState,
    lightningFlash: number,
    lightningUV: [number, number]
  ): void;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

export function createArtworkLayer(
  artworkTexture: Texture,
  textures: SceneTextures
): ArtworkLayerController {
  artworkTexture.source.addressMode = 'clamp-to-edge';

  const normalContainer = new Container();
  const addContainer = new Container();

  // Base painting sprite animated purely via GPU transforms (skew + subtle scale)
  const artworkSprite = new Sprite(artworkTexture);
  artworkSprite.anchor.set(0.5, 1.0);
  artworkSprite.position.set(WORLD_W * 0.5, WORLD_H);

  // Eclipse dark lunar umbra disc
  const eclipseUmbra = new Sprite(textures.eclipseUmbra);
  eclipseUmbra.anchor.set(0.5);
  eclipseUmbra.position.set(MOON_CENTER.x, MOON_CENTER.y);
  eclipseUmbra.visible = false;

  // Atmospheric dense fog veil over lower graveyard (uses soft-feathered mistBand)
  const fogVeil = new Sprite(textures.mistBand);
  fogVeil.position.set(0, 140);
  fogVeil.width = WORLD_W;
  fogVeil.height = WORLD_H - 110;
  fogVeil.visible = false;

  normalContainer.addChild(artworkSprite, eclipseUmbra, fogVeil);

  // Additive eclipse corona ring
  const eclipseCorona = new Sprite(textures.eclipseCorona);
  eclipseCorona.anchor.set(0.5);
  eclipseCorona.position.set(MOON_CENTER.x, MOON_CENTER.y);
  eclipseCorona.blendMode = 'add';
  eclipseCorona.visible = false;

  // Additive lightning sky glow & atmospheric wash
  const lightningGlow = new Sprite(textures.glow);
  lightningGlow.anchor.set(0.5);
  lightningGlow.blendMode = 'add';
  lightningGlow.tint = 0xb8dcff;
  lightningGlow.width = 760;
  lightningGlow.height = 540;
  lightningGlow.visible = false;

  const lightningWash = new Sprite(textures.whitePixel);
  lightningWash.position.set(0, 0);
  lightningWash.width = WORLD_W;
  lightningWash.height = WORLD_H;
  lightningWash.blendMode = 'add';
  lightningWash.tint = 0x9bc8ff;
  lightningWash.visible = false;

  addContainer.addChild(eclipseCorona, lightningGlow, lightningWash);

  return {
    normalContainer,
    addContainer,
    update(theta, state, lightningFlash, lightningUV) {
      // Wind-driven tree & sky sway around bottom ground anchor
      const sway =
        Math.sin(theta * 2) * 0.65 +
        Math.sin(theta * 3) * 0.35;
      artworkSprite.skew.x = sway * (0.0022 + state.windStrength * 0.0055);
      artworkSprite.scale.set(
        1.018 + Math.sin(theta) * 0.003,
        1.018 + Math.cos(theta * 2) * 0.003
      );

      // Tint combines lighting mode color, exposure, and storm darkening
      const mul = state.exposure * (1 - state.stormDarken * 0.28);
      const r = clampByte(state.artworkTint[0] * mul);
      const g = clampByte(state.artworkTint[1] * mul);
      const b = clampByte(state.artworkTint[2] * mul);
      artworkSprite.tint = (r << 16) | (g << 8) | b;

      // Eclipse umbra & fiery corona
      const hasEclipse = state.eclipseAmount > 0.01;
      eclipseUmbra.visible = hasEclipse;
      eclipseCorona.visible = hasEclipse;
      if (hasEclipse) {
        const umbraSize = MOON_RADIUS * 2.72 * (0.992 + 0.008 * Math.sin(theta * 2));
        eclipseUmbra.width = umbraSize;
        eclipseUmbra.height = umbraSize;
        eclipseUmbra.alpha = state.eclipseAmount * 0.94;

        const coronaSize = MOON_RADIUS * 2.76 * (0.985 + 0.02 * Math.sin(theta * 4));
        eclipseCorona.width = coronaSize;
        eclipseCorona.height = coronaSize;
        eclipseCorona.rotation = theta * 0.5;
        eclipseCorona.alpha = state.eclipseAmount * (0.85 + 0.12 * Math.sin(theta * 3));
      }

      // Fog veil in dense fog mode
      const excessFog = Math.max(0, state.fogDensity - 0.34);
      fogVeil.visible = excessFog > 0.005;
      if (fogVeil.visible) {
        fogVeil.tint = rgbTupleToHex(state.mistTint);
        fogVeil.alpha = excessFog * 0.38;
      }

      // Lightning illumination
      const hasFlash = lightningFlash > 0.01;
      lightningGlow.visible = hasFlash;
      lightningWash.visible = hasFlash;
      if (hasFlash) {
        lightningGlow.position.set(lightningUV[0] * WORLD_W, lightningUV[1] * WORLD_H);
        lightningGlow.alpha = lightningFlash * 0.45;
        lightningWash.alpha = lightningFlash * 0.14;
      }
    },
  };
}
