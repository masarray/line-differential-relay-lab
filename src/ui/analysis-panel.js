/**
 * GPL-3.0-only
 * Converts the analysis rail into a readable, vendor-neutral relay event view.
 */

const EVENT_LEVELS = Object.freeze({
  INFO: 'INFO',
  WARN: 'WARN',
  ALARM: 'ALARM',
  TRIP: 'TRIP'
});

export function classifyRelayEvent(message = '') {
  const text = String(message).toUpperCase();

  if (/OPERAT|TRIP/.test(text)) return EVENT_LEVELS.TRIP;
  if (/→\s*(NORMAL|RECOVERY)|RESET|INITIALIZED|ALGORITHM CHANGED/.test(text)) return EVENT_LEVELS.INFO;
  if (/→\s*BLOCKED|\bBLOCK\b|INTEGRITY|OVERFLOW|TOO OLD|CONSECUTIVE/.test(text)) return EVENT_LEVELS.ALARM;
  if (/→\s*(WATCH|SECURE)|SEQUENCE GAP|REORDER|DUPLICATE|ROUTE|LOSS|UNRELIABLE|RECOVERY/.test(text)) {
    return EVENT_LEVELS.WARN;
  }

  return EVENT_LEVELS.INFO;
}

export function formatRelayEventMessage(message = '') {
  const text = String(message).trim();
  let match = text.match(/^(\d+) packet sequence gap\(s\)$/i);
  if (match) return `Packet sequence gap detected · ${match[1]}`;

  match = text.match(/^(\d+) reordered frame\(s\)$/i);
  if (match) return `Out-of-order frame recovered · ${match[1]}`;

  match = text.match(/^(\d+) duplicate frame\(s\) discarded$/i);
  if (match) return `Duplicate frame discarded · ${match[1]}`;

  if (/^[A-Z ]+\s→\s[A-Z ]+$/.test(text)) return `Protection state · ${text}`;
  if (/^Experiment reset$/i.test(text)) return 'Simulator and relay state reset';
  if (/^Simulation running$/i.test(text)) return 'Simulation active';
  return text || 'Simulation active';
}

const styles = `
.analysis-panel{
  grid-template-rows:auto auto minmax(210px,.92fr) minmax(175px,1.08fr)
}
.analysis-panel .reason-section{display:none!important}
.analysis-panel .cause-effect{
  align-content:start;
  gap:6px;
  padding:8px 9px 9px;
  overflow:auto;
  scrollbar-width:thin
}
.analysis-section-heading{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:8px;
  margin-bottom:1px
}
.analysis-section-heading small{
  color:var(--dim);
  font:7px var(--font-mono);
  letter-spacing:.06em;
  white-space:nowrap
}
.analysis-panel .cause-step{
  min-height:0;
  grid-template-columns:22px minmax(0,1fr);
  padding:7px 8px
}
.analysis-panel .cause-step p{
  margin-top:3px;
  color:#c8d4d6;
  font-size:10px;
  line-height:1.42
}
.analysis-panel .cause-link{display:none}
.analysis-panel .event-section{
  min-height:0;
  display:grid;
  grid-template-rows:auto auto minmax(0,1fr);
  gap:5px;
  padding:8px 9px 9px;
  border-bottom:0;
  overflow:hidden;
  background:rgba(2,8,11,.2)
}
.relay-event-log-head{
  display:grid;
  grid-template-columns:54px 42px minmax(0,1fr);
  gap:6px;
  padding:0 5px 4px;
  border-bottom:1px solid var(--border);
  color:var(--dim);
  font:7px var(--font-mono);
  letter-spacing:.08em
}
#event-list{display:none!important}
#relay-event-log{
  min-height:0;
  height:auto;
  margin:0;
  padding:0 3px 0 0;
  list-style:none;
  overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:var(--border-strong) transparent
}
#relay-event-log li{
  display:grid;
  grid-template-columns:54px 42px minmax(0,1fr);
  gap:6px;
  align-items:start;
  min-height:31px;
  padding:6px 5px;
  border-top:1px dotted rgba(131,151,157,.24);
  border-left:2px solid transparent;
  background:rgba(255,255,255,.012)
}
#relay-event-log li:first-child{
  border-top:0;
  background:rgba(84,214,195,.045)
}
#relay-event-log time{
  color:var(--accent);
  font:8px var(--font-mono);
  white-space:nowrap
}
.relay-event-level{
  display:inline-grid;
  place-items:center;
  min-height:16px;
  padding:2px 3px;
  border:1px solid var(--border-strong);
  border-radius:2px;
  color:var(--muted);
  font:700 7px var(--font-mono);
  letter-spacing:.04em
}
.relay-event-message{
  color:#b9c7ca;
  font-size:9px;
  line-height:1.35;
  overflow-wrap:anywhere
}
#relay-event-log li[data-level="INFO"]{border-left-color:var(--accent)}
#relay-event-log li[data-level="WARN"]{border-left-color:var(--watch)}
#relay-event-log li[data-level="WARN"] .relay-event-level{color:var(--watch);border-color:color-mix(in srgb,var(--watch) 55%,var(--border))}
#relay-event-log li[data-level="ALARM"]{border-left-color:var(--remote)}
#relay-event-log li[data-level="ALARM"] .relay-event-level{color:var(--remote);border-color:color-mix(in srgb,var(--remote) 55%,var(--border))}
#relay-event-log li[data-level="TRIP"]{border-left-color:var(--danger);background:rgba(255,109,115,.065)}
#relay-event-log li[data-level="TRIP"] .relay-event-level{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 60%,var(--border))}
@media(max-width:980px){
  .analysis-panel{grid-template-rows:auto auto minmax(200px,auto) minmax(190px,1fr)}
}
`;

