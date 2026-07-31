import { Simulator as BaseSimulator } from './simulation-core.js';
import {
  evaluateStrongMeasuredDifferential,
  evaluateThroughPolaritySecurity,
  updateStrongMeasuredEvidence
} from './evidence-policy.js';

/**
 * P4 failure-driven hardening wrapper. The P0-P3 simulation core remains intact;
 * this layer adds two generic measured-evidence gates after the core frame is
 * complete and never reads scenario identity or evaluator ground truth.
 */
export class Simulator extends BaseSimulator {
  constructor(initialConfig) {
    super(initialConfig);
    this.strongMeasuredEvidenceMs = 0;
  }

  setConfig(patch) {
    const previousAlgorithm = this.config.algorithm;
    super.setConfig(patch);
    if (previousAlgorithm !== this.config.algorithm) this.strongMeasuredEvidenceMs = 0;
  }

  reset(config = this.config) {
    super.reset(config);
    this.strongMeasuredEvidenceMs = 0;
  }

  step(deltaMs = 20) {
    const frame = super.step(deltaMs);
    const effectiveDeltaMs = deltaMs * this.config.simulationSpeed;
    const signedCorrelation = Number(frame.alignment.correlation ?? 0);
    const throughPolaritySecure = evaluateThroughPolaritySecurity({
      algorithm: this.config.algorithm,
      protectionValidFraction: frame.differential.protectionValidFraction,
      signedCorrelation
    });

    if (throughPolaritySecure) {
      this.tripPersistenceMs = 0;
      frame.protection.operate = false;
      frame.protection.tripAllowed = false;
      frame.protection.decision = 'STABLE';
      frame.protection.permission = 'THROUGH RESTRAINT';
      frame.differential.throughPolaritySecure = true;
      frame.events = frame.events.filter((event) =>
        !(event.code === 'OPERATE' && Math.abs(event.timeSeconds - frame.timeSeconds) < 0.05)
      );
      this.events = this.events.filter((event) =>
        !(event.code === 'OPERATE' && Math.abs(event.timeSeconds - frame.timeSeconds) < 0.05)
      );
    } else {
      frame.differential.throughPolaritySecure = false;
    }

    const strongFaultCandidate = evaluateStrongMeasuredDifferential({
      algorithm: this.config.algorithm,
      hardInvalid: frame.confidence.hardInvalid,
      configuredMinimumCoverage: this.config.minProtectionValidFraction,
      protectionValidFraction: frame.differential.protectionValidFraction,
      idiffRmsPu: frame.differential.validatedRmsPu,
      pickupPu: frame.differential.pickupPu,
      signedCorrelation,
      tracker: {
        measurementAccepted: frame.alignment.measurementAccepted,
        configuredAgreementMs: this.config.trackerAgreementMs,
        estimatorAgreementMs: frame.alignment.estimatorAgreementMs,
        predictedFraction: frame.alignment.predictedFraction,
        short: { peakScore: frame.alignment.shortPeak },
        stable: { peakScore: frame.alignment.stabilityPeak }
      }
    });
    const evidence = updateStrongMeasuredEvidence({
      previousMs: this.strongMeasuredEvidenceMs,
      candidate: strongFaultCandidate,
      hardInvalid: frame.confidence.hardInvalid,
      deltaMs: effectiveDeltaMs
    });
    this.strongMeasuredEvidenceMs = evidence.evidenceMs;

    frame.differential.strongFaultCandidate = strongFaultCandidate;
    frame.differential.strongFaultEvidenceMs = Math.round(this.strongMeasuredEvidenceMs * 10) / 10;
    frame.protection.strongFaultOperate = evidence.operate;

    if (evidence.operate && !throughPolaritySecure) {
      frame.protection.operate = true;
      frame.protection.tripAllowed = true;
      frame.protection.decision = 'OPERATE';
      frame.protection.permission = 'STRONG MEASURED';
      const recent = this.events.some((event) =>
        event.code === 'STRONG_OPERATE' && this.timeSeconds - event.timeSeconds < 0.2
      );
      if (!recent) this.pushEvent('STRONG_OPERATE', 'Strong measured differential path satisfied');
      frame.events = [...this.events];
      frame.explanation.action =
        `Persistent measured-only differential evidence operated without overriding any hard-invalid communication veto.`;
    } else if (throughPolaritySecure) {
      frame.explanation.action =
        'Opposite-polarity measured currents identify through-current behaviour and restrain operation.';
    } else if (strongFaultCandidate) {
      frame.explanation.action =
        'Strong measured differential evidence is accumulating while both blind estimators remain coherent.';
    }

    return frame;
  }
}
