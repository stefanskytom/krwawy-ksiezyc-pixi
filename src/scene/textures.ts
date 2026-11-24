import { Texture, TextureStyle } from 'pixi.js';
import { TWO_PI } from './constants';

export interface SceneTextures {
  glow: Texture;
  cloudTile: Texture;
  mistTile: Texture;
  rainStreak: Texture;
  particleSoft: Texture;
  candleFlame: Texture;
  rayFan: Texture;
  destroy(): void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for procedural textures');
  }
  return [canvas, ctx];
}

function createRadialGlowTexture(): Texture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.68)');
  grad.addColorStop(0.52, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/**
 * Generates a horizontally seamless periodic FBM texture via trigonometric harmonics
 * so TilingSprite scrolling has strictly zero horizontal seams.
 */
function createPeriodicFbmTexture(
  width: number,
  height: number,
  seed: number,
  verticalFade: 'cloud' | 'mist'
): Texture {
  const [canvas, ctx] = makeCanvas(width, height);
  const img = ctx.createImageData(width, height);
  const data = img.data;

  // Precompute deterministic periodic wave components (integer X frequencies -> 0-seam wrap)
  const waves: Array<{ fx: number; fy: number; ph: number; amp: number }> = [];
  let s = seed;
  const nextRand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const octaves = [
    { fxMin: 1, fxMax: 3, amp: 0.44 },
    { fxMin: 3, fxMax: 6, amp: 0.27 },
    { fxMin: 6, fxMax: 11, amp: 0.16 },
    { fxMin: 11, fxMax: 18, amp: 0.09 },
  ];

  for (const oct of octaves) {
    for (let k = 0; k < 4; k++) {
      const fx = Math.floor(oct.fxMin + nextRand() * (oct.fxMax - oct.fxMin + 1));
      const fy = 1.0 + nextRand() * (oct.fxMax * 0.7);
      const ph = nextRand() * TWO_PI;
      waves.push({ fx, fy, ph, amp: oct.amp * 0.25 });
    }
  }

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    // Vertical envelope ensures smooth fading at top and bottom edges
    const env =
      verticalFade === 'mist'
        ? Math.sin(Math.PI * Math.pow(ny, 0.88)) * (0.45 + 0.55 * ny)
        : Math.sin(Math.PI * ny) * (1.0 - 0.35 * ny);

    for (let x = 0; x < width; x++) {
      const nx = x / width;
      let val = 0;
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        val += Math.cos(TWO_PI * (w.fx * nx) + w.fy * ny * TWO_PI + w.ph) * w.amp;
      }
      // Normalize from roughly [-0.85..0.85] -> [0..1] with soft wispy contrast
      const normalized = Math.max(0, Math.min(1, val * 0.72 + 0.48));
      const wispy = Math.pow(normalized, verticalFade === 'mist' ? 1.55 : 1.85);
      const alpha = Math.max(0, Math.min(255, Math.round(wispy * env * 255)));

      const idx = (y * width + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.style = new TextureStyle({
    addressModeU: 'repeat',
    addressModeV: 'clamp-to-edge',
  });
  return tex;
}

function createRainStreakTexture(): Texture {
  const [canvas, ctx] = makeCanvas(8, 64);
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.92)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(4, 32, 1.4, 30, 0, 0, TWO_PI);
  ctx.fill();
  return Texture.from(canvas);
}

function createSoftParticleTexture(): Texture {
  const [canvas, ctx] = makeCanvas(32, 32);
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return Texture.from(canvas);
}

function createCandleFlameTexture(): Texture {
  const [canvas, ctx] = makeCanvas(32, 48);
  const grad = ctx.createRadialGradient(16, 30, 2, 16, 26, 20);
  grad.addColorStop(0.0, 'rgba(255,255,235,1.0)');
  grad.addColorStop(0.3, 'rgba(255,210,115,0.95)');
  grad.addColorStop(0.65, 'rgba(255,105,30,0.55)');
  grad.addColorStop(1.0, 'rgba(255,60,10,0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.bezierCurveTo(26, 18, 28, 36, 16, 44);
  ctx.bezierCurveTo(4, 36, 6, 18, 16, 4);
  ctx.fill();
  return Texture.from(canvas);
}

function createRayFanTexture(): Texture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(128, 0, 128, 256);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.20)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(108, 0);
  ctx.lineTo(148, 0);
  ctx.lineTo(240, 256);
  ctx.lineTo(16, 256);
  ctx.closePath();
  ctx.fill();
  return Texture.from(canvas);
}

export function createSceneTextures(): SceneTextures {
  const glow = createRadialGlowTexture();
  const cloudTile = createPeriodicFbmTexture(512, 256, 1337, 'cloud');
  const mistTile = createPeriodicFbmTexture(512, 256, 7919, 'mist');
  const rainStreak = createRainStreakTexture();
  const particleSoft = createSoftParticleTexture();
  const candleFlame = createCandleFlameTexture();
  const rayFan = createRayFanTexture();

  return {
    glow,
    cloudTile,
    mistTile,
    rainStreak,
    particleSoft,
    candleFlame,
    rayFan,
    destroy() {
      glow.destroy(true);
      cloudTile.destroy(true);
      mistTile.destroy(true);
      rainStreak.destroy(true);
      particleSoft.destroy(true);
      candleFlame.destroy(true);
      rayFan.destroy(true);
    },
  };
}
