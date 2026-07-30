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
residual timing error = forward delay - measured RTT / 2 + clock error
```

The baseline intentionally does not use waveform tracking. It demonstrates false Idiff caused by path asymmetry or unstable RTT.

## Secure window

The secure mode supervises the same ping-pong estimate. Soft degradation first enters a bounded state with raised security. Persistent or hard-invalid conditions block 87L. Recovery requires sustained good evidence.

## GPS time synchronization

Network latency does not directly affect sample alignment while timestamps remain valid and data arrives before the processing deadline. Clock offset, drift, holdover age, and sync loss become the dominant risks.

## Smart waveform tracking

The tracker starts from the ping-pong coarse estimate and searches only inside a bounded residual window. It computes normalized correlation, peak ambiguity, and trajectory consistency. The tracker may reduce residual alignment error but cannot override hard-invalid communication data.

The simulator deliberately separates:

- communication anomaly evidence,
- timing/alignment evidence,
- waveform coherence,
- electrical fault evidence.

Low waveform correlation alone is not classified as a communication failure because a genuine power-system disturbance can also change the waveform.

## Protection characteristic

The current implementation uses an educational percentage-restraint characteristic:

```text
pickup = minimum pickup + slope × Irestraint
```

Secure mode applies a configurable multiplier and persistence requirement. These values are simulation defaults only.
