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

const scene = new GraveyardScene(stageEl, settings, (progress) => {
  if (progressBar) {
    progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
  }
});

void scene.init();

motionMedia.addEventListener('change', (ev) => {
  settings.reducedMotion = ev.matches;
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

// Lighting mode radios
const lightingRadios = document.querySelectorAll<HTMLInputElement>('input[name="lighting"]');
for (const radio of lightingRadios) {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    const mode = radio.value as LightingMode;
    settings.lighting = mode;
    applyUiAccent(mode);
  });
}

// Lighting switches
const swMoonGlow = document.getElementById('sw-moon-glow') as HTMLInputElement | null;
const swLanterns = document.getElementById('sw-lanterns') as HTMLInputElement | null;
const swCursorLight = document.getElementById('sw-cursor-light') as HTMLInputElement | null;

swMoonGlow?.addEventListener('change', () => {
  settings.moonGlow = swMoonGlow.checked;
});
swLanterns?.addEventListener('change', () => {
  settings.lanterns = swLanterns.checked;
});
swCursorLight?.addEventListener('change', () => {
  settings.cursorLight = swCursorLight.checked;
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
  });
}

swStrongWind?.addEventListener('change', () => {
  settings.strongWind = swStrongWind.checked;
});
swLightning?.addEventListener('change', () => {
  settings.lightning = swLightning.checked;
});
swBats?.addEventListener('change', () => {
  settings.bats = swBats.checked;
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

window.addEventListener('beforeunload', () => {
  scene.destroy();
});
