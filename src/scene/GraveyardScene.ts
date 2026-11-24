import { Application, Assets, Container, Texture } from 'pixi.js';
import { LOOP_DURATION, TWO_PI, WORLD_H, WORLD_W } from './constants';
import {
  createInitialResolvedState,
  stepResolvedState,
  type ResolvedSceneState,
  type SceneSettings,
} from '../state/sceneState';
import { createSceneTextures, type SceneTextures } from './textures';
import { createArtworkMesh, type ArtworkMeshController } from './artworkMesh';
import { createMoonLayer } from './moonLayer';
import { createCloudMistLayer } from './cloudMistLayer';
import { createBatFlock } from './batFlock';
import { createLightsLayer } from './lightsLayer';
import { createWeatherLayer } from './weatherLayer';

export class GraveyardScene {
  private app: Application;
  private stageRoot: Container;
  private textures: SceneTextures | null = null;
  private artwork: ArtworkMeshController | null = null;
  private resolvedState: ResolvedSceneState;
  private loopTime = 0;
  private cursorUV: [number, number] = [0.5, 0.5];
  private targetCursorUV: [number, number] = [0.5, 0.5];
  private destroyed = false;

  constructor(
    private hostElement: HTMLElement,
    private settings: SceneSettings,
    private onLoopProgress?: (progress: number) => void
  ) {
    this.app = new Application();
    this.stageRoot = new Container();
    this.resolvedState = createInitialResolvedState(settings);
  }

  async init(): Promise<void> {
    await this.app.init({
      preference: 'webgl',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      backgroundAlpha: 0,
      resizeTo: this.hostElement,
    });

    if (this.destroyed) return;

    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.hostElement.appendChild(this.app.canvas);

    const artworkTexture = await Assets.load<Texture>('./assets/graveyard-clean.png');
    if (this.destroyed) return;

    this.textures = createSceneTextures();
    this.artwork = createArtworkMesh(artworkTexture);

    const moonLayer = createMoonLayer(this.textures);
    const cloudMistLayer = createCloudMistLayer(this.textures);
    const batFlock = createBatFlock();
    const lightsLayer = createLightsLayer(this.textures);
    const weatherLayer = createWeatherLayer(this.textures);

    this.stageRoot.addChild(
      this.artwork.mesh,
      moonLayer.container,
      cloudMistLayer.container,
      batFlock.container,
      lightsLayer.container,
      weatherLayer.container
    );

    this.app.stage.addChild(this.stageRoot);

    this.layoutStage();
    const resizeObserver = new ResizeObserver(() => this.layoutStage());
    resizeObserver.observe(this.hostElement);

    const onPointerMove = (ev: PointerEvent) => {
      const rect = this.app.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const localX = (px - this.stageRoot.x) / this.stageRoot.scale.x;
      const localY = (py - this.stageRoot.y) / this.stageRoot.scale.y;
      this.targetCursorUV[0] = Math.max(0, Math.min(1, localX / WORLD_W));
      this.targetCursorUV[1] = Math.max(0, Math.min(1, localY / WORLD_H));
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    this.app.ticker.add((ticker) => {
      if (this.destroyed) return;

      const rawDt = Math.min(ticker.deltaMS / 1000, 0.05);
      // Always advance UI state transitions even while paused
      stepResolvedState(this.resolvedState, this.settings, rawDt);

      // Smooth cursor lantern movement
      const cAlpha = 1 - Math.exp(-10 * rawDt);
      this.cursorUV[0] += (this.targetCursorUV[0] - this.cursorUV[0]) * cAlpha;
      this.cursorUV[1] += (this.targetCursorUV[1] - this.cursorUV[1]) * cAlpha;

      const speedMul = this.settings.paused ? 0 : this.settings.reducedMotion ? 0.25 : 1.0;
      const simDt = rawDt * speedMul;

      this.loopTime = (this.loopTime + simDt) % LOOP_DURATION;
      const progress = this.loopTime / LOOP_DURATION;
      const theta = progress * TWO_PI;

      this.onLoopProgress?.(progress);

      weatherLayer.update(simDt, this.loopTime, theta, this.resolvedState);
      this.artwork?.update(
        theta,
        this.resolvedState,
        this.cursorUV,
        weatherLayer.lightningFlash,
        weatherLayer.lightningUV
      );
      moonLayer.update(theta, this.resolvedState);
      cloudMistLayer.update(simDt, theta, this.resolvedState);
      batFlock.update(theta, this.resolvedState);
      lightsLayer.update(theta, this.resolvedState, this.cursorUV);
    });

    // Clean up DOM/ResizeObserver on destroy
    const originalDestroy = this.destroy.bind(this);
    this.destroy = () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      originalDestroy();
    };
  }

  private layoutStage(): void {
    const viewW = this.hostElement.clientWidth || window.innerWidth;
    const viewH = this.hostElement.clientHeight || window.innerHeight;
    const scale = Math.min(viewW / WORLD_W, viewH / WORLD_H);

    this.stageRoot.scale.set(scale);
    this.stageRoot.position.set(
      (viewW - WORLD_W * scale) * 0.5,
      (viewH - WORLD_H * scale) * 0.5
    );
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.artwork?.destroy();
    this.textures?.destroy();
    this.app.destroy(true, { children: true });
  }
}
