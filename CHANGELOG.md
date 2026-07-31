# Changelog

All notable changes will be documented here.

The project follows Semantic Versioning.

## [Unreleased]

### Planned

- COMTRADE import
- Side-by-side deterministic algorithm comparison in the browser
- Expanded CT saturation and sequence-component models

## [0.8.0] - 2026-07-31

### Added

- Accelerated long-horizon rare-event benchmark with one persistent simulator state across repeated communication episodes
- Recovery-qualified sequence covering link flapping, partial recovery, sustained healthy bursts, severe jitter history, constant-RTT one-way delay redistribution, and high through/external current
- Generic `Communication-only supervised RTT/2` comparator for studying the blind region where communication quality recovers while RTT/2 alignment remains wrong
- Generic fixed observation-window research policy with hard-invalid communication veto
- Episode, equivalent-exposure, permission-reopen, state-churn, availability, near-miss, stale-correction, post-recovery alignment, and cumulative-failure metrics
- Deterministic JSON failure artifacts and replay commands for every discovered unwanted operation
- Manual GitHub Actions workflow for configurable long-horizon campaigns
- P5 regression tests for deterministic scheduling, no forced/internal-fault target, policy recovery boundaries, fixed-window expiry, and hard-invalid vetoes

### Changed

- CI now runs a compact P5 stress campaign and requires deterministic unwanted-operation counterexamples for both baseline security comparators
- Security-policy configuration now distinguishes full communication/alignment supervision, communication-only supervision, and fixed observation-window research behavior
- Long-horizon reports explicitly pair unwanted-operation security with protection availability; zero trips with zero availability is not classified as success
- PWA and package release metadata updated to v0.8.0

### Validation snapshot

- 46 automated tests passed
- Conventional RTT/2: unwanted operation found in 2/2 smoke seeds
- Communication-only supervised RTT/2: unwanted operation found in 2/2 smoke seeds; median first occurrence near episode 8
- Fixed observation window: unwanted operation found in 2/2 smoke seeds; median first occurrence near episode 5
- Waveform-assisted security: zero unwanted operations in the same finite smoke budget, but zero availability under this destructive stress profile; no superiority claim is made

## [0.7.0] - 2026-07-31

### Added

- Failure-driven P4 regression suite derived from P3 unwanted-operation and missed-operation cases
- Trusted electrical-transient hold that freezes timing adaptation during coherent polarity reversal
- Receiver-quality qualification for electrical hold using sequence continuity, consecutive-loss, lateness, queue depth, and RTT variation
- Directional measured-evidence gate for smart-mode operation
- Strong measured internal-fault path that remains supervised and cannot bypass hard-invalid communication
- `ELECTRICAL_TRANSIENT_HOLD`, `ELECTRICAL_HOLD_UNTRUSTED`, and `CHANNEL_UNRELIABLE` reason codes

### Changed

- Correlation search-boundary penalty is suppressed only while a trusted electrical hold deliberately freezes the last accepted correction
- An unreliable channel score is now a hard-invalid veto for protection operation
- Trusted electrical hold can move a soft BLOCKED or RECOVERY state only to WATCH supervision, never directly to unrestricted permission
- Smart operation under communication stress now requires stronger directional evidence, measured coverage, persistence, and channel quality
- P4 smoke replay reduced smart-mode unwanted operations from one to zero on the deterministic 12-case validation set

## [0.6.0] - 2026-07-31

### Added

- Blind deterministic Monte Carlo validation engine with balanced electrical case families
- Same-case replay across Conventional RTT/2, Communication-supervised RTT/2, and Smart waveform-assisted modes
- Security metrics for unwanted operations in non-internal-fault cases
- Dependability metrics that separate eligible internal-fault misses from communication-inhibited cases
- Trip operating-time, secure/block/recovery timing, availability, alignment, uncertainty, prediction, ambiguity, and packet-disorder metrics
- Machine-readable JSON and engineering Markdown reports
- `npm run benchmark` and compact `npm run benchmark:smoke` commands
- Manual GitHub Actions workflow for configurable full Monte Carlo campaigns
- P3 regression tests for deterministic generation, replay, aggregation, compact output, and report interpretation

