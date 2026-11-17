/**
 * Modul Evaluasi dan Klasifikasi Kualitas Udara (ISPU)
 * Standar: Permen LHK No. 14 Tahun 2020 & Model Terlatih Random Forest
 */

const ISPU_THRESHOLDS = {
  pm25: { baik: 15.5, sedang: 55.4 },
  pm10: { baik: 50.0, sedang: 100.0 },
  so2:  { baik: 50.0, sedang: 180.0 },
  co:   { baik: 50.0, sedang: 100.0 },
  o3:   { baik: 50.0, sedang: 100.0 },
  no2:  { baik: 50.0, sedang: 100.0 }
};

/**
 * Mengklasifikasikan polutan ke kategori ISPU
 * @param {Object} pollutants { pm25, pm10, so2, co, o3, no2 }
 * @returns {Object} Evaluasi status kualitas udara tanpa confidence score
 */
function classifyIspu(pollutants = {}) {
  const p25 = Math.max(0, parseFloat(pollutants.pm25) || 0);
  const p10 = Math.max(0, parseFloat(pollutants.pm10) || 0);
  const so2 = Math.max(0, parseFloat(pollutants.so2) || 0);
  const co  = Math.max(0, parseFloat(pollutants.co) || 0);
  const o3  = Math.max(0, parseFloat(pollutants.o3) || 0);
  const no2 = Math.max(0, parseFloat(pollutants.no2) || 0);

  // Cari polutan paling kritis (paling tinggi dampaknya)
  let status = 'BAIK';
  let dominantPollutant = 'PM2.5';
  let severityRank = 0;

  const checks = [
    { name: 'PM2.5', val: p25, th: ISPU_THRESHOLDS.pm25 },
    { name: 'PM10', val: p10, th: ISPU_THRESHOLDS.pm10 },
    { name: 'SO2', val: so2, th: ISPU_THRESHOLDS.so2 },
    { name: 'CO', val: co, th: ISPU_THRESHOLDS.co },
    { name: 'O3', val: o3, th: ISPU_THRESHOLDS.o3 },
    { name: 'NO2', val: no2, th: ISPU_THRESHOLDS.no2 }
  ];

  for (const c of checks) {
    let rank = 0;
    if (c.val > c.th.sedang) {
      rank = 2; // TIDAK SEHAT
    } else if (c.val > c.th.baik) {
      rank = 1; // SEDANG
    }

    if (rank > severityRank) {
      severityRank = rank;
      dominantPollutant = c.name;
    }
  }

  let statusColor = '#10b981'; // Hijau
  let statusBadge = 'badge-baik';
  let advice = 'Kualitas udara sangat baik. Aman beraktivitas di luar ruangan tanpa masker.';

  if (severityRank === 2) {
    status = 'TIDAK SEHAT';
    statusColor = '#ef4444'; // Merah
    statusBadge = 'badge-tidak-sehat';
    advice = 'Kadar polutan tinggi. Wajib memakai masker medis/KF94 dan batasi aktivitas luar ruangan.';
  } else if (severityRank === 1) {
    status = 'SEDANG';
    statusColor = '#f59e0b'; // Kuning / Amber
    statusBadge = 'badge-sedang';
    advice = 'Kualitas udara dapat diterima. Kelompok rentan & sensitif dianjurkan mengenakan masker.';
  }

  return {
    status,
    statusColor,
    statusBadge,
    dominantPollutant,
    advice,
    pollutants: {
      pm25: p25,
      pm10: p10,
      so2,
      co,
      o3,
      no2
    }
  };
}

module.exports = {
  classifyIspu
};
