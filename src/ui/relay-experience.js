/**
 * GPL-3.0-only
 * Small presentation helpers for the generic relay faceplate and benchmark access.
 */

const BENCHMARK_WORKFLOW_URL =
  'https://github.com/masarray/line-differential-relay-lab/actions/workflows/long-horizon-stress.yml';

const MODE_SWITCH_SETTLE_MS = 800;

const styles = `
.relay-device[data-relay-mode="smart-tracking"][data-relay-state="secure"] .relay-lcd{
  background-color:var(--relay-lcd)
}
.relay-device[data-mode-switch-pending="true"][data-relay-state="secure"] .relay-lcd{
  background-color:var(--relay-lcd)!important
}
.relay-device[data-relay-mode="smart-tracking"] .relay-lcd [data-degraded-display="true"]{
  font-weight:800
}

/* Physical faceplate polish: give the lower relay hardware enough vertical mass. */
#virtual-relay.relay-device{
  aspect-ratio:.78/1
}
#virtual-relay .relay-tripbar{
  min-height:96px;
  grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);
  gap:12px;
  padding:12px 13px
}
#virtual-relay .relay-tripbar>div{
  gap:5px;
  align-content:center
}
#virtual-relay .relay-tripbar strong{
  font-size:14px
}
#virtual-relay .relay-output-mimic .relay-mimic-chain{
  grid-template-columns:36px minmax(14px,1fr) 36px minmax(14px,1fr) 36px;
  margin:5px 0
}
#virtual-relay .relay-mimic-chain span,
#virtual-relay .relay-mimic-chain b{
  height:26px
}
#virtual-relay .relay-output-mimic>strong{
  font-size:10px
}
#virtual-relay .relay-deck{
  grid-template-columns:46px minmax(0,1fr) 46px 52px;
  gap:14px;
  min-height:132px;
  padding:15px 15px;
  align-items:center
}
#virtual-relay .relay-deck button{
  padding:0;
  border-radius:50%;
  aspect-ratio:1/1
}
#virtual-relay .relay-deck-left,
#virtual-relay .relay-deck-right{
  gap:10px;
  align-content:center;
  justify-items:center
}
#virtual-relay .relay-deck-left button,
#virtual-relay .relay-deck-right button{
  width:40px;
  height:40px;
  min-width:40px;
  min-height:40px
}
#virtual-relay .relay-dpad{
  grid-template-columns:repeat(3,36px);
  grid-template-rows:repeat(3,36px);
  gap:5px;
  padding:8px;
  border-radius:50%
}
#virtual-relay .relay-dpad button{
  width:36px;
  height:36px;
  min-width:36px;
  min-height:36px;
  border-radius:50%!important;
  font-size:10px
}
#virtual-relay .relay-usb{
  min-height:48px;
  align-content:center;
  border-radius:8px
}
.benchmark-access-button{
  width:auto;
  min-width:84px;
  height:30px;
  display:inline-grid;
  place-items:center;
  padding:0 9px;
  border:1px solid rgba(84,214,195,.38);
  border-radius:5px;
  color:var(--accent);
  background:var(--accent-soft);
  text-decoration:none;
  font:700 8px var(--font-mono);
  letter-spacing:.08em;
  white-space:nowrap
}
.benchmark-access-button:hover{
  border-color:rgba(84,214,195,.72);
  background:rgba(84,214,195,.18)
}
@media(max-width:1320px){
  #virtual-relay.relay-device{aspect-ratio:.81/1}
  #virtual-relay .relay-tripbar{min-height:86px;padding:10px;gap:8px}
  #virtual-relay .relay-deck{grid-template-columns:40px minmax(0,1fr) 40px 44px;min-height:112px;padding:11px;gap:9px}
  #virtual-relay .relay-deck-left button,
  #virtual-relay .relay-deck-right button{width:34px;height:34px;min-width:34px;min-height:34px}
  #virtual-relay .relay-dpad{grid-template-columns:repeat(3,30px);grid-template-rows:repeat(3,30px);gap:4px;padding:6px}
  #virtual-relay .relay-dpad button{width:30px;height:30px;min-width:30px;min-height:30px}
}
@media(max-width:1180px){
  .benchmark-access-button{min-width:0;padding-inline:7px;font-size:7px}
  #virtual-relay.relay-device{aspect-ratio:.84/1}
  #virtual-relay .relay-tripbar{min-height:76px;padding:8px;gap:6px}
  #virtual-relay .relay-tripbar strong{font-size:11px}
  #virtual-relay .relay-deck{grid-template-columns:34px minmax(0,1fr) 34px 38px;min-height:96px;padding:8px;gap:6px}
  #virtual-relay .relay-deck-left button,
  #virtual-relay .relay-deck-right button{width:30px;height:30px;min-width:30px;min-height:30px}
  #virtual-relay .relay-dpad{grid-template-columns:repeat(3,26px);grid-template-rows:repeat(3,26px);gap:3px;padding:5px}
  #virtual-relay .relay-dpad button{width:26px;height:26px;min-width:26px;min-height:26px;font-size:8px}
}
@media(max-width:980px){
  #virtual-relay.relay-device{aspect-ratio:.78/1}
  #virtual-relay .relay-tripbar{min-height:96px;padding:12px 13px;gap:12px}
  #virtual-relay .relay-tripbar strong{font-size:14px}
  #virtual-relay .relay-deck{grid-template-columns:46px minmax(0,1fr) 46px 52px;min-height:132px;padding:15px;gap:14px}
  #virtual-relay .relay-deck-left button,
  #virtual-relay .relay-deck-right button{width:40px;height:40px;min-width:40px;min-height:40px}
  #virtual-relay .relay-dpad{grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px);gap:5px;padding:8px}
  #virtual-relay .relay-dpad button{width:36px;height:36px;min-width:36px;min-height:36px;font-size:10px}
}
`;

