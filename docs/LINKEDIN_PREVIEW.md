# LinkedIn preview and screenshot workflow

The public simulator uses a single always-on waveform persistence presentation. Recent display frames remain as a subtle slow-shutter trail so packet gaps and alignment movement remain readable in screenshots without exposing extra display-mode controls.

Recommended screenshot sequence:

1. Select the communication scenario and algorithm mode.
2. Allow the waveform trail to settle for one or two seconds.
3. Press **PAUSE** at the most informative protection state.
4. Capture the browser viewport at 16:9 or crop the simulator to approximately 1.91:1 for social sharing.

The production build calculates a SHA-256 digest from `docs/assets/simulator-preview.png` and includes a shortened content hash in the published Open Graph filename. Every actual image change therefore produces a new URL, even when the package version is unchanged, preventing LinkedIn from silently reusing an older cached thumbnail.

Waveform persistence is a visualization aid only. It never fills missing samples in the protection engine and never changes Idiff, restraint, permission, persistence timing, or trip decisions.
