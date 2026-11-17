/**
 * =============================================================================
 * RESPIRA ML - Mesin Inferensi Klasifikasi Kualitas Udara (Random Forest)
 * Algoritma: Random Forest Classifier (Supervised Ensemble Learning)
 * Dataset Pelatihan: SPKU Dinas Lingkungan Hidup DKI Jakarta (1.796 sampel)
 * Akurasi Evaluasi: 99.44% (Data Uji Stratified 80:20)
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.join(__dirname, '../models/respira-random-forest.json');
let rfModel = null;

try {
  if (fs.existsSync(MODEL_PATH)) {
    rfModel = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  }
} catch (err) {
  console.warn('Gagal memuat model Random Forest JSON:', err.message);
}

/**
 * Menelusuri satu Decision Tree dari root hingga leaf untuk menghasilkan prediksi kelas
 * @param {Array} nodes - Daftar node dalam satu pohon
 * @param {Array} vector - Vektor fitur [pm25, pm10, so2, co, o3, no2]
 * @returns {Object} { predictedClass, probs }
 */
function traverseTree(nodes, vector) {
  let curr = nodes[0];
  while (curr.left !== -1 && curr.right !== -1 && curr.feature >= 0) {
    const featVal = vector[curr.feature];
    if (featVal <= curr.threshold) {
      curr = nodes[curr.left];
    } else {
      curr = nodes[curr.right];
    }
  }
  return {
    predictedClass: curr.class,
    probs: curr.probs
  };
}

/**
 * Melakukan inferensi Random Forest lengkap menggunakan mekanisme Majority Voting (Ensemble)
 * @param {Object} pollutants - Nilai konsentrasi 6 polutan { pm25, pm10, so2, co, o3, no2 }
 * @returns {Object} Hasil prediksi klasifikasi, confidence score, dan voting pohon
 */
function classifyIspu(pollutants = {}) {
  const p25 = Math.max(0, parseFloat(pollutants.pm25) || 0);
  const p10 = Math.max(0, parseFloat(pollutants.pm10) || 0);
  const so2 = Math.max(0, parseFloat(pollutants.so2) || 0);
  const co  = Math.max(0, parseFloat(pollutants.co) || 0);
  const o3  = Math.max(0, parseFloat(pollutants.o3) || 0);
  const no2 = Math.max(0, parseFloat(pollutants.no2) || 0);

  // Jika model Random Forest gagal dimuat dari file JSON, gunakan fallback aman
  if (!rfModel || !rfModel.trees || rfModel.trees.length === 0) {
    let fallbackStatus = 'BAIK';
    let fallbackColor = '#10b981';
    let fallbackBadge = 'badge-baik';
    if (p25 > 55.4 || p10 > 100) {
      fallbackStatus = 'TIDAK SEHAT';
      fallbackColor = '#ef4444';
      fallbackBadge = 'badge-tidak-sehat';
    } else if (p25 > 15.5 || p10 > 50) {
      fallbackStatus = 'SEDANG';
      fallbackColor = '#f59e0b';
      fallbackBadge = 'badge-sedang';
    }
    return {
      status: fallbackStatus,
      statusColor: fallbackColor,
      statusBadge: fallbackBadge,
      dominantPollutant: p25 >= p10 ? 'PM2.5' : 'PM10',
      advice: 'Kualitas udara terpantau.',
      pollutants: { pm25: p25, pm10: p10, so2, co, o3, no2 }
    };
  }

  // Bentuk vektor fitur sesuai urutan saat pelatihan model Scikit-Learn
  const vector = [p25, p10, so2, co, o3, no2];
  const nTrees = rfModel.trees.length;
  const votes = [0, 0, 0]; // Index: 0=BAIK, 1=SEDANG, 2=TIDAK SEHAT
  const accumulatedProbs = [0.0, 0.0, 0.0];

  // 1. Jalankan traversal pada seluruh pohon keputusan (Ensemble Trees)
  for (let i = 0; i < nTrees; i++) {
    const tree = rfModel.trees[i];
    const treeResult = traverseTree(tree.nodes, vector);
    votes[treeResult.predictedClass]++;
    for (let c = 0; c < 3; c++) {
      accumulatedProbs[c] += treeResult.probs[c];
    }
  }

  // 2. Tentukan kelas pemenang melalui Suara Terbanyak (Majority Voting)
  let bestClass = 0;
  let maxVotes = -1;
  for (let c = 0; c < 3; c++) {
    if (votes[c] > maxVotes) {
      maxVotes = votes[c];
      bestClass = c;
    }
  }

  const confidenceScore = parseFloat((maxVotes / nTrees).toFixed(4));
  const classProbabilities = {
    BAIK: parseFloat((accumulatedProbs[0] / nTrees).toFixed(4)),
    SEDANG: parseFloat((accumulatedProbs[1] / nTrees).toFixed(4)),
    'TIDAK SEHAT': parseFloat((accumulatedProbs[2] / nTrees).toFixed(4))
  };

  const classDef = rfModel.classes[bestClass] || { name: 'SEDANG', color: '#f59e0b', badge: 'badge-sedang' };

  // 3. Tentukan polutan kritis berbasis kombinasi rasio konsentrasi terhadap bobot Feature Importance
  const featureWeights = rfModel.featureImportances || { pm25: 0.68, pm10: 0.14, o3: 0.08, so2: 0.05, co: 0.03, no2: 0.02 };
  const pollutantRatios = [
    { name: 'PM2.5', ratio: (p25 / 55.4) * (featureWeights.pm25 || 0.6) },
    { name: 'PM10',  ratio: (p10 / 100.0) * (featureWeights.pm10 || 0.15) },
    { name: 'SO2',   ratio: (so2 / 180.0) * (featureWeights.so2 || 0.05) },
    { name: 'CO',    ratio: (co / 50.0) * (featureWeights.co || 0.03) },
    { name: 'O3',    ratio: (o3 / 100.0) * (featureWeights.o3 || 0.08) },
    { name: 'NO2',   ratio: (no2 / 100.0) * (featureWeights.no2 || 0.02) }
  ];
  pollutantRatios.sort((a, b) => b.ratio - a.ratio);
  const dominantPollutant = pollutantRatios[0].name;

  // 4. Rekomendasi mitigasi klinis sesuai hasil klasifikasi Machine Learning
  let advice = 'Kualitas udara sangat baik dan bersih. Aman beraktivitas di luar ruangan tanpa masker.';
  if (classDef.name === 'TIDAK SEHAT') {
    advice = 'Kadar polutan tinggi. Wajib memakai masker medis/KF94 dan batasi aktivitas fisik di luar ruangan.';
  } else if (classDef.name === 'SEDANG') {
    advice = 'Kualitas udara dapat diterima. Kelompok rentan & penderita penyakit pernapasan dianjurkan mengenakan masker.';
  }

  return {
    status: classDef.name,
    statusColor: classDef.color,
    statusBadge: classDef.badge,
    dominantPollutant,
    advice,
    pollutants: {
      pm25: p25,
      pm10: p10,
      so2,
      co,
      o3,
      no2
    },
    mlPrediction: {
      algorithm: rfModel.algorithm || 'Random Forest Classifier',
      nEstimators: nTrees,
      predictedCode: bestClass,
      confidenceScore,
      treeVotes: {
        BAIK: votes[0],
        SEDANG: votes[1],
        'TIDAK SEHAT': votes[2]
      },
      classProbabilities
    }
  };
}

module.exports = {
  classifyIspu,
  getRandomForestModel: () => rfModel
};
