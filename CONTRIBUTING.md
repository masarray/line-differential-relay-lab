# Contributing

Thank you for helping improve the Line Differential Relay Algorithm Laboratory.

## Before opening a change

1. Search existing issues and discussions.
2. For algorithm changes, document the electrical assumptions, communication model, units, and expected protection consequence.
3. Keep simulation defaults educational; do not present them as universal field settings.
4. Avoid proprietary relay logic unless you have the right to publish it.

## Local workflow

```bash
npm install
npm run dev
npm run validate
```

Open `http://localhost:4173` while the development server is running.

## Pull request requirements

- Explain the user-visible effect and engineering rationale.
- Add or update deterministic tests.
- Include screenshots for UX changes.
- Keep the one-screen laptop layout usable at 1280 × 720.
- Preserve keyboard access, reduced-motion support, and non-colour status cues.
- Confirm that no generated `dist/` files are committed.

## Commit style

Use concise imperative commits, for example:

- `Add bounded waveform tracking confidence`
- `Fix secure-window recovery hysteresis`
- `Document terminal current sign convention`