function installSmartModePresentation() {
  const device = document.getElementById('virtual-relay');
  const tabs = document.querySelector('.algorithm-tabs');
  const clock = document.getElementById('relay-lcd-clock');
  if (!device || !tabs) return;

  let settleTimer = null;
  let clockAtSwitch = '';

  const renderDegradedLabels = () => {
    const smart = device.dataset.relayMode === 'smart-tracking';
    const stateOutputs = [
      document.getElementById('relay-lcd-state'),
      document.getElementById('protection-state')
    ].filter(Boolean);

    for (const output of stateOutputs) {
      if (smart && output.textContent === 'WATCH') {
        output.textContent = 'DEGRADED 87L';
        output.dataset.degradedDisplay = 'true';
      } else if (!smart && output.textContent === 'DEGRADED 87L') {
        output.textContent = 'WATCH';
        output.removeAttribute('data-degraded-display');
      } else if (output.textContent !== 'DEGRADED 87L') {
        output.removeAttribute('data-degraded-display');
      }
    }
  };

  const clearPending = () => {
    device.removeAttribute('data-mode-switch-pending');
    if (settleTimer !== null) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
  };

  const beginModeSwitch = (button) => {
    if (!(button instanceof HTMLElement)) return;
    const algorithm = button.dataset.algorithm;
    if (!algorithm) return;

    // Update the faceplate mode before the application click handler changes
    // the active tab. This prevents one paint using the old secure-state color.
    device.dataset.relayMode = algorithm;
    device.dataset.modeSwitchPending = 'true';
    clockAtSwitch = clock?.textContent ?? '';
    renderDegradedLabels();

    if (settleTimer !== null) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(clearPending, MODE_SWITCH_SETTLE_MS);
  };

  const findAlgorithmButton = (event) => {
    const target = event.target;
    return target instanceof Element ? target.closest('[data-algorithm]') : null;
  };

  // Capture phase runs before app.js handles the algorithm change.
  tabs.addEventListener('pointerdown', (event) => beginModeSwitch(findAlgorithmButton(event)), true);
  tabs.addEventListener('click', (event) => beginModeSwitch(findAlgorithmButton(event)), true);

  const syncRelayMode = () => {
    const active = tabs.querySelector('[data-algorithm].is-active');
    if (!device.dataset.modeSwitchPending) {
      device.dataset.relayMode = active?.dataset.algorithm ?? '';
    }
    renderDegradedLabels();
  };

  new MutationObserver(syncRelayMode).observe(tabs, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  for (const id of ['relay-lcd-state', 'protection-state']) {
    const output = document.getElementById(id);
    if (!output) continue;
    new MutationObserver(renderDegradedLabels).observe(output, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (clock) {
    new MutationObserver(() => {
      if (device.dataset.modeSwitchPending === 'true' && clock.textContent !== clockAtSwitch) {
        clearPending();
        syncRelayMode();
      }
    }).observe(clock, { childList: true, characterData: true, subtree: true });
  }

  syncRelayMode();
}

function installBenchmarkAccess() {
  const headerStatus = document.querySelector('.header-status');
  if (!headerStatus || document.getElementById('benchmark-access')) return;

  const link = document.createElement('a');
  link.id = 'benchmark-access';
  link.className = 'benchmark-access-button';
  link.href = BENCHMARK_WORKFLOW_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'BENCHMARK';
  link.title = 'Run the P5 long-horizon reliability benchmark in GitHub Actions';
  link.setAttribute('aria-label', 'Open long-horizon reliability benchmark');
  headerStatus.prepend(link);
}

export function installRelayExperience() {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.id = 'relay-experience-styles';
  style.textContent = styles;
  document.head.append(style);

  installSmartModePresentation();
  installBenchmarkAccess();
}
