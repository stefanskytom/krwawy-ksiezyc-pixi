import { Container, Graphics, Sprite } from 'pixi.js';
import { LOOP_DURATION, TWO_PI, WORLD_H, WORLD_W } from './constants';
import { rgbTupleToHex, type ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

interface MoteParticle {
  sprite: Sprite;
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  freqX: number;
  freqY: number;
  phase: number;
  baseAlpha: number;
}

interface RainDrop {
  sprite: Sprite;
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
}

interface RainSplash {
  gfx: Graphics;
  x: number;
  y: number;
  phase: number;
  freq: number;
  scale: number;
}

interface SnowFlake {
  sprite: Sprite;
  x: number;
  y: number;
  fallSpeed: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  size: number;
  baseAlpha: number;
}

interface EmberParticle {
  sprite: Sprite;
  x: number;
  y: number;
  riseSpeed: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  size: number;
  isAsh: boolean;
}

interface LightningStrikeState {
  u: number;
  originX: number;
  targetX: number;
  targetY: number;
  seed: number;
}

export interface WeatherLayerController {
  container: Container;
  lightningFlash: number;
  lightningUV: [number, number];
  update(dt: number, loopTime: number, theta: number, state: ResolvedSceneState): void;
}

function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Deterministic well-spaced storm strikes inside the 24s loop (~8s apart),
 * guaranteeing <= 0.13 flashes/s (well below WCAG 2.3.1 3 flashes/s threshold).
 */
const STRIKE_SCHEDULE: readonly LightningStrikeState[] = [
  { u: 0.14, originX: 295, targetX: 240, targetY: 365, seed: 101 },
  { u: 0.49, originX: 735, targetX: 785, targetY: 382, seed: 202 },
  { u: 0.81, originX: 430, targetX: 390, targetY: 345, seed: 303 },
];

function drawForkedBolt(gfx: Graphics, strike: LightningStrikeState, alpha: number): void {
  gfx.clear();
  if (alpha <= 0.015) return;

  const rand = createPrng(strike.seed);
  const segments = 12;
  const pts: Array<{ x: number; y: number }> = [{ x: strike.originX, y: -6 }];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = strike.originX + (strike.targetX - strike.originX) * t;
    const baseY = -6 + (strike.targetY + 6) * t;
    const jitter = (1 - Math.abs(t - 0.5) * 1.4) * 34;
    pts.push({
      x: baseX + (rand() - 0.5) * jitter,
      y: baseY + (rand() - 0.5) * 8,
    });
  }

  // Outer glow stroke
  gfx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    gfx.lineTo(pts[i].x, pts[i].y);
  }
  gfx.stroke({ width: 7, color: 0x8fc4ff, alpha: alpha * 0.34, cap: 'round', join: 'round' });

  // Inner bright core
  gfx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    gfx.lineTo(pts[i].x, pts[i].y);
  }
  gfx.stroke({ width: 2.2, color: 0xf4f9ff, alpha: alpha * 0.96, cap: 'round', join: 'round' });

  // 3 jagged sub-branches
  for (const branchIdx of [3, 6, 8]) {
    const start = pts[branchIdx];
    const dir = rand() > 0.5 ? 1 : -1;
    let bx = start.x;
    let by = start.y;
    gfx.moveTo(bx, by);
    for (let s = 0; s < 4; s++) {
      bx += dir * (12 + rand() * 18);
      by += 16 + rand() * 18;
      gfx.lineTo(bx, by);
    }
    gfx.stroke({ width: 1.4, color: 0xd4ecff, alpha: alpha * 0.72, cap: 'round', join: 'round' });
  }
}

