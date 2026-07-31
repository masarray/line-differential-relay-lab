# P7 — Engine Reliability Freeze

P7 freezes the safety and validation boundary of the experimental waveform-assisted 87L engine before it is presented as a public engineering portfolio.

The objective is not to certify a relay or claim field reliability. The objective is to make the research engine deterministic, failure-driven, auditable, and honest about when an internal-fault trip expectation is or is not fair.

## Scope

P7 adds six reliability controls:

1. alignment-correction freshness supervision;
2. bounded electrical-hold age;
3. runtime safety invariants at the final trip-permission boundary;
4. adversarial false-strong-evidence regression;
5. evidence-qualified internal-fault dependability classification;
6. separate availability delay and qualified operating-latency measurement.

## Alignment freshness watchdog

The waveform tracker now carries:

- accepted correction;
- correction velocity;
- consecutive held frames;
- electrical-hold frames;
- age of the last accepted correction;
- accumulated electrical-hold age;
- source of the last accepted correction.

A rejected lag measurement no longer leaves an indefinitely trusted correction. Its age increases with fixed simulation time.

Default freshness boundaries:

| Boundary | Default |
|---|---:|
| Maximum correction age for DEGRADED eligibility | 120 ms |
| Maximum correction age before alignment expires into revalidation | 260 ms |
| Maximum trusted electrical-hold duration | 80 ms |
| Maximum correction age for strong electrical evidence | 60 ms |

The limits are experimental policy defaults, not operational relay settings.

```text
fresh accepted correction
        ↓
NORMAL or DEGRADED may be eligible
        ↓ age increases while measurement is held
DEGRADED eligibility removed
        ↓
SECURE / REVALIDATION
        ↓ fundamental receiver failure
HARD BLOCK
```

Correction age also increases estimated alignment uncertainty. A stale or expired correction is exposed through explicit reason codes rather than hidden as generic low confidence.

## Low-quality estimator agreement

Two lag estimators are not accepted merely because they return similar positions. P7 requires minimum peak and estimator-quality evidence before a geometrically agreeing pair may become a fused correction.

This closes a failure found by the first P7 CI run: two estimators operating on missing or uninformative samples could agree numerically while both were poor measurements. The corrected behavior is `HOLD`, not a newly accepted timing correction.

## Trusted electrical hold

A polarity transition may represent a genuine internal electrical event, but a large timing error can also change apparent correlation polarity. P7 therefore permits trusted electrical hold only when:

- the previous correction was accepted recently;
- the hold has not exceeded its bounded age;
- the channel is not hard-invalid;
- no receiver-visible route transition is active;
- packet sequence, consecutive loss, late-frame, and queue evidence remain acceptable;
- RTT step and jitter remain bounded;
- waveform and measured-coverage evidence remain strong.

Strong internal evidence in Smart SECURE additionally requires `trustedElectricalHold`. A raw correlation reversal alone cannot open this path.

## Runtime safety invariants

The final trip-permission guard enforces these invariants:

| Invariant | Meaning |
|---|---|
| `INV_HARD_INVALID_VETO` | Hard-invalid receiver evidence can never initiate 87L operation |
| `INV_MEASURED_EVIDENCE_REQUIRED` | Protection operation requires measured-valid current coverage |
| `INV_BLOCKED_PERMISSION_VETO` | BLOCKED permission cannot become trip permission |
| `INV_DEGRADED_GATE_REQUIRED` | Smart WATCH operation requires the complete DEGRADED evidence gate |
| `INV_SECURE_STRONG_PATH_REQUIRED` | Smart SECURE operation requires the trusted strong-internal path |
| `INV_FRESH_ALIGNMENT_REQUIRED` | Non-strong Smart operation requires a fresh correction |
| `INV_TRUSTED_ELECTRICAL_HOLD_REQUIRED` | Strong internal evidence requires a trusted electrical hold |

The normal protection logic should satisfy these rules before the guard is reached. The guard is defence in depth against future refactoring errors. Every violation is placed in deterministic frame diagnostics and the relay event stream, and validation fails if any violation frame is found.

## Adversarial false-strong-evidence audit

P7 sweeps non-internal scenarios across:

- healthy through current;
- external through fault;
- CT and waveform error;
- 49, 50, and 51 Hz;
- remote phase mismatch;
- large positive and negative one-way asymmetry;
- constant nominal RTT with a rapidly changed forward/return split.

The regression fails if any case creates strong internal evidence, an unwanted operation, or a safety-invariant violation.

## Evidence-qualified dependability

An internal-fault case is no longer classified using measured coverage alone. P7 reports three distinct boundaries:

### Communication-inhibited

Remote measured evidence is unavailable or hard-invalid for too much of the fault interval. A differential trip expectation is not fair.

### Alignment-inhibited

Remote measured samples exist, but the receiver cannot establish a final continuous trip-permission interval of at least three frames. This is reported explicitly as loss of 87L availability due to alignment uncertainty.

