import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import modelData from "../public/data/model.json";
import fixtures from "./fixtures/python-inference.json";
import allFires from "./fixtures/all-fires-python.json";
import { forecast, infer, observationValues, transitionCounts } from "../src/lib/hmm";
import { parseCSV } from "../src/lib/data";
import type { FireData, HMMModel } from "../src/lib/types";

const model = modelData as HMMModel;
for (const fixture of fixtures) {
  test(`JavaScript agrees with Python hmmlearn: ${fixture.id}`, () => {
    const result = infer(fixture.values, model);
    assert.deepEqual(result.states, fixture.states);
    assert.ok(Math.abs(result.logProbability - fixture.logProbability) < 1e-7 * Math.max(1, Math.abs(fixture.logProbability)));
    result.posterior.forEach((row, t) => row.forEach((p, s) => assert.ok(Math.abs(p - fixture.posterior[t][s]) < 1e-7)));
  });
}
test("forecasts propagate probability mass without future observations", () => {
  const prefix = fixtures[0].values.slice(0, 2);
  const result = infer(prefix, model);
  const initial = result.posterior.at(-1)!;
  const predicted = forecast(initial, model, 14);
  predicted.forEach(row => assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-10));
  model.start.forEach((_, s) => assert.ok(Math.abs(predicted[0][s] - initial.reduce((p, v, i) => p + v * model.transition[i][s], 0)) < 1e-12));
});
test("invalid observations and horizons fail explicitly", () => {
  assert.throws(() => infer([], model));
  assert.throws(() => infer([[NaN]], model));
  assert.throws(() => forecast(model.start, model, 0));
  assert.throws(() => forecast([0, 0, 0, 0, 0], model, 3));
});
test("observed transitions count only consecutive decoded states", () => {
  const counts = transitionCounts([0, 0, 3, 4, 3]);
  assert.equal(counts.flat().reduce((a, b) => a + b, 0), 4);
  assert.equal(counts[0][3], 1);
  assert.equal(counts[4][3], 1);
});

test("all 624 bundled fires agree with independent Python inference", () => {
  assert.equal(allFires.length,624);
  let observations=0;
  for(const reference of allFires) {
    const file=new URL(`../public/data/fires/${reference.id}.json.gz`,import.meta.url);
    const data=JSON.parse(gunzipSync(readFileSync(file)).toString()) as FireData;
    const result=infer(observationValues(data.rows,model),model);
    assert.deepEqual(result.states,reference.states,reference.id);
    assert.ok(Math.abs(result.logProbability-reference.logProbability)<1e-7*Math.max(1,Math.abs(reference.logProbability)),reference.id);
    result.posterior.at(-1)!.forEach((p,s)=>assert.ok(Math.abs(p-reference.lastPosterior[s])<1e-7,reference.id));
    observations+=data.rows.length;
  }
  assert.equal(observations,8054);
});

test("CSV imports handle quoted values and reject malformed rows", () => {
  assert.deepEqual(parseCSV('\uFEFFname,value\r\n"fire, one",2\r\n"a""b",3\r\n'),[{name:"fire, one",value:"2"},{name:'a"b',value:"3"}]);
  assert.throws(()=>parseCSV('a,b\n1'));
  assert.throws(()=>parseCSV('a,a\n1,2'));
  assert.throws(()=>parseCSV('a\n"unclosed'));
});
