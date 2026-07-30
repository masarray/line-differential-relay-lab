# Architecture

## Design objectives

- Deterministic fixed-step simulation
- UI rendering isolated from protection calculations
- No runtime dependencies
- Static hosting compatibility
- Versionable experiment configuration
- Explicit separation of measured, predicted, aligned, and rejected data

## Runtime topology

```text
Main thread
  ├─ controls and experiment state
  ├─ canvas renderer
  ├─ confidence/state presentation
  └─ import/export and accessibility layer

Module Web Worker
  ├─ electrical signal model
  ├─ communication and time impairment model
  ├─ alignment algorithms
  ├─ confidence calculation
  ├─ protection state machine
  └─ deterministic event timeline
```

## Processing pipeline

```text
Electrical source
  → terminal direction and CT transformation
  → remote clock model
  → communication impairment
  → packet/data validity
  → selected alignment algorithm
  → raw and validated Idiff / Irestraint
  → confidence rails
  → protection permission and trip decision
```

## Modules

- `src/engine/signal-model.js` — local and remote electrical waveforms
- `src/engine/channel-model.js` — delay, jitter, loss, packet age, and clock effects
- `src/engine/algorithms.js` — ping-pong, GPS, and bounded waveform tracking
- `src/engine/confidence.js` — independent confidence domains and reason codes
- `src/engine/state-machine.js` — secure-window and recovery hysteresis
- `src/engine/simulation.js` — deterministic orchestration
- `src/worker/simulation-worker.js` — fixed-step worker loop
- `src/ui/waveform-renderer.js` — high-DPI canvas visualization
- `src/app.js` — interaction and presentation controller

## Data policy

The UI receives immutable frame snapshots. Protection logic never reads rendered pixels or animation timing. All decisions are based on fixed simulation time.
