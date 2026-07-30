import { ALGORITHM_MODES, PRESETS, createDefaultConfig } from './engine/constants.js';
import { createExperimentDocument, parseExperimentDocument, sanitizeConfig } from './engine/schema.js';
import { WaveformRenderer } from './ui/waveform-renderer.js';
import { createRelayLatchState, resetRelayLatch, updateRelayLatch } from './ui/relay-latch.js';

const worker = new Worker(new URL('./worker/simulation-worker.js', import.meta.url), { type: 'module' });
const renderer = new WaveformRenderer(document.querySelector('#waveform-canvas'));
let config = createDefaultConfig();
let running = true;
let latestFrame = null;
let relayLatch = createRelayLatchState();

const units = {
  baseDelayMs: ['ms', 2],
  asymmetryMs: ['ms', 2],
  jitterMs: ['ms', 2],
  packetLossPct: ['%', 1],
  burstLossPct: ['%', 0],
  corruptionPct: ['%', 1],
  clockOffsetMs: ['ms', 2],
  clockDriftPpm: ['ppm', 0],
  packetAbsoluteAgeMs: ['ms', 0],
  remoteMagnitudePct: ['%', 0],
  remotePhaseDeg: ['°', 2],
  halfWaveAsymmetryPct: ['%', 0],
  harmonic3Pct: ['%', 1],
  dcOffsetPct: ['%', 0],
  ctSaturationPct: ['%', 0],
  secureWindowMs: ['ms', 0],
  recoveryValidationMs: ['ms', 0],
  trackWindowMs: ['ms', 2],
  trackerMaxSlewMs: ['ms/frame', 2],
  minPickupPu: ['pu', 2],
  restraintSlope: ['pu/pu', 2]
};

function element(id) {
  return document.getElementById(id);
}

function formatConfigValue(key, value) {
  const [unit, digits] = units[key] ?? ['', 2];
  return `${Number(value).toFixed(digits)} ${unit}`.trim();
}

function postConfig(patch, replace = false) {
  config = sanitizeConfig({ ...config, ...patch });
  worker.postMessage(replace
    ? { type: 'REPLACE_CONFIG', config }
    : { type: 'CONFIG', patch });
  syncControls();
}

