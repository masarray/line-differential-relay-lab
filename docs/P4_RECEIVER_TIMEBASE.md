# P4 Receiver Time-Base Hardening

This follow-up preserves the integrated P4 electrical-transient hold and supervised dependability logic while correcting two transport-estimator boundary effects found during failure replay.

## Sequence-aware playout

Accepted packet frames are released onto a uniform receiver sample cadence. Bounded jitter and recoverable out-of-order arrival consume playout-buffer margin; they do not stretch or compress the electrical waveform. A frame arriving after its deterministic release deadline remains an explicit measured-data gap.

The playout delay is represented as symmetric known receiver latency in the measured RTT path. Network asymmetry remains unknown to the algorithm and must still be estimated or supervised.

## Common measured overlap

Every candidate lag is now scored over the same nite local/remote sample region. When coarse delay compensation consumes the right edge, the requested short or stability horizon moves left while retaining its duration. This avoids comparing one candidate against a full waveform and another mostly against unavailable samples.

## Regression boundary

The tests verify:

- bounded reordering preserves waveform cadence;
- lag search retains a useful common sample span at large transport delay;
- P3 failure cases `MC-0002` and `MC-0003` remain secure and dependable.

The protection algorithm still has no access to scenario identity, expected result, true one-way delay, or evaluator ground truth.
