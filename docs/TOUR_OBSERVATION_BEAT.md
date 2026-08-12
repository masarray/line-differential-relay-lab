# Guided tour observation beat

The before/after tour intentionally pauses after the conventional 87L relay latches TRIP.

Sequence:

1. The user raises Timing jitter until the real simulated relay latches TRIP.
2. The guide holds focus on the virtual relay for about 2.8 seconds so the user can inspect the TRIP LED, latch memory, and output path.
3. Without normalizing jitter, the guide moves the spotlight to the waveform canvas for about 4.2 seconds so the user can observe the timing-disturbed received/aligned/differential traces.
4. Only after these observation beats does the Waveform Tracking button begin blinking and request a click.
5. The second pass then resets to the same healthy baseline and repeats the jitter stress with Waveform Tracking.

The observation delay is presentation-only. It does not pause, alter, or fake the protection simulation.
