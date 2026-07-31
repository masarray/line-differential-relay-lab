import { ALGORITHM_MODES, PROTECTION_STATES, SECURITY_POLICIES } from './constants.js';

export class ProtectionStateMachine {
  constructor(config) {
    this.reset(config);
  }

  reset(config) {
    this.state = PROTECTION_STATES.NORMAL;
    this.secureRemainingMs = config.secureWindowMs;
    this.goodEvidenceMs = 0;
    this.lastReason = 'QUALITY_NOMINAL';
  }

  updateFixedObservationWindow({ config, confidence, deltaMs }) {
    const score = confidence.minimumScore;
    const good = score >= 80;

    switch (this.state) {
      case PROTECTION_STATES.NORMAL:
        this.secureRemainingMs = config.secureWindowMs;
        if (score < 74) this.state = PROTECTION_STATES.SECURE;
        break;
      case PROTECTION_STATES.WATCH:
        this.state = PROTECTION_STATES.SECURE;
        this.secureRemainingMs = config.secureWindowMs;
        this.goodEvidenceMs = 0;
        break;
      case PROTECTION_STATES.SECURE:
        this.secureRemainingMs = Math.max(0, this.secureRemainingMs - deltaMs);
        if (this.secureRemainingMs <= 0) {
          // Generic fixed-window research policy: soft degradation is observed
          // for a fixed period, then permission is released for one evaluation
          // interval. Persistent bad evidence can start a new window on the next
          // update. Hard-invalid communication is handled before this branch.
          this.state = PROTECTION_STATES.NORMAL;
          this.secureRemainingMs = config.secureWindowMs;
          this.goodEvidenceMs = 0;
        }
        break;
      case PROTECTION_STATES.BLOCKED:
      case PROTECTION_STATES.RECOVERY:
        if (good) {
          this.goodEvidenceMs += deltaMs;
          if (this.goodEvidenceMs >= config.recoveryValidationMs) {
            this.state = PROTECTION_STATES.SECURE;
            this.secureRemainingMs = config.secureWindowMs;
            this.goodEvidenceMs = 0;
          }
        } else {
          this.goodEvidenceMs = 0;
        }
        break;
      default:
        this.state = PROTECTION_STATES.NORMAL;
        this.secureRemainingMs = config.secureWindowMs;
    }

    return this.snapshot();
  }

  update({ config, confidence, deltaMs }) {
    const reasons = confidence.reasons;
    this.lastReason = reasons[0] ?? 'QUALITY_NOMINAL';

    if (config.algorithm === ALGORITHM_MODES.PING_PONG) {
      this.state = confidence.hardInvalid ? PROTECTION_STATES.BLOCKED : PROTECTION_STATES.NORMAL;
      this.secureRemainingMs = config.secureWindowMs;
      return this.snapshot();
    }

    if (confidence.hardInvalid) {
      this.state = PROTECTION_STATES.BLOCKED;
      this.goodEvidenceMs = 0;
      this.secureRemainingMs = 0;
      return this.snapshot();
    }

    if (
      config.algorithm === ALGORITHM_MODES.SECURE_WINDOW &&
      config.securityPolicy === SECURITY_POLICIES.FIXED_OBSERVATION_WINDOW
    ) {
      return this.updateFixedObservationWindow({ config, confidence, deltaMs });
    }

    // A trusted electrical hold means the receiver and measured waveform agree
    // that timing adaptation must freeze during an electrical polarity event.
    // It may leave a soft communication block only through WATCH supervision;
    // it never bypasses a hard-invalid channel and never restores unrestricted
    // permission directly.
    if (
      confidence.trustedElectricalHold &&
      (this.state === PROTECTION_STATES.BLOCKED || this.state === PROTECTION_STATES.RECOVERY)
    ) {
      this.state = PROTECTION_STATES.WATCH;
      this.goodEvidenceMs = 0;
      this.secureRemainingMs = config.secureWindowMs;
      return this.snapshot();
    }

    const score = confidence.minimumScore;
    const good = score >= 80;
    const poor = score < 58;
    const critical = score < 38;

    switch (this.state) {
      case PROTECTION_STATES.NORMAL:
        this.secureRemainingMs = config.secureWindowMs;
        if (critical) this.state = PROTECTION_STATES.SECURE;
        else if (score < 74) this.state = PROTECTION_STATES.WATCH;
        break;
      case PROTECTION_STATES.WATCH:
        if (good) {
          this.goodEvidenceMs += deltaMs;
          if (this.goodEvidenceMs >= 80) {
            this.state = PROTECTION_STATES.NORMAL;
            this.goodEvidenceMs = 0;
          }
        } else {
          this.goodEvidenceMs = 0;
          if (poor) {
            this.state = PROTECTION_STATES.SECURE;
            this.secureRemainingMs = config.secureWindowMs;
          }
        }
        break;
      case PROTECTION_STATES.SECURE:
        this.secureRemainingMs = Math.max(0, this.secureRemainingMs - deltaMs);
        if (good) {
          this.state = PROTECTION_STATES.RECOVERY;
          this.goodEvidenceMs = 0;
        } else if (this.secureRemainingMs <= 0) {
          this.state = PROTECTION_STATES.BLOCKED;
        }
        break;
      case PROTECTION_STATES.BLOCKED:
        if (good) {
          this.goodEvidenceMs += deltaMs;
          if (this.goodEvidenceMs >= config.recoveryValidationMs) {
            this.state = PROTECTION_STATES.RECOVERY;
            this.goodEvidenceMs = 0;
          }
        } else {
          this.goodEvidenceMs = 0;
        }
        break;
      case PROTECTION_STATES.RECOVERY:
        if (!good) {
          this.state = poor ? PROTECTION_STATES.SECURE : PROTECTION_STATES.WATCH;
          this.secureRemainingMs = config.secureWindowMs;
          this.goodEvidenceMs = 0;
        } else {
          this.goodEvidenceMs += deltaMs;
          if (this.goodEvidenceMs >= config.recoveryValidationMs) {
            this.state = PROTECTION_STATES.NORMAL;
            this.goodEvidenceMs = 0;
            this.secureRemainingMs = config.secureWindowMs;
          }
        }
        break;
      default:
        this.state = PROTECTION_STATES.NORMAL;
    }

    return this.snapshot();
  }

  snapshot() {
    const blocked = this.state === PROTECTION_STATES.BLOCKED || this.state === PROTECTION_STATES.RECOVERY;
    const secure = this.state === PROTECTION_STATES.SECURE;
    return {
      state: this.state,
      permission: blocked ? 'BLOCKED' : secure ? 'RAISED SECURITY' : this.state === PROTECTION_STATES.WATCH ? 'SUPERVISED' : 'UNRESTRICTED',
      secureRemainingMs: this.secureRemainingMs,
      reason: this.lastReason
    };
  }
}