function syncControls() {
  document.querySelectorAll('[data-config]').forEach((control) => {
    const key = control.dataset.config;
    if (!(key in config)) return;
    if (control.type === 'checkbox') control.checked = Boolean(config[key]);
    else control.value = String(config[key]);
  });

  document.querySelectorAll('[data-output]').forEach((output) => {
    const key = output.dataset.output;
    output.value = formatConfigValue(key, config[key]);
    output.textContent = output.value;
  });

  document.querySelectorAll('[data-algorithm]').forEach((button) => {
    const active = button.dataset.algorithm === config.algorithm;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  element('scenario-select').value = config.scenario;
  element('seed-value').textContent = String(config.seed);
  element('frequency-label').textContent = `${config.frequencyHz} Hz`;
  element('sample-label').textContent = `${config.sampleRateHz} Sa/s`;
}

function scoreColor(score) {
  if (score >= 82) return 'var(--good)';
  if (score >= 62) return 'var(--watch)';
  if (score >= 42) return 'var(--remote)';
  return 'var(--danger)';
}

function updateConfidence(domain, confidence) {
  element(`${domain}-confidence-value`).textContent = `${confidence.score.toFixed(0)}%`;
  element(`${domain}-confidence-status`).textContent = confidence.status;
  const bar = element(`${domain}-confidence-bar`);
  bar.style.width = `${Math.max(1, confidence.score)}%`;
  bar.style.backgroundColor = scoreColor(confidence.score);
}

function setRelayLed(id, active, condition = 'normal') {
  const led = element(id);
  led.dataset.active = String(Boolean(active));
  led.dataset.condition = condition;
}

function updateVirtualRelay(frame) {
  if (!frame) return;

  relayLatch = updateRelayLatch(relayLatch, frame);
  const blocked = frame.protection.permission === 'BLOCKED';
  const secure = frame.protection.state === 'SECURE WINDOW' || frame.protection.state === 'WATCH';
  const pickup = frame.differential.validatedRmsPu >= frame.differential.activeThresholdPu * 0.9;
  const channelScore = frame.confidence.channel.score;
  const commCondition = blocked || channelScore < 42 ? 'danger' : channelScore < 82 ? 'warning' : 'normal';
  const hardError = blocked || frame.confidence.reasons.some((reason) =>
    ['PACKET_INTEGRITY_FAIL', 'TIME_SYNC_INVALID', 'PACKET_TOO_OLD'].includes(reason));

  setRelayLed('relay-run-led', running, running ? 'normal' : 'warning');
  setRelayLed('relay-comm-led', true, commCondition);
  setRelayLed('relay-error-led', hardError, 'danger');
  setRelayLed('relay-pickup-led', pickup || frame.protection.operate, 'warning');
  setRelayLed('relay-secure-led', secure, 'warning');
  setRelayLed('relay-block-led', blocked, 'blocked');
  setRelayLed('relay-trip-led', relayLatch.latched, 'danger');

  const device = element('virtual-relay');
  device.dataset.relayState = relayLatch.latched ? 'trip' : blocked ? 'blocked' : secure ? 'secure' : 'ready';

  element('relay-lcd-clock').textContent = `${frame.timeSeconds.toFixed(3)} s`;
  element('relay-lcd-idiff').textContent = `${frame.differential.validatedRmsPu.toFixed(3)} pu`;
  element('relay-lcd-ibias').textContent = `${frame.differential.restraintRmsPu.toFixed(3)} pu`;
  element('relay-lcd-state').textContent = frame.protection.state;
  element('relay-lcd-permission').textContent = frame.protection.permission;

  if (relayLatch.latched) {
    element('relay-lcd-title').textContent = 'TRIP LATCHED';
    element('relay-lcd-message').textContent = `87L OPERATE @ ${relayLatch.tripTimeSeconds.toFixed(3)} s`;
    element('relay-latch-status').textContent = '87L TRIP';
    element('relay-latch-detail').textContent = `${relayLatch.idiffPu.toFixed(3)} pu · ${relayLatch.scenarioLabel}`;
  } else if (blocked) {
    element('relay-lcd-title').textContent = '87L BLOCKED';
    element('relay-lcd-message').textContent = 'REMOTE DATA NOT RELIABLE';
    element('relay-latch-status').textContent = 'CLEAR';
    element('relay-latch-detail').textContent = 'Trip permission blocked';
  } else if (secure) {
    element('relay-lcd-title').textContent = 'SECURE MODE';
    element('relay-lcd-message').textContent = `${frame.protection.secureRemainingMs.toFixed(0)} ms VALIDATION WINDOW`;
    element('relay-latch-status').textContent = 'CLEAR';
    element('relay-latch-detail').textContent = 'Supervised operation active';
  } else {
    element('relay-lcd-title').textContent = '87L IN SERVICE';
    element('relay-lcd-message').textContent = 'PROTECTION AVAILABLE';
    element('relay-latch-status').textContent = 'CLEAR';
    element('relay-latch-detail').textContent = 'No latched operation';
  }

  element('relay-output-state').textContent = relayLatch.latched ? 'TRIP OUTPUT LATCHED' : blocked ? 'TRIP OUTPUT BLOCKED' : 'TRIP CONTACT RESET';
  element('relay-reset-latch').disabled = !relayLatch.latched;
}

function updateFrame(frame) {
  latestFrame = frame;
  renderer.setFrame(frame);

  element('scenario-label').textContent = frame.scenarioLabel;
  element('rtt-value').textContent = `${frame.channel.rttMs.toFixed(2)} ms`;
  element('alignment-error').textContent = `${frame.alignment.residualEstimateMs >= 0 ? '+' : ''}${frame.alignment.residualEstimateMs.toFixed(2)} ms`;
  element('idiff-value').textContent = `${frame.differential.validatedRmsPu.toFixed(3)} pu`;
  element('irest-value').textContent = `${frame.differential.restraintRmsPu.toFixed(3)} pu`;
  element('simulation-time').textContent = `t = ${frame.timeSeconds.toFixed(3)} s`;

  element('protection-state').textContent = frame.protection.state;
  element('permission-badge').textContent = frame.protection.permission;
  element('secure-remaining').textContent = `${frame.protection.secureRemainingMs.toFixed(0)} ms`;

  updateConfidence('channel', frame.confidence.channel);
  updateConfidence('alignment', frame.confidence.alignment);
  updateConfidence('waveform', frame.confidence.waveform);

  element('reason-codes').replaceChildren(...frame.confidence.reasons.map((reason) => {
    const span = document.createElement('span');
    span.textContent = reason;
    return span;
  }));

  element('explain-changed').textContent = frame.explanation.changed;
  element('explain-why').textContent = frame.explanation.why;
  element('explain-action').textContent = frame.explanation.action;

  const eventItems = frame.events.slice(0, 4).map((event) => {
    const item = document.createElement('li');
    const time = document.createElement('time');
    const text = document.createElement('span');
    time.textContent = event.timeSeconds.toFixed(3);
    text.textContent = event.message;
    item.append(time, text);
    return item;
  });
  if (eventItems.length === 0) {
    const item = document.createElement('li');
    item.innerHTML = '<time>0.000</time><span>Simulation running</span>';
    eventItems.push(item);
  }
  element('event-list').replaceChildren(...eventItems);

  element('forward-value').textContent = `FWD ${frame.channel.forwardMs.toFixed(2)} ms`;
  element('return-value').textContent = `RET ${frame.channel.returnMs.toFixed(2)} ms`;
  const total = Math.max(0.01, frame.channel.forwardMs + frame.channel.returnMs);
  const forwardRatio = frame.channel.forwardMs / total;
  element('forward-segment').style.width = `${Math.max(5, forwardRatio * 48)}%`;
  element('remote-node').style.left = `${Math.max(8, Math.min(92, forwardRatio * 100))}%`;
  element('return-segment').style.width = `${Math.max(5, (1 - forwardRatio) * 48)}%`;

  element('decision-value').textContent = frame.protection.decision;
  element('margin-value').textContent = `${frame.differential.marginPu >= 0 ? '+' : ''}${frame.differential.marginPu.toFixed(3)} pu`;
  const decisionBlock = document.querySelector('.decision-block');
  const decisionKind = frame.protection.operate
    ? 'operate'
    : frame.protection.permission === 'BLOCKED'
      ? 'blocked'
      : frame.protection.state === 'SECURE WINDOW'
        ? 'secure'
        : 'stable';
  decisionBlock.dataset.decision = decisionKind;

  const permissionBadge = element('permission-badge');
  permissionBadge.style.color = decisionKind === 'blocked'
    ? 'var(--blocked)'
    : decisionKind === 'secure'
      ? 'var(--watch)'
      : frame.protection.operate
        ? 'var(--danger)'
        : 'var(--good)';

  updateVirtualRelay(frame);

  element('canvas-summary').textContent = [
    `${frame.modeLabel}, ${frame.scenarioLabel}.`,
    `Validated differential current ${frame.differential.validatedRmsPu.toFixed(3)} per unit.`,
    `Restraint current ${frame.differential.restraintRmsPu.toFixed(3)} per unit.`,
    `Channel confidence ${frame.confidence.channel.score.toFixed(0)} percent.`,
    `Alignment confidence ${frame.confidence.alignment.score.toFixed(0)} percent.`,
    `Waveform confidence ${frame.confidence.waveform.score.toFixed(0)} percent.`,
    `Protection state ${frame.protection.state}; decision ${frame.protection.decision}.`
  ].join(' ');
}

function setRunning(nextRunning) {
  running = nextRunning;
  worker.postMessage({ type: running ? 'RUN' : 'PAUSE' });
  element('play-button').textContent = running ? 'Ⅱ PAUSE' : '▶ RUN';
  element('run-state').textContent = running ? 'RUNNING' : 'PAUSED';
  document.querySelector('.live-indicator').classList.toggle('is-paused', !running);
  if (latestFrame) updateVirtualRelay(latestFrame);
}

document.querySelectorAll('[data-config]').forEach((control) => {
  const eventName = control.type === 'checkbox' ? 'change' : 'input';
  control.addEventListener(eventName, () => {
    const key = control.dataset.config;
    const value = control.type === 'checkbox' ? control.checked : Number(control.value);
    postConfig({ [key]: value });
  });
});

document.querySelectorAll('[data-algorithm]').forEach((button) => {
  button.addEventListener('click', () => postConfig({ algorithm: button.dataset.algorithm }, true));
});

element('scenario-select').addEventListener('change', (event) => {
  postConfig({ scenario: event.target.value }, true);
});

document.querySelectorAll('[data-control-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.controlTab;
    document.querySelectorAll('[data-control-tab]').forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-control-page]').forEach((page) => {
      page.classList.toggle('is-active', page.dataset.controlPage === selected);
    });
  });
});

