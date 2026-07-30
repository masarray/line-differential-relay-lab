# Validation Strategy

## Determinism

Given the same experiment JSON, random seed, and number of simulation steps, the frame output must be repeatable within floating-point tolerance.

## Numerical checks

- Ideal through current produces near-zero validated Idiff.
- Internal fault produces Idiff above the educational pickup characteristic.
- Ping-pong residual follows half the forward/return asymmetry in the idealized model.
- GPS alignment is insensitive to pure communication latency while timestamps remain valid.
- Smart tracking cannot exceed its configured search or slew limits.

## State-machine checks

- A hard-invalid packet immediately blocks when policy requires it.
- Soft degradation enters `WATCH` or `SECURE_WINDOW` before `BLOCKED`.
- Secure-window expiry blocks if confidence does not recover.
- Recovery requires sustained valid evidence and does not unblock on one good frame.

## UX checks

- Full primary workflow remains visible at 1280 × 720 without page scrolling.
- Status is conveyed by label and shape, not colour alone.
- Controls are keyboard operable and have visible labels.
- Reduced-motion preference stops nonessential transitions.
- Canvas has an accessible textual summary that updates with the simulation.

## Future validation

- Reference vectors generated independently in MATLAB/Python
- COMTRADE replay comparison
- Hardware-in-the-loop communication impairment tests
- Subject-matter review against documented relay application principles
