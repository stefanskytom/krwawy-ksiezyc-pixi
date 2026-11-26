import {
  Container,
  ImageSource,
  Texture,
  Ticker,
  UPDATE_PRIORITY,
  WebGLRenderer,
  type TextureSource,
} from 'pixi.js';
import { LOOP_DURATION, TWO_PI, WORLD_H, WORLD_W } from './constants';
import {
  createInitialResolvedState,
  isResolvedStateSettled,
  stepResolvedState,
  type FitMode,
  type ResolvedSceneState,
  type SceneSettings,
} from '../state/sceneState';
import { createSceneTextures, type SceneTextures } from './textures';
import { createArtworkLayer } from './artworkLayer';
import { createMoonLayer } from './moonLayer';
import { createCloudMistLayer, type CloudMistLayerController } from './cloudMistLayer';
import { createBatFlock } from './batFlock';
import { createLightsLayer } from './lightsLayer';
import { createWeatherLayer, type WeatherLayerController } from './weatherLayer';
import {
  createPerfStats,
  type PerfSnapshot,
  type PerfStatsController,
} from './perfStats';

const ARTWORK_URL = './assets/graveyard-clean.webp';
const MAX_BACKING_PIXELS = 2560 * 1440;

async function loadArtworkTexture(
  url: string
): Promise<{ texture: Texture; bitmap: ImageBitmap | null }> {
  if (typeof createImageBitmap === 'function') {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load artwork (${res.status}): ${url}`);
    }
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const source = new ImageSource({
      resource: bitmap,
      addressMode: 'clamp-to-edge',
    });
    return {
      texture: new Texture({ source }),
      bitmap,
    };
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load artwork image: ${url}`));
    el.src = url;
  });
  const source = new ImageSource({
    resource: img,
    addressMode: 'clamp-to-edge',
  });
  return {
    texture: new Texture({ source }),
    bitmap: null,
  };
}

export class GraveyardScene {
  private renderer: WebGLRenderer;
  private stage: Container;
  private stageRoot: Container;
  private ticker: Ticker;
  private textures: SceneTextures | null = null;
  private artworkTexture: Texture | null = null;
  private artworkBitmap: ImageBitmap | null = null;
  private cloudMistLayer: CloudMistLayerController | null = null;
  private weatherLayer: WeatherLayerController | null = null;
  private perfStats: PerfStatsController | null = null;
  private resolvedState: ResolvedSceneState;
  private loopTime = 0;
  private cursorUV: [number, number] = [0.5, 0.5];
  private targetCursorUV: [number, number] = [0.5, 0.5];
  private initialized = false;
  private destroyed = false;
  private sleeping = false;
  private statsEnabled: boolean;
  private lastCanvasW = 0;
  private lastCanvasH = 0;
  private lastResolution = 0;
  private cleanupListeners: (() => void) | null = null;

  constructor(
    private hostElement: HTMLElement,
    private settings: SceneSettings,
    private onLoopProgress?: (progress: number) => void,
    private onPerfStats?: (snapshot: PerfSnapshot) => void,
    initialStatsEnabled = true
  ) {
    this.renderer = new WebGLRenderer();
    this.stage = new Container();
    this.stage.interactiveChildren = false;
    this.stageRoot = new Container();
    this.stageRoot.interactiveChildren = false;
    this.ticker = new Ticker();
    this.ticker.autoStart = false;
    this.resolvedState = createInitialResolvedState(settings);
    this.statsEnabled = initialStatsEnabled;
  }

  private computeResolution(cssW: number, cssH: number): number {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxResForBudget = Math.sqrt(MAX_BACKING_PIXELS / Math.max(1, cssW * cssH));
    return Math.max(1, Math.min(dpr, maxResForBudget));
  }

