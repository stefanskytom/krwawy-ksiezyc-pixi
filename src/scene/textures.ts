import { Rectangle, Texture } from 'pixi.js';
import { TWO_PI } from './constants';

export interface SceneTextures {
  cloudBand: Texture;
  mistBand: Texture;
  glow: Texture;
  rayFan: Texture;
  eclipseCorona: Texture;
  eclipseUmbra: Texture;
  particleSoft: Texture;
  rainStreak: Texture;
  candleFlame: Texture;
  splashRing: Texture;
  candleWax: Texture;
  batWing: Texture;
  batBody: Texture;
  batBodyEyes: Texture;
  whitePixel: Texture;
  lightningBolt: Texture;
  destroy(): void;
}

const ATLAS_SIZE = 512;

function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Writes a horizontally seamless periodic FBM band into the atlas with
 * 1px horizontal edge extrusion so side-by-side Sprites wrap with zero seam.
 */
function paintPeriodicFbmRegion(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  width: number,
  height: number,
  seed: number,
  verticalFade: 'cloud' | 'mist'
): void {
  const img = ctx.createImageData(width + 2, height);
  const data = img.data;
  const rand = createPrng(seed);

  const waves: Array<{ fx: number; fy: number; ph: number; amp: number }> = [];
  const octaves = [
    { fxMin: 1, fxMax: 3, amp: 0.44 },
    { fxMin: 3, fxMax: 6, amp: 0.27 },
    { fxMin: 6, fxMax: 11, amp: 0.16 },
    { fxMin: 11, fxMax: 18, amp: 0.09 },
  ];

  for (const oct of octaves) {
    for (let k = 0; k < 4; k++) {
      const fx = Math.floor(oct.fxMin + rand() * (oct.fxMax - oct.fxMin + 1));
      const fy = 1.0 + rand() * (oct.fxMax * 0.7);
      const ph = rand() * TWO_PI;
      waves.push({ fx, fy, ph, amp: oct.amp * 0.25 });
    }
  }

  const stride = width + 2;
  for (let y = 0; y < height; y++) {
    const ny = y / (height - 1);
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
      const normalized = Math.max(0, Math.min(1, val * 0.72 + 0.48));
      const wispy = Math.pow(normalized, verticalFade === 'mist' ? 1.55 : 1.85);
      const alpha = Math.max(0, Math.min(255, Math.round(wispy * env * 255)));

      const idx = (y * stride + (x + 1)) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }

    // 1px horizontal wrap extrusion into padding border
    const firstIdx = (y * stride + 1) * 4;
    const lastIdx = (y * stride + width) * 4;
    const leftPad = (y * stride) * 4;
    const rightPad = (y * stride + width + 1) * 4;
    for (let c = 0; c < 4; c++) {
      data[leftPad + c] = data[lastIdx + c];
      data[rightPad + c] = data[firstIdx + c];
    }
  }

  ctx.putImageData(img, ox - 1, oy);
}

function paintRadialGlow(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number
): void {
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(ox + half, oy + half, 0, ox + half, oy + half, half - 1);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.68)');
  grad.addColorStop(0.52, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, size, size);
}

