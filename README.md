# Line Differential Relay Algorithm Laboratory

> A deterministic, one-screen, industrial 87L simulator for teaching and researching how communication quality, time alignment, confidence, and security logic affect line differential protection.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![CI](https://github.com/masarray/line-differential-relay-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/masarray/line-differential-relay-lab/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/masarray/line-differential-relay-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/masarray/line-differential-relay-lab/actions/workflows/pages.yml)

## Why this project exists

Line differential protection is easy to write as an equation but much harder to understand when remote samples arrive with asymmetric delay, jitter, clock error, stale packets, or loss of synchronization. This laboratory keeps the complete cause-and-effect chain visible in one laptop viewport:

```text
communication disturbance
        ↓
received remote waveform
        ↓
time alignment / validation
        ↓
raw and validated Idiff
        ↓
confidence and protection permission
        ↓
STABLE / SECURE WINDOW / BLOCKED / OPERATE
```

The application is intended for technical training, demonstrations, and algorithm research. It is not a certified relay or a source of operational settings.

![One-screen industrial 87L simulator preview](docs/assets/simulator-preview.png)

## Algorithm modes

| Mode | Alignment method | Communication security behaviour |
|---|---|---|
| Conventional ping-pong | `RTT / 2` | Baseline behaviour; only hard-invalid data is rejected |
| Ping-pong + secure window | `RTT / 2` | Watch, bounded ride-through, expiry block, recovery validation |
| GPS time sync | Absolute sample time | Channel delay tolerant while timestamp quality remains valid |
| Smart waveform tracking | Ping-pong coarse estimate + bounded correlation tracking | Uses waveform coherence to validate alignment, but hard failures still block 87L |

## Current capabilities

- Local, remote received, remote aligned, raw Idiff, and validated Idiff waveforms
- Through current, load step, external fault, internal fault, and CT-error scenarios
- Forward/return delay, path asymmetry, jitter, packet loss, clock offset, and drift
- Channel, alignment, and waveform confidence as separate rails
- Protection state machine with reason codes and secure-window countdown
- Deterministic presets, pause, single-step, reset, seed regeneration, import, and export
- Canvas rendering and Web Worker simulation with no runtime dependencies
- Responsive industrial UI optimized for 1280 × 720 and larger laptop screens
- Automated tests and GitHub Pages deployment

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

The production site is written to `dist/`.

## Deploy to GitHub Pages

1. Create a public repository and push this project to the `main` branch.
2. Replace `masarray` placeholders in `README.md`, `CITATION.cff`, and `package.json` metadata if added.
3. In **Settings → Pages**, select **GitHub Actions** as the source.
4. Push to `main`, or run the **Deploy GitHub Pages** workflow manually.

The build uses relative asset URLs, so the same output works at:

```text
https://<username>.github.io/line-differential-relay-lab/
```

## Engineering model

The educational default uses terminal currents positive into the protected zone:

```text
Through current:  I_local ≈ -I_remote  → Idiff ≈ 0
Internal fault:   I_local and I_remote enter the zone → Idiff rises
```

The protection characteristic uses a configurable minimum pickup and percentage-restraint slope. All displayed thresholds are simulation policy defaults, not field recommendations.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Algorithm notes](docs/ALGORITHM_NOTES.md)
- [Validation strategy](docs/VALIDATION.md)
- [Product requirements summary](docs/PRD.md)
- [Roadmap](docs/ROADMAP.md)

## Safety and limitations

- Do not connect this application to trip circuits or operational protection systems.
- Do not use the default values as relay settings.
- Do not infer vendor-specific proprietary behaviour from the educational models.
- Validate all protection concepts independently before any practical application.

## License

Copyright © 2026 Mas Ari and contributors.

Licensed under the [GNU General Public License v3.0 only](LICENSE). Derivative works distributed to others must remain under GPL-compatible terms and provide corresponding source as required by the license.
