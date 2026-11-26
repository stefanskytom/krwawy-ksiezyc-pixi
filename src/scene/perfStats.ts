import { Container, Sprite, type TextureSource, type WebGLRenderer } from 'pixi.js';

export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  renderMs: number;
  drawCalls: number;
  triangles: number;
  activeSprites: number;
  meshCount: number;
  textureCount: number;
  vramMB: number;
  jsHeapMB: number | null;
  rendererType: string;
}

export interface PerfStatsController {
  setEnabled(enabled: boolean): void;
  tick(deltaMs: number): void;
  destroy(): void;
}

interface CountResult {
  sprites: number;
  meshes: number;
}

function countSceneObjects(node: Container, out: CountResult): void {
  if (!node.visible) return;
  if (node instanceof Sprite) {
    out.sprites += 1;
  } else if ((node as { renderPipeId?: string }).renderPipeId === 'mesh') {
    out.meshes += 1;
  }
  const children = node.children;
  for (let i = 0; i < children.length; i++) {
    countSceneObjects(children[i], out);
  }
}

function triCountForMode(mode: number, count: number, gl: WebGLRenderingContext): number {
  if (mode === gl.TRIANGLES) return Math.floor(count / 3);
  if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) return Math.max(0, count - 2);
  return 0;
}

export function createPerfStats(
  renderer: WebGLRenderer,
  stageRoot: Container,
  trackedSources: readonly TextureSource[],
  onUpdate?: (snapshot: PerfSnapshot) => void
): PerfStatsController {
  const gl = renderer.gl;
  const rendererType =
    typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
      ? 'WebGL 2'
      : 'WebGL';

  let enabled = false;
  let frameDrawCalls = 0;
  let frameTriangles = 0;
  let lastDrawCalls = 0;
  let lastTriangles = 0;
  let lastRenderMs = 0;

  let origDrawElements: WebGLRenderingContext['drawElements'] | null = null;
  let origDrawArrays: WebGLRenderingContext['drawArrays'] | null = null;
  let origDrawElementsInstanced: WebGL2RenderingContext['drawElementsInstanced'] | null = null;
  let origDrawArraysInstanced: WebGL2RenderingContext['drawArraysInstanced'] | null = null;
  let origRender: ((...args: unknown[]) => void) | null = null;

  let smoothedFrameMs = 16.67;
  let smoothedRenderMs = 0.5;
  let accumMs = 200;
  const counts: CountResult = { sprites: 0, meshes: 0 };

  const snapshot: PerfSnapshot = {
    fps: 60,
    frameMs: 16.67,
    renderMs: 0,
    drawCalls: 0,
    triangles: 0,
    activeSprites: 0,
    meshCount: 0,
    textureCount: 0,
    vramMB: 0,
    jsHeapMB: null,
    rendererType,
  };

  const attachWrappers = (): void => {
    if (origRender) return;

    origDrawElements = gl.drawElements.bind(gl);
    gl.drawElements = (mode: number, count: number, type: number, offset: number): void => {
      frameDrawCalls += 1;
      frameTriangles += triCountForMode(mode, count, gl);
      origDrawElements!(mode, count, type, offset);
    };

    origDrawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = (mode: number, first: number, count: number): void => {
      frameDrawCalls += 1;
      frameTriangles += triCountForMode(mode, count, gl);
      origDrawArrays!(mode, first, count);
    };

    const gl2 = gl as WebGL2RenderingContext;
    if (typeof gl2.drawElementsInstanced === 'function') {
      origDrawElementsInstanced = gl2.drawElementsInstanced.bind(gl2);
      gl2.drawElementsInstanced = (
        mode: number,
        count: number,
        type: number,
        offset: number,
        instanceCount: number
      ): void => {
        frameDrawCalls += 1;
        frameTriangles += triCountForMode(mode, count, gl) * Math.max(1, instanceCount);
        origDrawElementsInstanced!(mode, count, type, offset, instanceCount);
      };
    }

    if (typeof gl2.drawArraysInstanced === 'function') {
      origDrawArraysInstanced = gl2.drawArraysInstanced.bind(gl2);
      gl2.drawArraysInstanced = (
        mode: number,
        first: number,
        count: number,
        instanceCount: number
      ): void => {
        frameDrawCalls += 1;
        frameTriangles += triCountForMode(mode, count, gl) * Math.max(1, instanceCount);
        origDrawArraysInstanced!(mode, first, count, instanceCount);
      };
    }

    origRender = renderer.render as (...args: unknown[]) => void;
    (renderer as { render: (...args: unknown[]) => void }).render = function (
      this: unknown,
      ...args: unknown[]
    ): void {
      frameDrawCalls = 0;
      frameTriangles = 0;
      const t0 = performance.now();
      origRender!.apply(this, args);
      lastRenderMs = performance.now() - t0;
      lastDrawCalls = frameDrawCalls;
      lastTriangles = frameTriangles;
    };
  };

  const detachWrappers = (): void => {
    if (origRender) {
      (renderer as { render: (...args: unknown[]) => void }).render = origRender;
      origRender = null;
    }

    if (origDrawElements) {
      gl.drawElements = origDrawElements;
      origDrawElements = null;
    }
    if (origDrawArrays) {
      gl.drawArrays = origDrawArrays;
      origDrawArrays = null;
    }
    const gl2 = gl as WebGL2RenderingContext;
    if (origDrawElementsInstanced) {
      gl2.drawElementsInstanced = origDrawElementsInstanced;
      origDrawElementsInstanced = null;
    }
    if (origDrawArraysInstanced) {
      gl2.drawArraysInstanced = origDrawArraysInstanced;
      origDrawArraysInstanced = null;
    }
  };

  return {
    setEnabled(nextEnabled) {
      if (nextEnabled === enabled) return;
      enabled = nextEnabled;
      if (enabled) {
        attachWrappers();
        accumMs = 200;
      } else {
        detachWrappers();
      }
    },
    tick(deltaMs: number) {
      if (!enabled) return;

      const clampedMs = Math.max(0.1, Math.min(deltaMs, 250));
      smoothedFrameMs += (clampedMs - smoothedFrameMs) * 0.14;
      smoothedRenderMs += (lastRenderMs - smoothedRenderMs) * 0.2;
      accumMs += deltaMs;

      if (accumMs < 200) return;
      accumMs = 0;

      counts.sprites = 0;
      counts.meshes = 0;
      countSceneObjects(stageRoot, counts);

      let texCount = 0;
      let vramBytes = 0;
      for (let i = 0; i < trackedSources.length; i++) {
        const src = trackedSources[i];
        if (!src || src.destroyed) continue;
        texCount += 1;
        vramBytes += src.pixelWidth * src.pixelHeight * 4;
      }

      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const jsHeapMB = mem ? mem.usedJSHeapSize / (1024 * 1024) : null;

      snapshot.fps = Math.round(1000 / Math.max(1, smoothedFrameMs));
      snapshot.frameMs = smoothedFrameMs;
      snapshot.renderMs = smoothedRenderMs;
      snapshot.drawCalls = lastDrawCalls;
      snapshot.triangles = lastTriangles;
      snapshot.activeSprites = counts.sprites;
      snapshot.meshCount = counts.meshes;
      snapshot.textureCount = texCount;
      snapshot.vramMB = vramBytes / (1024 * 1024);
      snapshot.jsHeapMB = jsHeapMB;

      onUpdate?.(snapshot);
    },
    destroy() {
      enabled = false;
      detachWrappers();
    },
  };
}
