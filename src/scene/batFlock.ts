import { Container, Sprite } from 'pixi.js';
import type { ResolvedSceneState } from '../state/sceneState';
import type { SceneTextures } from './textures';

interface BatEntity {
  root: Container;
  leftWing: Sprite;
  rightWing: Sprite;
  body: Sprite;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  orbitFreqX: number;
  orbitFreqY: number;
  phaseX: number;
  phaseY: number;
  flapFreq: number;
  flapPhase: number;
  baseScale: number;
  depthAlpha: number;
}

export interface BatFlockController {
  container: Container;
  update(theta: number, state: ResolvedSceneState): void;
}

function buildBatParts(textures: SceneTextures, hasEyes: boolean): {
  root: Container;
  leftWing: Sprite;
  rightWing: Sprite;
  body: Sprite;
} {
  const root = new Container();

  const leftWing = new Sprite(textures.batWing);
  leftWing.anchor.set(56 / 64, 24 / 48);
  leftWing.scale.set(0.5);

  const rightWing = new Sprite(textures.batWing);
  rightWing.anchor.set(56 / 64, 24 / 48);
  rightWing.scale.set(-0.5, 0.5);

  const body = new Sprite(hasEyes ? textures.batBodyEyes : textures.batBody);
  body.anchor.set(12 / 24, 22 / 40);
  body.scale.set(0.5);

  root.addChild(leftWing, rightWing, body);
  return { root, leftWing, rightWing, body };
}

export function createBatFlock(textures: SceneTextures): BatFlockController {
  const container = new Container();

  // 8 gothic bats on closed periodic orbits (integer frequencies -> exact 24s loop)
  const specs = [
    { cx: 315, cy: 96, rx: 145, ry: 34, fx: 1, fy: 2, px: 0.2, py: 0.9, flap: 44, scale: 1.05, alpha: 0.95, eyes: true },
    { cx: 650, cy: 128, rx: 130, ry: 42, fx: 1, fy: 2, px: 3.3, py: 1.5, flap: 48, scale: 0.88, alpha: 0.92, eyes: true },
    { cx: 495, cy: 152, rx: 220, ry: 48, fx: 1, fy: 3, px: 1.1, py: 2.1, flap: 40, scale: 0.98, alpha: 0.94, eyes: true },
    { cx: 390, cy: 145, rx: 105, ry: 26, fx: 2, fy: 3, px: 2.4, py: 0.4, flap: 56, scale: 0.52, alpha: 0.78, eyes: false },
    { cx: 585, cy: 112, rx: 118, ry: 30, fx: 2, fy: 1, px: 4.5, py: 1.2, flap: 54, scale: 0.48, alpha: 0.75, eyes: false },
    { cx: 455, cy: 192, rx: 180, ry: 38, fx: 1, fy: 2, px: 5.1, py: 3.7, flap: 46, scale: 0.64, alpha: 0.84, eyes: false },
    { cx: 745, cy: 175, rx: 95, ry: 28, fx: 2, fy: 3, px: 0.7, py: 2.9, flap: 52, scale: 0.56, alpha: 0.80, eyes: false },
    { cx: 245, cy: 162, rx: 90, ry: 24, fx: 2, fy: 2, px: 3.8, py: 0.2, flap: 58, scale: 0.44, alpha: 0.72, eyes: false },
  ];

  const bats: BatEntity[] = specs.map((s, idx) => {
    const parts = buildBatParts(textures, s.eyes);
    container.addChild(parts.root);
    return {
      ...parts,
      cx: s.cx,
      cy: s.cy,
      rx: s.rx,
      ry: s.ry,
      orbitFreqX: s.fx,
      orbitFreqY: s.fy,
      phaseX: s.px,
      phaseY: s.py,
      flapFreq: s.flap,
      flapPhase: idx * 0.85,
      baseScale: s.scale,
      depthAlpha: s.alpha,
    };
  });

  return {
    container,
    update(theta, state) {
      container.alpha = state.bats;
      container.visible = state.bats > 0.01;
      if (!container.visible) return;

      for (const b of bats) {
        const ax = b.orbitFreqX * theta + b.phaseX;
        const ay = b.orbitFreqY * theta + b.phaseY;

        const x = b.cx + Math.cos(ax) * b.rx;
        const y = b.cy + Math.sin(ay) * b.ry;

        const vx = -Math.sin(ax) * b.rx * b.orbitFreqX;
        const vy = Math.cos(ay) * b.ry * b.orbitFreqY;

        b.root.position.set(x, y);
        b.root.rotation = Math.max(-0.42, Math.min(0.42, vy / 260)) + (vx < 0 ? -0.06 : 0.06);

        const depthPulse = 0.84 + 0.16 * Math.sin(ax);
        const dirScale = vx >= 0 ? 1 : -1;
        b.root.scale.set(b.baseScale * depthPulse * dirScale, b.baseScale * depthPulse);
        b.root.alpha = b.depthAlpha * (0.85 + 0.15 * depthPulse);

        const wingBeat = Math.sin(theta * b.flapFreq + b.flapPhase);
        const wingFold = 0.72 + 0.28 * Math.cos(theta * b.flapFreq + b.flapPhase);
        b.leftWing.rotation = wingBeat * 0.56;
        b.rightWing.rotation = -wingBeat * 0.56;
        b.leftWing.scale.set(0.5 * wingFold, 0.5 * (0.85 + 0.15 * wingBeat));
        b.rightWing.scale.set(-0.5 * wingFold, 0.5 * (0.85 + 0.15 * wingBeat));
      }
    },
  };
}
