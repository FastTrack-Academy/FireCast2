import type { HMMModel, Observation } from "./types";

// Names follow the model's physical emission means, not the inconsistent labels
// in the old Streamlit state_names list (which swapped states 2 and 4).
export const STATES = [
  { name: "Stable / suppressed", short: "Stable", color: "#6b9c96", description: "Little boundary change on average. The model associates this state with slowing or stable spread." },
  { name: "Rain-driven collapse", short: "Rain-driven collapse", color: "#709bc4", description: "A shrinking mapped boundary associated with moisture. Boundary contraction alone does not establish containment." },
  { name: "Chaotic breakdown", short: "Chaotic breakdown", color: "#9a87b8", description: "Large negative boundary change and centroid movement, with the highest rain and wind means among these states." },
  { name: "Moderate growth", short: "Moderate growth", color: "#e6ae51", description: "Steady positive area change, associated with relatively flat terrain in the training data." },
  { name: "Extreme growth", short: "Extreme growth", color: "#ed6a45", description: "The largest positive area changes, with the highest temperature and lowest rain means in this model." },
] as const;

const LOG_TWO_PI = Math.log(2 * Math.PI);
const log = (x: number) => x > 0 ? Math.log(x) : -Infinity;

function logSumExp(values: number[]): number {
  const max = Math.max(...values);
  if (max === -Infinity) return max;
  return max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0));
}

export function observationValues(rows: Observation[], model: HMMModel): number[][] {
  return rows.map((row, i) => model.features.map((feature) => {
    const value = row[feature];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Observation ${i + 1}: ${feature} must be a finite number.`);
    }
    return value;
  }));
}

export function infer(values: number[][], model: HMMModel) {
  if (!values.length) throw new Error("At least one observation is required.");
  const n = model.start.length;
  const emissions = values.map((row) => {
    if (row.length !== model.features.length || row.some(x => !Number.isFinite(x))) {
      throw new Error(`Each observation must contain ${model.features.length} finite features.`);
    }
    const x = row.map((v, f) => (v - model.scalerMean[f]) / model.scalerScale[f]);
    return model.means.map((means, state) => -0.5 * means.reduce((sum, mean, f) => {
      const variance = Math.max(model.variances[state][f], Number.MIN_VALUE);
      return sum + LOG_TWO_PI + Math.log(variance) + (x[f] - mean) ** 2 / variance;
    }, 0));
  });
  const logTransition = model.transition.map(row => row.map(log));
  const forward: number[][] = [model.start.map((p, s) => log(p) + emissions[0][s])];
  const viterbi: number[][] = [[...forward[0]]];
  const backPointers: number[][] = [Array(n).fill(0)];
  for (let t = 1; t < values.length; t++) {
    const nextForward: number[] = [], nextViterbi: number[] = [], pointers: number[] = [];
    for (let s = 0; s < n; s++) {
      nextForward[s] = emissions[t][s] + logSumExp(forward[t - 1].map((p, prev) => p + logTransition[prev][s]));
      const scores = viterbi[t - 1].map((p, prev) => p + logTransition[prev][s]);
      const best = Math.max(...scores);
      nextViterbi[s] = best + emissions[t][s];
      pointers[s] = scores.indexOf(best);
    }
    forward.push(nextForward);
    viterbi.push(nextViterbi);
    backPointers.push(pointers);
  }
  const last = values.length - 1;
  const logLikelihood = logSumExp(forward[last]);
  if (!Number.isFinite(logLikelihood)) throw new Error("The observation sequence has no valid path through the model.");
  const backward = Array.from({ length: values.length }, () => Array(n).fill(0) as number[]);
  for (let t = last - 1; t >= 0; t--) {
    for (let s = 0; s < n; s++) {
      backward[t][s] = logSumExp(logTransition[s].map((p, next) => p + emissions[t + 1][next] + backward[t + 1][next]));
    }
  }
  const posterior = forward.map((row, t) => {
    const joint = row.map((v, s) => v + backward[t][s]);
    const norm = logSumExp(joint);
    return joint.map(v => Math.exp(v - norm));
  });
  const logProbability = Math.max(...viterbi[last]);
  const states = Array(values.length).fill(0) as number[];
  states[last] = viterbi[last].indexOf(logProbability);
  for (let t = last; t > 0; t--) states[t - 1] = backPointers[t][states[t]];
  return { states, posterior, logProbability, logLikelihood };
}

/** Predict latent state distributions, never geographic boundaries or containment. */
export function forecast(initial: number[], model: HMMModel, days: number): number[][] {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("Forecast horizon must be 1–30 days.");
  if (initial.length !== model.start.length || initial.some(p => !Number.isFinite(p) || p < 0) || Math.abs(initial.reduce((a, b) => a + b, 0) - 1) > 1e-6) {
    throw new Error("Initial probabilities must form a valid state distribution.");
  }
  let current = initial;
  const output = [];
  for (let day = 0; day < days; day++) {
    current = model.start.map((_, next) => current.reduce((sum, p, state) => sum + p * model.transition[state][next], 0));
    output.push(current);
  }
  return output;
}

export function transitionCounts(states: number[], n = 5): number[][] {
  const counts = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  for (let i = 1; i < states.length; i++) counts[states[i - 1]][states[i]]++;
  return counts;
}
