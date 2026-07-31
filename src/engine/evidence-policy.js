import { ALGORITHM_MODES } from './constants.js';

/**
 * Generic P4 measured-evidence policy. These research constants are intentionally
 * independent of scenario identity and manufacturer-specific relay behaviour.
 */
export const P4_EVIDENCE_POLICY = Object.freeze({
  throughMinimumCoverage: 0.85,
  throughMaximumSignedCorrelation: -0.75,
  strongMaximumCoverageRelaxation: 0.85,
  strongIdiffPickupMultiple: 3,
  strongMinimumSignedCorrelation: 0.85,
  strongMinimumEstimatorPeak: 0.95,
  strongMaximumAgreementMs: 0.25,
  strongMaximumPredictedFraction: 0.1,
  strongPersistenceMs: 60,
  strongEvidenceDecayRatio: 0.5
});

export function evaluateThroughPolaritySecurity({
  algorithm,
  protectionValidFraction,
  signedCorrelation,
  policy = P4_EVIDENCE_POLICY
}) {
  return algorithm !== ALGORITHM_MODES.PING_PONG &&
    protectionValidFraction >= policy.throughMinimumCoverage &&
    signedCorrelation <= policy.throughMaximumSignedCorrelation;
}

export function evaluateStrongMeasuredDifferential({
  algorithm,
  hardInvalid,
  configuredMinimumCoverage,
  protectionValidFraction,
  idiffRmsPu,
  pickupPu,
  signedCorrelation,
  tracker,
  policy = P4_EVIDENCE_POLICY
}) {
  const shortPeak = Number(tracker?.short?.peakScore ?? 0);
  const stabilityPeak = Number(tracker?.stable?.peakScore ?? 0);
  const agreementLimitMs = Math.min(
    policy.strongMaximumAgreementMs,
    Number(tracker?.configuredAgreementMs ?? policy.strongMaximumAgreementMs) * 0.5
  );
  const coverageMinimum = Math.min(
    Number(configuredMinimumCoverage ?? 1),
    policy.strongMaximumCoverageRelaxation
  );

  return algorithm === ALGORITHM_MODES.SMART_TRACKING &&
    !hardInvalid &&
    protectionValidFraction >= coverageMinimum &&
    idiffRmsPu >= pickupPu * policy.strongIdiffPickupMultiple &&
    signedCorrelation >= policy.strongMinimumSignedCorrelation &&
    tracker?.measurementAccepted === true &&
    Math.min(shortPeak, stabilityPeak) >= policy.strongMinimumEstimatorPeak &&
    Number(tracker?.estimatorAgreementMs ?? Number.POSITIVE_INFINITY) <= agreementLimitMs &&
    Number(tracker?.predictedFraction ?? 1) <= policy.strongMaximumPredictedFraction;
}

export function updateStrongMeasuredEvidence({
  previousMs,
  candidate,
  hardInvalid,
  deltaMs,
  policy = P4_EVIDENCE_POLICY
}) {
  if (hardInvalid) return { evidenceMs: 0, operate: false };
  const evidenceMs = candidate
    ? Number(previousMs ?? 0) + deltaMs
    : Math.max(0, Number(previousMs ?? 0) - deltaMs * policy.strongEvidenceDecayRatio);
  return { evidenceMs, operate: evidenceMs >= policy.strongPersistenceMs };
}
