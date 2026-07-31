# P6 — Availability-Aware Degraded 87L

P6 adds a bounded operating region between unrestricted line differential protection and hard blocking. It is an experimental, vendor-neutral research design and does not reproduce or claim equivalence with any manufacturer algorithm.

## Objective

Increase Smart Waveform Tracking availability during recoverable communication degradation without allowing predicted, stale, corrupt, or critically incomplete remote data to become protection evidence.

## Permission hierarchy

### NORMAL

All confidence domains are good. Protection uses measured-valid local and remote current with the normal differential characteristic.

### DEGRADED 87L

The relay remains available only while all receiver-observable qualification gates are true:

- communication is not hard-invalid;
- measured-valid protection coverage meets the configured minimum;
- channel, alignment, and waveform confidence exceed degraded thresholds;
- blind alignment uncertainty remains bounded;
- predicted-sample usage remains bounded and tracking-only;
- the delay trajectory is plausible;
- trip operation passes stronger directional evidence, higher pickup, and longer persistence.

Default degraded trip security:

- pickup multiplier: `1.32`;
- minimum fault evidence: `0.72`;
- minimum directional correlation: `0.18`;
- persistence: `60 ms`;
- recovery qualification from hard block: `60 ms`.

### SECURE / REVALIDATION

For Smart Tracking, SECURE is not an operating substitute for DEGRADED. Non-strong tripping is inhibited while evidence is being revalidated. Only the existing trusted P4 strong-internal electrical path may operate in this state.

### HARD BLOCK

Hard block remains mandatory for fundamental evidence failure, including:

- packet integrity failure;
- excessive packet age;
- excessive consecutive frame loss;
- receiver queue overflow;
- critically unreliable channel evidence;
- critically insufficient measured-valid protection coverage.

No confidence combination, waveform correlation, or degraded setting can bypass a hard-invalid veto.

## Evidence separation

- Interpolated samples may support tracking only.
- Differential current, restraint, pickup, persistence, and operation use measured-valid samples only.
- Simulation ground truth remains diagnostic-only and is unavailable to the algorithm.

## Failure-driven correction

The first P6 candidate increased stress-benchmark availability but reopened unwanted operation during Smart SECURE. Replay showed large blind alignment error while the tracker was at its search boundary. P6 was corrected so that:

- DEGRADED trips require the complete degraded evidence gate;
- Smart SECURE inhibits non-strong operation;
- baseline comparators retain their original behavior for fair comparison.

## Validation snapshot

Deterministic P5 smoke campaign:

| Profile | Failed runs | Unwanted operations / 1,000 episodes | Availability |
|---|---:|---:|---:|
| Conventional RTT/2 | 2/2 | 1,333.33 | 68.34% |
| Communication-only supervised RTT/2 | 2/2 | 400.00 | 28.75% |
| Fixed observation window | 2/2 | 633.33 | 46.83% |
| Smart waveform-assisted P6 | 0/2 | 0 | 52.78% |

This finite smoke result is regression evidence, not a field-reliability or certification claim. Larger campaigns and hardware-in-the-loop validation remain necessary.
