import { ALGORITHM_MODES, PRESETS, createDefaultConfig } from './engine/constants.js';
import { createExperimentDocument, parseExperimentDocument, sanitizeConfig } from './engine/schema.js';
import { WaveformRenderer } from './ui/waveform-renderer.js';
import { createRelayLatchState, resetRelayLatch, updateRelayLatch } from './ui/relay-latch.js';

const worker = new Worker(new URL('./worker/simulation-worker.js', import.meta.url), { type: 'module' });
const renderer = new WaveformRenderer(document.querySelector('#waveform-canvas'));
const PRESENTATION_INTERVAL_MS = 1000 / 12;
const CONTROL_POST_INTERVAL_MS = 28;
const NARRATIVE_INTERVAL_MS = 250;

let config = createDefaultConfig();
let running = true;
let latestFrame = null;
let relayLatch = createRelayLatchState();
let pendingPresentationFrame = null;
let presentationTimer = null;
let lastPresentationAt = 0;
let pendingWorkerPatch = {};
let workerPatchTimer = null;
let lastReasonSignature = '';
let lastEventSignature = '';
let lastExplanationSignature = '';
let lastProtectionSignature = '';
let lastNarrativeAt = 0;
const visualMetrics = new Map();

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

function setText(target, value) {
  const node = typeof target === 'string' ? element(target) : target;
  if (!node) return;
  const text = String(value);
  if (node.textContent !== text) node.textContent = text;
}

function setDataset(node, key, value) {
  if (!node) return;
  const text = String(value);
  if (node.dataset[key] !== text) node.dataset[key] = text;
}

function setStyle(node, property, value) {
  if (!node) return;
  if (node.style[property] !== value) node.style[property] = value;
}

function smoothMetric(key, target, alpha = 0.55) {
  if (!Number.isFinite(target)) return target;
  const previous = visualMetrics.get(key);
  const next = Number.isFinite(previous) ? previous + (target - previous) * alpha : target;
  visualMetrics.set(key, next);
  return next;
}

function resetPresentationSmoothing() {
  visualMetrics.clear();
  renderer.resetSmoothing?.();
}

function formatConfigValue(key, value) {
  const [unit, digits] = units[key] ?? ['', 2];
  return `${Number(value).toFixed(digits)} ${unit}`.trim();
}

