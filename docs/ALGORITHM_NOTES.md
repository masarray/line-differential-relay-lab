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

The tracker starts from the ping-pong coarse estimate and searches only inside a bounded residual window. It cannot override hard-invalid communication data.

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

It cannot receive true forward/return delay, true clock error, scenario identity, ground-truth fault identity, or actual alignment residual. Ground-truth values are stored only under the diagnostic namespace.

### P1 dual-horizon estimator

```text
RTT / 2 coarse alignment
        ↓
short-horizon correlation ── rapid change evidence
stability-horizon correlation ── persistent alignment evidence
        ↓
estimator agreement and polarity check
        ↓
FUSED / SHORT / STABILITY / HOLD
        ↓
bounded delay-trajectory filter
```

The short horizon is intentionally more responsive to route or delay changes. The stability horizon uses a longer waveform history and is harder to disturb with a brief anomaly. Their lag estimates are refined below one sample using parabolic interpolation around the strongest bounded correlation peak.

When both estimators agree, their corrections are quality-weighted and fused. A short-only correction is accepted only when its evidence is substantially stronger and measured RTT has changed. A stability-only correction is accepted when the longer estimator is clearly more credible. Otherwise the new lag measurement is rejected and the previous bounded delay trajectory is held.

The trajectory state carries:

- accepted correction,
- correction velocity,
- innovation between predicted and requested correction,
- held-frame count.

Innovation and correction slew are bounded. Therefore a single correlation peak cannot force an abrupt phase jump, even when it is inside the wider search window.

### P2 packet-driven receiver

Remote samples are transported in frames rather than dropped independently. Each packet has a sequence number, fixed sample payload, transmission completion time, arrival time, integrity outcome, and receiver disposition.

```text
remote sampled current
        ↓ packetization
sequence + sample payload
        ↓ communication plant
loss / burst loss / corruption / duplicate / reorder / route change
        ↓ bounded receiver queue
accepted measured frames or rejected gaps
        ↓
tracking buffer and measured-only protection buffer
```

The receiver performs these generic security functions:

- detects packet sequence discontinuity,
- rejects corrupted frames,
- detects and discards duplicate frames,
- accepts out-of-order frames only within a bounded reorder depth,
- rejects late frames beyond the reorder buffer,
- detects receiver queue overflow,
- tracks consecutive missing frames,
- supervises packet age and processing deadline,
- detects deterministic communication-route transitions.

Fixed packet serialization delay is known to the receiver and is added to the RTT/2 coarse alignment. Variable route delay, queue delay, reordering, and packet loss remain uncertainty evidence; they are not silently treated as known timing.

Packet identity does not become electrical trip evidence. Only samples carried by accepted, measured frames are allowed into Idiff, Irestraint, persistence, and trip logic. Duplicate data cannot replace a missing frame, and frames rejected for corruption, excessive lateness, or queue overflow remain explicit gaps.

Hard-invalid communication includes packet integrity failure, receiver queue overflow, packet age beyond the configured deadline, excessive consecutive frame loss, or critically low measured coverage. Soft packet disorder lowers confidence and moves the supervised algorithms through WATCH, SECURE WINDOW, BLOCKED, and RECOVERY VALIDATION according to persistence.

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

The simulator deliberately separates communication anomaly evidence, timing/alignment evidence, waveform coherence, and measured electrical fault evidence. Low waveform correlation alone is not classified as a communication failure because a genuine power-system disturbance can also change the waveform.

## Protection characteristic

The current implementation uses an educational percentage-restraint characteristic:

```text
pickup = minimum pickup + slope × Irestraint
```

Secure mode applies a configurable multiplier and persistence requirement. These values are simulation defaults only.
