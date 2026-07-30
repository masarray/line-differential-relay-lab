export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

export function finiteOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function rms(values, startIndex = 0, endIndex = values.length) {
  let sum = 0;
  let count = 0;
  const upper = Math.min(values.length, Math.max(startIndex, endIndex));
  for (let index = Math.max(0, startIndex); index < upper; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    sum += value * value;
    count += 1;
  }
  return count ? Math.sqrt(sum / count) : 0;
}

export function finitePairFraction(a, b, startIndex = 0, endIndex = Math.min(a.length, b.length)) {
  const lower = Math.max(0, startIndex);
  const upper = Math.min(a.length, b.length, Math.max(lower, endIndex));
  if (upper <= lower) return 0;
  let valid = 0;
  for (let index = lower; index < upper; index += 1) {
    if (Number.isFinite(a[index]) && Number.isFinite(b[index])) valid += 1;
  }
  return valid / (upper - lower);
}

export function mean(values) {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    total += value;
    count += 1;
  }
  return count ? total / count : 0;
}

export function sampleLinear(values, index) {
  const lower = Math.floor(index);
  const upper = lower + 1;
  if (lower < 0 || upper >= values.length) return Number.NaN;
  const a = values[lower];
  const b = values[upper];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return lerp(a, b, index - lower);
}

/** Positive shift advances the signal in time: output[i] = input[i + shift]. */
export function shiftSeries(values, shiftSamples) {
  const shifted = new Float64Array(values.length);
  shifted.fill(Number.NaN);
  for (let index = 0; index < values.length; index += 1) {
    shifted[index] = sampleLinear(values, index + shiftSamples);
  }
  return shifted;
}

/**
 * Fills short gaps for estimator continuity only. The returned values must not
 * be used as measured protection evidence.
 */
export function fillSmallGaps(values, maximumGapSamples) {
  const output = Float64Array.from(values);
  let index = 0;
  let predictedCount = 0;
  while (index < output.length) {
    if (Number.isFinite(output[index])) {
      index += 1;
      continue;
    }
    const gapStart = index;
    while (index < output.length && !Number.isFinite(output[index])) index += 1;
    const gapLength = index - gapStart;
    const leftIndex = gapStart - 1;
    const rightIndex = index;
    if (
      gapLength <= maximumGapSamples &&
      leftIndex >= 0 &&
      rightIndex < output.length &&
      Number.isFinite(output[leftIndex]) &&
      Number.isFinite(output[rightIndex])
    ) {
      for (let gapIndex = 1; gapIndex <= gapLength; gapIndex += 1) {
        output[leftIndex + gapIndex] = lerp(
          output[leftIndex],
          output[rightIndex],
          gapIndex / (gapLength + 1)
        );
        predictedCount += 1;
      }
    }
  }
  return { values: output, predictedCount };
}

export function normalizedCorrelation(a, b, start = 0, end = a.length) {
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  const upper = Math.min(end, a.length, b.length);
  for (let index = Math.max(0, start); index < upper; index += 1) {
    if (!Number.isFinite(a[index]) || !Number.isFinite(b[index])) continue;
    sumA += a[index];
    sumB += b[index];
    count += 1;
  }
  if (count < 8) return 0;
  const meanA = sumA / count;
  const meanB = sumB / count;
  let numerator = 0;
  let energyA = 0;
  let energyB = 0;
  for (let index = Math.max(0, start); index < upper; index += 1) {
    const valueA = a[index];
    const valueB = b[index];
    if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) continue;
    const centeredA = valueA - meanA;
    const centeredB = valueB - meanB;
    numerator += centeredA * centeredB;
    energyA += centeredA * centeredA;
    energyB += centeredB * centeredB;
  }
  const denominator = Math.sqrt(energyA * energyB);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function parabolicPeakOffset(left, center, right) {
  const denominator = left - 2 * center + right;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return 0;
  return clamp(0.5 * (left - right) / denominator, -0.5, 0.5);
}

/**
 * Bounded correlation lag estimator with parabolic sub-sample refinement.
 * Interpolation refines the estimator peak and never synthesizes protection evidence.
 */
export function estimateLag(reference, candidate, maximumLagSamples, searchStart = 0, searchEnd = reference.length) {
  const results = [];
  const roundedMaximum = Math.max(0, Math.floor(maximumLagSamples));
  for (let lag = -roundedMaximum; lag <= roundedMaximum; lag += 1) {
    const shifted = shiftSeries(candidate, lag);
    const correlation = normalizedCorrelation(reference, shifted, searchStart, searchEnd);
    results.push({ lag, correlation, score: Math.abs(correlation) });
  }

  const ranked = [...results].sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? { lag: 0, correlation: 0, score: 0 };
  const bestIndex = results.findIndex((entry) => entry.lag === best.lag);
  const left = results[bestIndex - 1];
  const right = results[bestIndex + 1];
  const subSampleOffset = left && right
    ? parabolicPeakOffset(left.score, best.score, right.score)
    : 0;
  const refinedLag = best.lag + subSampleOffset;
  const refinedCorrelation = normalizedCorrelation(
    reference,
    shiftSeries(candidate, refinedLag),
    searchStart,
    searchEnd
  );

  const exclusionRadius = Math.max(2, Math.round(roundedMaximum * 0.2));
  const runnerUp = ranked.find((entry) => Math.abs(entry.lag - best.lag) > exclusionRadius) ?? ranked[1] ?? best;
  const neighbourAverage = left && right ? (left.score + right.score) / 2 : best.score;
  const peakCurvature = clamp((best.score - neighbourAverage) / Math.max(best.score, 1e-9), 0, 1);

  return {
    lagSamples: best.lag,
    refinedLagSamples: refinedLag,
    integerLagSamples: best.lag,
    subSampleOffset,
    correlation: refinedCorrelation,
    peakScore: Math.abs(refinedCorrelation),
    peakCurvature,
    ambiguity: clamp(runnerUp.score / Math.max(best.score, 1e-9), 0, 1)
  };
}

export function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
