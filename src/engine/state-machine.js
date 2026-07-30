import { ALGORITHM_MODES, PROTECTION_STATES } from './constants.js';

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
