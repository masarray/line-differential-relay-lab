import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHM_MODES } from '../src/engine/constants.js';
import {
  formatMonteCarloMarkdown,
  generateValidationCase,
  runMonteCarloCampaign,
  runValidationCase,
  summarizeValidationRuns
} from '../src/validation/monte-carlo.js';

test('validation-case generation is deterministic and balanced by family', () => {
  const first = generateValidationCase(2, { seed: 61850, warmupMs: 200, eventMs: 500 });
  const repeated = generateValidationCase(2, { seed: 61850, warmupMs: 200, eventMs: 500 });
  const next = generateValidationCase(3, { seed: 61850, warmupMs: 200, eventMs: 500 });

  assert.deepEqual(first, repeated);
  assert.equal(first.family, 'internal-fault');
  assert.equal(first.expectedTrip, true);
  assert.notEqual(first.seed, next.seed);
  assert.ok(first.eventPatch.routeChangeAtMs >= 250);
});

test('one blind case can be replayed identically across algorithm modes', () => {
  const testCase = generateValidationCase(0, { seed: 87, warmupMs: 120, eventMs: 240 });
  const conventional = runValidationCase(testCase, ALGORITHM_MODES.PING_PONG, {
    stepMs: 20,
    warmupMs: 120,
    eventMs: 240,
    recoveryMs: 160
  });
  const smart = runValidationCase(testCase, ALGORITHM_MODES.SMART_TRACKING, {
    stepMs: 20,
    warmupMs: 120,
    eventMs: 240,
    recoveryMs: 160
  });

  assert.equal(conventional.caseSeed, smart.caseSeed);
  assert.equal(conventional.family, smart.family);
  assert.equal(conventional.expectedTrip, false);
  assert.equal(smart.expectedTrip, false);
  assert.equal(typeof smart.alignmentRmseMs, 'number');
  assert.equal(typeof smart.meanEstimatedUncertaintyMs, 'number');
});

test('small Monte Carlo campaign is repeatable apart from report timestamp', () => {
  const options = {
    cases: 5,
    seed: 123456,
    stepMs: 20,
    warmupMs: 120,
    eventMs: 260,
    recoveryMs: 160,
    algorithms: [ALGORITHM_MODES.PING_PONG, ALGORITHM_MODES.SECURE_WINDOW, ALGORITHM_MODES.SMART_TRACKING],
    includeCaseDetails: true
  };
  const first = runMonteCarloCampaign(options);
  const second = runMonteCarloCampaign(options);

  assert.deepEqual(first.campaign, second.campaign);
  assert.deepEqual(first.summary, second.summary);
  assert.deepEqual(first.cases, second.cases);
  assert.deepEqual(first.runs, second.runs);
  assert.equal(first.campaign.replayCount, 15);
});

test('summary separates unwanted trips, eligible misses, and inhibited internal cases', () => {
  const base = {
    severity: 'moderate',
    scenario: 'through-current',
    operated: false,
    operatedDuringEvent: false,
    lateTrip: false,
    tripOperatingTimeMs: null,
    firstSecureMs: null,
    firstBlockedMs: null,
    recoveryToNormalMs: 20,
    eligibleFraction: 1,
    availabilityPct: 100,
    tripAllowedPct: 100,
    secureTimeMs: 0,
    blockedTimeMs: 0,
    hardInvalidTimeMs: 0,
    alignmentRmseMs: 0.1,
    alignmentMaxAbsMs: 0.2,
    meanEstimatedUncertaintyMs: 0.2,
    meanPredictedFraction: 0,
    maxPredictedFraction: 0,
    ambiguousFrames: 0,
    heldMeasurementFrames: 0,
    routeTransitionFrames: 0,
    packetMaxima: {},
    reasonCounts: { QUALITY_NOMINAL: 1 }
  };
  const algorithm = ALGORITHM_MODES.SMART_TRACKING;
  const runs = [
    { ...base, caseId: 'S1', caseSeed: 1, family: 'through-communication', algorithm, expectedTrip: false, dependabilityEligible: false, unwantedTrip: true, missedEligibleTrip: false, operated: true, operatedDuringEvent: true, tripOperatingTimeMs: 40 },
    { ...base, caseId: 'I1', caseSeed: 2, family: 'internal-fault', algorithm, expectedTrip: true, dependabilityEligible: true, unwantedTrip: false, missedEligibleTrip: false, operated: true, operatedDuringEvent: true, tripOperatingTimeMs: 60 },
    { ...base, caseId: 'I2', caseSeed: 3, family: 'internal-fault', algorithm, expectedTrip: true, dependabilityEligible: true, unwantedTrip: false, missedEligibleTrip: true },
    { ...base, caseId: 'I3', caseSeed: 4, family: 'internal-fault', algorithm, expectedTrip: true, dependabilityEligible: false, unwantedTrip: false, missedEligibleTrip: false }
  ];
  const summary = summarizeValidationRuns(runs, [algorithm])[algorithm];

  assert.equal(summary.unwantedTrips, 1);
  assert.equal(summary.dependabilityEligibleCases, 2);
  assert.equal(summary.eligibleInternalTrips, 1);
  assert.equal(summary.missedEligibleTrips, 1);
  assert.equal(summary.communicationInhibitedInternalCases, 1);
});

test('compact campaign omits replay details and produces an auditable report', () => {
  const report = runMonteCarloCampaign({
    cases: 2,
    seed: 99,
    warmupMs: 80,
    eventMs: 120,
    recoveryMs: 80,
    algorithms: [ALGORITHM_MODES.SMART_TRACKING],
    includeCaseDetails: false
  });
  const markdown = formatMonteCarloMarkdown(report);

  assert.equal(report.cases, undefined);
  assert.equal(report.runs, undefined);
  assert.match(markdown, /Ground truth is evaluator-only/);
  assert.match(markdown, /Unwanted-trip rate/);
  assert.match(markdown, /Communication-inhibited internal case/);
});