### Changed

- `npm run validate` now runs a deterministic Monte Carlo smoke campaign before the production build
- CI archives the validation smoke report separately from the GitHub Pages build
- Production build metadata now reads the package version and license dynamically
- Generated validation reports are excluded from source control

## [0.5.0] - 2026-07-31

### Added

- Packet/frame-driven communication plant with sequence identity and measured receiver reconstruction
- Packet-level random loss, deterministic burst loss, integrity rejection, duplicate detection, and bounded out-of-order recovery
- Receiver reorder-depth, queue-depth, late-frame, sequence-gap, consecutive-loss, and packet-age supervision
- Deterministic one-way route step or ramp with route-transition indication
- Packetization and serialization latency in the receiver-observable alignment path
- New packet controls and presets for duplicate/reorder disorder and communication route switching
- Seven P2 regression tests covering packet gaps, duplicate rejection, bounded reordering, reorder overflow, queue overflow, route steps, and unwanted-trip security

### Changed

- Remote waveform data is now reconstructed from accepted packet frames instead of independent sample-drop probabilities
- Channel confidence and alignment uncertainty now include receiver packet-order and queue evidence
- Hard-invalid communication now includes receiver queue overflow, excessive consecutive frame loss, packet age, and integrity failure
- Event trace and explanation rail now expose packet sequence gaps, reordering, duplicate discard, and route transitions

## [0.4.0] - 2026-07-31

### Added

- Short-horizon waveform estimator for rapid delay-change detection
- Stability-horizon estimator for persistent alignment validation
- Parabolic sub-sample refinement around the correlation peak
- Estimator-agreement gate with FUSED, SHORT, STABILITY, and HOLD outcomes
- Bounded alpha-beta-style delay trajectory with velocity damping and innovation gating
- New reason codes for estimator disagreement, held measurements, and excessive trajectory innovation
- Automated P1 tests for fractional lag, estimator agreement, abrupt delay requests, and incoherent short windows

### Changed

- Alignment uncertainty now includes dual-estimator agreement, peak curvature, and trajectory innovation
- Smart tracking state now carries correction, velocity, and held-frame history between simulation frames
- New lag measurements cannot force correction beyond configured slew and search bounds

## [0.3.0] - 2026-07-31

### Changed

- Smart tracking algorithm now operates without true forward/return delay or scenario-name access
- Confidence and protection permission now use receiver-observable RTT, packet quality, estimator evidence, and measured-data coverage only
- Short-gap interpolation is isolated to the tracking buffer and cannot become 87L trip evidence
- Validated Idiff and restraint are calculated from measured-valid remote samples only
- Trip permission is inhibited below the configurable measured-sample coverage threshold
- Ground-truth timing residual is retained only under a diagnostic namespace for validation
- Evaluation windows now account for alignment buffering without disguising missing samples

### Added

- Automated P0 boundary tests covering blind tracking, oracle independence, tracking-only interpolation, and measured-coverage trip inhibition

## [0.2.0] - 2026-07-30

### Added

- Generic industrial virtual 87L relay faceplate in the right-side workstation rail
- Live RUN, COMM, ERROR, PICKUP, SECURE, BLOCK, and latched TRIP indications
- LCD status mirroring Idiff, restraint, protection state, permission, and trip time
- Manual trip-latch reset with reset inhibition while the operate criterion remains active
- Automated unit tests for relay trip-memory behaviour

## [0.1.0] - 2026-07-30

### Added

- One-screen industrial 87L laboratory interface
- Conventional ping-pong, secure-window, GPS, and smart waveform-tracking modes
- Channel, alignment, and waveform confidence rails
- Fail-safe protection-permission state machine
- Communication and time impairment controls
- Deterministic presets and experiment JSON import/export
- GitHub Pages and continuous-integration workflows
