# P4 Failure-Driven Smart Tracking Hardening

P4 closes the deterministic failures exposed by the P3 blind validation campaign. It does not use scenario identity, expected trip classification, manufacturer-specific logic, or evaluator ground truth.

## Receiver time-base correction

Accepted sequence-numbered packets are released onto a uniform receiver sample cadence through a bounded playout buffer. Jitter and recoverable reordering consume buffer margin instead of stretching or compressing the electrical waveform. Frames that miss the release deadline remain explicit measured-data gaps.

## Common-overlap tracking

The short-horizon and stability estimators search only the sample region shared by local and coarse-aligned remote waveforms. This prevents a valid estimator from being evaluated mostly against unavailable right-edge samples at larger transport delay.

## Through-current polarity restraint

For supervised and smart modes, sufficiently complete measured currents with strong opposite signed correlation provide generic through-current evidence. This resets differential persistence and restrains operation. Conventional RTT/2 remains an intentionally unsecured baseline.

## Strong measured differential path

Smart mode has a narrow dependability path for persistent, high-margin differential current when all of the following are receiver-observable and measured:

- no hard-invalid communication condition;
- high measured-sample coverage;
- strong positive signed correlation;
- Idiff far above the percentage-restraint pickup;
- both blind estimators have high peaks and close agreement;
- the lag measurement is accepted;
- prediction use is low;
- evidence persists for the configured period.

Hard-invalid communication always resets this evidence and remains an absolute veto.

## Deterministic replay

```bash
npm run benchmark:replay -- --case MC-0002 --algorithm smart-tracking
npm run benchmark:replay -- --case MC-0003 --algorithm smart-tracking
```

P3 failure seeds:

- `MC-0002`, seed `1453102326`: external-fault unwanted operation;
- `MC-0003`, seed `1520509160`: eligible internal-fault missed operation.

## Validation result

P4 development campaigns using the unchanged P3 case generator produced:

| Campaign | Smart unwanted trips | Smart missed eligible trips | Eligible dependability | Mean alignment RMSE |
|---|---:|---:|---:|---:|
| 120 cases, seed 61850 | 0 | 0 | 100% | 0.9821 ms |
| 500 cases, seed 61850 | 0 0 | 100% | 0.8401 ms |

Additional 120-case campaigns with seeds `1`, `12345`, and `99991` also produced zero smart unwanted trips and zero missed eligible trips. These are simulator results, not relay certification.
