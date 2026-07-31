# P4 Failure-Driven Smart Tracking Hardening

P4 uses deterministic P3 failure replay to improve security and dependability without exposing scenario identity or plant ground truth to the protection algorithm.

## Failure classes

The P3 replay identified two distinct problems:

1. A communication-disturbed through-current case could create a highly coherent but incorrect positive waveform relationship and satisfy the differential characteristic.
2. A genuine internal fault could change waveform polarity while the timing tracker continued adapting, then remain soft-blocked because the deliberately frozen estimate was scored as an alignment failure.

## Electrical transient hold

Healthy through current is normally anti-correlated after the project sign convention. A strong transition toward positive correlation may represent an electrical event rather than a communication delay change.

The smart tracker now freezes the last trusted delay correction when both waveform horizons show a coherent polarity reversal and the receiver-observable channel remains trustworthy.

```text
trusted timing trajectory
        +
short/stability positive coherent transition
        +
sequence continuity and bounded receiver quality
        ↓
ELECTRICAL_TRANSIENT_HOLD
        ↓
freeze correction and zero correction velocity
```

The hold cannot activate when there are sequence gaps, consecutive losses, late frames, excessive queue depth, hard-invalid data, or excessive RTT variation.

## Protection supervision

A trusted electrical hold is not unrestricted permission. It may move a soft BLOCKED or RECOVERY condition only to WATCH supervision. Hard-invalid communication remains an unconditional veto.

Smart-mode operation requires measured-valid remote samples, directional differential evidence, persistence, and sufficient channel quality. A stronger internal-fault path is available only when:

- the electrical hold is trusted,
- local and remote measured currents have strong positive directional correlation,
- Idiff exceeds the percentage-restraint characteristic by a substantial margin,
- measured coverage remains high,
- waveform confidence remains adequate,
- no hard-invalid communication condition exists.

An unreliable channel score is treated as hard invalid. Coherent waveforms cannot override an unreliable receiver path.

## Validation

P4 adds deterministic regression tests for:

- freezing the last trusted correction during coherent polarity reversal,
- retaining normal timing adaptation for anti-polarity through current,
- internal-fault operation after healthy tracker warm-up,
- no unwanted operation under severe packet disorder.

The 12-case CI smoke replay changed the smart-mode security result from one unwanted operation to zero. This is regression evidence only, not a certification or a claim of universal reliability.