export function createWeatherLayer(textures: SceneTextures): WeatherLayerController {
  const container = new Container();
  const rand = createPrng(9001);

  // 1. Calm atmospheric dust motes (purely periodic -> exact 24s loop)
  const motesContainer = new Container();
  const motes: MoteParticle[] = [];
  for (let i = 0; i < 45; i++) {
    const sprite = new Sprite(textures.particleSoft);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    const size = 2.5 + rand() * 4.2;
    sprite.width = size;
    sprite.height = size;
    motesContainer.addChild(sprite);
    motes.push({
      sprite,
      baseX: rand() * WORLD_W,
      baseY: 160 + rand() * (WORLD_H - 180),
      ampX: 16 + rand() * 34,
      ampY: 10 + rand() * 24,
      freqX: 1 + Math.floor(rand() * 2),
      freqY: 1 + Math.floor(rand() * 3),
      phase: rand() * TWO_PI,
      baseAlpha: 0.25 + rand() * 0.48,
    });
  }

  // 2. Rain streaks + splash rings
  const rainContainer = new Container();
  const raindrops: RainDrop[] = [];
  for (let i = 0; i < 240; i++) {
    const sprite = new Sprite(textures.rainStreak);
    sprite.anchor.set(0.5);
    const depth = 0.45 + rand() * 0.55;
    sprite.width = 1.6 + depth * 1.4;
    const len = 28 + depth * 32;
    sprite.height = len;
    rainContainer.addChild(sprite);
    raindrops.push({
      sprite,
      x: rand() * (WORLD_W + 260) - 130,
      y: rand() * (WORLD_H + 120) - 60,
      speed: 580 + depth * 420,
      length: len,
      alpha: 0.18 + depth * 0.36,
    });
  }

  const splashes: RainSplash[] = [];
  for (let i = 0; i < 26; i++) {
    const gfx = new Graphics();
    rainContainer.addChild(gfx);
    splashes.push({
      gfx,
      x: 40 + rand() * (WORLD_W - 80),
      y: 488 + rand() * 78,
      phase: rand() * TWO_PI,
      freq: 14 + Math.floor(rand() * 10),
      scale: 0.65 + rand() * 0.65,
    });
  }

  // 3. Snowflakes
  const snowContainer = new Container();
  const snowflakes: SnowFlake[] = [];
  for (let i = 0; i < 160; i++) {
    const sprite = new Sprite(textures.particleSoft);
    sprite.anchor.set(0.5);
    const depth = 0.35 + rand() * 0.65;
    const size = 2.6 + depth * 6.5;
    sprite.width = size;
    sprite.height = size;
    snowContainer.addChild(sprite);
    snowflakes.push({
      sprite,
      x: rand() * WORLD_W,
      y: rand() * WORLD_H,
      fallSpeed: 28 + depth * 44,
      swayAmp: 12 + rand() * 22,
      swayFreq: 2 + Math.floor(rand() * 3),
      phase: rand() * TWO_PI,
      size,
      baseAlpha: 0.35 + depth * 0.55,
    });
  }

  // 4. Embers & Ash
  const embersContainer = new Container();
  const embers: EmberParticle[] = [];
  for (let i = 0; i < 155; i++) {
    const isAsh = i >= 105;
    const sprite = new Sprite(textures.particleSoft);
    sprite.anchor.set(0.5);
    sprite.blendMode = isAsh ? 'normal' : 'add';
    const size = isAsh ? 2.4 + rand() * 3.8 : 2.8 + rand() * 5.2;
    sprite.width = size;
    sprite.height = size;
    embersContainer.addChild(sprite);
    embers.push({
      sprite,
      x: rand() * WORLD_W,
      y: rand() * WORLD_H,
      riseSpeed: isAsh ? 22 + rand() * 28 : 48 + rand() * 72,
      swayAmp: 16 + rand() * 34,
      swayFreq: 2 + Math.floor(rand() * 3),
      phase: rand() * TWO_PI,
      size,
      isAsh,
    });
  }

  // 5. Forked Lightning Graphic
  const lightningGfx = new Graphics();
  lightningGfx.blendMode = 'add';

  container.addChild(motesContainer, rainContainer, snowContainer, embersContainer, lightningGfx);

  let activeStrikeIndex = -1;
  const controller: WeatherLayerController = {
    container,
    lightningFlash: 0,
    lightningUV: [0.5, 0.2],
    update(dt, loopTime, theta, state) {
      const particleHex = rgbTupleToHex(state.particleRgb);
      const mistHex = rgbTupleToHex(state.mistTint);
      const moonHex = rgbTupleToHex(state.moonTint);
      const windX = state.windStrength;

      // 1. Calm motes
      motesContainer.visible = state.calmMotes > 0.015;
      if (motesContainer.visible) {
        motesContainer.alpha = state.calmMotes;
        for (const m of motes) {
          const x = m.baseX + Math.sin(theta * m.freqX + m.phase) * m.ampX * (1 + windX * 0.8);
          const y = m.baseY + Math.cos(theta * m.freqY + m.phase) * m.ampY;
          const twinkle = 0.55 + 0.45 * Math.sin(theta * 3 + m.phase * 2);
          m.sprite.position.set(((x % WORLD_W) + WORLD_W) % WORLD_W, y);
          m.sprite.tint = particleHex;
          m.sprite.alpha = m.baseAlpha * twinkle;
        }
      }

      // 2. Rain & ground splashes
      rainContainer.visible = state.rainDensity > 0.015;
      if (rainContainer.visible) {
        rainContainer.alpha = state.rainDensity;
        const slantAngle = 0.08 + windX * 0.34;
        const horizVel = Math.tan(slantAngle);

        for (const drop of raindrops) {
          const dy = drop.speed * (0.85 + state.rainDensity * 0.35) * dt;
          drop.y += dy;
          drop.x -= dy * horizVel;
          if (drop.y > WORLD_H + 40) {
            drop.y -= WORLD_H + 80;
          }
          if (drop.x < -140) {
            drop.x += WORLD_W + 280;
          } else if (drop.x > WORLD_W + 140) {
            drop.x -= WORLD_W + 280;
          }
          drop.sprite.position.set(drop.x, drop.y);
          drop.sprite.rotation = slantAngle;
          drop.sprite.tint = mistHex;
          drop.sprite.alpha = drop.alpha;
        }

        for (const sp of splashes) {
          const prog = ((theta * sp.freq + sp.phase) % TWO_PI) / TWO_PI;
          sp.gfx.clear();
          if (prog < 0.75) {
            const k = prog / 0.75;
            const r = (2 + k * 9) * sp.scale;
            sp.gfx
              .ellipse(sp.x, sp.y, r, r * 0.34)
              .stroke({ width: 1.1, color: 0xcbe9ff, alpha: (1 - k) * 0.38 * state.rainDensity });
          }
        }
      }

      // 3. Snowflakes
      snowContainer.visible = state.snowDensity > 0.015;
      if (snowContainer.visible) {
        snowContainer.alpha = state.snowDensity;
        const driftX = (14 + windX * 115) * dt;
        for (const fl of snowflakes) {
          fl.y += fl.fallSpeed * dt;
          fl.x += driftX;
          if (fl.y > WORLD_H + 16) {
            fl.y -= WORLD_H + 32;
          }
          if (fl.x > WORLD_W + 20) {
            fl.x -= WORLD_W + 40;
          }
          const sway = Math.sin(theta * fl.swayFreq + fl.phase) * fl.swayAmp;
          fl.sprite.position.set(fl.x + sway, fl.y);
          fl.sprite.tint = particleHex;
          fl.sprite.alpha = fl.baseAlpha;
        }
      }

      // 4. Embers & Ash
      embersContainer.visible = state.embersDensity > 0.015;
      if (embersContainer.visible) {
        embersContainer.alpha = state.embersDensity;
        const emberHoriz = (10 + windX * 85) * dt;
        for (const em of embers) {
          em.y -= em.riseSpeed * dt;
          em.x += emberHoriz;
          if (em.y < -20) {
            em.y += WORLD_H + 40;
          }
          if (em.x > WORLD_W + 20) {
            em.x -= WORLD_W + 40;
          }
          const sway = Math.sin(theta * em.swayFreq + em.phase) * em.swayAmp;
          const flicker = 0.58 + 0.42 * Math.sin(theta * 9 + em.phase * 2);
          em.sprite.position.set(em.x + sway, em.y);
          em.sprite.tint = em.isAsh ? 0x625a64 : (state.colorShift > 0.5 ? moonHex : 0xff6e2b);
          em.sprite.alpha = em.isAsh ? 0.45 : 0.88 * flicker;
        }
      }

      // 5. WCAG 2.3.1-safe deterministic lightning flashes
      let flashVal = 0;
      let strikeFound = -1;
      const u = (loopTime % LOOP_DURATION) / LOOP_DURATION;

      if (state.lightning > 0.02) {
        for (let i = 0; i < STRIKE_SCHEDULE.length; i++) {
          const strike = STRIKE_SCHEDULE[i];
          let du = u - strike.u;
          if (du < 0) du += 1;
          const elapsedSec = du * LOOP_DURATION;
          if (elapsedSec < 0.48) {
            const decay = Math.exp(-elapsedSec * 8.2);
            if (decay > flashVal) {
              flashVal = decay * state.lightning;
              strikeFound = i;
            }
          }
        }
      }

      controller.lightningFlash = flashVal;
      if (strikeFound >= 0) {
        const s = STRIKE_SCHEDULE[strikeFound];
        controller.lightningUV[0] = s.originX / WORLD_W;
        controller.lightningUV[1] = 0.16;
        if (activeStrikeIndex !== strikeFound || flashVal > 0.02) {
          drawForkedBolt(lightningGfx, s, flashVal);
          activeStrikeIndex = strikeFound;
        }
      } else {
        if (activeStrikeIndex !== -1) {
          lightningGfx.clear();
          activeStrikeIndex = -1;
        }
      }
    },
  };

  return controller;
}
