# Validation Strategy

## Purpose

Validation is designed to test security, dependability, operating time, communication supervision, and blind alignment behaviour under deterministic electrical and communication disturbances.

The simulator is educational and experimental. Passing these checks does not certify a protection relay, reproduce a manufacturer algorithm, or establish suitability for operational trip circuits.

## Blind evaluation boundary

The algorithm under test receives only receiver-observable information. It cannot read:

- true forward or return delay,
- true clock error,
- scenario identity,
- expected trip classification,
- actual alignment residual,
- Monte Carlo case family or severity.

Ground-truth values are read only after each frame has completed and are used by the validation evaluator to calculate error metrics. They are never passed back into alignment, confidence, protection permission, Idiff, or trip logic.

## Determinism

Given the same campaign seed, case index, algorithm mode, configuration, and number of simulation steps, the generated case and frame sequence must be repeatable within floating-point tolerance.

Each Monte Carlo case is replayed with the same plant and communication parameters across:

- Conventional RTT/2,
- Communication-supervised RTT/2,
- Smart waveform-assisted alignment.

Absolute-time reference mode is optional and excluded from the default comparison because the principal research path does not depend on an external timestamp source.

## P3 Monte Carlo campaign

A campaign contains balanced case families:

- through-current communication disturbance,
- external fault,
- internal fault,
- CT or waveform error,
- dynamic load step.

Each case can combine:

- static path asymmetry,
- timing jitter,
- packet loss and consecutive burst loss,
- corruption,
- duplicate frames,
- out-of-order delivery,
- reorder-buffer overflow,
- receiver-queue overflow,
- packet-age violation,
- one-way route step or ramp,
- clock offset and drift,
- CT saturation and waveform distortion.

The standard replay sequence is:

```text
clean warm-up
      ↓
electrical event + communication anomaly
      ↓
clean communication and through-current recovery
```

This permits measurement of both disturbance response and recovery behaviour.

## Reported metrics

### Security

- non-internal-fault cases,
- unwanted-trip count,
- unwanted-trip rate,
- late unwanted operations.

An unwanted trip is any operate decision during a through-current, external-fault, CT-error, or load-step replay.

### Dependability

- total internal-fault cases,
- dependability-eligible internal cases,
- eligible internal trips,
- missed eligible trips,
- communication-inhibited internal cases,
- trip operating time mean, median, P95, and maximum.

An internal case is dependability-eligible only when measured-valid, non-hard-invalid remote evidence is available for at least 35% of the event and for at least three consecutive evaluation frames. Cases intentionally prevented from operating by hard validity or insufficient measured coverage are reported separately rather than silently counted as algorithm misses.

### Supervision and availability

- time to WATCH,
- time to SECURE WINDOW,
- time to BLOCKED,
- time to NORMAL after recovery,
- percentage of event frames with protection permission available,
- secure, blocked, and hard-invalid duration.

### Alignment and tracking

- evaluator-only alignment-error RMSE,
- maximum absolute alignment error,
- estimated alignment uncertainty,
- mean and maximum tracking prediction usage,
- ambiguous-estimator frame count,
- held-measurement frame count.

Predicted samples remain tracking-only. They never become protection evidence.

### Packet receiver evidence

- maximum sequence-gap count,
- maximum consecutive lost frames,
- duplicate and reordered frames,
- late frames,
- receiver-queue overflow,
- maximum reorder depth,
- maximum packet age.

## Commands

Run the default deterministic campaign:

```bash
npm run benchmark
```

Run a larger campaign and keep case-level replay details:

```bash
npm run benchmark -- --cases 500 --seed 61850
```

Run selected modes:

```bash
npm run benchmark -- --algorithms ping-pong,secure-window,smart-tracking
```

Include the optional absolute-time reference:

```bash
npm run benchmark -- --cases 500 --include-gps
```

Reports are written to:

```text
artifacts/validation/monte-carlo-report.json
artifacts/validation/monte-carlo-report.md
```

The JSON file contains machine-readable campaign metadata, summaries, case definitions, and replay outcomes. The Markdown file provides compact engineering tables and interpretation rules.

## Continuous integration

`npm run validate` performs:

1. JavaScript syntax checks,
2. unit and regression tests,
3. a compact deterministic Monte Carlo smoke campaign,
4. production static build.

CI uploads both the production site and the smoke validation report as workflow artifacts.

The **Monte Carlo validation** workflow can be launched manually with a requested case count and seed. Its report artifact is retained separately from the deployed application.

## Numerical checks

- Ideal through current produces near-zero validated Idiff.
- Internal fault produces Idiff above the educational pickup characteristic when valid measured evidence is available.
- Conventional RTT/2 residual responds to forward/return asymmetry.
- Smart tracking cannot exceed configured search, innovation, slew, or velocity limits.
- Packet duplicates cannot replace missing measured evidence.
- Corrupted, excessively late, or queue-overflowed packets remain rejected gaps.
- Hard-invalid communication vetoes supervised trip permission.

## State-machine checks

- A hard-invalid packet immediately blocks when policy requires it.
- Soft degradation enters `WATCH` or `SECURE WINDOW` before `BLOCKED`.
- Secure-window expiry blocks if confidence does not recover.
- Recovery requires sustained valid evidence and does not unblock on one good frame.

## UX checks

- Full primary workflow remains visible at 1280 × 720 without page scrolling.
- Status is conveyed by label and shape, not colour alone.
- Controls are keyboard operable and have visible labels.
- Reduced-motion preference stops nonessential transitions.
- Canvas has an accessible textual summary that updates with the simulation.

## Remaining validation work

- independently generated MATLAB or Python reference vectors,
- COMTRADE replay comparison,
- hardware-in-the-loop communication impairment tests,
- larger stratified campaigns with confidence intervals,
- subject-matter review against documented relay application principles,
- three-phase and sequence-component electrical models.