  private applyLayout(forceRender = true): void {
    if (!this.initialized || this.destroyed) return;

    const hostW = Math.max(1, Math.round(this.hostElement.clientWidth || window.innerWidth));
    const hostH = Math.max(1, Math.round(this.hostElement.clientHeight || window.innerHeight));

    let canvasW: number;
    let canvasH: number;

    if (this.settings.fitMode === 'cover') {
      canvasW = hostW;
      canvasH = hostH;
      const scale = Math.max(hostW / WORLD_W, hostH / WORLD_H);
      this.stageRoot.scale.set(scale);
      this.stageRoot.position.set(
        (hostW - WORLD_W * scale) * 0.5,
        (hostH - WORLD_H * scale) * 0.38
      );
    } else {
      const scale = Math.min(hostW / WORLD_W, hostH / WORLD_H);
      canvasW = Math.max(1, Math.floor(WORLD_W * scale));
      canvasH = Math.max(1, Math.floor(WORLD_H * scale));
      this.stageRoot.scale.set(canvasW / WORLD_W, canvasH / WORLD_H);
      this.stageRoot.position.set(0, 0);
    }

    const resolution = this.computeResolution(canvasW, canvasH);
    if (
      canvasW !== this.lastCanvasW ||
      canvasH !== this.lastCanvasH ||
      Math.abs(resolution - this.lastResolution) > 0.001
    ) {
      this.lastCanvasW = canvasW;
      this.lastCanvasH = canvasH;
      this.lastResolution = resolution;
      this.renderer.resize(canvasW, canvasH, resolution);
    }

    this.weatherLayer?.setViewportWidth(hostW);

    if (forceRender && this.textures) {
      this.renderer.render({ container: this.stage });
    }
  }