element('preset-select').addEventListener('change', (event) => {
  const preset = PRESETS[event.target.value];
  if (!preset) return;
  element('preset-purpose').textContent = preset.purpose;
  postConfig(preset.patch, true);
});

element('regenerate-seed').addEventListener('click', () => {
  const seed = Math.floor(1 + Math.random() * 2_000_000_000);
  postConfig({ seed }, true);
});

element('play-button').addEventListener('click', () => setRunning(!running));
element('step-button').addEventListener('click', () => {
  setRunning(false);
  worker.postMessage({ type: 'STEP', deltaMs: 40 });
});
element('reset-button').addEventListener('click', () => {
  worker.postMessage({ type: 'RESET', config });
});

element('relay-reset-latch').addEventListener('click', () => {
  const operateActive = Boolean(latestFrame?.protection?.operate);
  relayLatch = resetRelayLatch(relayLatch, operateActive);
  if (operateActive) {
    element('relay-latch-detail').textContent = 'RESET INHIBITED · operate condition active';
  }
  updateVirtualRelay(latestFrame);
});

element('theme-button').addEventListener('click', () => {
  document.documentElement.classList.toggle('high-contrast');
  renderer.draw();
});

element('export-button').addEventListener('click', () => {
  const documentData = createExperimentDocument(config);
  const blob = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `87l-experiment-${config.algorithm}-${config.seed}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

element('import-button').addEventListener('click', () => element('import-input').click());
element('import-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    config = parseExperimentDocument(parsed);
    worker.postMessage({ type: 'REPLACE_CONFIG', config });
    syncControls();
  } catch (error) {
    window.alert(`Unable to import experiment: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    event.target.value = '';
  }
});

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const editing = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  if (editing) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setRunning(!running);
  }
  if (event.code === 'ArrowRight' && !running) {
    worker.postMessage({ type: 'STEP', deltaMs: 40 });
  }
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'FRAME') updateFrame(event.data.frame);
});

worker.addEventListener('error', (event) => {
  element('run-state').textContent = 'WORKER ERROR';
  element('canvas-summary').textContent = `Simulation worker error: ${event.message}`;
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./service-worker.js', import.meta.url)).catch(() => {});
  });
}

syncControls();
worker.postMessage({ type: 'REPLACE_CONFIG', config });

// Expose a read-only diagnostic snapshot for automated smoke tests and educators.
Object.defineProperty(window, '__87L_LAB__', {
  get: () => ({ config: structuredClone(config), frame: latestFrame ? structuredClone(latestFrame) : null })
});
