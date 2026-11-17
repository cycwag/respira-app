/**
 * RESPIRA Client-side Regression Inference Engine
 * Parameter koefisien OLS Multivariat hasil training 160 minggu data riil Dinkes DKI & Open-Meteo.
 * Digunakan sebagai inferensi langsung pada frontend maupun fallback otomatis saat backend offline.
 */

export const REGRESSION_WEIGHTS = {
  version: '1.0.0',
  sampleCount: 160,
  trainedAt: '2026-11-17',
  testAccuracy: '86.6%',
  j00R2: '0.833 (Train) / 0.638 (Test)',
  caseBaselines: {
    j00Cases: 13527,
    j02Cases: 3713,
    j06Cases: 10796
  },
  intercept: {
    j00Cases: 22866.43,
    j02Cases: 8972.95,
    j06Cases: 18068.37
  },
  coefficients: {
    pm25: { j00Cases: -3.77, j02Cases: 4.75, j06Cases: -6.79 },
    temperature: { j00Cases: -362.52, j02Cases: -238.38, j06Cases: -436.31 },
    humidity: { j00Cases: -142.93, j02Cases: -36.76, j06Cases: -47.03 },
    rainfall: { j00Cases: 18.88, j02Cases: 1.97, j06Cases: 3.71 },
    windSpeed: { j00Cases: -129.32, j02Cases: -32.18, j06Cases: -111.41 },
    prevCases: { j00Cases: 0.4038, j02Cases: 0.1282, j06Cases: 0.3070 }
  }
};

/**
 * Prediksi jumlah kasus mingguan DKI Jakarta berdasarkan parameter cuaca & kasus sebelumnya
 */
export function predictCasesClientSide(env = {}) {
  const pm25 = Number(env.pm25) || 45.0;
  const temperature = Number(env.temperature) || 29.2;
  const humidity = Number(env.humidity) || 76.5;
  const rainfall = Number(env.rainfall) || 12.0;
  const windSpeed = Number(env.windSpeed) || 7.8;
  const prevCases = Number(env.prevCases) || 19500;

  const features = { pm25, temperature, humidity, rainfall, windSpeed, prevCases };
  const targets = ['j00Cases', 'j02Cases', 'j06Cases'];
  const results = {};

  for (const t of targets) {
    let est = REGRESSION_WEIGHTS.intercept[t];
    for (const [feat, val] of Object.entries(features)) {
      est += REGRESSION_WEIGHTS.coefficients[feat][t] * val;
    }
    results[t] = Math.max(100, Math.round(est));
  }

  return results;
}

/**
 * Hitung skor persentase risiko terbobot (0 - 100%)
 */
export function calculateWeightedRisksClientSide(oddsRatio = 1.30, cases = {}) {
  const validOR = Math.max(1.0, parseFloat(oddsRatio) || 1.30);
  const normalizedInternal = Math.min(1.0, Math.max(0.0, (validOR - 1.0) / 4.0));

  const computeScore = (caseCount, p95Baseline) => {
    const c = Math.max(0, Number(caseCount) || 100);
    const baseline = Math.max(500, (Number(p95Baseline) || 8000) * 0.70);
    const caseRatio = Math.min(1.0, Math.max(0.05, c / baseline));
    const externalRisk = 0.12 + (caseRatio * 0.48);
    const internalRisk = normalizedInternal * 0.40;
    return Math.min(99, Math.max(1, Math.round((externalRisk + internalRisk) * 100)));
  };

  const scoreJ00 = computeScore(cases.j00Cases, REGRESSION_WEIGHTS.caseBaselines.j00Cases);
  const scoreJ02 = computeScore(cases.j02Cases, REGRESSION_WEIGHTS.caseBaselines.j02Cases);
  const scoreJ06 = computeScore(cases.j06Cases, REGRESSION_WEIGHTS.caseBaselines.j06Cases);
  const overall = Math.round((scoreJ00 + scoreJ02 + scoreJ06) / 3);

  let riskLevel = 'Aman';
  const maxRisk = Math.max(scoreJ00, scoreJ02, scoreJ06);
  if (maxRisk > 20) {
    riskLevel = 'Waspada';
  } else if (maxRisk >= 10) {
    riskLevel = 'Moderat';
  }

  return {
    j00: scoreJ00,
    j02: scoreJ02,
    j06: scoreJ06,
    overall,
    riskLevel
  };
}

/**
 * Klasifikasi kategori risiko berdasarkan ambang batas:
 * - > 20%: Waspada (tag-high)
 * - 10% - 20%: Moderat (tag-med)
 * - < 10%: Aman (tag-low)
 */
export function classifyRisk(score, isHighest = false) {
  const s = Number(score) || 0;
  if (s > 20) {
    return {
      category: 'Waspada',
      label: isHighest ? 'Waspada (Tertinggi)' : 'Waspada',
      tagClass: 'tag-high',
      tone: 'danger'
    };
  }
  if (s >= 10) {
    return {
      category: 'Moderat',
      label: isHighest ? 'Moderat (Tertinggi)' : 'Moderat',
      tagClass: 'tag-med',
      tone: 'warning'
    };
  }
  return {
    category: 'Aman',
    label: isHighest ? 'Aman (Tertinggi)' : 'Aman',
    tagClass: 'tag-low',
    tone: 'safe'
  };
}

export const DEFAULT_PREVIOUS_CASES = {
  j00Cases: 6255,
  j02Cases: 1364,
  j06Cases: 4246,
  total: 11865
};

/**
 * Format perbandingan selisih kasus mingguan (delta)
 */
export function formatDeltaCases(currentCases, previousCases) {
  const cur = Number(currentCases);
  const prev = Number(previousCases);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;

  const diff = cur - prev;
  if (diff > 0) {
    return {
      diff,
      text: `▲ Bertambah ${diff.toLocaleString('id-ID')} kasus dari minggu lalu`,
      color: '#ef4444',
      type: 'increase'
    };
  }
  if (diff < 0) {
    return {
      diff,
      text: `▼ Berkurang ${Math.abs(diff).toLocaleString('id-ID')} kasus dari minggu lalu`,
      color: '#10b981',
      type: 'decrease'
    };
  }
  return {
    diff: 0,
    text: '― Relatif stabil dari minggu lalu',
    color: '#64748b',
    type: 'stable'
  };
}
