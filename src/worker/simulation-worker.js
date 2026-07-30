import { Simulator } from '../engine/simulation.js';
import { createDefaultConfig } from '../engine/constants.js';

let simulator = new Simulator(createDefaultConfig());
let running = true;
let timer = null;
const FRAME_INTERVAL_MS = 40;

function sendFrame(deltaMs = FRAME_INTERVAL_MS) {
  const frame = simulator.step(deltaMs);
  self.postMessage({ type: 'FRAME', frame });
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (running) sendFrame(FRAME_INTERVAL_MS);
  }, FRAME_INTERVAL_MS);
}

self.addEventListener('message', (event) => {
  const message = event.data ?? {};
  switch (message.type) {
    case 'CONFIG':
      simulator.setConfig(message.patch ?? {});
      sendFrame(0);
      break;
    case 'REPLACE_CONFIG':
      simulator.reset(message.config ?? createDefaultConfig());
      sendFrame(0);
      break;
    case 'RUN':
      running = true;
      break;
    case 'PAUSE':
      running = false;
      break;
    case 'STEP':
      running = false;
      sendFrame(Number(message.deltaMs) || FRAME_INTERVAL_MS);
      break;
    case 'RESET':
      simulator.reset(message.config ?? simulator.config);
      sendFrame(0);
      break;
    default:
      break;
  }
});

startTimer();
sendFrame(0);
