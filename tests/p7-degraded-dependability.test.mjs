import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateDependabilityCase,
  runDependabilityCase
} from '../src/validation/degraded-dependability.js';
import {
  evidenceQualifiedDependabilityMarkdown,
  runEvidenceQualifiedDependabilityCampaign
} from '../src/validation/evidence-qualified-dependability.js';

test('degraded dependability case generation and replay are deterministic', () => {
  const testCaseA = generateDependabilityCase(5, { seed: 87161850 });
  const testCaseB = generateDependabilityCase(5, { seed: 87161850 });
  assert.deepEqual(testCaseA, testCaseB);

  const replayA = runDependabilityCase(testCaseA, { stepMs: 20, faultMs: 320 });
  const replayB = runDependabilityCase(testCaseB, { stepMs: 20, faultMs: 320 });
  assert.deepEqual(replayA, replayB);
});

test('P7 dependability smoke separates eligibility, revalidation delay, and qualified operating latency', () => {
  const report = runEvidenceQualifiedDependabilityCampaign({
    seed: 87161850,
    cases: 12,
    stepMs: 20,
    faultMs: 360,
    includeCaseDetails: true
  });

  assert.equal(report.summary.totalCases, 12);
  assert.ok(report.summary.eligibleCases >= 6, JSON.stringify(report.summary));
  assert.equal(report.summary.missedEligibleTrips, 0, JSON.stringify(report.replays, null, 2));
  assert.equal(report.summary.invariantViolationFrames, 0, JSON.stringify(report.replays, null, 2));
  assert.ok(report.summary.alignmentInhibited >= 1, JSON.stringify(report.summary));
  assert.ok(report.summary.qualifiedOperatingLatencyMs.p95 <= 80, JSON.stringify(report.summary));
  assert.ok(report.summary.preFaultAvailableFaultToTripMs.p95 <= 160, JSON.stringify(report.summary));
  assert.ok(Number.isFinite(report.summary.faultToTripMs.p95), JSON.stringify(report.summary));

  const eligibleOperated = report.replays.filter((replay) => replay.dependabilityEligible && replay.operated);
  assert.ok(eligibleOperated.length > 0);
  for (const replay of eligibleOperated) {
    assert.ok(Number.isFinite(replay.faultToTripMs), JSON.stringify(replay));
    assert.ok(Number.isFinite(replay.operatingPermissionStartMs), JSON.stringify(replay));
    assert.ok(Number.isFinite(replay.qualifiedOperatingLatencyMs), JSON.stringify(replay));
    assert.ok(replay.qualifiedOperatingLatencyMs <= replay.faultToTripMs, JSON.stringify(replay));
  }

  const classes = new Set(report.replays.map((replay) => replay.inhibitionClass));
  assert.ok(classes.has('DEPENDABILITY_ELIGIBLE'), JSON.stringify(report.replays, null, 2));
  assert.ok(classes.has('ALIGNMENT_INHIBITED'), JSON.stringify(report.replays, null, 2));

  const preFaultStates = new Set(report.replays.map((replay) => replay.preFaultDisplayState));
  assert.ok(
    preFaultStates.has('DEGRADED 87L') || preFaultStates.has('SECURE WINDOW') || preFaultStates.has('BLOCKED'),
    JSON.stringify(report.replays, null, 2)
  );

  const markdown = evidenceQualifiedDependabilityMarkdown(report);
  assert.match(markdown, /Missed eligible trips: 0/);
  assert.match(markdown, /Alignment-inhibited:/);
  assert.match(markdown, /Qualified operating latency/);
  assert.match(markdown, /Full fault-to-trip/);
  assert.match(markdown, /Safety-invariant violation frames: 0/);
});
