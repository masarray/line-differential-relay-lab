# LinkedIn preview and screenshot workflow

The public simulator provides three waveform display modes:

- **LIVE** — engineering view; rejected samples remain visible as gaps.
- **PERSIST** — slow-shutter presentation view; recent display frames remain as a subtle visual trail.
- **FREEZE** — freezes the canvas display for a clean screenshot while the simulation engine and protection evidence remain unchanged.

Recommended screenshot sequence:

1. Select the communication scenario and algorithm mode.
2. Choose **PERSIST** and allow the display trail to settle.
3. Choose **FREEZE** at the most informative state.
4. Capture the browser viewport at 16:9 or crop the simulator to approximately 1.91:1 for social sharing.

The production build publishes a versioned Open Graph image URL so LinkedIn does not silently reuse an older cached image after a release. The Open Graph image is built from `docs/assets/simulator-preview.png`.

Display persistence is a visualization aid only. It never fills missing samples in the protection engine and never changes Idiff, restraint, permission, persistence, or trip decisions.
