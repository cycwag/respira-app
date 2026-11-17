const fs = require('fs');

const REGRESSION_FEATURES = ['pm25', 'temperature', 'humidity', 'rainfall', 'windSpeed', 'prevCases'];
const REGRESSION_TARGETS = {
  j00: 'j00Cases',
  j02: 'j02Cases',
  j06: 'j06Cases'
};

function parseNum(val, fallback, min = -Infinity, max = Infinity) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function solveLeastSquares(matrix, values) {
  const rows = matrix.length;
  const columns = matrix[0].length;
  const outputCount = values[0].length;
  const transformedValues = values.map((row) => [...row]);

  for (let column = 0; column < columns; column += 1) {
    const norm = Math.sqrt(matrix.slice(column).reduce((sum, row) => sum + row[column] ** 2, 0));
    if (norm < 1e-10) {
      throw new Error('Dataset tidak cukup bervariasi untuk menghitung koefisien regresi.');
    }

    const alpha = matrix[column][column] >= 0 ? -norm : norm;
    const reflector = matrix.slice(column).map((row, index) =>
      row[column] - (index === 0 ? alpha : 0)
    );
    const reflectorNormSquared = reflector.reduce((sum, value) => sum + value ** 2, 0);
    if (reflectorNormSquared < 1e-20) {
      throw new Error('Dataset tidak cukup bervariasi untuk menghitung koefisien regresi.');
    }

    for (let targetColumn = column; targetColumn < columns; targetColumn += 1) {
      const projection = 2 * matrix.slice(column).reduce(
        (sum, row, index) => sum + reflector[index] * row[targetColumn],
        0
      ) / reflectorNormSquared;
      for (let row = column; row < rows; row += 1) {
        matrix[row][targetColumn] -= projection * reflector[row - column];
      }
    }

    for (let output = 0; output < outputCount; output += 1) {
      const valueProjection = 2 * transformedValues.slice(column).reduce(
        (sum, row, index) => sum + reflector[index] * row[output],
        0
      ) / reflectorNormSquared;
      for (let row = column; row < rows; row += 1) {
        transformedValues[row][output] -= valueProjection * reflector[row - column];
      }
    }

    matrix[column][column] = alpha;
    for (let row = column + 1; row < rows; row += 1) {
      matrix[row][column] = 0;
    }
  }

  const coefficients = Array.from({ length: columns }, () => Array(outputCount).fill(0));
  for (let output = 0; output < outputCount; output += 1) {
    for (let row = columns - 1; row >= 0; row -= 1) {
      const residual = transformedValues[row][output] - matrix[row].slice(row + 1, columns)
        .reduce((sum, value, index) => sum + value * coefficients[row + index + 1][output], 0);
      coefficients[row][output] = residual / matrix[row][row];
    }
  }
  return coefficients;
}

function fitMultivariateRegression(rows) {
  if (!Array.isArray(rows) || rows.length <= REGRESSION_FEATURES.length + 1) {
    throw new Error(`Regresi multivariat memerlukan minimal ${REGRESSION_FEATURES.length + 2} baris data.`);
  }

  const features = rows.map((row, index) => {
    const values = REGRESSION_FEATURES.map((name) => row[name]);
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`Fitur regresi pada baris ${index + 1} tidak lengkap atau bukan angka.`);
    }
    return values;
  });
  const targetNames = Object.values(REGRESSION_TARGETS);
  const targets = rows.map((row, index) => targetNames.map((targetName) => {
    const value = row[targetName];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`Target ${targetName} pada baris ${index + 1} harus berupa angka non-negatif.`);
    }
    return value;
  }));
  const targetMeans = targetNames.map((_, output) =>
    targets.reduce((sum, row) => sum + row[output], 0) / rows.length
  );
  const targetBaselines = Object.fromEntries(targetNames.map((name, output) => [
    name,
    Math.max(1, percentile(targets.map((row) => row[output]), 0.95))
  ]));

  const means = REGRESSION_FEATURES.map((_, column) =>
    features.reduce((sum, row) => sum + row[column], 0) / rows.length
  );
  const scales = REGRESSION_FEATURES.map((_, column) => {
    const variance = features.reduce((sum, row) => sum + (row[column] - means[column]) ** 2, 0) / rows.length;
    const scale = Math.sqrt(variance);
    if (scale < 1e-12) {
      throw new Error(`Fitur ${REGRESSION_FEATURES[column]} tidak memiliki variasi pada dataset.`);
    }
    return scale;
  });

  const design = features.map((row) => [
    1,
    ...row.map((value, column) => (value - means[column]) / scales[column])
  ]);
  const centeredTargets = targets.map((row) =>
    row.map((value, output) => value - targetMeans[output])
  );
  const standardizedCoefficients = solveLeastSquares(design, centeredTargets);
  const coefficients = Object.fromEntries(
    ['intercept', ...REGRESSION_FEATURES].map((name) => [name, {}])
  );
  targetNames.forEach((targetName, output) => {
    let intercept = targetMeans[output];
    REGRESSION_FEATURES.forEach((name, column) => {
      const coefficient = standardizedCoefficients[column + 1][output] / scales[column];
      coefficients[name][targetName] = coefficient;
      intercept -= coefficient * means[column];
    });
    coefficients.intercept[targetName] = intercept;
  });
  return { coefficients, caseBaselines: targetBaselines };
}

