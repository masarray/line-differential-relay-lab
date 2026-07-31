# Line Differential Relay Algorithm Laboratory

> A deterministic, one-screen, vendor-neutral 87L simulator for teaching and exploring how packet communication, time alignment, evidence quality, and protection permission interact.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![CI](https://github.com/masarray/line-differential-relay-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/masarray/line-differential-relay-lab/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/masarray/line-differential-relay-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/masarray/line-differential-relay-lab/actions/workflows/pages.yml)
[![Monte Carlo](https://github.com/masarray/line-differential-relay-lab/actions/workflows/monte-carlo-validation.yml/badge.svg)](https://github.com/masarray/line-differential-relay-lab/actions/workflows/monte-carlo-validation.yml)

## Why this project exists

Line differential protection is simple to express as an equation but much harder to reason about when remote current samples arrive through a communication path with asymmetric delay, jitter, sequence gaps, duplicates, reordering, queue overflow, corruption, route changes, and unstable recovery.

This laboratory keeps the complete cause-and-effect chain visible in one laptop viewport:

```text
communication disturbance
        ↓
received remote waveform and packet evidence
        ↓
time alignment, trajectory, and freshness validation
        ↓
measured-only Idiff and Irestraint
        ↓
channel / alignment / waveform confidence
        ↓
NORMAL → DEGRADED → REVALIDATION → HARD BLOCK
        ↓
STABLE or OPERATE
```

The application is intended for technical training, demonstrations, practitioner-led R&D, and open engineering discussion. It is not a certified relay, a source of operational settings, or a production trip algorithm.

![One-screen industrial 87L simulator preview](docs/assets/simulator-preview.png)

## Algorithm modes

| Mode | Alignment method | Communication security behavior |
|---|---|---|
| Conventional RTT/2 | `RTT / 2` | Generic baseline; only hard-invalid data is rejected |
| Communication-supervised RTT/2 | `RTT / 2` | Watch, bounded ride-through, block, and recovery validation |
| Absolute-time reference | Common sample time | Channel-delay tolerant while time-reference quality remains valid |
| Experimental waveform-assisted 87L | RTT/2 coarse estimate + bounded dual-horizon tracking | Evidence-aware degraded operation with hard validity vetoes |

The simulator does not reproduce, benchmark, or claim equivalence with any manufacturer’s proprietary relay algorithm.

## Experimental waveform-assisted path

```text
RTT/2 coarse estimate
        ↓
short-horizon estimator + stability-horizon estimator
        ↓
quality and agreement gate
        ↓
bounded correction trajectory
        ↓
correction freshness watchdog
        ↓
measured-only protection evidence
        ↓
NORMAL / DEGRADED / REVALIDATION / HARD BLOCK
```

Important boundaries:

- interpolated samples may support tracking continuity only;
- Idiff, Irestraint, pickup, persistence, and trip use measured-valid samples only;
- ground truth is evaluator-only and cannot enter the algorithm;
- stale alignment cannot qualify degraded operation;
- Smart SECURE is a revalidation state, not an unrestricted operating state;
- integrity failure, stale packets, receiver overflow, excessive consecutive loss, and critically low measured coverage remain hard vetoes;
- runtime safety invariants provide a final defence-in-depth permission guard.

## Current capabilities

- Local, remote received, remote aligned, raw Idiff, and validated Idiff waveforms
- Through current, load step, external fault, internal fault, and CT-error scenarios
- Sequence-numbered packet frames instead of independent sample-drop simulation
- Path asymmetry, jitter, random and burst loss, corruption, duplicates, reordering, packet age, queue overflow, and route step/ramp
- Receiver-observable dual-horizon waveform tracking with sub-sample lag refinement
- Quality-qualified estimator fusion and bounded delay trajectory
- Correction-age and electrical-hold-age supervision
- Separate channel, alignment, and waveform confidence rails
- Availability-aware DEGRADED 87L operation with raised pickup, stronger evidence, and longer persistence
- Runtime safety-invariant diagnostics
- Generic virtual 87L relay with readable event log and manual-reset trip latch
- Deterministic presets, pause, single-step, reset, seed regeneration, import, and export
- Blind Monte Carlo comparison
- Stateful long-horizon rare-event communication stress
- Evidence-qualified internal-fault dependability classification
- Combined P7 publication reliability gate
- Canvas rendering and Web Worker simulation with no runtime dependencies
- Automated tests, CodeQL, CI report artifacts, and GitHub Pages deployment

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:4173`.

## Validate and build

```bash
npm run validate
```

Validation performs:

1. JavaScript syntax checks;
2. unit and deterministic regression tests;
3. compact blind Monte Carlo validation;
4. compact long-horizon rare-event stress;
5. evidence-qualified degraded dependability smoke;
6. the larger P7 reliability-freeze gate;
7. production static build.

## Benchmark commands

Blind Monte Carlo:

```bash
npm run benchmark
npm run benchmark -- --cases 500 --seed 61850
```

Long-horizon communication stress:

```bash
npm run benchmark:stress
```

Evidence-qualified internal-fault dependability:

```bash
npm run benchmark:dependability
```

Combined publication reliability gate:

```bash
npm run benchmark:reliability
```

Default P7 reliability-freeze budget:

```text
8 stress seeds
120 stateful episodes per seed
960 episode exposures per profile
64 evidence-qualified internal-fault cases
```

Reports are written under:

```text
artifacts/validation/
artifacts/long-horizon-stress/
artifacts/degraded-dependability/
artifacts/reliability-freeze/
```

Every generated electrical and communication case is deterministic. Comparator modes receive the same plant conditions. Ground truth may be read only after a completed frame by the evaluator and is never fed back into alignment, confidence, protection permission, Idiff, persistence, or trip output.

## Engineering model

The educational default uses terminal currents positive into the protected zone:

```text
Through current:  I_local ≈ -I_remote  → Idiff ≈ 0
Internal fault:   I_local and I_remote enter the zone → Idiff rises
```

The protection characteristic uses configurable minimum pickup and percentage restraint. All values are simulation policy defaults, not field settings.

## Evidence-qualified dependability

Internal-fault results are separated into:

- **communication-inhibited** — measured remote evidence is unavailable or hard-invalid;
- **alignment-inhibited** — measured samples exist, but timing evidence is not sufficiently trustworthy;
- **dependability-eligible** — both communication and alignment evidence support a fair trip expectation;
- **eligible missed trip** — a dependability-eligible case did not operate.

This prevents fail-safe revalidation from being presented as successful protection availability, while avoiding an unfair trip expectation from untrusted time alignment.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Algorithm notes](docs/ALGORITHM_NOTES.md)
- [Validation strategy](docs/VALIDATION.md)
- [P5 long-horizon stress](docs/P5_LONG_HORIZON_STRESS.md)
- [P6 availability-aware degraded 87L](docs/P6-availability-aware-degraded-87l.md)
- [P7 engine reliability freeze](docs/P7_ENGINE_RELIABILITY_FREEZE.md)
- [Product requirements summary](docs/PRD.md)
- [Roadmap](docs/ROADMAP.md)

## Known limitations

- Synthetic single-phase equivalent electrical model
- Simplified CT saturation and transient waveform behavior
- Deterministic moving-window packet receiver, not a complete production network stack
- No independent MATLAB/Python reference implementation yet
- No COMTRADE replay validation yet
- No hardware-in-the-loop communication test
- No embedded real-time execution proof
- Finite simulation evidence rather than field statistics

## Safety

- Do not connect this application to trip circuits or operational protection systems.
- Do not use its default values as relay settings.
- Do not infer vendor-specific proprietary behavior from the generic comparators.
- Do not interpret zero failures in a finite campaign as proof of zero field risk.
- Validate every protection concept independently before practical application.

## License

Copyright © 2026 Mas Ari and contributors.

Licensed under the [GNU General Public License v3.0 only](LICENSE). Derivative works distributed to others must remain under GPL-compatible terms and provide corresponding source as required by the license.
