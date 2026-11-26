import './styles.css';
import { GraveyardScene } from './scene/GraveyardScene';
import {
  createInitialSettings,
  LIGHTING_PALETTES,
  type LightingMode,
  type WeatherMode,
} from './state/sceneState';

// Load input-switch-polyfill ONLY when native <input type="checkbox" switch> is unsupported
if (!('switch' in HTMLInputElement.prototype)) {
  void import('input-switch-polyfill');
  void import('input-switch-polyfill/input-switch-polyfill.css');
}

const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
const settings = createInitialSettings(motionMedia.matches);

const stageEl = document.getElementById('stage');
if (!stageEl) {
  throw new Error('Missing #stage container');
}

const progressBar = document.getElementById('loop-progress-bar');

const statRenderer = document.getElementById('stat-renderer');
const statFps = document.getElementById('stat-fps');
const statFrameMs = document.getElementById('stat-frame-ms');
const statDrawCalls = document.getElementById('stat-draw-calls');
const statTriangles = document.getElementById('stat-triangles');
const statSprites = document.getElementById('stat-sprites');
const statMeshes = document.getElementById('stat-meshes');
const statVram = document.getElementById('stat-vram');
const statHeap = document.getElementById('stat-heap');

const statsHud = document.getElementById('perf-stats');
const toggleStatsBtn = document.getElementById('toggle-stats-btn') as HTMLButtonElement | null;
const statsBody = document.getElementById('stats-body');

const isCompactViewport = window.innerWidth <= 720 || window.innerHeight <= 540;
if (isCompactViewport && statsBody && statsHud && toggleStatsBtn) {
  toggleStatsBtn.setAttribute('aria-expanded', 'false');
  toggleStatsBtn.textContent = 'Pokaż';
  statsBody.hidden = true;
  statsHud.classList.add('is-collapsed');
}

const scene = new GraveyardScene(
  stageEl,
  settings,
  (progress) => {
    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
    }
  },
  (stats) => {
    if (statRenderer) statRenderer.textContent = stats.rendererType;
    if (statFps) statFps.textContent = String(stats.fps);
    if (statFrameMs) {
      statFrameMs.textContent = `${stats.frameMs.toFixed(1)} / ${stats.renderMs.toFixed(2)}`;
    }
    if (statDrawCalls) statDrawCalls.textContent = String(stats.drawCalls);
    if (statTriangles) statTriangles.textContent = String(stats.triangles);
    if (statSprites) statSprites.textContent = String(stats.activeSprites);
    if (statMeshes) statMeshes.textContent = String(stats.meshCount);
    if (statVram) {
      statVram.textContent = `${stats.vramMB.toFixed(2)} MB (${stats.textureCount})`;
    }
    if (statHeap) {
      statHeap.textContent = stats.jsHeapMB !== null ? `${stats.jsHeapMB.toFixed(1)} MB` : 'n/d';
    }
  },
  !isCompactViewport
);

void scene.init();

motionMedia.addEventListener('change', (ev) => {
  settings.reducedMotion = ev.matches;
  scene.wake();
});

function applyUiAccent(mode: LightingMode): void {
  const accent = LIGHTING_PALETTES[mode].uiAccent;
  document.documentElement.style.setProperty('--accent-color', accent);
  const switches = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][switch]');
  for (const sw of switches) {
    sw.style.setProperty('--switch-accent', accent);
  }
}
applyUiAccent(settings.lighting);

// Fit mode toggle (cover vs contain 16:9)
const swFitCover = document.getElementById('sw-fit-cover') as HTMLInputElement | null;
swFitCover?.addEventListener('change', () => {
  scene.setFitMode(swFitCover.checked ? 'cover' : 'contain');
});

// Lighting mode radios
const lightingRadios = document.querySelectorAll<HTMLInputElement>('input[name="lighting"]');
for (const radio of lightingRadios) {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    const mode = radio.value as LightingMode;
    settings.lighting = mode;
    applyUiAccent(mode);
    scene.wake();
  });
}

// Lighting switches
const swMoonGlow = document.getElementById('sw-moon-glow') as HTMLInputElement | null;
const swLanterns = document.getElementById('sw-lanterns') as HTMLInputElement | null;
const swCursorLight = document.getElementById('sw-cursor-light') as HTMLInputElement | null;

