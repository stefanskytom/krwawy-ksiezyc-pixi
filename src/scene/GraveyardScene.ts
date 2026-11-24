import 'pixi.js/prepare';
import { Application, Assets, Container, Texture, UPDATE_PRIORITY } from 'pixi.js';
import { LOOP_DURATION, TWO_PI, WORLD_H, WORLD_W } from './constants';
import {
  createInitialResolvedState,
  stepResolvedState,
  type ResolvedSceneState,
  type SceneSettings,
} from '../state/sceneState';
import { createSceneTextures, type SceneTextures } from './textures';
import { createArtworkLayer } from './artworkLayer';
import { createMoonLayer } from './moonLayer';
import { createCloudMistLayer, type CloudMistLayerController } from './cloudMistLayer';
import { createBatFlock } from './batFlock';
import { createLightsLayer } from './lightsLayer';
import { createWeatherLayer } from './weatherLayer';
import {
  createPerfStats,
  type PerfSnapshot,
  type PerfStatsController,
} from './perfStats';

const ARTWORK_URL = './assets/graveyard-clean.png';

export class GraveyardScene {
  private app: Application;
  private stageRoot: Container;
  private textures: SceneTextures | null = null;
  private cloudMistLayer: CloudMistLayerController | null = null;
  private perfStats: PerfStatsController | null = null;
  private resolvedState: ResolvedSceneState;
  private loopTime = 0;
  private cursorUV: [number, number] = [0.5, 0.5];
  private targetCursorUV: [number, number] = [0.5, 0.5];
  private initialized = false;
  private destroyed = false;
  private cleanupListeners: (() => void) | null = null;

  constructor(
    private hostElement: HTMLElement,
    private settings: SceneSettings,
    private onLoopProgress?: (progress: number) => void,
    private onPerfStats?: (snapshot: PerfSnapshot) => void
  ) {
    this.app = new Application();
    this.stageRoot = new Container();
    this.resolvedState = createInitialResolvedState(settings);
  }

  async init(): Promise<void> {
    await this.app.init({
      preference: 'webgl',
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      backgroundAlpha: 0,
      autoStart: false,
      resizeTo: this.hostElement,
      eventMode: 'none',
      eventFeatures: {
        move: false,
        globalMove: false,
        click: false,
        wheel: false,
      },
      gcActive: true,
      gcMaxUnusedTime: 30_000,
      gcFrequency: 15_000,
    });
    this.initialized = true;

    if (this.destroyed) {
      this.app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
      return;
    }

    this.app.stage.interactiveChildren = false;
    this.stageRoot.interactiveChildren = false;

    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.hostElement.appendChild(this.app.canvas);

    const artworkTexture = await Assets.load<Texture>(ARTWORK_URL);
    if (this.destroyed) {
      void Assets.unload(ARTWORK_URL);
      return;
    }

    this.textures = createSceneTextures();
    const artworkLayer = createArtworkLayer(artworkTexture, this.textures);
    const moonLayer = createMoonLayer(this.textures);
    this.cloudMistLayer = createCloudMistLayer(this.textures);
    const batFlock = createBatFlock(this.textures);
    const lightsLayer = createLightsLayer(this.textures);
    const weatherLayer = createWeatherLayer(this.textures);

    // Group strictly into 2 consecutive blend-mode passes -> minimal draw calls
    const normalLayer = new Container();
    normalLayer.interactiveChildren = false;
    normalLayer.addChild(
      artworkLayer.normalContainer,
      this.cloudMistLayer.normalContainer,
      batFlock.container,
      lightsLayer.normalContainer,
      weatherLayer.normalContainer
    );

    const addLayer = new Container();
    addLayer.interactiveChildren = false;
    addLayer.addChild(
      moonLayer.container,
      artworkLayer.addContainer,
      this.cloudMistLayer.addContainer,
      lightsLayer.addContainer,
      weatherLayer.addContainer
    );

    this.stageRoot.addChild(normalLayer, addLayer);
    this.app.stage.addChild(this.stageRoot);

    this.layoutStage(this.app.screen.width, this.app.screen.height);
    const onResize = (w: number, h: number) => this.layoutStage(w, h);
    this.app.renderer.on('resize', onResize);

    const resizeObserver = new ResizeObserver(() => this.app.queueResize());
    resizeObserver.observe(this.hostElement);

    const onPointerMove = (ev: PointerEvent) => {
      if (!this.settings.cursorLight) return;
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

    await this.app.renderer.prepare.upload(this.app.stage);
    if (this.destroyed) {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      this.app.renderer.off('resize', onResize);
      return;
    }

    this.perfStats = createPerfStats(this.app, this.stageRoot, this.onPerfStats);

    this.cleanupListeners = () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      this.app.renderer.off('resize', onResize);
    };

    this.app.ticker.add((ticker) => {
      if (this.destroyed) return;

      const rawDt = Math.min(ticker.deltaMS / 1000, 0.05);
      stepResolvedState(this.resolvedState, this.settings, rawDt);

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
      artworkLayer.update(
        theta,
        this.resolvedState,
        weatherLayer.lightningFlash,
        weatherLayer.lightningUV
      );
      moonLayer.update(theta, this.resolvedState);
      this.cloudMistLayer?.update(simDt, theta, this.resolvedState);
      batFlock.update(theta, this.resolvedState);
      lightsLayer.update(theta, this.resolvedState, this.cursorUV);
    });

    this.app.ticker.add(
      (ticker) => {
        if (!this.destroyed) {
          this.perfStats?.tick(ticker.deltaMS);
        }
      },
      undefined,
      UPDATE_PRIORITY.UTILITY
    );

    this.app.start();
  }

  private layoutStage(viewW: number, viewH: number): void {
    const w = viewW || this.hostElement.clientWidth || window.innerWidth;
    const h = viewH || this.hostElement.clientHeight || window.innerHeight;
    const scale = Math.min(w / WORLD_W, h / WORLD_H);

    this.stageRoot.scale.set(scale);
    this.stageRoot.position.set(
      (w - WORLD_W * scale) * 0.5,
      (h - WORLD_H * scale) * 0.5
    );
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.cleanupListeners?.();
    this.cleanupListeners = null;

    this.perfStats?.destroy();
    this.perfStats = null;

    this.cloudMistLayer?.destroy();
    this.cloudMistLayer = null;

    this.textures?.destroy();
    this.textures = null;

    void Assets.unload(ARTWORK_URL);

    if (this.initialized) {
      this.app.destroy(
        { removeView: true, releaseGlobalResources: true },
        { children: true }
      );
    }
  }
}