### Dependability-eligible

Both communication evidence and alignment evidence are qualified for at least a bounded consecutive interval. Failure to operate in this category is an eligible missed trip.

This classification prevents fail-safe revalidation from being hidden as successful protection availability, while also preventing untrusted timing from being incorrectly counted as a fair dependability expectation.

## Timing interpretation

P7 deliberately reports two timing domains:

```text
Full fault-to-trip time
= revalidation / availability delay
+ qualified protection operating latency
```

- **Full fault-to-trip time** starts when the internal fault is applied. It retains any initial SECURE or BLOCKED period.
- **Permission delay** is the time before the final continuous trusted trip-permission streak begins.
- **Qualified operating latency** starts at that final trusted permission streak and measures the persistence and decision path that leads to operation.
- **Available-at-fault total time** is reported only for cases already in NORMAL or DEGRADED permission when the fault begins.

This separation does not remove slow recovery. It prevents a revalidation delay from being mislabeled as a slow differential characteristic while keeping the complete fault-to-trip delay visible.

## Publication reliability gate

The combined P7 gate executes:

- deterministic recovery-qualified rare-event security stress;
- generic baseline counterexample checks;
- Smart unwanted-operation and availability checks;
- evidence-qualified internal-fault dependability cases;
- separate availability and qualified-latency limits;
- runtime invariant checks;
- production build and CodeQL.

Run it locally:

```bash
npm run benchmark:reliability
```

The default publication gate uses:

```text
8 stress seeds
120 stateful episodes per seed
960 episode exposures per profile
64 evidence-qualified internal-fault cases
```

Acceptance rules:

```text
Smart failed stress runs                 = 0
Smart mean availability                  ≥ 35%
baseline supervised counterexample       ≥ 1 failed run
baseline fixed-window counterexample     ≥ 1 failed run
eligible internal-fault misses           = 0
dependability-eligible cases             ≥ 50% of campaign
pre-fault-available eligible cases       ≥ 25% of campaign
qualified operating-latency P95          ≤ 80 ms
available-at-fault full timing P95       ≤ 160 ms
runtime safety-invariant violations      = 0
```

Full fault-to-trip P95 across all eligible cases is reported but is not substituted for either availability or qualified operating latency.

## Final validation snapshot

| Result | Value |
|---|---:|
| Automated tests | 61/61 passed |
| Security stress budget | 8 × 120 episodes |
| Episode exposures per profile | 960 |
| Smart failed runs | 0/8 |
| Smart unwanted operations | 0 |
| Smart mean availability | 54.0841% |
| Dependability-eligible internal faults | 54 |
| Eligible internal trips | 54 |
| Eligible missed trips | 0 |
| Alignment-inhibited internal faults | 10 |
| Full fault-to-trip P95, including revalidation | 187 ms |
| Qualified operating-latency P95 | 60 ms |
| Available-at-fault full P95 | 87 ms |
| Safety-invariant violation frames | 0 |
| Continuous Integration | passed |
| CodeQL | passed |

The baseline communication-supervised and fixed observation-window comparators continued to produce deterministic counterexamples, so the benchmark did not become trivially easy after P7 hardening.

Reports are written to:

```text
artifacts/reliability-freeze/reliability-freeze-report.json
artifacts/reliability-freeze/reliability-freeze-report.md
```

## Deliberately deferred receiver refactor

The current packet model is deterministic and packet-driven, but it reconstructs receiver evidence over each moving analysis window. A fully persistent transport and receiver stack would carry explicit objects across time for:

- in-flight packets;
- expected sequence identity;
- duplicate history;
- reorder timeout;
- persistent receiver queue;
- stream restart and sequence reset.

That refactor is technically valuable, but it is intentionally deferred beyond P7 because it changes the communication architecture and would require every security and dependability baseline to be re-established.

Therefore the public claim must remain:

> deterministic packet-driven receiver simulation

and must not be overstated as a complete implementation of a physical or production packet network stack.

## Remaining model limitations

- single-phase equivalent electrical model;
- synthetic CT saturation and DC-offset behavior;
- moving-window rather than fully persistent receiver stack;
- no independent Python or MATLAB reference vectors;
- no COMTRADE replay validation;
- no hardware-in-the-loop communication emulator;
- no embedded real-time execution proof;
- finite deterministic campaign rather than field statistics;
- no equivalence claim with any manufacturer algorithm.

## Valid public positioning

After P7, the engine may be described as:

> A portfolio-grade, failure-driven 87L research engine with deterministic communication stress, explicit safety invariants, alignment-freshness supervision, and evidence-qualified dependability evaluation.

It must not be described as:

- a certified protection relay;
- a production-ready trip algorithm;
- field-reliability proof;
- a reproduction or benchmark of proprietary manufacturer logic;
- proof of universal superiority.