function paintRayFan(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number
): void {
  ctx.save();
  ctx.translate(ox, oy);
  const grad = ctx.createLinearGradient(size * 0.5, 0, size * 0.5, size);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.20)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(size * (108 / 256), 0);
  ctx.lineTo(size * (148 / 256), 0);
  ctx.lineTo(size * (240 / 256), size);
  ctx.lineTo(size * (16 / 256), size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintEclipseCorona(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number
): void {
  const half = size * 0.5;
  const ringR = 45;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half;
      const dy = y - half;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const dr = (dist - ringR) / 4.2;
      const ring = Math.exp(-dr * dr);
      const flare = 0.88 + 0.12 * Math.sin(angle * 6.0) + 0.08 * Math.cos(angle * 11.0);
      const outerHalo = dist >= ringR ? Math.exp(-Math.pow((dist - ringR) / 10.5, 2)) * 0.45 : 0;
      const innerCut = Math.max(0, Math.min(1, (dist - (ringR - 4.5)) / 4.5));

      const intensity = Math.min(1, (ring * 1.1 + outerHalo) * flare * innerCut);
      const coreBoost = Math.pow(ring, 3.0);

      const r = Math.min(255, Math.round(255 * intensity));
      const g = Math.min(255, Math.round((112 + 128 * coreBoost) * intensity));
      const b = Math.min(255, Math.round((32 + 165 * coreBoost) * intensity));
      const a = Math.min(255, Math.round(intensity * 255));

      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(img, ox, oy);
}

function paintEclipseUmbra(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number
): void {
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(ox + half, oy + half, 38, ox + half, oy + half, 49);
  grad.addColorStop(0.0, 'rgba(9, 3, 6, 1.0)');
  grad.addColorStop(0.72, 'rgba(12, 4, 7, 0.96)');
  grad.addColorStop(1.0, 'rgba(12, 4, 7, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, size, size);
}

function paintSoftParticle(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number
): void {
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(ox + half, oy + half, 0, ox + half, oy + half, half - 1);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, size, size);
}

function paintRainStreak(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.translate(ox, oy);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.92)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.5, 1.4, h * 0.5 - 2, 0, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function paintCandleFlame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number
): void {
  ctx.save();
  ctx.translate(ox, oy);
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
  ctx.restore();
}

function paintSplashRing(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number
): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(32, 16, 24, 8.2, 0, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();
}

function paintCandleWax(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number
): void {
  ctx.save();
  ctx.translate(ox + 8, oy + 22);
  ctx.fillStyle = 'rgba(217, 203, 184, 0.9)';
  ctx.beginPath();
  ctx.roundRect(-5, -20, 10, 22, 3);
  ctx.fill();

  ctx.fillStyle = '#2b221e';
  ctx.fillRect(-1, -26, 2, 7);
  ctx.restore();
}

