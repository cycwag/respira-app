function parseNum(val, fallback, min = -Infinity, max = Infinity) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function calculatePersonalOddsRatio(factors = {}) {
  const { bmi, gender, hasKidneyDisease, hasLiverDisease, isSmoker } = factors || {};
  let score = 1.0;
  const numBmi = typeof bmi === 'number' ? bmi : parseFloat(bmi);

  if (Number.isFinite(numBmi) && numBmi > 5.0 && numBmi < 18.5) {
    score *= 2.14;
  }
  if (gender === 'male') {
    score *= 1.30;
  }
  if (Boolean(hasKidneyDisease)) {
    score *= 1.47;
  }
  if (Boolean(hasLiverDisease)) {
    score *= 1.30;
  }
  if (Boolean(isSmoker)) {
    score *= 1.25;
  }

  return Math.min(15.0, Math.max(1.0, parseFloat(score.toFixed(2))));
}

function mockRegressionInference(env = {}) {
  const { pm25, temperature, humidity, rainfall, windSpeed, prevCases } = env || {};

  const p = parseNum(pm25, 35.0, 0, 500);
  const t = parseNum(temperature, 28.0, -10, 50);
  const h = parseNum(humidity, 75.0, 0, 100);
  const r = parseNum(rainfall, 10.0, 0, 300);
  const w = parseNum(windSpeed, 5.0, 0, 150);
  const prev = parseNum(prevCases, 1000, 0, 100000);

  const prevNorm = Math.min(2.0, Math.max(0.2, prev / 2000));
  const baseJ00 = (p * 0.45) - (t * 0.1) - (h * 0.15) - (r * 0.2) + (w * 0.1) + (prevNorm * 15);
  const baseJ02 = (p * 0.35) - (t * 0.08) - (h * 0.12) - (r * 0.15) + (w * 0.08) + (prevNorm * 12);
  const baseJ06 = (p * 0.55) - (t * 0.12) - (h * 0.18) - (r * 0.25) + (w * 0.12) + (prevNorm * 20);

  return {
    j00Cases: Math.max(0, Math.round(baseJ00)),
    j02Cases: Math.max(0, Math.round(baseJ02)),
    j06Cases: Math.max(0, Math.round(baseJ06))
  };
}

function calculateWeightedRisk({ internalOR, regressionCases } = {}) {
  const clamp = (val) => {
    const n = Number.isFinite(val) ? val : 25.0;
    return Math.min(99.0, Math.max(1.0, parseFloat(n.toFixed(1))));
  };

  const orVal = parseNum(internalOR, 1.0, 1.0, 15.0);
  const normalizedInternal = Math.min(1.0, Math.max(0.0, (orVal - 1.0) / 4.0));

  const cases = regressionCases || { j00Cases: 45, j02Cases: 36, j06Cases: 64 };
  const normCase = (val) => {
    const c = parseNum(val, 20, 0, 10000);
    return Math.min(1.0, Math.max(0.05, c / 150));
  };

  const scoreJ00 = clamp((normCase(cases.j00Cases) * 0.6 + normalizedInternal * 0.4) * 100);
  const scoreJ02 = clamp((normCase(cases.j02Cases) * 0.6 + normalizedInternal * 0.4) * 100);
  const scoreJ06 = clamp((normCase(cases.j06Cases) * 0.6 + normalizedInternal * 0.4) * 100);

  return {
    j00: scoreJ00,
    j02: scoreJ02,
    j06: scoreJ06
  };
}

module.exports = {
  calculatePersonalOddsRatio,
  mockRegressionInference,
  calculateWeightedRisk
};