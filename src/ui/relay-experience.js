/**
 * GPL-3.0-only
 * Small presentation helpers for the generic relay faceplate and benchmark access.
 */

const BENCHMARK_WORKFLOW_URL =
  'https://github.com/masarray/line-differential-relay-lab/actions/workflows/long-horizon-stress.yml';

const styles = `
.relay-device[data-relay-mode="smart-tracking"][data-relay-state="secure"] .relay-lcd{
  background-color:var(--relay-lcd)
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
@media(max-width:1180px){
  .benchmark-access-button{min-width:0;padding-inline:7px;font-size:7px}
}
`;

function installSmartModePresentation() {
  const device = document.getElementById('virtual-relay');
  const tabs = document.querySelector('.algorithm-tabs');
  if (!device || !tabs) return;

  const syncRelayMode = () => {
    const active = tabs.querySelector('[data-algorithm].is-active');
    device.dataset.relayMode = active?.dataset.algorithm ?? '';
  };

  new MutationObserver(syncRelayMode).observe(tabs, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
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
