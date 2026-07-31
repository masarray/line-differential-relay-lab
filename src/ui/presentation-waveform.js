export const WAVEFORM_DISPLAY_MODES = Object.freeze({
  LIVE: 'live',
  PERSIST: 'persist',
  FREEZE: 'freeze'
});

export function normalizeWaveformDisplayMode(value) {
  return Object.values(WAVEFORM_DISPLAY_MODES).includes(value)
    ? value
    : WAVEFORM_DISPLAY_MODES.LIVE;
}

const STYLE_ID = 'waveform-presentation-style';
const CONTROL_ID = 'waveform-display-control';
const STORAGE_KEY = '87l-waveform-display-mode';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .scope-toolbar{grid-template-columns:minmax(150px,1fr) auto auto}
    .waveform-display-control{
      display:grid;
      grid-template-columns:auto repeat(3,auto);
      align-items:center;
      gap:3px;
      padding:3px;
      border:1px solid var(--border);
      border-radius:6px;
      background:rgba(2,9,11,.48);
      white-space:nowrap;
    }
    .waveform-display-control>span{
      padding:0 4px;
      color:var(--dim);
      font:8px var(--font-mono);
      letter-spacing:.08em;
    }
    .waveform-display-button{
      min-width:48px;
      padding:4px 6px;
      border:0;
      border-radius:4px;
      color:var(--muted);
      background:transparent;
      font:9px var(--font-mono);
      letter-spacing:.04em;
    }
    .waveform-display-button:hover{color:var(--text)}
    .waveform-display-button.is-active{
      color:var(--text);
      background:var(--accent-soft);
      box-shadow:inset 0 0 0 1px rgba(84,214,195,.34);
    }
    .waveform-display-button[data-mode="freeze"].is-active{
      color:#071014;
      background:var(--watch);
      box-shadow:none;
    }
    .canvas-wrap[data-display-mode="persist"]::after,
    .canvas-wrap[data-display-mode="freeze"]::after{
      content:attr(data-display-label);
      position:absolute;
      top:8px;
      right:9px;
      z-index:2;
      padding:4px 7px;
      border:1px solid rgba(84,214,195,.34);
      border-radius:4px;
      color:var(--accent);
      background:rgba(5,14,18,.86);
      font:8px var(--font-mono);
      letter-spacing:.06em;
      pointer-events:none;
    }
    .canvas-wrap[data-display-mode="freeze"]::after{
      color:#191305;
      border-color:rgba(240,192,92,.7);
      background:var(--watch);
    }
    @media(max-width:1260px){
      .waveform-display-control>span{display:none}
      .waveform-display-button{min-width:41px;padding-inline:4px}
    }
  `;
  document.head.append(style);
}

function readStoredMode() {
  try {
    const stored = normalizeWaveformDisplayMode(localStorage.getItem(STORAGE_KEY));
    return stored === WAVEFORM_DISPLAY_MODES.FREEZE
      ? WAVEFORM_DISPLAY_MODES.LIVE
      : stored;
  } catch {
    return WAVEFORM_DISPLAY_MODES.LIVE;
  }
}

function storeMode(mode) {
  if (mode === WAVEFORM_DISPLAY_MODES.FREEZE) return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage is optional; the display control remains functional without it.
  }
}

export function installPresentationWaveformControls() {
  if (typeof document === 'undefined' || document.getElementById(CONTROL_ID)) return;
  const toolbar = document.querySelector('.scope-toolbar');
  const metrics = toolbar?.querySelector('.scope-metrics');
  const canvasWrap = document.querySelector('.canvas-wrap');
  if (!toolbar || !metrics || !canvasWrap) return;

  installStyles();

  const control = document.createElement('div');
  control.id = CONTROL_ID;
  control.className = 'waveform-display-control';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Waveform display mode');

  const label = document.createElement('span');
  label.textContent = 'DISPLAY';
  control.append(label);

  const definitions = [
    [WAVEFORM_DISPLAY_MODES.LIVE, 'LIVE', 'Engineering view: show measured gaps exactly as received.'],
    [WAVEFORM_DISPLAY_MODES.PERSIST, 'PERSIST', 'Slow-shutter visual persistence. Display aid only; protection evidence is unchanged.'],
    [WAVEFORM_DISPLAY_MODES.FREEZE, 'FREEZE', 'Freeze the waveform display for a clean screenshot. The simulation engine is not modified.']
  ];

  const buttons = new Map();
  for (const [mode, text, title] of definitions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'waveform-display-button';
    button.dataset.mode = mode;
    button.textContent = text;
    button.title = title;
    button.setAttribute('aria-pressed', 'false');
    control.append(button);
    buttons.set(mode, button);
  }

  toolbar.insertBefore(control, metrics);

  const setMode = (requestedMode) => {
    const mode = normalizeWaveformDisplayMode(requestedMode);
    for (const [candidate, button] of buttons) {
      const active = candidate === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    canvasWrap.dataset.displayMode = mode;
    canvasWrap.dataset.displayLabel = mode === WAVEFORM_DISPLAY_MODES.PERSIST
      ? 'PERSISTENCE DISPLAY · VISUAL AID ONLY'
      : mode === WAVEFORM_DISPLAY_MODES.FREEZE
        ? 'DISPLAY FROZEN · ENGINE UNCHANGED'
        : '';
    storeMode(mode);
    window.dispatchEvent(new CustomEvent('waveform-display-mode', { detail: { mode } }));
  };

  for (const [mode, button] of buttons) {
    button.addEventListener('click', () => setMode(mode));
  }

  setMode(readStoredMode());
}
