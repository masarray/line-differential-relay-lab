# Validation Strategy

## Purpose

Validation tests security, dependability, operating time, communication supervision, blind alignment behavior, protection availability, and runtime safety invariants under deterministic synthetic disturbances.

Passing these checks does not certify a protection relay, reproduce a manufacturer algorithm, establish field reliability, or make the engine suitable for operational trip circuits.

## Blind evaluation boundary

The algorithm under test receives receiver-observable information only:

- local measured current;
- accepted measured remote current;
- measured RTT and its recent variation;
- packet identity, integrity, age, loss, duplicate, reorder, and queue evidence;
- measured-sample coverage;
- previous estimator and state-machine history.

It cannot read:

- true forward or return delay;
- true clock error;
- scenario identity;
- expected trip classification;
- actual alignment residual;
- Monte Carlo family or severity;
- evaluator failure labels.

Ground truth is read only after a completed frame. It is used for diagnostic metrics and never fed back into alignment, confidence, protection permission, Idiff, persistence, or trip output.

## Determinism

Given the same seed, configuration, algorithm mode, and simulation step count, every electrical case, packet disposition, state transition, and result must be repeatable within floating-point tolerance.

Comparator modes receive the same plant and communication schedule.

## Validation layers

### Unit and regression tests

These cover:

- bounded signal shifting and sub-sample lag refinement;
- packet loss, duplicate rejection, bounded reordering, late frames, and queue overflow;
- receiver-only algorithm boundaries;
- tracking-only interpolation;
- bounded correction, innovation, slew, and velocity;
- secure, blocked, recovery, and degraded state transitions;
- trip latch behavior;
- alignment freshness and electrical-hold age;
- runtime safety-invariant enforcement;
- adversarial false-strong-evidence sweeps.

### P3 blind Monte Carlo

Balanced families include:

- through-current communication disturbance;
- external fault;
- internal fault;
- CT or waveform error;
- dynamic load step.

Cases can combine:

- static path asymmetry;
- timing jitter;
- random and burst packet loss;
- corruption;
- duplicate and out-of-order delivery;
- reorder-buffer and receiver-queue overflow;
- packet-age violation;
- route step or ramp;
- clock offset and drift;
- CT saturation and waveform distortion.

Each case is replayed identically across the selected generic algorithms.

### P5 long-horizon rare-event stress

One simulator state persists across repeated communication episodes:

```text
link flapping
→ partial recovery
→ sustained recovery
→ severe jitter history
→ second healthy burst
→ constant-RTT one-way delay redistribution
→ high through or external-fault current
```

This searches for recovery-related unwanted operations that may require repeated exposure. It does not force a trip or inject an internal-fault target.

Security results must always be read together with availability. Zero unwanted operations with zero availability is not considered a successful protection result.

### P7 adversarial strong-evidence audit

The non-internal sweep varies:

- through current, external through fault, and CT error;
- large positive and negative one-way asymmetry;
- constant nominal RTT;
- 49–51 Hz;
- phase and waveform distortion.

The gate fails on:

- false strong internal evidence;
- unwanted operation;
- runtime safety-invariant violation.

### P7 evidence-qualified internal-fault dependability

Measured coverage alone is not enough to create a fair differential trip expectation. Internal faults are separated into:

#### Communication-inhibited

Measured remote evidence is unavailable or hard-invalid for too much of the fault interval.

#### Alignment-inhibited

Measured remote samples exist, but trusted timing evidence is unavailable for a sufficient consecutive interval. This is explicitly reported as loss of 87L availability caused by alignment uncertainty.

#### Dependability-eligible

Both communication evidence and alignment evidence are qualified. Failure to operate in this category is an eligible missed trip.

The default P7 evaluator requires:

- measured-valid, non-hard-invalid evidence for at least 50% of the fault frames;
- at least three consecutive communication-eligible frames;
- at least three frames with DEGRADED-qualified timing or trusted strong electrical evidence.

These thresholds are research-evaluator rules, not field relay settings.

### P7 combined reliability freeze

The publication gate combines:

