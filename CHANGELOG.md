# Changelog

All notable changes will be documented here.

The project follows Semantic Versioning.

## [Unreleased]

### Planned

- COMTRADE import
- Side-by-side deterministic algorithm comparison
- Expanded CT saturation and sequence-component models

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
