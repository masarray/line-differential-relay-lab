import { ALGORITHM_MODES, PROTECTION_STATES } from './constants.js';

export const SAFETY_INVARIANTS = Object.freeze({
  HARD_INVALID_VETO: 'INV_HARD_INVALID_VETO',
  MEASURED_EVIDENCE_REQUIRED: 'INV_MEASURED_EVIDENCE_REQUIRED',
  BLOCKED_PERMISSION_VETO: 'INV_BLOCKED_PERMISSION_VETO',
  DEGRADED_GATE_REQUIRED: 'INV_DEGRADED_GATE_REQUIRED',
  SECURE_STRONG_PATH_REQUIRED: 'INV_SECURE_STRONG_PATH_REQUIRED',
  FRESH_ALIGNMENT_REQUIRED: 'INV_FRESH_ALIGNMENT_REQUIRED',
  TRUSTED_ELECTRICAL_HOLD_REQUIRED: 'INV_TRUSTED_ELECTRICAL_HOLD_REQUIRED'
});

/**
 * Defence-in-depth guard for the final trip-permission boundary.
 *
 * The normal protection logic should already satisfy every invariant. This
 * guard prevents a future refactor from silently allowing an unsafe path and
 * exposes the violated invariant in the deterministic frame diagnostics.
 */
export function guardProtectionPermission({
  config,
  confidence,
  protection,
  measuredEvidenceValid,
  proposedTripAllowed,
  strongInternalEvidence,
  degradedSupervised
}) {
  const violations = [];
  const smart = config.algorithm === ALGORITHM_MODES.SMART_TRACKING;

  if (strongInternalEvidence && confidence.trustedElectricalHold !== true) {
    violations.push(SAFETY_INVARIANTS.TRUSTED_ELECTRICAL_HOLD_REQUIRED);
  }
  if (degradedSupervised && confidence.degradedEligible !== true) {
    violations.push(SAFETY_INVARIANTS.DEGRADED_GATE_REQUIRED);
  }

  if (proposedTripAllowed) {
    if (confidence.hardInvalid) violations.push(SAFETY_INVARIANTS.HARD_INVALID_VETO);
    if (!measuredEvidenceValid) violations.push(SAFETY_INVARIANTS.MEASURED_EVIDENCE_REQUIRED);
    if (protection.permission === 'BLOCKED') violations.push(SAFETY_INVARIANTS.BLOCKED_PERMISSION_VETO);

    if (smart && protection.state === PROTECTION_STATES.SECURE && !strongInternalEvidence) {
      violations.push(SAFETY_INVARIANTS.SECURE_STRONG_PATH_REQUIRED);
    }
    if (smart && protection.state === PROTECTION_STATES.WATCH && !strongInternalEvidence && !degradedSupervised) {
      violations.push(SAFETY_INVARIANTS.DEGRADED_GATE_REQUIRED);
    }
    if (
      smart &&
      !strongInternalEvidence &&
      Number(confidence.correctionAgeMs ?? Number.POSITIVE_INFINITY) > config.degradedMaxCorrectionAgeMs
    ) {
      violations.push(SAFETY_INVARIANTS.FRESH_ALIGNMENT_REQUIRED);
    }
  }

  return {
    tripAllowed: Boolean(proposedTripAllowed && violations.length === 0),
    violations: [...new Set(violations)]
  };
}