- 8 deterministic stress seeds;
- 120 stateful episodes per seed;
- 960 episode exposures per policy profile;
- 64 evidence-qualified internal-fault cases;
- baseline counterexample preservation;
- Smart unwanted-operation and availability limits;
- internal-fault operating-time limits;
- zero runtime safety-invariant violations.

The default acceptance rules are:

```text
Smart failed stress runs                = 0
Smart mean availability                 ≥ 35%
communication-supervised counterexample ≥ 1 failed run
fixed-window counterexample             ≥ 1 failed run
eligible internal-fault misses          = 0
eligible internal cases                 ≥ 50% of campaign
internal-fault operating-time P95       ≤ 160 ms
safety-invariant violation frames       = 0
```

These are portfolio publication gates for this deterministic synthetic model, not certification criteria.

## Runtime safety invariants

The final permission guard checks:

- hard-invalid communication cannot trip;
- measured-valid evidence is required;
- BLOCKED permission cannot trip;
- Smart WATCH operation requires the complete DEGRADED gate;
- Smart SECURE operation requires trusted strong internal evidence;
- non-strong Smart operation requires fresh alignment;
- strong internal evidence requires a trusted electrical hold.

Any violation is included in frame diagnostics, event history, campaign reports, and causes P7 validation failure.

## Reported metrics

### Security

- unwanted-operation count and rate;
- failed deterministic runs;
- operations per 1,000 episodes;
- near misses;
- episode and time to first unwanted operation.

### Dependability

- total internal cases;
- communication-inhibited cases;
- alignment-inhibited cases;
- dependability-eligible cases;
- eligible trips and misses;
- operating-time mean, P50, P95, and maximum.

### Availability and supervision

- time in NORMAL, DEGRADED, SECURE, BLOCKED, and RECOVERY;
- permission reopen count;
- availability percentage;
- hard-invalid duration;
- state churn.

### Alignment and tracking

- evaluator-only alignment RMSE;
- maximum residual;
- estimated uncertainty;
- correction age;
- electrical-hold age;
- predicted fraction;
- estimator disagreement, ambiguity, boundary, and held-measurement counts.

### Receiver evidence

- sequence gaps;
- consecutive missing frames;
- duplicates and reordered frames;
- late frames;
- queue overflow;
- packet age.

## Commands

Full validation:

```bash
npm run validate
```

Blind Monte Carlo:

```bash
npm run benchmark
npm run benchmark -- --cases 500 --seed 61850
```

Long-horizon stress:

```bash
npm run benchmark:stress
```

Evidence-qualified dependability:

```bash
npm run benchmark:dependability
```

Combined reliability freeze:

```bash
npm run benchmark:reliability
```

Reports:

```text
artifacts/validation/
artifacts/long-horizon-stress/
artifacts/degraded-dependability/
artifacts/reliability-freeze/
```

CI archives all four report families and the production build.

## Numerical and state checks

- Ideal through current produces low validated Idiff.
- Internal fault operates after healthy alignment qualification when evidence remains eligible.
- Conventional RTT/2 responds to forward/return asymmetry.
- Low-quality estimator agreement is rejected.
- Correction age increases while lag measurements are held and resets only after accepted evidence.
- Stale correction cannot qualify DEGRADED operation.
- Expired correction remains in revalidation.
- Corrupted, excessively late, or overflowed packets remain rejected gaps.
- Interpolated samples cannot become protection evidence.
- Hard-invalid evidence overrides every operate path.
- Mode changes reset incompatible estimator, state, and persistence history.

## UX checks

- The primary workflow remains visible at 1280 × 720 without long page scrolling.
- Status is communicated by text and shape, not color alone.
- Event explanations use stable presentation buffering.
- Relay event history is readable as TIME / LEVEL / EVENT.
- Controls are keyboard operable and visibly labeled.
- Reduced-motion preference suppresses nonessential transitions.

## Deliberately deferred validation

- fully persistent transit queue and receiver network stack;
- independently generated MATLAB or Python reference vectors;
- COMTRADE replay comparison;
- hardware-in-the-loop communication impairment;
- larger stratified campaigns with confidence intervals;
- external subject-matter review;
- three-phase and sequence-component models;
- embedded worst-case execution-time proof.
