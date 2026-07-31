#!/usr/bin/env node
import { ALGORITHM_MODES } from '../src/engine/constants.js';
import { generateValidationCase, runValidationCase } from '../src/validation/monte-carlo.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const seed = Number(argument('--seed', 61850));
const caseToken = String(argument('--case', 'MC-0003'));
const numericCase = Number(caseToken.replace(/\D/g, ''));
if (!Number.isInteger(numericCase) || numericCase < 1) {
  throw new Error(`Invalid --case value: ${caseToken}`);
}

const algorithmToken = argument('--algorithm', ALGORITHM_MODES.SMART_TRACKING);
const algorithms = algorithmToken === 'all'
  ? [ALGORITHM_MODES.PING_PONG, ALGORITHM_MODES.SECURE_WINDOW, ALGORITHM_MODES.SMART_TRACKING]
  : [algorithmToken];
const validAlgorithms = new Set(Object.values(ALGORITHM_MODES));
for (const algorithm of algorithms) {
  if (!validAlgorithms.has(algorithm)) throw new Error(`Unsupported algorithm: ${algorithm}`);
}

const testCase = generateValidationCase(numericCase - 1, { seed });
const runs = algorithms.map((algorithm) => runValidationCase(testCase, algorithm));
console.log(JSON.stringify({
  format: 'line-differential-relay-lab-failure-replay',
  schemaVersion: 1,
  masterSeed: seed,
  testCase,
  runs
}, null, 2));
