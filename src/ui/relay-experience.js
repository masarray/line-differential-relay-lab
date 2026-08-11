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

/* Physical faceplate polish: extend the enclosure downward and give trip hardware true physical proportions. */
#virtual-relay.relay-device{
  aspect-ratio:.64/1
}
#virtual-relay .relay-tripbar{
  min-height:128px;
  grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);
  gap:16px;
  padding:16px 16px
}
#virtual-relay .relay-tripbar>div{
  gap:7px;
  align-content:center
}
#virtual-relay .relay-tripbar strong{
  font-size:14px
}
#virtual-relay .relay-output-mimic{
  align-content:center
}
#virtual-relay .relay-output-mimic .relay-mimic-chain{
  grid-template-columns:38px minmax(16px,1fr) 38px minmax(16px,1fr) 38px;
  align-items:center;
  margin:8px 0
}
#virtual-relay .relay-mimic-chain span{
  height:30px
}
#virtual-relay .relay-mimic-chain b{
  width:30px;
  height:30px;
  min-width:30px;
  min-height:30px;
  aspect-ratio:1/1;
  justify-self:center;
  box-sizing:border-box;
  border-radius:50%!important
}
#virtual-relay .relay-output-mimic>strong{
  font-size:10px
}
#virtual-relay .relay-deck{
  grid-template-columns:48px minmax(142px,1fr) 48px 54px;
  gap:14px;
  min-height:158px;
  padding:16px;
  align-items:center
}
#virtual-relay .relay-deck button{
  padding:0;
  border-radius:50%;
  aspect-ratio:1/1
}
#virtual-relay .relay-deck-left,
#virtual-relay .relay-deck-right{
  gap:12px;
  align-content:center;
  justify-items:center
}
#virtual-relay .relay-deck-left button,
#virtual-relay .relay-deck-right button{
  width:42px;
  height:42px;
  min-width:42px;
  min-height:42px
}
#virtual-relay .relay-dpad{
  width:142px;
  height:142px;
  min-width:142px;
  min-height:142px;
  box-sizing:border-box;
  place-content:center;
  align-self:center;
  justify-self:center;
  grid-template-columns:repeat(3,34px);
  grid-template-rows:repeat(3,34px);
  gap:5px;
  padding:8px;
  border-radius:50%!important
}
#virtual-relay .relay-dpad button{
  width:34px;
  height:34px;
  min-width:34px;
  min-height:34px;
  border-radius:50%!important;
  font-size:10px
}
#virtual-relay .relay-usb{
  min-height:54px;
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
  #virtual-relay.relay-device{aspect-ratio:.68/1}
  #virtual-relay .relay-tripbar{min-height:108px;padding:13px;gap:10px}
  #virtual-relay .relay-mimic-chain span{height:27px}
  #virtual-relay .relay-mimic-chain b{width:27px;height:27px;min-width:27px;min-height:27px}
  #virtual-relay .relay-deck{grid-template-columns:40px minmax(122px,1fr) 40px 44px;min-height:136px;padding:12px;gap:9px}
  #virtual-relay .relay-deck-left button,
  #virtual-relay .relay-deck-right button{width:34px;height:34px;min-width:34px;min-height:34px}
  #virtual-relay .relay-dpad{width:122px;height:122px;min-width:122px;min-height:122px;grid-template-columns:repeat(3,30px);grid-template-rows:repeat(3,30px);gap:4px;padding:6px}
  #virtual-relay .relay-dpad button{width:30px;height:30px;min-width:30px;min-height:30px}
}
@media(max-width:1180px){
  .benchmark-access-button{min-width:0;padding-inline:7px;font-size:7px}
  #virtual-relay.relay-device{aspect-ratio:.74/1}
  #virtual-relay .relay-tripbar{min-height:94px;padding:10px;gap:7px}
  #virtual-relay .relay-tripbar strong{font-size:11px}
  #virtual-relay .relay-mimic-chain span{height:24px}
  #virtual-relay .relay-mimic-chain b{width:24px;height:24px;min-width:24px;min-height:24px}
  #virtual-relay .relay-deck{grid-template-columns:34px minmax(106px,1fr) 34px 38px;min-height:116px;padding:9px;gap:6px}
  #virtual-relay .relay-deck-left button,
  #virtual-relay .relay-deck-right button{width:30px;height:30px;min-width:30px;min-height:30px}
  #virtual-relay .relay-dpad{width:106px;height:106px;min-width:106px;min-height:106px;grid-template-columns:repeat(3,25px);grid-template-rows:repeat(3,25px);gap:3px;padding:5px}
  #virtual-relay .relay-dpad button{width:25px;height:25px;min-width:25px;min-height:25px;font-size:8px}
}
@media(max-width:980px){
  #virtual-relay.relay-device{aspect-ratio:.64/1}
  #virtual-relay .relay-tripbar{min-height:128px;padding:16px;gap:16px}
  #virtual-relay .relay-tripbar strong{font-size:14px}
  #virtual-relay .relay-mimic-chain span{height:30px}
  #virtual-relay .relay-mimic-chain b{width:30px;height:30px;min-width:30px;min-height:30px}
  #virtual-relay .relay-deck{grid-template-columns:48px minmax(142px,1fr) 48px 54px;min-height:158px;padding:16px;gap:14px}
  #virtual-relay .relay-deck-left button,
  #virtual-relay .relay-deck-right button{width:42px;height:42px;min-width:42px;min-height:42px}
  #virtual-relay .relay-dpad{width:142px;height:142px;min-width:142px;min-height:142px;grid-template-columns:repeat(3,34px);grid-template-rows:repeat(3,34px);gap:5px;padding:8px}
  #virtual-relay .relay-dpad button{width:34px;height:34px;min-width:34px;min-height:34px;font-size:10px}
}

