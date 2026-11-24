import { Mesh, MeshGeometry, Shader, Texture } from 'pixi.js';
import {
  GRAVESTONE_SPOTS,
  MOON_RADIUS_NORM_H,
  MOON_UV,
  WORLD_H,
  WORLD_W,
} from './constants';
import type { ResolvedSceneState } from '../state/sceneState';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 finalColor;

uniform sampler2D uTexture;

uniform float uLoopTheta;
uniform float uWindStrength;
uniform float uAspect;
uniform vec2 uMoonCenter;
uniform float uMoonRadius;

uniform vec3 uMoonTint;
uniform vec3 uMistTint;
uniform vec3 uShadowTint;
uniform float uColorShift;
uniform float uExposure;
uniform float uEclipseAmount;
uniform float uMoonGlow;

uniform float uLanternAmount;
uniform float uCursorLight;
uniform vec2 uCursorPos;

uniform float uLightningFlash;
uniform vec2 uLightningPos;
uniform float uFogDensity;
uniform float uStormDarken;

uniform vec2 uCandle0;
uniform vec2 uCandle1;
uniform vec2 uCandle2;
uniform vec2 uCandle3;

float moonDistance(vec2 uv) {
  vec2 delta = uv - uMoonCenter;
  delta.x *= uAspect;
  return length(delta);
}

float candlePool(vec2 uv, vec2 pos, float flicker) {
  vec2 d = (uv - pos) * vec2(uAspect, 1.0);
  float dist = length(d);
  return exp(-dist * dist * 68.0) * (0.85 + 0.15 * flicker);
}

