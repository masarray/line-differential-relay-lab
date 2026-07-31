# Changelog

All notable changes will be documented here.

The project follows Semantic Versioning.

## [Unreleased]

### Planned

- Persistent packet transit and receiver state
- COMTRADE import
- Side-by-side deterministic algorithm comparison in the browser
- Expanded CT saturation and sequence-component models

## [0.10.0] - 2026-07-31

### Added

- Alignment-correction freshness watchdog with explicit correction age, electrical-hold age, and last accepted estimator source
- Separate freshness boundaries for DEGRADED eligibility, SECURE revalidation, trusted electrical hold, and strong internal evidence
- Runtime safety-invariant guard at the final trip-permission boundary
- Deterministic invariant diagnostics and relay events
- Low-quality dual-estimator agreement rejection
- Adversarial constant-RTT one-way asymmetry sweep across through-current, external-fault, CT-error, frequency, and phase variants
- Evidence-qualified internal-fault dependability campaign
- Explicit communication-inhibited, alignment-inhibited, dependability-eligible, and eligible-miss classifications
- Separate full fault-to-trip, permission-delay, available-at-fault, and qualified operating-latency metrics
- Combined P7 publication reliability gate and CI artifact
- P7 engine reliability-freeze documentation

### Changed

- A correction held without a newly accepted lag measurement accumulates age and loses DEGRADED eligibility when stale
- Smart SECURE remains a revalidation state and cannot recover from expired alignment without new qualified evidence
- Trusted electrical hold now requires a recent correction, bounded hold duration, stable RTT, no route transition, and strong receiver evidence
- Internal-fault regression now performs healthy alignment qualification before applying the fault
- CI archives security, dependability, and reliability reports even when a gate fails
- Public documentation now separates protection availability delay from differential operating latency
- Persistent receiver refactoring is deliberately deferred to P8 to avoid changing the communication architecture during publication freeze
- Package release metadata updated to v0.10.0 and PWA cache updated to v16

### Validation snapshot

- 61 automated tests passed
- P7 security gate: 8 seeds × 120 stateful episodes, or 960 episode exposures per profile
- Experimental waveform-assisted profile: 0/8 failed runs, zero unwanted operations, 54.0841% mean availability
- Baseline communication-supervised and fixed-window counterexamples remained reproducible
- Evidence-qualified dependability: 54/54 eligible internal faults operated, zero eligible misses
- 10 additional internal faults were reported as alignment-inhibited rather than hidden as successful availability or counted as fair misses
- Full fault-to-trip P95 including revalidation: 187 ms
- Qualified operating-latency P95 after final trusted permission: 60 ms
- Available-at-fault total P95: 87 ms
- Runtime safety-invariant violation frames: 0
- Continuous Integration and CodeQL passed

These finite synthetic results are regression evidence only, not relay certification or field-reliability proof.

## [0.9.0] - 2026-07-31

### Added

- Availability-aware DEGRADED 87L region for Experimental Waveform-Assisted 87L
- Receiver-observable degraded eligibility using measured coverage, channel, alignment, waveform, uncertainty, prediction, and trajectory evidence
- Higher pickup, stronger directional evidence, and longer persistence for degraded operation
- Bounded recovery from hard block through qualified degraded evidence
- P6 safety-boundary documentation and deterministic regression tests

### Changed

- Smart soft uncertainty no longer escalates to hard block merely because a fixed secure timer expires
- Smart SECURE is treated as revalidation; non-strong operation is inhibited
- Hard-invalid communication remains an absolute veto
- Availability and unwanted-operation security are reported together
- Package release metadata updated to v0.9.0 and PWA cache updated to v15

### Validation snapshot

- 54 automated tests passed
- P5 smoke: Experimental Waveform-Assisted 87L had zero failures in 2/2 seeds with 52.7795% availability
- The initial P6 candidate reopened unwanted operations and was corrected using deterministic replay before release

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