function syncControlKey(key) {
  const control = document.querySelector(`[data-config="${key}"]`);
  if (control && key in config) {
    if (control.type === 'checkbox') control.checked = Boolean(config[key]);
    else control.value = String(config[key]);
  }

  const output = document.querySelector(`[data-output="${key}"]`);
  if (output && key in config) {
    output.value = formatConfigValue(key, config[key]);
    setText(output, output.value);
  }

  if (key === 'algorithm') {
    document.querySelectorAll('[data-algorithm]').forEach((button) => {
      const active = button.dataset.algorithm === config.algorithm;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  if (key === 'scenario') element('scenario-select').value = config.scenario;
  if (key === 'seed') setText('seed-value', config.seed);
  if (key === 'frequencyHz') setText('frequency-label', `${config.frequencyHz} Hz`);
  if (key === 'sampleRateHz') setText('sample-label', `${config.sampleRateHz} Sa/s`);
}

function syncControls(keys = null) {
  if (Array.isArray(keys)) {
    [...new Set(keys)].forEach(syncControlKey);
    return;
  }

  document.querySelectorAll('[data-config]').forEach((control) => syncControlKey(control.dataset.config));
  document.querySelectorAll('[data-output]').forEach((output) => syncControlKey(output.dataset.output));
  syncControlKey('algorithm');
  syncControlKey('scenario');
  syncControlKey('seed');
  syncControlKey('frequencyHz');
  syncControlKey('sampleRateHz');
}

function flushWorkerPatch() {
  if (workerPatchTimer !== null) {
    window.clearTimeout(workerPatchTimer);
    workerPatchTimer = null;
  }
  const patch = pendingWorkerPatch;
  pendingWorkerPatch = {};
  if (Object.keys(patch).length > 0) worker.postMessage({ type: 'CONFIG', patch });
}

function queueWorkerPatch(patch) {
  Object.assign(pendingWorkerPatch, patch);
  if (workerPatchTimer !== null) return;
  workerPatchTimer = window.setTimeout(flushWorkerPatch, CONTROL_POST_INTERVAL_MS);
}

function postConfig(patch, replace = false) {
  config = sanitizeConfig({ ...config, ...patch });
  if (replace) {
    flushWorkerPatch();
    worker.postMessage({ type: 'REPLACE_CONFIG', config });
    resetPresentationSmoothing();
    syncControls();
  } else {
    queueWorkerPatch(patch);
    syncControls(Object.keys(patch));
  }
}

function scoreColor(score) {
  if (score >= 82) return 'var(--good)';
  if (score >= 62) return 'var(--watch)';
  if (score >= 42) return 'var(--remote)';
  return 'var(--danger)';
}

function updateConfidence(domain, confidence) {
  const score = smoothMetric(`confidence-${domain}`, confidence.score, 0.48);
  setText(`${domain}-confidence-value`, `${score.toFixed(0)}%`);
  setText(`${domain}-confidence-status`, confidence.status);
  const bar = element(`${domain}-confidence-bar`);
  setStyle(bar, 'width', `${Math.max(1, score)}%`);
  setStyle(bar, 'backgroundColor', scoreColor(score));
}

function setRelayLed(id, active, condition = 'normal') {
  const led = element(id);
  if (!led) return;
  setDataset(led, 'active', Boolean(active));
  setDataset(led, 'condition', condition);
}

function updateVirtualRelay(frame) {
  if (!frame) return;

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
  setDataset(device, 'relayState', relayLatch.latched ? 'trip' : blocked ? 'blocked' : secure ? 'secure' : 'ready');

  const relayIdiff = smoothMetric('relay-idiff', frame.differential.validatedRmsPu, 0.58);
  const relayIbias = smoothMetric('relay-ibias', frame.differential.restraintRmsPu, 0.58);
  const relayIraw = smoothMetric('relay-iraw', frame.differential.rawRmsPu, 0.58);
  const relayPickup = smoothMetric('relay-pickup', frame.differential.activeThresholdPu, 0.58);
  const relayChannel = smoothMetric('relay-channel', channelScore, 0.5);

  setText('relay-lcd-clock', `${frame.timeSeconds.toFixed(3)} s`);
  setText('relay-lcd-idiff', `${relayIdiff.toFixed(3)} pu`);
  setText('relay-lcd-ibias', `${relayIbias.toFixed(3)} pu`);
  setText('relay-lcd-iraw', `${relayIraw.toFixed(3)} pu`);
  setText('relay-lcd-ipickup', `${relayPickup.toFixed(3)} pu`);
  setText('relay-lcd-channel', `${relayChannel.toFixed(0)} %`);
  setText('relay-lcd-state', frame.protection.state);
  setText('relay-lcd-permission', frame.protection.permission);

  if (relayLatch.latched) {
    setText('relay-lcd-title', 'TRIP LATCHED');
    setText('relay-lcd-message', `87L OPERATE @ ${relayLatch.tripTimeSeconds.toFixed(3)} s`);
    setText('relay-latch-status', '87L TRIP');
    setText('relay-latch-detail', `${relayLatch.idiffPu.toFixed(3)} pu · ${relayLatch.scenarioLabel}`);
  } else if (blocked) {
    setText('relay-lcd-title', '87L BLOCKED');
    setText('relay-lcd-message', 'REMOTE DATA NOT RELIABLE');
    setText('relay-latch-status', 'CLEAR');
    setText('relay-latch-detail', 'Trip permission blocked');
  } else if (secure) {
    setText('relay-lcd-title', 'SUPERVISED 87L');
    setText('relay-lcd-message', `${frame.protection.secureRemainingMs.toFixed(0)} ms REVALIDATION`);
    setText('relay-latch-status', 'CLEAR');
    setText('relay-latch-detail', 'Supervised operation active');
  } else {
    setText('relay-lcd-title', '87L IN SERVICE');
    setText('relay-lcd-message', 'PROTECTION AVAILABLE');
    setText('relay-latch-status', 'CLEAR');
    setText('relay-latch-detail', 'No latched operation');
  }

  setText('relay-output-state', relayLatch.latched ? 'TRIP OUTPUT LATCHED' : blocked ? 'TRIP OUTPUT BLOCKED' : 'TRIP CONTACT RESET');
  const reset = element('relay-reset-latch');
  if (reset) reset.disabled = !relayLatch.latched;
}

function updateReasons(frame) {
  const signature = frame.confidence.reasons.join('|');
  if (signature === lastReasonSignature) return;
  lastReasonSignature = signature;
  element('reason-codes').replaceChildren(...frame.confidence.reasons.map((reason) => {
    const span = document.createElement('span');
    span.textContent = reason;
    return span;
  }));
}

function updateExplanation(frame) {
  const signature = [frame.explanation.changed, frame.explanation.why, frame.explanation.action].join('\u241f');
  if (signature === lastExplanationSignature) return;
  lastExplanationSignature = signature;
  setText('explain-changed', frame.explanation.changed);
  setText('explain-why', frame.explanation.why);
  setText('explain-action', frame.explanation.action);
}

function updateEvents(frame) {
  const events = frame.events.slice(0, 4);
  const signature = events.map((event) => `${event.timeSeconds.toFixed(3)}|${event.message}`).join('||');
  if (signature === lastEventSignature) return;
  lastEventSignature = signature;

  const eventItems = events.map((event) => {
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
}

function updateCanvasSummary(frame) {
  setText('canvas-summary', [
    `${frame.modeLabel}, ${frame.scenarioLabel}.`,
    `Validated differential current ${frame.differential.validatedRmsPu.toFixed(3)} per unit.`,
    `Restraint current ${frame.differential.restraintRmsPu.toFixed(3)} per unit.`,
    `Channel confidence ${frame.confidence.channel.score.toFixed(0)} percent.`,
    `Alignment confidence ${frame.confidence.alignment.score.toFixed(0)} percent.`,
    `Waveform confidence ${frame.confidence.waveform.score.toFixed(0)} percent.`,
    `Protection state ${frame.protection.state}; decision ${frame.protection.decision}.`
  ].join(' '));
}

function renderPresentation(frame) {
  if (!frame) return;
  const now = performance.now();
  renderer.setFrame(frame);

  setText('scenario-label', frame.scenarioLabel);
  const rtt = smoothMetric('rtt', frame.channel.rttMs, 0.48);
  const alignment = smoothMetric('alignment', frame.alignment.residualEstimateMs, 0.48);
  const idiff = smoothMetric('idiff', frame.differential.validatedRmsPu, 0.58);
  const irest = smoothMetric('irest', frame.differential.restraintRmsPu, 0.58);
  const margin = smoothMetric('margin', frame.differential.marginPu, 0.58);

  setText('rtt-value', `${rtt.toFixed(2)} ms`);
  setText('alignment-error', `${alignment >= 0 ? '+' : ''}${alignment.toFixed(2)} ms`);
  setText('idiff-value', `${idiff.toFixed(3)} pu`);
  setText('irest-value', `${irest.toFixed(3)} pu`);
  setText('simulation-time', `t = ${frame.timeSeconds.toFixed(3)} s`);

  setText('protection-state', frame.protection.state);
  setText('permission-badge', frame.protection.permission);
  setText('secure-remaining', `${frame.protection.secureRemainingMs.toFixed(0)} ms`);

  updateConfidence('channel', frame.confidence.channel);
  updateConfidence('alignment', frame.confidence.alignment);
  updateConfidence('waveform', frame.confidence.waveform);

  const protectionSignature = `${frame.protection.state}|${frame.protection.permission}|${frame.protection.operate}`;
  const protectionChanged = protectionSignature !== lastProtectionSignature;
  if (protectionChanged) lastProtectionSignature = protectionSignature;
  if (protectionChanged || now - lastNarrativeAt >= NARRATIVE_INTERVAL_MS) {
    lastNarrativeAt = now;
    updateReasons(frame);
    updateExplanation(frame);
    updateCanvasSummary(frame);
  }
  updateEvents(frame);

  const forward = smoothMetric('forward', frame.channel.forwardMs, 0.5);
  const backward = smoothMetric('return', frame.channel.returnMs, 0.5);
  setText('forward-value', `FWD ${forward.toFixed(2)} ms`);
  setText('return-value', `RET ${backward.toFixed(2)} ms`);
  const total = Math.max(0.01, forward + backward);
  const forwardRatio = forward / total;
  setStyle(element('forward-segment'), 'width', `${Math.max(5, forwardRatio * 48)}%`);
  setStyle(element('remote-node'), 'left', `${Math.max(8, Math.min(92, forwardRatio * 100))}%`);
  setStyle(element('return-segment'), 'width', `${Math.max(5, (1 - forwardRatio) * 48)}%`);

  setText('decision-value', frame.protection.decision);
  setText('margin-value', `${margin >= 0 ? '+' : ''}${margin.toFixed(3)} pu`);
  const decisionBlock = document.querySelector('.decision-block');
  const decisionKind = frame.protection.operate
    ? 'operate'
    : frame.protection.permission === 'BLOCKED'
      ? 'blocked'
      : frame.protection.state === 'SECURE WINDOW'
        ? 'secure'
        : 'stable';
  setDataset(decisionBlock, 'decision', decisionKind);

  const permissionBadge = element('permission-badge');
  setStyle(permissionBadge, 'color', decisionKind === 'blocked'
    ? 'var(--blocked)'
    : decisionKind === 'secure'
      ? 'var(--watch)'
      : frame.protection.operate
        ? 'var(--danger)'
        : 'var(--good)');

  updateVirtualRelay(frame);
}

function flushPresentation() {
  presentationTimer = null;
  const frame = pendingPresentationFrame;
  pendingPresentationFrame = null;
  if (!frame) return;
  lastPresentationAt = performance.now();
  renderPresentation(frame);
}

function schedulePresentation(frame) {
  pendingPresentationFrame = frame;
  if (presentationTimer !== null) return;
  const elapsed = performance.now() - lastPresentationAt;
  const delay = Math.max(0, PRESENTATION_INTERVAL_MS - elapsed);
  presentationTimer = window.setTimeout(flushPresentation, delay);
}

function setRunning(nextRunning) {
  running = nextRunning;
  worker.postMessage({ type: running ? 'RUN' : 'PAUSE' });
  setText('play-button', running ? 'Ⅱ PAUSE' : '▶ RUN');
  setText('run-state', running ? 'RUNNING' : 'PAUSED');
  document.querySelector('.live-indicator').classList.toggle('is-paused', !running);
  if (latestFrame) updateVirtualRelay(latestFrame);
}

function installPresentationMotion() {
  ['channel-confidence-bar', 'alignment-confidence-bar', 'waveform-confidence-bar'].forEach((id) => {
    const bar = element(id);
    if (bar) bar.style.transition = 'width 150ms cubic-bezier(.22,.61,.36,1), background-color 180ms ease';
  });
  const forwardSegment = element('forward-segment');
  const returnSegment = element('return-segment');
  const remoteNode = element('remote-node');
  if (forwardSegment) forwardSegment.style.transition = 'width 150ms cubic-bezier(.22,.61,.36,1)';
  if (returnSegment) returnSegment.style.transition = 'width 150ms cubic-bezier(.22,.61,.36,1)';
  if (remoteNode) remoteNode.style.transition = 'left 150ms cubic-bezier(.22,.61,.36,1)';
}

document.querySelectorAll('[data-config]').forEach((control) => {
  const eventName = control.type === 'checkbox' ? 'change' : 'input';
  control.addEventListener(eventName, () => {
    const key = control.dataset.config;
    const value = control.type === 'checkbox' ? control.checked : Number(control.value);
    postConfig({ [key]: value });
  }, { passive: eventName === 'input' });
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
  setText('preset-purpose', preset.purpose);
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
  resetPresentationSmoothing();
  worker.postMessage({ type: 'RESET', config });
});

element('relay-reset-latch').addEventListener('click', () => {
  const operateActive = Boolean(latestFrame?.protection?.operate);
  relayLatch = resetRelayLatch(relayLatch, operateActive);
  if (operateActive) setText('relay-latch-detail', 'RESET INHIBITED · operate condition active');
  updateVirtualRelay(latestFrame);
});

element('theme-button').addEventListener('click', () => {
  document.documentElement.classList.toggle('high-contrast');
  renderer.invalidatePalette?.();
  renderer.requestDraw?.();
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
    flushWorkerPatch();
    resetPresentationSmoothing();
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
  if (event.code === 'ArrowRight' && !running) worker.postMessage({ type: 'STEP', deltaMs: 40 });
});

worker.addEventListener('message', (event) => {
  if (event.data?.type !== 'FRAME') return;
  const frame = event.data.frame;
  latestFrame = frame;
  const wasLatched = relayLatch.latched;
  relayLatch = updateRelayLatch(relayLatch, frame);
  if (!wasLatched && relayLatch.latched) updateVirtualRelay(frame);
  schedulePresentation(frame);
});

worker.addEventListener('error', (event) => {
  setText('run-state', 'WORKER ERROR');
  setText('canvas-summary', `Simulation worker error: ${event.message}`);
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./service-worker.js', import.meta.url)).catch(() => {});
  });
}

installPresentationMotion();
syncControls();
worker.postMessage({ type: 'REPLACE_CONFIG', config });

// Expose a read-only diagnostic snapshot for automated smoke tests and educators.
Object.defineProperty(window, '__87L_LAB__', {
  get: () => ({
    config: structuredClone(config),
    frame: latestFrame ? structuredClone(latestFrame) : null,
    presentation: { targetFps: Math.round(1000 / PRESENTATION_INTERVAL_MS), engineFrameMs: 40 }
  })
});
