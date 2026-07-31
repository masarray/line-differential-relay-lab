# Roadmap

## Completed research phases

### P0 — Blind algorithm boundary

- Receiver-observable inputs only
- Ground truth isolated under diagnostics
- Measured-only differential evidence
- Tracking-only interpolation

### P1 — Bounded dual-horizon tracking

- Short and stability lag estimators
- Sub-sample peak refinement
- Estimator agreement and quality gate
- Bounded correction trajectory

### P2 — Packet-driven communication model

- Sequence-numbered packet frames
- Loss, burst loss, corruption, duplicate, reorder, and queue evidence
- Packet age and route transition
- Receiver-valid reconstruction

### P3 — Blind deterministic Monte Carlo

- Balanced electrical families
- Same-case comparator replay
- Security, dependability, operating-time, availability, and alignment metrics

### P4 — Failure-driven hardening

- Trusted electrical-transition hold
- Directional measured evidence
- Hard-invalid veto strengthening
- Deterministic regressions from discovered failures

### P5 — Long-horizon rare-event stress

- Stateful repeated communication episodes
- Recovery-qualified constant-RTT one-way asymmetry exposure
- Deterministic failure artifacts
- Generic comparator counterexamples

### P6 — Availability-aware degraded 87L

- NORMAL / DEGRADED / REVALIDATION / HARD BLOCK hierarchy
- Raised degraded pickup and persistence
- Measured-only degraded evidence
- Availability recovery without bypassing hard validity

### P7 — Engine reliability freeze

- Alignment-correction freshness watchdog
- Bounded electrical-hold age
- Runtime safety invariants
- Low-quality estimator agreement rejection
- Adversarial false-strong-evidence sweep
- Communication versus alignment inhibition classification
- Evidence-qualified internal-fault dependability campaign
- Combined publication reliability gate

## Next engineering phase — P8 persistent receiver and interoperability

- Persistent in-flight packet queue
- Persistent expected sequence identity
- Duplicate history and reorder timeout
- Receiver queue carried across every simulation step
- Stream restart and sequence-reset scenarios
- COMTRADE import and deterministic replay
- Exportable experiment and event report
- URL-shareable experiment configuration

P8 is intentionally separated from P7 because a persistent receiver changes the communication architecture and must be revalidated against all existing security and dependability baselines.

## P9 electrical-model depth

- Three-phase current model
- Symmetrical components
- Per-phase CT ratio, polarity, saturation, and remanence
- Fault inception angle and DC decay
- High-resistance and weak-infeed faults
- Evolving and single-pole conditions
- Frequency ramp and ROCOF
- Inverter-limited fault current

## P10 independent evidence

- Independently generated Python or MATLAB reference vectors
- Numerical tolerance specification
- Cross-implementation decision comparison
- Larger stratified campaigns with confidence intervals
- Hardware-in-the-loop communication impairment
- Embedded execution-time and memory profiling

## 1.0 — Validated education release

Version 1.0 remains reserved for:

- external subject-matter review;
- stable experiment schema;
- independent reference vectors;
- documented numerical tolerances;
- COMTRADE laboratory exercises;
- translation framework;
- published reproducible teaching modules.

Version 1.0 will still be an educational and research release, not a certified protection relay.