/* Wider front panel: give the F-key rail and status indicators proper hardware spacing. */
.workspace{
  grid-template-columns:196px minmax(0,1fr) 205px clamp(450px,31vw,560px)
}
#virtual-relay.relay-device{
  width:100%;
  max-width:560px;
  aspect-ratio:.70/1
}
#virtual-relay .relay-face{
  grid-template-columns:112px minmax(0,1fr) 72px;
  gap:11px
}
#virtual-relay .relay-status-column{
  padding:13px 11px
}
#virtual-relay .relay-status-column>small{
  margin-bottom:13px
}
#virtual-relay .relay-indicator-list{
  gap:13px
}
#virtual-relay .relay-indicator-list li{
  grid-template-columns:14px minmax(0,1fr);
  gap:10px;
  font-size:9.3px
}
#virtual-relay .relay-led{
  width:14px;
  height:14px
}
#virtual-relay .relay-fkeys{
  gap:8px
}
#virtual-relay .relay-fkeys .relay-fkey{
  grid-template-columns:10px minmax(0,1fr);
  gap:6px
}
#virtual-relay .relay-fkey i{
  width:10px
}
#virtual-relay .relay-fkey button{
  min-height:32px;
  font-size:10px
}
#virtual-relay #relay-reset-latch{
  font-size:9px
}
@media(max-width:1500px){
  .workspace{grid-template-columns:190px minmax(0,1fr) 195px clamp(410px,30vw,520px)}
  #virtual-relay.relay-device{max-width:520px;aspect-ratio:.70/1}
  #virtual-relay .relay-face{grid-template-columns:104px minmax(0,1fr) 68px;gap:10px}
  #virtual-relay .relay-indicator-list{gap:12px}
  #virtual-relay .relay-led{width:13px;height:13px}
  #virtual-relay .relay-indicator-list li{grid-template-columns:13px minmax(0,1fr);gap:9px;font-size:8.8px}
  #virtual-relay .relay-fkeys .relay-fkey{grid-template-columns:9px minmax(0,1fr);gap:5px}
  #virtual-relay .relay-fkey i{width:9px}
}
@media(max-width:1320px){
  .workspace{grid-template-columns:188px minmax(0,1fr) 185px clamp(340px,27vw,400px)}
  #virtual-relay.relay-device{max-width:400px;aspect-ratio:.68/1}
  #virtual-relay .relay-face{grid-template-columns:84px minmax(0,1fr) 48px;gap:7px}
  #virtual-relay .relay-status-column{padding:8px 7px}
  #virtual-relay .relay-status-column>small{margin-bottom:9px}
  #virtual-relay .relay-indicator-list{gap:8px}
  #virtual-relay .relay-indicator-list li{grid-template-columns:10px minmax(0,1fr);gap:6px;font-size:8px}
  #virtual-relay .relay-led{width:10px;height:10px}
  #virtual-relay .relay-fkeys{gap:7px}
  #virtual-relay .relay-fkeys .relay-fkey{grid-template-columns:8px minmax(0,1fr);gap:5px}
  #virtual-relay .relay-fkey i{width:8px}
  #virtual-relay .relay-fkey button{min-height:25px;font-size:8.5px}
  #virtual-relay #relay-reset-latch{font-size:7.7px}
}
@media(max-width:1180px){
  .workspace{grid-template-columns:180px minmax(0,1fr) 170px 310px}
  #virtual-relay.relay-device{max-width:310px;aspect-ratio:.74/1}
  #virtual-relay .relay-face{grid-template-columns:72px minmax(0,1fr) 40px;gap:5px}
  #virtual-relay .relay-status-column{padding:7px 5px}
  #virtual-relay .relay-status-column>small{margin-bottom:7px}
  #virtual-relay .relay-indicator-list{gap:6px}
  #virtual-relay .relay-indicator-list li{grid-template-columns:9px minmax(0,1fr);gap:5px;font-size:7px}
  #virtual-relay .relay-led{width:9px;height:9px}
  #virtual-relay .relay-fkeys{gap:5px}
  #virtual-relay .relay-fkeys .relay-fkey{grid-template-columns:7px minmax(0,1fr);gap:4px}
  #virtual-relay .relay-fkey i{width:7px}
  #virtual-relay .relay-fkey button{min-height:22px;font-size:8px}
  #virtual-relay #relay-reset-latch{font-size:7px}
}
@media(max-width:980px){
  .workspace{grid-template-columns:220px minmax(0,1fr)}
  #virtual-relay.relay-device{max-width:560px;aspect-ratio:.70/1}
  #virtual-relay .relay-face{grid-template-columns:112px minmax(0,1fr) 72px;gap:11px}
  #virtual-relay .relay-status-column{padding:13px 11px}
  #virtual-relay .relay-status-column>small{margin-bottom:13px}
  #virtual-relay .relay-indicator-list{gap:13px}
  #virtual-relay .relay-indicator-list li{grid-template-columns:14px minmax(0,1fr);gap:10px;font-size:9.3px}
  #virtual-relay .relay-led{width:14px;height:14px}
  #virtual-relay .relay-fkeys{gap:8px}
  #virtual-relay .relay-fkeys .relay-fkey{grid-template-columns:10px minmax(0,1fr);gap:6px}
  #virtual-relay .relay-fkey i{width:10px}
  #virtual-relay .relay-fkey button{min-height:32px;font-size:10px}
  #virtual-relay #relay-reset-latch{font-size:9px}
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