function percentile(values, proportion) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(proportion * sorted.length) - 1);
  return sorted[index];
}

function trainRespiraRegression(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('Dataset regresi harus berupa array baris data.');
  }
  const { coefficients, caseBaselines } = fitMultivariateRegression(rows);

  return {
    version: 3,
    trainedAt: new Date().toISOString(),
    sampleCount: rows.length,
    features: [...REGRESSION_FEATURES],
    targets: Object.values(REGRESSION_TARGETS),
    coefficients,
    caseBaselines
  };
}

function validateRespiraRegressionModel(model) {
  if (!model || model.version !== 3 || !Array.isArray(model.features) ||
      model.features.length !== REGRESSION_FEATURES.length ||
      !REGRESSION_FEATURES.every((feature, index) => model.features[index] === feature) ||
      !Array.isArray(model.targets) ||
      !Object.values(REGRESSION_TARGETS).every((target, index) => model.targets[index] === target) ||
      !model.coefficients || typeof model.coefficients !== 'object' ||
      !model.caseBaselines || typeof model.caseBaselines !== 'object') {
    throw new Error('Format model regresi RESPIRA tidak valid atau versi fitur tidak cocok.');
  }

  for (const name of ['intercept', ...REGRESSION_FEATURES]) {
    const targetCoefficients = model.coefficients[name];
    if (!targetCoefficients || !Object.values(REGRESSION_TARGETS).every((target) =>
      typeof targetCoefficients[target] === 'number' && Number.isFinite(targetCoefficients[target])
    )) {
      throw new Error(`Koefisien multivariat untuk fitur ${name} tidak valid.`);
    }
  }
  for (const target of Object.values(REGRESSION_TARGETS)) {
    if (typeof model.caseBaselines[target] !== 'number' ||
        !Number.isFinite(model.caseBaselines[target]) ||
        model.caseBaselines[target] <= 0) {
      throw new Error(`Skala target regresi untuk ${target} tidak valid.`);
    }
  }
  return model;
}

function loadRespiraRegressionModel(filePath) {
  let model;
  try {
    model = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Gagal membaca model regresi RESPIRA dari ${filePath}: ${error.message}`);
  }
  return validateRespiraRegressionModel(model);
}

function predictRespiraCases(env, model) {
  validateRespiraRegressionModel(model);
  const features = REGRESSION_FEATURES.map((name) => {
    const value = env?.[name];
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && value.trim() === '') ||
        !Number.isFinite(Number(value))) {
      throw new Error(`Fitur ${name} wajib tersedia sebagai angka untuk prediksi regresi.`);
    }
    return Number(value);
  });

  const predictions = {};
  Object.values(REGRESSION_TARGETS).forEach((targetName) => {
    const estimate = model.coefficients.intercept[targetName] + REGRESSION_FEATURES.reduce(
      (sum, name, index) => sum + model.coefficients[name][targetName] * features[index],
      0
    );
    if (!Number.isFinite(estimate)) {
      throw new Error(`Hasil prediksi regresi ${targetName} tidak valid.`);
    }
    predictions[targetName] = Math.max(0, Math.round(estimate));
  });
  return predictions;
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

function calculateWeightedRisk({ internalOR, regressionCases, caseBaselines } = {}) {
  const clamp = (val) => {
    const n = Number.isFinite(val) ? val : 25.0;
    return Math.min(99.0, Math.max(1.0, parseFloat(n.toFixed(1))));
  };

  const orVal = parseNum(internalOR, 1.0, 1.0, 15.0);
  const normalizedInternal = Math.min(1.0, Math.max(0.0, (orVal - 1.0) / 4.0));

  const cases = regressionCases || { j00Cases: 4500, j02Cases: 1200, j06Cases: 3800 };
  
  // Normalisasi kasus terhadap beban kasus epidemiologis tipikal (median ~42% baseline p95)
  // Dilengkapi baseline paparan polusi Jakarta (12%)
  const computeScore = (caseCount, p95Baseline) => {
    const c = parseNum(caseCount, 100, 0, 1000000);
    const effectiveMedian = Math.max(500, parseNum(p95Baseline, 8000, 1, 100000) * 0.42);
    const caseRatio = Math.min(1.0, Math.max(0.05, c / effectiveMedian));
    const externalRisk = 0.12 + (caseRatio * 0.48);
    const internalRisk = normalizedInternal * 0.40;
    
    return clamp((externalRisk + internalRisk) * 100);
  };

  const scoreJ00 = computeScore(cases.j00Cases, caseBaselines?.j00Cases);
  const scoreJ02 = computeScore(cases.j02Cases, caseBaselines?.j02Cases);
  const scoreJ06 = computeScore(cases.j06Cases, caseBaselines?.j06Cases);

  return {
    j00: scoreJ00,
    j02: scoreJ02,
    j06: scoreJ06
  };
}

module.exports = {
  REGRESSION_FEATURES,
  calculatePersonalOddsRatio,
  trainRespiraRegression,
  validateRespiraRegressionModel,
  loadRespiraRegressionModel,
  predictRespiraCases,
  mockRegressionInference,
  calculateWeightedRisk
};