function createEventItem(event) {
  const item = document.createElement('li');
  const time = document.createElement('time');
  const level = document.createElement('span');
  const message = document.createElement('span');
  const eventLevel = classifyRelayEvent(event.message);

  item.dataset.level = eventLevel;
  time.textContent = `${Number(event.timeSeconds || 0).toFixed(3)} s`;
  level.className = 'relay-event-level';
  level.textContent = eventLevel;
  message.className = 'relay-event-message';
  message.textContent = formatRelayEventMessage(event.message);
  item.append(time, level, message);
  return item;
}

export function installReadableAnalysisPanel() {
  if (typeof document === 'undefined') return;
  const panel = document.querySelector('.analysis-panel');
  const sourceList = document.getElementById('event-list');
  if (!panel || !sourceList || document.getElementById('relay-event-log')) return;

  const reasonSection = panel.querySelector('.reason-section');
  if (reasonSection) {
    reasonSection.hidden = true;
    reasonSection.setAttribute('aria-hidden', 'true');
  }

  const causeEffect = panel.querySelector('.cause-effect');
  if (causeEffect && !causeEffect.querySelector('.analysis-section-heading')) {
    const heading = document.createElement('div');
    heading.className = 'analysis-section-heading';
    heading.innerHTML = '<span class="section-eyebrow">SYSTEM EXPLANATION</span><small>CAUSE · IMPACT · ACTION</small>';
    causeEffect.prepend(heading);
  }

  const eventSection = panel.querySelector('.event-section');
  const eventHeading = eventSection?.querySelector('.section-eyebrow');
  if (eventHeading) eventHeading.textContent = 'RELAY EVENT LOG';
  eventSection?.setAttribute('aria-label', 'Relay event log');

  const columnHeader = document.createElement('div');
  columnHeader.className = 'relay-event-log-head';
  columnHeader.setAttribute('aria-hidden', 'true');
  columnHeader.innerHTML = '<span>TIME</span><span>LEVEL</span><span>EVENT</span>';

  const readableList = document.createElement('ol');
  readableList.id = 'relay-event-log';
  readableList.setAttribute('role', 'log');
  readableList.setAttribute('aria-live', 'polite');
  readableList.setAttribute('aria-relevant', 'additions');
  eventSection?.append(columnHeader, readableList);

  const style = document.createElement('style');
  style.id = 'readable-analysis-panel-styles';
  style.textContent = styles;
  document.head.append(style);

  let history = [];
  let lastTime = 0;
  let lastSignature = '';

  const captureEvents = () => {
    const incoming = Array.from(sourceList.querySelectorAll('li')).map((item) => ({
      timeSeconds: Number.parseFloat(item.querySelector('time')?.textContent || '0') || 0,
      message: item.querySelector('span')?.textContent?.trim() || 'Simulation active'
    }));
    if (incoming.length === 0) return;

    const newestTime = Math.max(...incoming.map((event) => event.timeSeconds));
    const resetObserved = incoming.some((event) => /reset|initialized/i.test(event.message));
    if ((newestTime + 0.001 < lastTime) || (resetObserved && newestTime < 0.1 && lastTime > 0.1)) history = [];
    lastTime = Math.max(lastTime, newestTime);

    const known = new Set(history.map((event) => `${event.timeSeconds.toFixed(3)}|${event.message}`));
    for (const event of incoming) {
      const key = `${event.timeSeconds.toFixed(3)}|${event.message}`;
      if (!known.has(key)) {
        history.push(event);
        known.add(key);
      }
    }

    history.sort((a, b) => b.timeSeconds - a.timeSeconds);
    history = history.slice(0, 12);
    const signature = history.map((event) => `${event.timeSeconds.toFixed(3)}|${event.message}`).join('||');
    if (signature === lastSignature) return;
    lastSignature = signature;
    readableList.replaceChildren(...history.map(createEventItem));
  };

  new MutationObserver(captureEvents).observe(sourceList, { childList: true, subtree: true });
  captureEvents();
}
