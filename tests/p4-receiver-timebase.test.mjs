import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacketChannelWindow } from '../src/engine/channel-model.js';
import { ALGORITHM_MODES, createDefaultConfig } from '../src/engine/constants.js';
import { estimateLag, normalizedCorrelation, shiftSeries } from '../src/engine/math.js';
import { generateValidationCase, runValidationCase } from '../src/validation/monte-carlo.js';

test('bounded packet reordering preserves the uniform receiver sample time base', () => {
  const config = {
    ...createDefaultConfig(),
    baseDelayMs: 4,
    asymmetryMs: 2,
    jitterMs: 0.6,
    packetSamples: 8,
    packetSerializationMs: 0.3,
    reorderPct: 100,
    reorderExtraDelayMs: 3,
    reorderBufferFrames: 4,
    maxReceiverQueueFrames: 8,
    packetAbsoluteAgeMs: 40,
    packetLossPct: 0,
    burstLossPct: 0,
    corruptionPct: 0,
    clockOffsetMs: 0,
    clockDriftPpm: 0
  };
  const sampleCount = 400;
  const simulationTimeSeconds = 1;
  const windowStartSeconds = simulationTimeSeconds - sampleCount / config.sampleRateHz;
  const transport = createPacketChannelWindow({
    config,
    simulationTimeSeconds,
    frameIndex: 25,
    windowStartSeconds,
    sampleCount,
    sampleValueAt: (time) => -Math.sin(2 * Math.PI * config.frequencyHz * time)
  });
  const local = Float64Array.from({ length: sampleCount }, (_, index) =>
    Math.sin(2 * Math.PI * config.frequencyHz * (windowStartSeconds + index / config.sampleRateHz))
  );
  const knownDelayMs = config.baseDelayMs + config.asymmetryMs / 2 +
    config.packetSerializationMs + transport.snapshot.playoutBufferMs;
  const aligned = shiftSeries(transport.remoteReceived, knownDelayMs * config.sampleRateHz / 1000);

  assert.ok(transport.snapshot.receiver.reorderedFrames > 0);
  assert.equal(transport.snapshot.receiver.lateFrames, 0);
  assert.ok(Math.abs(normalizedCorrelation(local, aligned, 80, 300)) > 0.995);
});

test('bounded lag estimator moves its horizon into common measured overlap', () => {
  const reference = Float64Array.from({ length: 480 }, (_, index) => {
    const angle = index / 80 * Math.PI * 2;
    return Math.sin(angle) + 0.04 * Math.sin(3 * angle + 0.2);
  });
  const candidate = shiftSeries(Float64Array.from(reference, (value) => -value), -52.4);
  const coarseAligned = shiftSeries(candidate, 48);
  const estimate = estimateLag(reference, coarseAligned, 16, 428, 480);

  assert.ok(estimate.commonSampleSpan >= 40, JSON.stringify(estimate));
  assert.ok(estimate.searchEnd < 480, JSON.stringify(estimate));
  assert.ok(estimate.peakScore > 0.95, JSON.stringify(estimate));
  assert.ok(Math.abs(estimate.refinedLagSamples - 4.4) < 0.25, JSON.stringify(estimate));
});

test('P3 deterministic failure seeds remain secure and dependable after P4 receiver hardening', () => {
  const externalCase = generateValidationCase(1, { seed: 61850 });
  const externalRun = runValidationCase(externalCase, ALGORITHM_MODES.SMART_TRACKING);
  assert.equal(externalRun.caseSeed, 1453102326);
  assert.equal(externalRun.unwantedTrip, false, JSON.stringify(externalRun));

  const internalCase = generateValidationCase(2, { seed: 61850 });
  const internalRun = runValidationCase(internalCase, ALGORITHM_MODES.SMART_TRACKING);
  assert.equal(internalRun.caseSeed, 1520509160);
  assert.equal(internalRun.dependabilityEligible, true, JSON.stringify(internalRun));
  assert.equal(internalRun.missedEligibleTrip, false, JSON.stringify(internalRun));
  assert.equal(internalRun.operatedDuringEvent, true, JSON.stringify(internalRun));
});
