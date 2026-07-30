# Algorithm Notes

## Sign convention

Currents are positive into the protected zone.

```text
Healthy through current:  I_local + I_remote ≈ 0
Internal fault:           I_local + I_remote is large
```

## Conventional ping-pong

```text
estimated one-way delay = measured RTT / 2
```

The baseline intentionally does not use waveform tracking. It demonstrates false Idiff caused by path asymmetry or unstable RTT. The simulator can calculate the true residual timing error for diagnostic scoring, but that plant-only value is never exposed to the algorithm or protection-permission logic.

## Secure window

The secure mode supervises the same ping-pong estimate. Soft degradation first enters a bounded state with raised security. Persistent or hard-invalid conditions block 87L. Recovery requires sustained good evidence.

## Absolute-time reference

Network latency does not directly affect sample alignment while common-time sample identity remains valid and data arrives before the processing deadline. Clock offset, drift, holdover age, and sync loss become the dominant risks. This mode is retained as a reference model; the waveform-assisted research path does not require an external absolute-time source.

## Smart waveform tracking

The tracker starts from the ping-pong coarse estimate and searches only inside a bounded residual window. It computes normalized correlation, peak ambiguity, correction innovation, RTT stability, and a bounded correction trajectory. The tracker may reduce alignment error but cannot override hard-invalid communication data.

### P0 algorithm boundary

The algorithm under test can receive only receiver-observable information:

- local current samples,
- measured remote current samples,
- measured RTT and its recent variation,
- packet arrival age or processing deadline status,
- integrity status,
- measured-sample coverage,
- previous estimator state,
- common-time sample age only in the absolute-time reference mode.

It cannot receive:

- true forward or return path delay,
- true clock error,
- scenario or preset name,
- ground-truth fault identity,
- actual alignment residual.

Ground-truth values are stored only under the diagnostic namespace for automated validation.

### Tracking versus protection buffers

```text
Tracking buffer
  measured samples + bounded short-gap interpolation
  → estimator continuity only

Protection buffer
  measured-valid remote samples only
  → Idiff, Irestraint, persistence, and trip decision
```

Predicted or interpolated samples cannot initiate 87L operation. Trip permission is inhibited when measured-valid coverage falls below the configured minimum.

The simulator deliberately separates:

- communication anomaly evidence,
- timing/alignment evidence,
- waveform coherence,
- measured electrical fault evidence.

Low waveform correlation alone is not classified as a communication failure because a genuine power-system disturbance can also change the waveform.

## Protection characteristic

The current implementation uses an educational percentage-restraint characteristic:

```text
pickup = minimum pickup + slope × Irestraint
```

Secure mode applies a configurable multiplier and persistence requirement. These values are simulation defaults only.
