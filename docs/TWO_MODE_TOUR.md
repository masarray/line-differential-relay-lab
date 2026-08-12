# Two-mode guided comparison

The public simulator intentionally presents two user-facing line-differential modes:

1. **Conventional 87L** — the educational RTT/2 baseline.
2. **87L + Waveform Tracking** — bounded waveform-assisted alignment with evidence supervision.

Legacy comparator paths remain in the research engine for deterministic validation and historical experiment compatibility, but GPS and secure-window comparator choices are not exposed as public UI modes.

## Guided demo flow

The `▶ DEMO` control runs a before/after walkthrough:

1. Reset to the healthy through-current baseline and conventional 87L.
2. Ask the user to increase **Timing jitter** slowly until the virtual relay latches TRIP.
3. Highlight the relay and ask the user to choose **87L + Waveform Tracking**.
4. Automatically return the communication injection to the normal baseline and clear the relay latch.
5. Ask the user to repeat the jitter stress at the same or a stronger level.
6. Observe the relay for five seconds without fabricating a result.
7. If no false TRIP is latched, explain that bounded waveform-assisted alignment can add resilience against timing anomalies such as jitter, path asymmetry, route changes, and related packet-timing disturbance. If a TRIP is actually observed, the tour reports it and offers a retry instead of claiming success.

The tour manipulates the same DOM controls available to the user. It does not write protection outputs directly.