void main() {
  vec2 uv = vUV;
  float theta = uLoopTheta;

  // 1. Distance from moon center in aspect-corrected space (keeps moon disc 100% round)
  float mDist = moonDistance(uv);
  float outsideMoon = smoothstep(uMoonRadius * 0.98, uMoonRadius * 1.18, mDist);

  // 2. Painterly tree sway on left & right gnarled trees (anchored at roots)
  float rootAnchor = 1.0 - smoothstep(0.06, 0.94, uv.y);
  float leftTreeZone = (1.0 - smoothstep(0.14, 0.34, uv.x)) * smoothstep(0.04, 0.14, uv.y);
  float rightTreeZone = smoothstep(0.66, 0.86, uv.x) * smoothstep(0.04, 0.14, uv.y);

  float swayWaveL = sin(theta * 2.0 + uv.y * 7.5 + uv.x * 5.0) * 0.65
                  + sin(theta * 3.0 + uv.y * 13.0) * 0.35;
  float swayWaveR = sin(theta * 2.0 + uv.y * 8.0 - uv.x * 4.5 + 1.2) * 0.65
                  + cos(theta * 3.0 + uv.y * 12.0 + 0.7) * 0.35;

  float treeAmp = 0.0018 + uWindStrength * 0.0052;
  vec2 treeOffset = vec2(
    (leftTreeZone * swayWaveL + rightTreeZone * swayWaveR) * rootAnchor * treeAmp,
    (leftTreeZone * swayWaveL - rightTreeZone * swayWaveR) * rootAnchor * treeAmp * 0.18
  );

  // 3. Sky cloud billow warp (strictly masked outside the moon circle)
  float cloudMask = (1.0 - smoothstep(0.32, 0.58, uv.y)) * outsideMoon;
  float cloudAmp = 0.0014 + uWindStrength * 0.0022;
  vec2 cloudOffset = vec2(
    sin(theta * 2.0 + uv.y * 14.0 + uv.x * 6.283185) * cloudAmp,
    cos(theta * 3.0 + uv.x * 11.0 - uv.y * 8.0) * cloudAmp * 0.45
  ) * cloudMask;

  // 4. Lower horizon mist shimmer wave
  float mistWaveMask = smoothstep(0.54, 0.92, uv.y);
  float mistAmp = 0.0012 + uWindStrength * 0.0018;
  vec2 mistOffset = vec2(
    sin(theta * 3.0 + uv.y * 22.0 + uv.x * 9.0) * mistAmp,
    cos(theta * 2.0 + uv.x * 16.0) * mistAmp * 0.25
  ) * mistWaveMask;

  vec2 sampleUV = clamp(uv + treeOffset + cloudOffset + mistOffset, vec2(0.002), vec2(0.998));
  vec3 baseCol = texture(uTexture, sampleUV).rgb;

  // 5. Region-aware & hue-aware relighting (preserves blood default at uColorShift == 0)
  float lum = dot(baseCol, vec3(0.299, 0.587, 0.114));

  float warmEnergy = baseCol.r - max(baseCol.g, baseCol.b) * 0.72;
  float upperRegion = 1.0 - smoothstep(0.46, 0.76, uv.y);
  float moonProximity = 1.0 - smoothstep(uMoonRadius * 0.6, uMoonRadius * 2.4, mDist);
  float warmMask = clamp(smoothstep(0.03, 0.34, warmEnergy) * (0.55 * upperRegion + 0.65 * moonProximity), 0.0, 1.0);

  float coolEnergy = (baseCol.g + baseCol.b) * 0.5 - baseCol.r;
  float lowerRegion = smoothstep(0.30, 0.66, uv.y);
  float mistMask = clamp(smoothstep(0.015, 0.20, coolEnergy) * lowerRegion, 0.0, 1.0);

  // Reconstruct relit color preserving painted value/detail
  float detailBoost = pow(clamp(lum * 1.18, 0.0, 1.0), 0.88);
  vec3 recoloredShadow = mix(uShadowTint * (0.5 + lum * 1.8), baseCol * 0.85, 0.30);
  vec3 recoloredMist = uMistTint * (0.28 + detailBoost * 0.98);
  vec3 recoloredMoon = mix(uMoonTint * (0.35 + lum * 1.08), vec3(1.0) * lum * 1.12, smoothstep(0.58, 0.95, lum) * 0.62);

  vec3 relitCol = recoloredShadow;
  relitCol = mix(relitCol, recoloredMist, mistMask);
  relitCol = mix(relitCol, recoloredMoon, warmMask);
  // Keep moon disc bright & luminous in relit modes
  float insideDisc = 1.0 - smoothstep(uMoonRadius * 0.88, uMoonRadius * 1.02, mDist);
  float moonTextureLum = smoothstep(0.16, 0.82, lum);
  vec3 discRelit = mix(uMoonTint * (0.55 + moonTextureLum * 0.72), vec3(0.98, 0.99, 1.0), moonTextureLum * 0.48);
  relitCol = mix(relitCol, discRelit, insideDisc * 0.85 * smoothstep(0.18, 0.65, lum));

  vec3 col = mix(baseCol, relitCol, uColorShift);

  // 6. Eclipse umbra & fiery corona ring centered cleanly on (0.5029, 0.0694)
  if (uEclipseAmount > 0.001) {
    float umbraMask = 1.0 - smoothstep(uMoonRadius * 0.84, uMoonRadius * 0.97, mDist);
    float coronaRing = exp(-pow((mDist - uMoonRadius * 0.99) / (uMoonRadius * 0.085), 2.0));
    float coronaPulse = 0.92 + 0.08 * sin(theta * 4.0 + atan(uv.y - uMoonCenter.y, (uv.x - uMoonCenter.x) * uAspect) * 6.0);
    vec3 eclipsedDisc = col * 0.08 + vec3(0.05, 0.015, 0.02) * moonTextureLum;
    vec3 coronaGlow = vec3(1.0, 0.42, 0.10) * coronaRing * 1.35 * coronaPulse
                    + vec3(1.0, 0.86, 0.55) * pow(coronaRing, 3.0) * 0.85;
    col = mix(col, eclipsedDisc, umbraMask * uEclipseAmount * 0.95);
    col += coronaGlow * uEclipseAmount * smoothstep(0.15, 0.55, lum + coronaRing * 0.6);
  }

  // 7. Breathing lunar radiance & cloud rim glow
  float moonPulse = 0.90 + 0.10 * sin(theta * 2.0);
  float haloFalloff = exp(-mDist * mDist * 6.2);
  col += uMoonTint * haloFalloff * (0.20 * uMoonGlow * moonPulse);

  // 8. Storm darkening
  col *= (1.0 - uStormDarken * 0.26);

  // 9. Gravestone candle warm bounce light
  if (uLanternAmount > 0.001) {
    float f0 = sin(theta * 7.0 + 0.3) * 0.5 + sin(theta * 13.0) * 0.5;
    float f1 = sin(theta * 8.0 + 1.9) * 0.5 + cos(theta * 11.0) * 0.5;
    float f2 = cos(theta * 6.0 + 2.4) * 0.5 + sin(theta * 15.0) * 0.5;
    float f3 = sin(theta * 9.0 + 4.1) * 0.5 + cos(theta * 14.0) * 0.5;

    float bounce = candlePool(uv, uCandle0, f0)
                 + candlePool(uv, uCandle1, f1)
                 + candlePool(uv, uCandle2, f2)
                 + candlePool(uv, uCandle3, f3);
    col += vec3(1.0, 0.58, 0.20) * bounce * 0.42 * uLanternAmount * (0.45 + 0.75 * (1.0 - lum));
  }

  // 10. Interactive cursor lantern spotlight
  if (uCursorLight > 0.001) {
    vec2 cd = (uv - uCursorPos) * vec2(uAspect, 1.0);
    float cDist = length(cd);
    float spot = exp(-cDist * cDist * 22.0);
    vec3 lanternColor = mix(vec3(1.0, 0.72, 0.34), uMistTint * 1.15 + 0.25, 0.25);
    col += lanternColor * spot * 0.52 * uCursorLight * (0.38 + 0.62 * (1.0 - lum * 0.4));
  }

  // 11. Lightning strike illumination across clouds and tombstones
  if (uLightningFlash > 0.001) {
    vec2 ld = (uv - uLightningPos) * vec2(uAspect, 1.0);
    float lDist = length(ld);
    float skyFlash = exp(-lDist * lDist * 1.75) * (1.0 - smoothstep(0.45, 0.98, uv.y) * 0.55);
    float rimReveal = smoothstep(0.03, 0.35, lum) * 0.45 + 0.25;
    col += vec3(0.76, 0.88, 1.0) * uLightningFlash * (0.28 + 0.72 * skyFlash) * rimReveal;
  }

  // 12. Atmospheric fog veil in dense fog mode
  float fogBand = smoothstep(0.26, 0.88, uv.y) * (0.28 + 0.72 * (1.0 - lum * 0.5));
  float excessFog = max(0.0, uFogDensity - 0.34);
  col = mix(col, uMistTint * 0.52 + vec3(0.10, 0.13, 0.17), excessFog * fogBand * 0.42);

  // 13. Exposure & subtle gothic vignette
  col *= uExposure;
  vec2 vigDelta = uv - vec2(0.5, 0.48);
  float vig = 1.0 - dot(vigDelta, vigDelta) * 0.32;
  col *= clamp(vig, 0.72, 1.0);

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export interface ArtworkMeshController {
  mesh: Mesh<MeshGeometry, Shader>;
  update(theta: number, state: ResolvedSceneState, cursorUV: [number, number], lightningFlash: number, lightningUV: [number, number]): void;
  destroy(): void;
}

export function createArtworkMesh(texture: Texture): ArtworkMeshController {
  texture.source.addressMode = 'clamp-to-edge';

  const geometry = new MeshGeometry({
    positions: new Float32Array([
      0, 0,
      WORLD_W, 0,
      WORLD_W, WORLD_H,
      0, WORLD_H,
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });

  const shader = Shader.from({
    gl: {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
    },
    resources: {
      uTexture: texture.source,
      sceneUniforms: {
        uLoopTheta: { value: 0, type: 'f32' },
        uWindStrength: { value: 0.3, type: 'f32' },
        uAspect: { value: WORLD_W / WORLD_H, type: 'f32' },
        uMoonCenter: { value: [MOON_UV.x, MOON_UV.y], type: 'vec2<f32>' },
        uMoonRadius: { value: MOON_RADIUS_NORM_H, type: 'f32' },

        uMoonTint: { value: [1.0, 0.28, 0.14], type: 'vec3<f32>' },
        uMistTint: { value: [0.24, 0.74, 0.80], type: 'vec3<f32>' },
        uShadowTint: { value: [0.09, 0.04, 0.09], type: 'vec3<f32>' },
        uColorShift: { value: 0.0, type: 'f32' },
        uExposure: { value: 1.0, type: 'f32' },
        uEclipseAmount: { value: 0.0, type: 'f32' },
        uMoonGlow: { value: 1.0, type: 'f32' },

        uLanternAmount: { value: 1.0, type: 'f32' },
        uCursorLight: { value: 0.0, type: 'f32' },
        uCursorPos: { value: [0.5, 0.5], type: 'vec2<f32>' },

        uLightningFlash: { value: 0.0, type: 'f32' },
        uLightningPos: { value: [0.5, 0.2], type: 'vec2<f32>' },
        uFogDensity: { value: 0.34, type: 'f32' },
        uStormDarken: { value: 0.0, type: 'f32' },

        uCandle0: { value: [GRAVESTONE_SPOTS[0].x / WORLD_W, GRAVESTONE_SPOTS[0].y / WORLD_H], type: 'vec2<f32>' },
        uCandle1: { value: [GRAVESTONE_SPOTS[1].x / WORLD_W, GRAVESTONE_SPOTS[1].y / WORLD_H], type: 'vec2<f32>' },
        uCandle2: { value: [GRAVESTONE_SPOTS[2].x / WORLD_W, GRAVESTONE_SPOTS[2].y / WORLD_H], type: 'vec2<f32>' },
        uCandle3: { value: [GRAVESTONE_SPOTS[3].x / WORLD_W, GRAVESTONE_SPOTS[3].y / WORLD_H], type: 'vec2<f32>' },
      },
    },
  });

  const mesh = new Mesh({
    geometry,
    shader,
    texture,
  });

  const uniforms = shader.resources.sceneUniforms.uniforms as Record<string, any>;

  return {
    mesh,
    update(theta, state, cursorUV, lightningFlash, lightningUV) {
      uniforms.uLoopTheta = theta;
      uniforms.uWindStrength = state.windStrength;

      uniforms.uMoonTint[0] = state.moonTint[0];
      uniforms.uMoonTint[1] = state.moonTint[1];
      uniforms.uMoonTint[2] = state.moonTint[2];

      uniforms.uMistTint[0] = state.mistTint[0];
      uniforms.uMistTint[1] = state.mistTint[1];
      uniforms.uMistTint[2] = state.mistTint[2];

      uniforms.uShadowTint[0] = state.shadowTint[0];
      uniforms.uShadowTint[1] = state.shadowTint[1];
      uniforms.uShadowTint[2] = state.shadowTint[2];

      uniforms.uColorShift = state.colorShift;
      uniforms.uExposure = state.exposure;
      uniforms.uEclipseAmount = state.eclipseAmount;
      uniforms.uMoonGlow = state.moonGlow;

      uniforms.uLanternAmount = state.lanterns;
      uniforms.uCursorLight = state.cursorLight;
      uniforms.uCursorPos[0] = cursorUV[0];
      uniforms.uCursorPos[1] = cursorUV[1];

      uniforms.uLightningFlash = lightningFlash;
      uniforms.uLightningPos[0] = lightningUV[0];
      uniforms.uLightningPos[1] = lightningUV[1];
      uniforms.uFogDensity = state.fogDensity;
      uniforms.uStormDarken = state.stormDarken;
    },
    destroy() {
      mesh.destroy({ children: true });
      geometry.destroy();
      shader.destroy(true);
    },
  };
}