function paintBatWing(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number
): void {
  ctx.save();
  ctx.translate(ox + 56, oy + 24);
  ctx.scale(2, 2);
  ctx.fillStyle = '#0a070b';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-9, -11, -18, -10, -24, -2);
  ctx.quadraticCurveTo(-18, 2, -15, 7);
  ctx.quadraticCurveTo(-10, 2, -7, 6);
  ctx.quadraticCurveTo(-3, 2, 0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintBatBody(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  withEyes: boolean
): void {
  ctx.save();
  ctx.translate(ox + 12, oy + 22);
  ctx.scale(2, 2);
  ctx.fillStyle = '#080509';
  ctx.beginPath();
  ctx.moveTo(-2.5, -4);
  ctx.lineTo(-4, -9.5);
  ctx.lineTo(-1, -6);
  ctx.lineTo(1, -6);
  ctx.lineTo(4, -9.5);
  ctx.lineTo(2.5, -4);
  ctx.quadraticCurveTo(3.8, 2, 0, 7);
  ctx.quadraticCurveTo(-3.8, 2, -2.5, -4);
  ctx.closePath();
  ctx.fill();

  if (withEyes) {
    ctx.fillStyle = 'rgba(255, 61, 42, 0.92)';
    ctx.beginPath();
    ctx.arc(-1.2, -3.5, 0.75, 0, TWO_PI);
    ctx.arc(1.2, -3.5, 0.75, 0, TWO_PI);
    ctx.fill();
  }
  ctx.restore();
}

function paintLightningBolt(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  const rand = createPrng(101);
  const segments = 12;
  const pts: Array<{ x: number; y: number }> = [{ x: w * 0.5, y: 2 }];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const jitter = (1 - Math.abs(t - 0.5) * 1.4) * 34;
    pts.push({
      x: w * 0.5 + (rand() - 0.5) * jitter,
      y: 2 + (h - 8) * t + (rand() - 0.5) * 6,
    });
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokeMain = (width: number, style: string) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  };

  strokeMain(10, 'rgba(143, 196, 255, 0.28)');
  strokeMain(4.5, 'rgba(170, 215, 255, 0.55)');
  strokeMain(2.0, 'rgba(244, 249, 255, 0.98)');

  for (const branchIdx of [3, 6, 8]) {
    const start = pts[branchIdx];
    const dir = branchIdx === 6 ? -1 : 1;
    let bx = start.x;
    let by = start.y;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    for (let s = 0; s < 4; s++) {
      bx += dir * (10 + rand() * 14);
      by += 12 + rand() * 14;
      ctx.lineTo(bx, by);
    }
    ctx.strokeStyle = 'rgba(212, 236, 255, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

export function createSceneTextures(): SceneTextures {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for procedural atlas');
  }

  // Row 1 (y: 0..127): Seamless periodic FBM cloud & mist bands (with 1px wrap extrusion)
  paintPeriodicFbmRegion(ctx, 2, 2, 252, 124, 1337, 'cloud');
  paintPeriodicFbmRegion(ctx, 258, 2, 252, 124, 7919, 'mist');

  // Row 2 (y: 128..255): Glow, god rays, eclipse corona, eclipse umbra
  paintRadialGlow(ctx, 2, 130, 124);
  paintRayFan(ctx, 130, 130, 124);
  paintEclipseCorona(ctx, 258, 130, 124);
  paintEclipseUmbra(ctx, 386, 130, 124);

  // Row 3 (y: 256..511): Particles, weather streaks/splashes, candle, bat silhouettes, white pixel, lightning
  paintSoftParticle(ctx, 2, 258, 32);
  paintRainStreak(ctx, 38, 258, 8, 64);
  paintCandleFlame(ctx, 50, 258);
  paintSplashRing(ctx, 86, 258);
  paintCandleWax(ctx, 154, 258);
  paintBatWing(ctx, 174, 258);
  paintBatBody(ctx, 242, 258, false);
  paintBatBody(ctx, 270, 258, true);

  // White pixel padded with 2px solid border so linear filtering never fades edges when scaled
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(2, 296, 12, 12);

  paintLightningBolt(ctx, 384, 258, 124, 250);

  const atlasBase = Texture.from(canvas);
  const source = atlasBase.source;
  source.addressMode = 'clamp-to-edge';

  const slice = (x: number, y: number, w: number, h: number): Texture =>
    new Texture({
      source,
      frame: new Rectangle(x, y, w, h),
    });

  const cloudBand = slice(2, 2, 252, 124);
  const mistBand = slice(258, 2, 252, 124);
  const glow = slice(2, 130, 124, 124);
  const rayFan = slice(130, 130, 124, 124);
  const eclipseCorona = slice(258, 130, 124, 124);
  const eclipseUmbra = slice(386, 130, 124, 124);
  const particleSoft = slice(2, 258, 32, 32);
  const rainStreak = slice(38, 258, 8, 64);
  const candleFlame = slice(50, 258, 32, 48);
  const splashRing = slice(86, 258, 64, 32);
  const candleWax = slice(154, 258, 16, 24);
  const batWing = slice(174, 258, 64, 48);
  const batBody = slice(242, 258, 24, 40);
  const batBodyEyes = slice(270, 258, 24, 40);
  const whitePixel = slice(4, 298, 8, 8);
  const lightningBolt = slice(384, 258, 124, 250);

  return {
    cloudBand,
    mistBand,
    glow,
    rayFan,
    eclipseCorona,
    eclipseUmbra,
    particleSoft,
    rainStreak,
    candleFlame,
    splashRing,
    candleWax,
    batWing,
    batBody,
    batBodyEyes,
    whitePixel,
    lightningBolt,
    destroy() {
      cloudBand.destroy(false);
      mistBand.destroy(false);
      glow.destroy(false);
      rayFan.destroy(false);
      eclipseCorona.destroy(false);
      eclipseUmbra.destroy(false);
      particleSoft.destroy(false);
      rainStreak.destroy(false);
      candleFlame.destroy(false);
      splashRing.destroy(false);
      candleWax.destroy(false);
      batWing.destroy(false);
      batBody.destroy(false);
      batBodyEyes.destroy(false);
      whitePixel.destroy(false);
      lightningBolt.destroy(false);
      atlasBase.destroy(true);
    },
  };
}
