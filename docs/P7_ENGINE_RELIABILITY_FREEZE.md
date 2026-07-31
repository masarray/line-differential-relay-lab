# P7 — Engine Reliability Freeze

P7 freezes the safety and validation boundary of the experimental waveform-assisted 87L engine before it is presented as a public engineering portfolio.

The objective is not to certify a relay or claim field reliability. The objective is to make the research engine deterministic, failure-driven, auditable, and honest about when an internal-fault trip expectation is or is not fair.

## Scope

P7 adds five reliability controls:

1. alignment-correction freshness supervision;
2. bounded electrical-hold age;
3. runtime safety invariants at the final trip-permission boundary;
4. adversarial false-strong-evidence regression;
5. evidence-qualified internal-fault dependability classification.

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

The regression fails if any case creates persistent strong internal evidence, an unwanted operation, or a safety-invariant violation.

## Evidence-qualified dependability

An internal-fault case is no longer classified using measured coverage alone. P7 reports three distinct boundaries:

### Communication-inhibited

Remote measured evidence is unavailable or hard-invalid for too much of the fault interval. A differential trip expectation is not fair.

### Alignment-inhibited

Remote measured samples exist, but the receiver cannot establish enough trusted timing evidence. This is reported explicitly as loss of 87L availability due to alignment uncertainty.

### Dependability-eligible

Both communication evidence and alignment evidence are qualified for at least a bounded consecutive interval. Failure to operate in this category is an eligible missed trip.

This classification prevents fail-safe revalidation from being hidden as a successful trip case, while also preventing an untrusted timing condition from being incorrectly counted as a fair dependability expectation.

## Publication reliability gate

The combined P7 gate executes:

- deterministic recovery-qualified rare-event security stress;
- generic baseline counterexample checks;
- Smart unwanted-operation and availability checks;
- evidence-qualified internal-fault dependability cases;
- operating-time limits;
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

That refactor is technically valuable, but it is intentionally deferred beyond P7 because it changes the communication architecture and could invalidate existing benchmark baselines immediately before the publication freeze.

Therefore the public claim must remain:

> deterministic packet-driven receiver simulation

and must not be overstated as a complete implementation of a physical or production packet network stack.

## Remaining model limitations

- single-phase equivalent electrical model;
- synthetic CT saturation and DC-offset behavior;
- no independent COMTRADE reference vectors;
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
