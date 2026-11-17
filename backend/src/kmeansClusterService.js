const path = require('path');
const fs = require('fs');

const MODEL_PATH = path.join(__dirname, '../models/respira-kmeans-clusters.json');
let clusterModel = null;

try {
  if (fs.existsSync(MODEL_PATH)) {
    clusterModel = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  }
} catch (err) {
  console.warn('Gagal memuat model K-Means JSON:', err.message);
}

/**
 * Memprediksi klaster risiko spasial polusi multi-variat menggunakan model K-Means ($K=3$).
 * Menghitung jarak Euclidean ternormalisasi ke titik pusat centroid masing-masing klaster.
 * 
 * @param {Object} pollutants - Nilai konsentrasi 6 polutan: { pm25, pm10, so2, co, o3, no2 }
 * @returns {Object} Metadata klaster risiko spasial
 */
function predictCluster(pollutants = {}) {
  if (!clusterModel || !clusterModel.centroids || !clusterModel.scaler) {
    const pm25 = Number(pollutants.pm25) || 35;
    if (pm25 < 40) {
      return {
        clusterId: 2,
        rank: 0,
        name: 'Klaster Risiko Terkontrol',
        badge: 'Zona Risiko Rendah',
        level: 'low',
        color: '#10b981',
        description: 'Sirkulasi udara terbuka, konsentrasi PM2.5 terendah dengan paparan minimal.'
      };
    } else if (pm25 < 70) {
      return {
        clusterId: 0,
        rank: 1,
        name: 'Klaster Risiko Moderat',
        badge: 'Zona Paparan Sedang',
        level: 'medium',
        color: '#f59e0b',
        description: 'Kawasan urban komersial/pemukiman, polusi meningkat saat jam sibuk.'
      };
    } else {
      return {
        clusterId: 1,
        rank: 2,
        name: 'Klaster Risiko Tinggi',
        badge: 'Zona Bahaya Paparan Akut',
        level: 'high',
        color: '#ef4444',
        description: 'Kawasan koridor industri & lalu lintas padat dengan akumulasi PM2.5 & PM10 pekat.'
      };
    }
  }

  const { features, scaler, centroids, clusterDefinitions } = clusterModel;

  const vector = features.map((feat, idx) => {
    const val = Number(pollutants[feat]);
    if (Number.isFinite(val)) return val;
    return scaler.mean[idx];
  });

  // Bobot relevansi klinis pernapasan pada perhitungan jarak K-Means:
  // Partikulat halus PM2.5 (2.0) dan PM10 (1.2) memiliki dampak patologis terbesar pada sistem respirasi
  const FEATURE_WEIGHTS = {
    pm25: 2.0,
    pm10: 1.2,
    so2:  0.6,
    co:   0.4,
    o3:   0.8,
    no2:  0.4
  };

  let minDistance = Infinity;
  let bestClusterId = 0;

  centroids.forEach((centroid, cIdx) => {
    let sumSq = 0;
    for (let j = 0; j < features.length; j++) {
      const featName = features[j];
      const weight = FEATURE_WEIGHTS[featName] || 1.0;
      const diffScaled = (vector[j] - centroid[j]) / scaler.scale[j];
      sumSq += weight * (diffScaled * diffScaled);
    }
    const dist = Math.sqrt(sumSq);
    if (dist < minDistance) {
      minDistance = dist;
      bestClusterId = cIdx;
    }
  });

  // Batas Keamanan Klinis (Clinical Boundary Check):
  // Jika PM2.5 < 55.4 µg/m³ (kualitas udara Baik/Sedang sesuai Permen LHK 14/2020),
  // wilayah tidak dapat dikategorikan sebagai "Zona Bahaya Paparan Akut" (Klaster 1).
  const pm25Input = vector[features.indexOf('pm25')] || 0;
  if (bestClusterId === 1 && pm25Input < 55.4) {
    bestClusterId = pm25Input >= 40.0 ? 0 : 2;
  }

  const def = clusterDefinitions[String(bestClusterId)] || {
    cluster_id: bestClusterId,
    rank: 1,
    name: `Klaster ${bestClusterId}`,
    badge: 'Zona Terklasifikasi',
    level: 'medium',
    color: '#f59e0b',
    description: 'Klaster spasial polusi'
  };

  return {
    clusterId: def.cluster_id,
    rank: def.rank,
    name: def.name,
    badge: def.badge,
    level: def.level,
    color: def.color,
    description: def.description,
    distanceToCentroid: parseFloat(minDistance.toFixed(3)),
    centroid: def.centroid
  };
}

module.exports = {
  predictCluster,
  getClusterModel: () => clusterModel
};
