const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculatePersonalOddsRatio,
  calculateWeightedRisk,
  predictRespiraCases,
  trainRespiraRegression
} = require('../src/scoring');

function makeDataset(count = 40) {
  return Array.from({ length: count }, (_, i) => {
    const row = {
      pm25: 15 + i * 0.7,
      temperature: 20 + ((i * 7) % 13) * 0.4,
      humidity: 40 + ((i * 11) % 17) * 2,
      rainfall: ((i * 13) % 19) * 0.5,
      windSpeed: 1 + ((i * 5) % 23) * 0.3,
      prevCases: 500 + ((i * 17) % 29) * 20
    };
    const { pm25, temperature, humidity, rainfall, windSpeed, prevCases } = row;
    return {
      ...row,
      j00Cases: 100 + pm25 * 0.8 - temperature * 0.2 + humidity * 0.1 + rainfall * 0.4 + windSpeed + prevCases * 0.05,
      j02Cases: 80 + pm25 * 0.3 + temperature * 0.5 - humidity * 0.2 + rainfall * 0.1 + windSpeed * 0.6 + prevCases * 0.03,
      j06Cases: 120 - pm25 * 0.1 + temperature * 0.2 + humidity * 0.3 - rainfall * 0.2 + windSpeed * 0.4 + prevCases * 0.08
    };
  });
}

test('fits one multivariate model with three outputs and predicts unseen weekly cases', () => {
  const rows = makeDataset();
  const model = trainRespiraRegression(rows);
  const actual = {
    pm25: 33.2,
    temperature: 24.8,
    humidity: 61,
    rainfall: 3.5,
    windSpeed: 3.7,
    prevCases: 760
  };
  const predicted = predictRespiraCases(actual, model);

  assert.equal(model.sampleCount, rows.length);
  assert.deepEqual(predicted, { j00Cases: 171, j02Cases: 116, j06Cases: 202 });
  assert.deepEqual(model.targets, ['j00Cases', 'j02Cases', 'j06Cases']);
  assert.deepEqual(Object.keys(model.coefficients.intercept), model.targets);
  assert.deepEqual(Object.keys(model.coefficients.pm25), model.targets);
});

test('rejects constant features and incomplete external prediction inputs', () => {
  const rows = makeDataset();
  rows.forEach((row) => { row.pm25 = 25; });
  assert.throws(() => trainRespiraRegression(rows), /tidak memiliki variasi/);

  const model = trainRespiraRegression(makeDataset());
  assert.throws(() => predictRespiraCases({ pm25: 30 }, model), /temperature/);
});

test('regression outputs feed into the existing weighted scoring with personal odds', () => {
  const model = trainRespiraRegression(makeDataset());
  const cases = predictRespiraCases({
    pm25: 35,
    temperature: 27,
    humidity: 65,
    rainfall: 4,
    windSpeed: 4,
    prevCases: 1000
  }, model);
  const oddsRatio = calculatePersonalOddsRatio({ gender: 'male', isSmoker: true });
  const risks = calculateWeightedRisk({
    internalOR: oddsRatio,
    regressionCases: cases,
    caseBaselines: model.caseBaselines
  });

  assert.deepEqual(Object.keys(risks), ['j00', 'j02', 'j06']);
  assert.ok(Object.values(risks).every((risk) => risk >= 1 && risk <= 99));
  assert.ok(Object.values(model.caseBaselines).every((baseline) => baseline > 0));
  assert.ok(model.caseBaselines.j00Cases > 0);
  assert.ok(model.caseBaselines.j02Cases > 0);
  assert.ok(model.caseBaselines.j06Cases > 0);
});