  async init(): Promise<void> {
    const initW = Math.max(1, Math.round(this.hostElement.clientWidth || window.innerWidth));
    const initH = Math.max(1, Math.round(this.hostElement.clientHeight || window.innerHeight));
    const initRes = this.computeResolution(initW, initH);

    try {
      await this.renderer.init({
        width: initW,
        height: initH,
        antialias: false,
        resolution: initRes,
        autoDensity: true,
        backgroundAlpha: 0,
        skipExtensionImports: true,
        gcActive: true,
        gcMaxUnusedTime: 30_000,
        gcFrequency: 15_000,
      });
    } catch (err) {
      console.warn('WebGL initialization failed; showing static artwork fallback.', err);
      this.hostElement.classList.add('webgl-fallback');
      return;
    }

    this.initialized = true;
    this.lastCanvasW = initW;
    this.lastCanvasH = initH;
    this.lastResolution = initRes;

    if (this.destroyed) {
      this.stage.destroy({ children: true });
      this.renderer.destroy({ removeView: true, releaseGlobalResources: true });
      return;
    }

    this.renderer.canvas.setAttribute('aria-hidden', 'true');
    this.hostElement.appendChild(this.renderer.canvas);

    const loaded = await loadArtworkTexture(ARTWORK_URL);
    if (this.destroyed) {
      loaded.texture.destroy(true);
      loaded.bitmap?.close();
      return;
    }
    this.artworkTexture = loaded.texture;
    this.artworkBitmap = loaded.bitmap;

    this.textures = createSceneTextures();
    const artworkLayer = createArtworkLayer(this.artworkTexture, this.textures);
    const moonLayer = createMoonLayer(this.textures);
    this.cloudMistLayer = createCloudMistLayer(this.textures);
    const batFlock = createBatFlock(this.textures);
    const lightsLayer = createLightsLayer(this.textures);
    this.weatherLayer = createWeatherLayer(this.textures);

    // Group strictly into 2 consecutive blend-mode passes -> minimal draw calls
    const normalLayer = new Container();
    normalLayer.interactiveChildren = false;
    normalLayer.addChild(
      artworkLayer.normalContainer,
      this.cloudMistLayer.normalContainer,
      batFlock.container,
      lightsLayer.normalContainer,
      this.weatherLayer.normalContainer
    );

    const addLayer = new Container();
    addLayer.interactiveChildren = false;
    addLayer.addChild(
      moonLayer.container,
      artworkLayer.addContainer,
      this.cloudMistLayer.addContainer,
      lightsLayer.addContainer,
      this.weatherLayer.addContainer
    );

    this.stageRoot.addChild(normalLayer, addLayer);
    this.stage.addChild(this.stageRoot);

    this.renderer.texture.initSource(this.artworkTexture.source);
    this.renderer.texture.initSource(this.textures.atlasSource);

    this.applyLayout(false);

    const resizeObserver = new ResizeObserver(() => this.applyLayout(true));
    resizeObserver.observe(this.hostElement);

    let dprMedia: MediaQueryList | null = null;
    const onDprChange = (): void => {
      if (this.destroyed) return;
      this.applyLayout(true);
      bindDprWatcher();
    };
    const bindDprWatcher = (): void => {
      dprMedia?.removeEventListener('change', onDprChange);
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprMedia.addEventListener('change', onDprChange, { once: true });
    };
    bindDprWatcher();

    const onPointerMove = (ev: PointerEvent) => {
      if (!this.settings.cursorLight) return;
      const rect = this.renderer.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const localX = (px - this.stageRoot.x) / this.stageRoot.scale.x;
      const localY = (py - this.stageRoot.y) / this.stageRoot.scale.y;
      this.targetCursorUV[0] = Math.max(0, Math.min(1, localX / WORLD_W));
      this.targetCursorUV[1] = Math.max(0, Math.min(1, localY / WORLD_H));
      this.wake();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onVisibilityChange = (): void => {
      if (this.destroyed) return;
      if (document.hidden) {
        this.ticker.stop();
      } else if (!this.sleeping) {
        this.ticker.start();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const trackedSources: readonly TextureSource[] = [
      this.artworkTexture.source,
      this.textures.atlasSource,
    ];
    this.perfStats = createPerfStats(
      this.renderer,
      this.stageRoot,
      trackedSources,
      this.onPerfStats
    );
    this.perfStats.setEnabled(this.statsEnabled);

    this.cleanupListeners = () => {
      resizeObserver.disconnect();
      dprMedia?.removeEventListener('change', onDprChange);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const stepAndRender = (deltaMS: number): void => {
      const rawDt = Math.min(deltaMS / 1000, 0.05);
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

      this.weatherLayer!.update(simDt, this.loopTime, theta, this.resolvedState);
      artworkLayer.update(
        theta,
        this.resolvedState,
        this.weatherLayer!.lightningFlash,
        this.weatherLayer!.lightningUV
      );
      moonLayer.update(theta, this.resolvedState);
      this.cloudMistLayer?.update(simDt, theta, this.resolvedState);
      batFlock.update(theta, this.resolvedState);
      lightsLayer.update(theta, this.resolvedState, this.cursorUV);

      this.renderer.render({ container: this.stage });

      if (this.settings.paused && isResolvedStateSettled(this.resolvedState, this.settings)) {
        const cursorSettled =
          !this.settings.cursorLight ||
          Math.hypot(
            this.targetCursorUV[0] - this.cursorUV[0],
            this.targetCursorUV[1] - this.cursorUV[1]
          ) < 0.001;
        if (cursorSettled) {
          this.sleeping = true;
          this.ticker.stop();
        }
      }
    };

    this.ticker.add((ticker) => {
      if (this.destroyed) return;
      stepAndRender(ticker.deltaMS);
    });

    this.ticker.add(
      (ticker) => {
        if (!this.destroyed) {
          this.perfStats?.tick(ticker.deltaMS);
        }
      },
      undefined,
      UPDATE_PRIORITY.UTILITY
    );

    if (document.hidden) {
      stepAndRender(16.67);
    } else {
      this.ticker.start();
    }
  }

  wake(): void {
    if (!this.initialized || this.destroyed) return;
    this.sleeping = false;
    if (!document.hidden && !this.ticker.started) {
      this.ticker.start();
    }
  }

  setFitMode(mode: FitMode): void {
    this.settings.fitMode = mode;
    this.applyLayout(true);
    this.wake();
  }

  setStatsEnabled(enabled: boolean): void {
    this.statsEnabled = enabled;
    this.perfStats?.setEnabled(enabled);
    if (enabled) {
      this.wake();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.ticker.destroy();

    this.cleanupListeners?.();
    this.cleanupListeners = null;

    this.perfStats?.destroy();
    this.perfStats = null;

    this.cloudMistLayer?.destroy();
    this.cloudMistLayer = null;

    this.textures?.destroy();
    this.textures = null;

    this.artworkTexture?.destroy(true);
    this.artworkTexture = null;

    this.artworkBitmap?.close();
    this.artworkBitmap = null;

    this.stage.destroy({ children: true });

    if (this.initialized) {
      this.renderer.destroy({ removeView: true, releaseGlobalResources: true });
    }
  }
}