swMoonGlow?.addEventListener('change', () => {
  settings.moonGlow = swMoonGlow.checked;
  scene.wake();
});
swLanterns?.addEventListener('change', () => {
  settings.lanterns = swLanterns.checked;
  scene.wake();
});
swCursorLight?.addEventListener('change', () => {
  settings.cursorLight = swCursorLight.checked;
  scene.wake();
});

// Weather switches & mode radios
const swStrongWind = document.getElementById('sw-strong-wind') as HTMLInputElement | null;
const swLightning = document.getElementById('sw-lightning') as HTMLInputElement | null;
const swBats = document.getElementById('sw-bats') as HTMLInputElement | null;

const weatherRadios = document.querySelectorAll<HTMLInputElement>('input[name="weather"]');
for (const radio of weatherRadios) {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    const wx = radio.value as WeatherMode;
    settings.weather = wx;

    if (wx === 'storm') {
      settings.strongWind = true;
      settings.lightning = !settings.reducedMotion;
    } else if (wx === 'calm') {
      settings.strongWind = false;
      settings.lightning = false;
    } else {
      settings.strongWind = false;
      settings.lightning = false;
    }

    if (swStrongWind) swStrongWind.checked = settings.strongWind;
    if (swLightning) swLightning.checked = settings.lightning;
    scene.wake();
  });
}

swStrongWind?.addEventListener('change', () => {
  settings.strongWind = swStrongWind.checked;
  scene.wake();
});
swLightning?.addEventListener('change', () => {
  settings.lightning = swLightning.checked;
  scene.wake();
});
swBats?.addEventListener('change', () => {
  settings.bats = swBats.checked;
  scene.wake();
});

// Play / Pause button (no aria-pressed because label toggles between Wstrzymaj & Wznów)
const playPauseBtn = document.getElementById('play-pause-btn') as HTMLButtonElement | null;
const playPauseLabel = document.getElementById('play-pause-label');
playPauseBtn?.addEventListener('click', () => {
  settings.paused = !settings.paused;
  if (playPauseLabel) {
    playPauseLabel.textContent = settings.paused ? 'Wznów' : 'Wstrzymaj';
  }
  const svgPath = playPauseBtn.querySelector('path');
  if (svgPath) {
    svgPath.setAttribute(
      'd',
      settings.paused
        ? 'M8 5v14l11-7z'
        : 'M6 5h4v14H6zm8 0h4v14h-4z'
    );
  }
  scene.wake();
});

// Fullscreen toggle
const fullscreenBtn = document.getElementById('fullscreen-btn') as HTMLButtonElement | null;
const fullscreenLabel = document.getElementById('fullscreen-label');
const syncFullscreenLabel = (): void => {
  if (!fullscreenLabel) return;
  fullscreenLabel.textContent = document.fullscreenElement
    ? 'Zamknij pełny ekran'
    : 'Pełny ekran';
};
fullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    void document.exitFullscreen?.().catch(() => {});
  }
});
document.addEventListener('fullscreenchange', syncFullscreenLabel);

// Panel collapse / expand toggle
const hudDock = document.querySelector<HTMLElement>('.hud-dock');
const togglePanelBtn = document.getElementById('toggle-panel-btn') as HTMLButtonElement | null;
const panelBody = document.getElementById('panel-body');
togglePanelBtn?.addEventListener('click', () => {
  if (!panelBody || !hudDock) return;
  const isExpanded = togglePanelBtn.getAttribute('aria-expanded') === 'true';
  const nextExpanded = !isExpanded;
  togglePanelBtn.setAttribute('aria-expanded', String(nextExpanded));
  togglePanelBtn.textContent = nextExpanded ? 'Ukryj panel' : 'Sterowanie';
  panelBody.hidden = !nextExpanded;
  hudDock.classList.toggle('is-collapsed', !nextExpanded);
});

// Stats HUD collapse / expand toggle
toggleStatsBtn?.addEventListener('click', () => {
  if (!statsBody || !statsHud) return;
  const isExpanded = toggleStatsBtn.getAttribute('aria-expanded') === 'true';
  const nextExpanded = !isExpanded;
  toggleStatsBtn.setAttribute('aria-expanded', String(nextExpanded));
  toggleStatsBtn.textContent = nextExpanded ? 'Ukryj' : 'Pokaż';
  statsBody.hidden = !nextExpanded;
  statsHud.classList.toggle('is-collapsed', !nextExpanded);
  scene.setStatsEnabled(nextExpanded);
});

window.addEventListener('beforeunload', () => {
  scene.destroy();
});
