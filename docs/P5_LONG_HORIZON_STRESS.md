# P5 Accelerated Long-Horizon Rare-Event Stress

P5 searches for unwanted 87L operations that may require many communication/recovery cycles before the vulnerable sequence appears. It compresses long healthy intervals into an episode exposure index, while explicitly simulating every protection timer, packet disturbance, estimator update, recovery transition, and high-current opportunity.

## Public-neutral comparator names

The benchmark uses generic research policies only:

- **Conventional RTT/2** — direct `RTT / 2` alignment with basic hard-validity rejection.
- **Communication-only supervised RTT/2** — channel health controls blocking and recovery, but no waveform-based alignment supervision is used to prolong the communication block.
- **Fixed observation window** — soft degradation starts a fixed raised-security interval; hard-invalid communication remains a veto.
- **Waveform-assisted security** — blind dual-horizon tracking and P4 electrical-event hold.

These profiles do not reproduce, benchmark, or claim equivalence with any manufacturer proprietary algorithm.

## Why the communication-only comparator exists

The normal simulator supervisor combines channel, alignment, and waveform confidence. That is stronger than the specific failure hypothesis being tested.

P5 therefore includes a deliberately narrower generic comparator:

```text
communication appears healthy
        ↓
channel-based recovery completes
        ↓
87L permission becomes available
        ↓
one-way delay distribution changes while RTT stays plausible
        ↓
RTT/2 alignment remains wrong
```

It still rejects corruption, queue overflow, excessive packet age, critically low measured coverage, and other hard-invalid conditions. It does not force relay operation.

## Stateful exposure sequence

One `Simulator` instance persists across all episodes. Tracker state, RTT history, receiver sequence history, protection state, recovery timers, trip persistence, and event history are not reset between episodes.

Each recovery-qualified episode follows:

```text
link flapping and burst loss
        ↓
partial recovery
        ↓
sustained healthy recovery
        ↓
severe but non-hard-invalid jitter history
        ↓
second healthy burst / permission opportunity
        ↓
rapid forward-return delay redistribution
        ↓
high through current or external through fault
        ↓
settling interval
```

The decisive timing event uses a longer stable RTT domain and changes the forward/return split while keeping nominal total RTT approximately constant. This exposes the one-way-delay blind region of `RTT / 2` without providing true delay to the algorithm.

## Safety and blindness boundaries

P5 never writes `operate = true`, never injects an internal-fault target, and never modifies protection output from the evaluator.

Algorithm inputs remain receiver-observable:

- local and accepted measured remote samples;
- RTT and recent variation;
- packet sequence, age, integrity, loss, reorder, duplicate, and queue evidence;
- previous estimator and protection state.

Ground truth is read only after a completed frame to calculate report metrics and save a deterministic failure artifact.

## Metrics

Reports include:

- failed seeds and cumulative failure probability;
- unwanted operations per 1,000 episodes;
- episodes and equivalent exposure hours to first unwanted operation;
- permission reopen count;
- WATCH / SECURE / BLOCK / RECOVERY churn;
- protection availability;
- near-miss count;
- post-recovery alignment RMSE;
- maximum stale-correction age;
- maximum `Idiff / active threshold` ratio;
- deterministic seed, episode, phase, and frame evidence for each failure.

Security must be interpreted together with availability. A policy that produces zero unwanted trips by remaining blocked for the whole campaign is not considered a successful protection result.

## Commands

Compact CI-style campaign:

```bash
npm run benchmark:stress:smoke
```

Default engineering campaign:

```bash
npm run benchmark:stress
```

Larger deterministic search:

```bash
npm run benchmark:stress -- \
  --seeds 100 \
  --episodes 1000 \
  --seed 87161850
```

Replay one policy family:

```bash
npm run benchmark:stress -- \
  --seeds 1 \
  --episodes 180 \
  --seed <failure-seed> \
  --profiles communication-supervised-rtt2
```

Outputs:

```text
artifacts/long-horizon-stress/long-horizon-stress-report.json
artifacts/long-horizon-stress/long-horizon-stress-report.md
artifacts/long-horizon-stress/failures/*.json
```

## Current finite smoke result

The deterministic two-seed, thirty-episode CI smoke budget found unwanted-operation counterexamples for:

- Conventional RTT/2;
- Communication-only supervised RTT/2;
- Fixed observation window.

Waveform-assisted security produced no unwanted operation in the same smoke budget, but its availability was zero under this destructive profile. This is not proof of superiority. It identifies the next engineering problem: improve smart-mode availability without reopening the unwanted-operation region.

P5 is simulation evidence only. It is not certification, field reliability proof, or a manufacturer comparison.
