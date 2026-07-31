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

test('P7 dependability smoke separates eligible trips, communication inhibition, and alignment inhibition', () => {
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
  assert.ok(report.summary.operatingTimeMs.p95 <= 140, JSON.stringify(report.summary));

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
  assert.match(markdown, /Safety-invariant violation frames: 0/);
});
