# Product Requirements Summary

## Product thesis

Users must be able to see communication quality → waveform alignment → differential current → protection decision in one laptop viewport without calculating manually in MATLAB or another engineering package.

## Primary users

- Protection and substation automation engineers
- Relay application and testing engineers
- Technical trainers, lecturers, and students
- Researchers exploring secure line-differential communication logic

## Product goals

1. Explain why healthy through current can create false Idiff when remote data is misaligned.
2. Compare conventional ping-pong, secure-window, GPS, and waveform-tracked algorithms under identical disturbances.
3. Separate channel, alignment, and waveform confidence.
4. Show when the relay remains dependable, enters a bounded secure state, or blocks because the data is unsafe.
5. Keep all primary controls and consequences visible without long vertical scrolling.

## Required one-screen zones

- Compact algorithm and experiment header
- Disturbance injection controls
- Synchronized waveform stack
- Confidence and cause/effect rail
- Communication timeline and protection decision footer

## Core protection states

- `NORMAL`
- `WATCH`
- `SECURE_WINDOW`
- `BLOCKED`
- `RECOVERY_VALIDATION`

Every transition exposes a machine-readable reason code and a human-readable explanation.

## Non-goals

- Replacing a vendor relay, test set, EMT simulator, or certified setting tool
- Reproducing proprietary algorithms
- Generating field setting recommendations
- Driving real protection outputs
