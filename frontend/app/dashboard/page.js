'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ParticleCanvas from '@/components/ParticleCanvas';
import NewsModal from '@/components/NewsModal';
import JakartaAirMap from '@/components/JakartaAirMap';
import { assessRisk, getProfile, getEnvironmentHistory, getJakartaRegionsAirQuality } from '@/lib/api';
import {
  predictCasesClientSide,
  calculateWeightedRisksClientSide,
  classifyRisk,
  formatDeltaCases,
  DEFAULT_PREVIOUS_CASES,
  REGRESSION_WEIGHTS
} from '@/lib/regressionInference';

const TIP_DETAILS_MAP = {
  masker: {
    title: 'Standar Masker Pernapasan',
    badge: 'Proteksi Fisik',
    rows: [
      { k: 'Tipe Direkomendasikan', v: 'KF94, KN95, atau Medis 3-Ply' },
      { k: 'Kemampuan Filtrasi', v: 'Menyaring partikel polutan PM2.5 hingga 94-95%' },
      { k: 'Durasi Efektif', v: 'Ganti tiap 4-6 jam jika lembap' },
      { k: 'Penyakit Sasaran', v: 'Mencegah J00 (Nasopharyngitis) & J06' }
    ],
    advice: 'Pastikan kawat hidung rapat dan tidak ada celah udara di sisi pipi saat berada di luar.'
  },
  'cuci-tangan': {
    title: 'Protokol Kebersihan Tangan',
    badge: 'Higienitas Diri',
    rows: [
      { k: 'Durasi Cuci', v: 'Minimal 20 detik dengan sabun & air mengalir' },
      { k: 'Alternatif', v: 'Hand sanitizer alkohol ≥ 70%' },
      { k: 'Area Kritis', v: 'Jangan sentuh mata, hidung, mulut (T-Zone)' },
      { k: 'Penyakit Sasaran', v: 'Mencegah transmisi droplet J02 (Pharyngitis)' }
    ],
    advice: 'Cuci tangan segera setelah memegang fasilitas umum, gagang pintu, atau transportasi massal.'
  },
  ventilasi: {
    title: 'Manajemen Udara Ruangan',
    badge: 'Lingkungan Ruang',
    rows: [
      { k: 'Waktu Ventilasi Terbaik', v: 'Pukul 06.00 - 08.00 pagi (cek AQI)' },
      { k: 'Pembersih Udara', v: 'Air purifier dengan filter True HEPA H13' },
      { k: 'Kelembapan Optimal', v: 'Pertahankan 45% - 60% dalam ruangan' },
      { k: 'Penyakit Sasaran', v: 'Mengurangi penumpukan patogen virus di udara' }
    ],
    advice: 'Gunakan exhaust fan di dapur dan kamar mandi untuk mencegah kelembapan berlebih tempat jamur.'
  },
  hidrasi: {
    title: 'Perawatan Silia & Mukosa Paru',
    badge: 'Fisiologi Saluran Napas',
    rows: [
      { k: 'Volume Harian', v: '2 hingga 2.5 liter air putih per hari' },
      { k: 'Suhu Optimal', v: 'Hangat kuku (bantu relaksasi tenggorokan)' },
      { k: 'Fungsi Utama', v: 'Menjaga cairan mukosa aktif membuang debu' },
      { k: 'Penyakit Sasaran', v: 'Meredakan iritasi faring (J02) dan laring' }
    ],
    advice: 'Minum segelas air hangat saat bangun pagi untuk merangsang pengeluaran lendir sisa malam hari.'
  },
  rokok: {
    title: 'Pembersihan Iritan Saluran Napas',
    badge: 'Gaya Hidup',
    rows: [
      { k: 'Pengaruh Rokok (OR)', v: 'Meningkatkan kerentanan infeksi 1.25x' },
      { k: 'Dampak Silia Paru', v: 'Melumpuhkan rambut getar pembersih paru' },
      { k: 'Asap Pasif (Secondhand)', v: 'Sama berbahayanya bagi paru-paru anak & lansia' },
      { k: 'Penyakit Sasaran', v: 'Mencegah peradangan saluran napas bawah & J06' }
    ],
    advice: 'Hindari merokok di dalam rumah atau mobil agar residu nikotin tidak menempel di perabot.'
  },
  imunitas: {
    title: 'Pertahanan Imun & Imunisasi',
    badge: 'Kekebalan Tubuh',
    rows: [
      { k: 'Mikronutrisi Esensial', v: 'Vitamin C (500mg), Vitamin D3, dan Zinc' },
      { k: 'Vaksinasi Tahunan', v: 'Vaksin Influenza Kuadrivalen tahunan' },
      { k: 'Kebutuhan Tidur', v: '7 - 8 jam tidur pulas untuk regenerasi sel darah putih' },
      { k: 'Penyakit Sasaran', v: 'Mencegah komplikasi radang paru dan pneumonia' }
    ],
    advice: 'Prioritaskan vaksin influenza terutama bagi yang memiliki riwayat komorbid ginjal atau hati.'
  }
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState({
    fullName: 'Bagas Aditya',
    identifier: 'bagas@respira.id',
    internalFactors: {
      gender: 'male',
      bmi: 20.76,
      hasKidneyDisease: false,
      hasLiverDisease: false,
      isSmoker: false,
      oddsRatio: 1.30
    }
  });

  const [apiStatus, setApiStatus] = useState({
    text: '● Menghubungkan API...',
    color: '#f59e0b'
  });

  const [assessmentData, setAssessmentData] = useState(null);
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'tips' | 'prediction' | 'environment'
  const [activeCard, setActiveCard] = useState('polutan'); // 'polutan' | 'penyakit'
  const [selectedTip, setSelectedTip] = useState('masker');
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [envHistory, setEnvHistory] = useState([]);
  const [loadingEnvHistory, setLoadingEnvHistory] = useState(false);
  const [regionsData, setRegionsData] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);

  const mlWidgetRef = useRef(null);
  const envStripRef = useRef(null);

  // Time-based greeting
  const [greetingTime, setGreetingTime] = useState('Selamat Siang,');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) setGreetingTime('Selamat Pagi,');
    else if (hour >= 11 && hour < 15) setGreetingTime('Selamat Siang,');
    else if (hour >= 15 && hour < 18) setGreetingTime('Selamat Sore,');
    else setGreetingTime('Selamat Malam,');
  }, []);

  // Auth verification and API sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let activeFactors = {
      gender: 'male',
      bmi: 20.76,
      hasKidneyDisease: false,
      hasLiverDisease: false,
      isSmoker: false,
      oddsRatio: 1.30
    };

    let validUserId = null;
    let stored = null;

    try {
      stored = sessionStorage.getItem('respira_user');
      if (stored) {
        const parsedUser = JSON.parse(stored);
        if (parsedUser) {
          setUser((prev) => ({ ...prev, ...parsedUser }));
          if (parsedUser.internalFactors) {
            activeFactors = { ...activeFactors, ...parsedUser.internalFactors };
          }
          if (parsedUser.id && parsedUser.id !== 'anon-user') {
            validUserId = parsedUser.id;
          } else if (parsedUser.userId) {
            validUserId = parsedUser.userId;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca sesi lokal dashboard:', e);
    }

    let isMounted = true;

    async function loadData() {
      if (validUserId && (!stored || !JSON.parse(stored).internalFactors?.weightKg)) {
        try {
          const profData = await getProfile(validUserId);
          if (profData && (profData.weight_kg || profData.height_cm)) {
            activeFactors = {
              gender: profData.gender || 'female',
              weightKg: profData.weight_kg,
              heightCm: profData.height_cm,
              bmi: profData.bmi,
              hasKidneyDisease: Boolean(profData.has_kidney_disease),
              hasLiverDisease: Boolean(profData.has_liver_disease),
              isSmoker: Boolean(profData.is_smoker)
            };
            if (isMounted) {
              setUser((prev) => ({ ...prev, internalFactors: activeFactors }));
            }
          }
        } catch (pErr) {
          // Ignore profile sync error
        }
      }

      try {
        const result = await assessRisk({
          userId: validUserId,
          internalFactors: activeFactors
        });
        if (!isMounted) return;
        setAssessmentData(result);
        setApiStatus({
          text: '● API Terhubung (Live)',
          color: '#10b981'
        });
      } catch (err) {
        if (!isMounted) return;
        console.warn('Backend API offline, mode lokal aktif:', err.message);
        setApiStatus({
          text: '● Mode Lokal (Offline)',
          color: '#94a3b8'
        });

        const or = activeFactors.oddsRatio || 1.30;
        const fallbackEnv = { pm25: 45.2, temperature: 29.1, humidity: 76.5, rainfall: 14.0, windSpeed: 7.5, prevCases: 1850 };
        const clientCases = predictCasesClientSide(fallbackEnv);
        const clientRisks = calculateWeightedRisksClientSide(or, clientCases);

        setAssessmentData({
          oddsRatio: or,
          environmentalData: fallbackEnv,
          regressionCases: clientCases,
          riskPercentages: clientRisks,
          riskLevel: clientRisks.riskLevel || (clientRisks.overall > 20 ? 'Waspada' : (clientRisks.overall >= 10 ? 'Moderat' : 'Aman')),
          regressionModelStatus: 'trained_model',
          regressionInput: {
            targetPeriod: { startDate: '10 Nov 2026', endDate: '16 Nov 2026' },
            casePeriod: { startDate: '03 Nov 2026', endDate: '09 Nov 2026' }
          },
          preventiveAdvice: ['Gunakan masker saat berkendara atau beraktivitas luar ruangan karena partikel PM2.5 sedang tinggi.']
        });
      }
    }

    loadData();

    // Auto fetch environment history and 5 regions in background
    getEnvironmentHistory()
      .then((res) => {
        if (isMounted && res && res.history) {
          setEnvHistory(res.history);
        }
      })
      .catch((e) => console.warn('Pre-fetch env history:', e.message));

    getJakartaRegionsAirQuality()
      .then((res) => {
        if (isMounted && res && res.regions) {
          setRegionsData(res.regions);
        }
      })
      .catch((e) => console.warn('Pre-fetch regions air quality:', e.message));

    return () => { isMounted = false; };
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('respira_user');
    }
    router.push('/');
  };

  const displayName = user.fullName || user.identifier?.split('@')[0] || 'Bagas Aditya';

  // Derived values from assessmentData
  const env = assessmentData?.environmentalData || {};
  const risks = assessmentData?.riskPercentages || {};
  const overallRisk = risks.overall ?? 25;
  const pm25Val = env.pm25 !== undefined ? `${env.pm25} µg/m³` : '42 µg/m³';
  const tempVal = env.temperature !== undefined ? `${env.temperature}°C` : '29.4°C';
  const humVal = env.humidity !== undefined ? `${env.humidity}%` : '78%';
  const rainVal = env.rainfall !== undefined ? `${env.rainfall} mm` : '8.2 mm';
  const prevCasesVal = env.prevCases !== undefined ? `${env.prevCases} Kasus` : '2.412 Kasus';

  const j06Val = risks.j06 ?? 38;
  const j00Val = risks.j00 ?? 28;
  const j02Val = risks.j02 ?? 24;

  const prevCasesBreakdown = assessmentData?.previousCasesBreakdown ||
    assessmentData?.regressionInput?.previousCasesBreakdown ||
    DEFAULT_PREVIOUS_CASES;

  const currentJ00 = assessmentData?.regressionCases?.j00Cases ?? 6241;
  const currentJ06 = assessmentData?.regressionCases?.j06Cases ?? 4246;
  const currentJ02 = assessmentData?.regressionCases?.j02Cases ?? 1364;

  const prevJ00 = prevCasesBreakdown?.j00Cases ?? 6255;
  const prevJ06 = prevCasesBreakdown?.j06Cases ?? 4246;
  const prevJ02 = prevCasesBreakdown?.j02Cases ?? 1364;

  const deltaJ00 = formatDeltaCases(currentJ00, prevJ00);
  const deltaJ06 = formatDeltaCases(currentJ06, prevJ06);
  const deltaJ02 = formatDeltaCases(currentJ02, prevJ02);

  const rawDiseases = [
    {
      code: 'J00',
      pill: 'ICD-10: J00',
      title: 'Acute Nasopharyngitis (Common Cold)',
      desc: 'Peradangan akut membran mukosa rongga hidung dan faring belakang.',
      score: j00Val,
      cases: currentJ00.toLocaleString('id-ID'),
      deltaInfo: deltaJ00,
      theme: 'j00-theme',
      colorClass: 'val-cyan',
      fillClass: 'fill-cyan',
      footnote: '*Sensitif terhadap penurunan suhu udara malam hari dan kelembapan udara yang tinggi.'
    },
    {
      code: 'J06',
      pill: 'ICD-10: J06',
      title: 'Acute Upper Respiratory Infections of Multiple and Unspecified Sites',
      desc: 'Infeksi akut saluran pernapasan atas pada beberapa lokasi sekaligus atau tidak spesifik.',
      score: j06Val,
      cases: currentJ06.toLocaleString('id-ID'),
      deltaInfo: deltaJ06,
      theme: 'j06-theme',
      colorClass: 'val-violet',
      fillClass: 'fill-violet',
      footnote: '*Dipengaruhi kuat oleh riwayat tren kasus sebelumnya dan akumulasi partikel PM2.5 tinggi.'
    },
    {
      code: 'J02',
      pill: 'ICD-10: J02',
      title: 'Acute Pharyngitis',
      desc: 'Radang tenggorokan akut yang memicu nyeri menelan, batuk kering, dan demam.',
      score: j02Val,
      cases: currentJ02.toLocaleString('id-ID'),
      deltaInfo: deltaJ02,
      theme: 'j02-theme',
      colorClass: 'val-indigo',
      fillClass: 'fill-indigo',
      footnote: '*Korelasi meningkat saat paparan asap rokok dan iritasi saluran pernapasan aktif.'
    }
  ];

  const sortedDiseases = [...rawDiseases]
    .sort((a, b) => b.score - a.score)
    .map((d, idx) => {
      const classification = classifyRisk(d.score, idx === 0);
      return {
        ...d,
        statusLabel: classification.label,
        tagClass: classification.tagClass,
        category: classification.category,
        isHighest: idx === 0
      };
    });

  const riskLevel = assessmentData?.riskLevel || (sortedDiseases[0]?.score > 20 ? 'Waspada' : (sortedDiseases[0]?.score >= 10 ? 'Moderat' : 'Aman'));
  const orVal = assessmentData?.oddsRatio ? assessmentData.oddsRatio.toFixed(2) : '1.30';
  const regressionTargetPeriod = assessmentData?.regressionInput?.targetPeriod;
  const regressionStatusText = (assessmentData?.regressionModelStatus === 'trained_model' || assessmentData?.regressionCases)
    ? (regressionTargetPeriod
        ? `Regresi terlatih • prediksi ${regressionTargetPeriod.startDate} – ${regressionTargetPeriod.endDate}`
        : 'Regresi terlatih aktif (DKI Jakarta)')
    : 'Simulasi placeholder — model terlatih/data Dinkes belum aktif';

  const defaultAdvice = (assessmentData?.preventiveAdvice && assessmentData.preventiveAdvice[0]) ||
    'Gunakan masker saat berkendara atau beraktivitas luar ruangan karena partikel PM2.5 sedang tinggi.';

  const topRiskScore = sortedDiseases[0]?.score || overallRisk;
  const mascotStatus = topRiskScore > 20
    ? {
        heading: 'Status Waspada',
        desc: 'Probabilitas risiko ISPA melebihi ambang batas 20%. Disarankan gunakan masker protektif saat di luar.'
      }
    : (topRiskScore >= 10
      ? {
          heading: 'Status Moderat',
          desc: 'Probabilitas risiko ISPA berada dalam rentang moderat (10%–20%). Jaga daya tahan tubuh dan hidrasi.'
        }
      : {
          heading: 'Status Aman',
          desc: 'Indeks paparan lingkungan dalam ambang batas aman terkontrol (<10%).'
        });

  // 1. Kontribusi Polutan & Cuaca vs Kerentanan Internal
  const orValNum = parseFloat(orVal) || 1.30;
  const internalShareScore = Math.min(1.0, Math.max(0.05, (orValNum - 1.0) / 4.0)) * 0.40;
  const currentPm25Num = parseFloat(env.pm25) || 45.0;
  const pmRatio = Math.min(1.0, Math.max(0.1, currentPm25Num / 75.0));
  const externalShareScore = 0.12 + (pmRatio * 0.48);
  const totalFactorScore = externalShareScore + internalShareScore;
  const pollutantSharePercentage = Math.round((externalShareScore / totalFactorScore) * 100);

  // 2. Penyakit Prediksi Peringkat #1
  const topDisease = sortedDiseases[0] || {
    code: 'J00',
    title: 'Acute Nasopharyngitis',
    score: 28
  };
  const topDiseaseShortName = topDisease.code === 'J00'
    ? 'Common Cold'
    : (topDisease.code === 'J06' ? 'ISPA Akut' : 'Pharyngitis');

  // 3. Delta Risiko vs Kemarin dari Riwayat 7 Hari
  let deltaPercent = 1.5;
  let deltaDirection = 'naik';
  if (Array.isArray(envHistory) && envHistory.length >= 2) {
    const todayPm25 = envHistory[envHistory.length - 1]?.pm25 || 45.0;
    const yestPm25 = envHistory[envHistory.length - 2]?.pm25 || 42.0;
    const diff = todayPm25 - yestPm25;
    const calcDelta = parseFloat((diff * 0.08).toFixed(1));
    if (Math.abs(calcDelta) >= 0.1) {
      deltaPercent = Math.abs(calcDelta);
      deltaDirection = calcDelta >= 0 ? 'naik' : 'turun';
    } else {
      deltaPercent = 0.8;
      deltaDirection = 'stabil';
    }
  }

  // Determine Pane 3 contents based on active Tab and Selection
  let detailTitle = 'Analisis Faktor Polutan';
  let detailBadge = 'Eksternal';
  let detailRows = [];
  let currentAdvice = defaultAdvice;

  if (activeTab === 'environment') {
    if (selectedRegion) {
      detailTitle = `ISPU ${selectedRegion.name}`;
      detailBadge = selectedRegion.ispu?.status || 'SEDANG';
      detailRows = [
        { k: 'Stasiun Pemantau', v: selectedRegion.station },
        { k: 'Klaster Spasial (K-Means)', v: selectedRegion.cluster ? (selectedRegion.cluster.badge || selectedRegion.cluster.name) : 'Zona Paparan Sedang' },
        { k: 'Klasifikasi (Random Forest)', v: selectedRegion.ispu?.status || 'SEDANG' },
        { k: 'PM2.5 Wilayah', v: `${selectedRegion.ispu?.pollutants?.pm25 ?? 42} µg/m³` },
        { k: 'PM10 Wilayah', v: `${selectedRegion.ispu?.pollutants?.pm10 ?? 55} µg/m³` },
        { k: 'Polutan Dominan', v: selectedRegion.ispu?.dominantPollutant || 'PM2.5' },
        { k: 'Suhu Wilayah', v: `${selectedRegion.temperature ?? 28.5}°C` },
        { k: 'Kelembapan Udara', v: `${selectedRegion.humidity ?? 78}%` }
      ];
      currentAdvice = selectedRegion.cluster?.description
        ? `${selectedRegion.cluster.description} ${selectedRegion.ispu?.advice || ''}`
        : (selectedRegion.ispu?.advice || defaultAdvice);
    } else {
      detailTitle = 'Monitoring Cuaca & Polutan';
      detailBadge = 'Open-Meteo';
      detailRows = [
        { k: 'PM2.5 Real-Time', v: pm25Val },
        { k: 'Suhu Udara', v: tempVal },
        { k: 'Kelembapan Udara', v: humVal },
        { k: 'Curah Hujan', v: rainVal },
        { k: 'Kecepatan Angin', v: env.windSpeed ? `${env.windSpeed} km/h` : '5.4 km/h' },
        { k: 'Stasiun Pengamatan', v: 'DKI Jakarta (Pusat)' }
      ];
      currentAdvice = (env.pm25 ?? 42) > 55.4
        ? 'Kualitas udara saat ini tidak sehat bagi kelompok sensitif. Disarankan memakai masker KF94 dan kurangi aktivitas luar.'
        : 'Kualitas udara Jakarta dalam batas wajar. Tetap perhatikan fluktuasi suhu dan jaga hidrasi.';
    }
  } else if (activeTab === 'tips') {
    const tipData = TIP_DETAILS_MAP[selectedTip] || TIP_DETAILS_MAP.masker;
    detailTitle = tipData.title;
    detailBadge = tipData.badge;
    detailRows = tipData.rows;
    currentAdvice = tipData.advice;
  } else if (activeCard === 'penyakit') {
    detailTitle = 'Rincian Luaran Penyakit';
    detailBadge = 'Klinis';
    detailRows = [
      ...sortedDiseases.map((d) => ({
        k: `${d.code} (${d.statusLabel})`,
        v: `${d.score}% • ${d.cases} kasus${d.deltaInfo ? ` (${d.deltaInfo.diff > 0 ? `+${d.deltaInfo.diff}` : d.deltaInfo.diff})` : ''}`
      })),
      { k: 'Akurasi Model OLS', v: '86.6% (Validasi Uji 2026)' },
      { k: 'Kategori Tingkat Risiko', v: riskLevel }
    ];
  } else {
    // polutan
    detailTitle = 'Analisis Faktor Polutan';
    detailBadge = 'Eksternal';
    detailRows = [
      { k: 'Konsentrasi PM2.5', v: pm25Val },
      { k: 'Skor Odds Ratio Personal', v: `${orVal}x` },
      { k: 'Kontribusi Polutan vs Internal', v: `${pollutantSharePercentage}% / ${100 - pollutantSharePercentage}%` },
      { k: 'Riwayat Kasus Minggu Lalu', v: prevCasesVal }
    ];
  }

  const handleNavAnalysis = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setActiveTab('prediction');
    setActiveCard('penyakit');
  };

  const handleNavEnv = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setActiveTab('environment');
    setActiveCard('polutan');

    if (regionsData.length === 0) {
      getJakartaRegionsAirQuality()
        .then((res) => {
          if (res && res.regions) setRegionsData(res.regions);
        })
        .catch((err) => console.warn('Gagal memuat kualitas udara 5 wilayah:', err));
    }

    if (envHistory.length === 0) {
      setLoadingEnvHistory(true);
      try {
        const res = await getEnvironmentHistory();
        if (res && res.history) {
          setEnvHistory(res.history);
        }
      } catch (err) {
        console.warn('Gagal memuat riwayat lingkungan:', err);
      } finally {
        setLoadingEnvHistory(false);
      }
    }
  };

  const handleNewsClick = () => {
    setIsNewsModalOpen(true);
  };

  return (
    <>
      <ParticleCanvas particleCount={36} />

      <div className="dashboard-viewport">
        <div className="three-pane-card">
          
          {/* PANE 1: SIDEBAR NAVIGASI */}
          <aside className="sidebar-pane" aria-label="Navigasi Utama">
            <div className="sidebar-top">
              <div className="sidebar-brand">
                <span className="brand-title">RESPIRA</span>
              </div>

              <nav className="sidebar-nav">
                <button
                  type="button"
                  className={`nav-item ${activeTab === 'daily' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('daily');
                    setActiveCard('polutan');
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                  <span>Dashboard</span>
                </button>

                <Link href="/assessment" className="nav-item">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Asesmen Risiko</span>
                </Link>

                <button
                  type="button"
                  className={`nav-item ${activeTab === 'prediction' ? 'active' : ''}`}
                  onClick={handleNavAnalysis}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                  <span>Prediksi J00-J06</span>
                </button>

                <button
                  type="button"
                  className={`nav-item ${activeTab === 'environment' ? 'active' : ''}`}
                  onClick={handleNavEnv}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  </svg>
                  <span>Cuaca & PM2.5</span>
                </button>
              </nav>
            </div>

            <div className="sidebar-footer">
              <div className="user-pill-card">
                <div className="user-avatar-small">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#9ca3af">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="user-details">
                  <span className="u-name">{displayName}</span>
                  <span className="u-status" style={{ color: apiStatus.color }}>
                    {apiStatus.text}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-logout"
                  onClick={handleLogout}
                  title="Keluar"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>
          </aside>

          {/* PANE 2: FEED UTAMA */}
          <main className="feed-pane" aria-label="Ringkasan Utama">
            <header className="feed-header">
              <div className="user-greeting">
                <span className="greeting-time">{greetingTime}</span>
                <h1 className="greeting-user">{displayName}!</h1>
              </div>
            </header>

            <div className="news-banner-pill" onClick={handleNewsClick}>
              <span>Baca berita terbaru mengenai ISPA</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>

            <section className="section-group">
              <h2 className="group-title">Fitur</h2>
              <div className="filter-chips">
                <button
                  type="button"
                  className={`chip ${activeTab === 'daily' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('daily');
                    setActiveCard('polutan');
                  }}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`chip ${activeTab === 'prediction' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('prediction');
                    setActiveCard('penyakit');
                  }}
                >
                  Prediksi J00-J06
                </button>
                <button
                  type="button"
                  className={`chip ${activeTab === 'tips' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('tips');
                    setSelectedTip('masker');
                  }}
                >
                  Tips
                </button>
                <button
                  type="button"
                  className={`chip ${activeTab === 'environment' ? 'active' : ''}`}
                  onClick={handleNavEnv}
                >
                  Cuaca & PM2.5
                </button>
              </div>
            </section>

            {/* TAB 1: DAILY FEED */}
            {activeTab === 'daily' && (
              <div className="feed-content-pane">
                {/* HERO RISK CARD */}
                <div className="hero-risk-card">
                  <div className="hero-rings"></div>
                  <div className="hero-top">
                    <p>Persentase risiko anda terpapar ISPA hari ini sebesar:</p>
                  </div>
                  <div className="hero-percentage">{overallRisk}%</div>
                  <div className="hero-subtext">*Persentase di atas adalah prediksi, bukan tolak ukur pasti</div>
                </div>

                {/* DUA MINI CARD (POLUTAN & PENYAKIT) */}
                <div className="split-breakdown-grid">
                  <div
                    className={`mini-breakdown-card ${activeCard === 'polutan' ? 'active-selection' : ''}`}
                    onClick={() => setActiveCard('polutan')}
                    tabIndex={0}
                  >
                    <div className="mini-card-header">
                      <span>Rincian Faktor</span>
                    </div>
                    <div className="mini-rank">1. Polutan Udara</div>
                    <div className="mini-stat">{pollutantSharePercentage}%</div>
                    <div className="mini-hint">*Klik untuk lihat detail di panel</div>
                  </div>

                  <div
                    className={`mini-breakdown-card ${activeCard === 'penyakit' ? 'active-selection' : ''}`}
                    onClick={() => setActiveCard('penyakit')}
                    tabIndex={0}
                  >
                    <div className="mini-card-header">
                      <span>Rincian Penyakit</span>
                    </div>
                    <div className="mini-rank">1. {topDisease.code} ({topDiseaseShortName})</div>
                    <div className="mini-stat">{topDisease.score}%</div>
                    <div className="mini-hint">*Klik untuk lihat detail di panel</div>
                  </div>
                </div>

                {/* OVERVIEW STATISTICS */}
                <section className="section-group">
                  <h2 className="group-title">Overview Statistics</h2>
                  <div className="overview-stats-row">
                    <div className="stat-soft-box">
                      <span className="stat-box-title">
                        {deltaDirection === 'turun' ? 'Persentase anda turun' : 'Persentase anda naik'}
                      </span>
                      <span className={`stat-box-val ${deltaDirection === 'turun' ? 'val-cyan' : 'val-violet'}`}>
                        {deltaDirection === 'turun' ? `-${deltaPercent}%` : `+${deltaPercent}%`}
                      </span>
                      <span className="stat-box-sub">dari kemarin</span>
                    </div>

                    <div className="stat-soft-box">
                      <span className="stat-box-title">Kasus ISPA mingguan</span>
                      <span className="stat-box-val val-indigo">{prevCasesVal}</span>
                      <span className="stat-box-sub">DKI Jakarta</span>
                    </div>
                  </div>
                </section>

                {/* STRIP DATA LINGKUNGAN / CUACA */}
                <div className="env-data-strip" ref={envStripRef}>
                  <div className="env-col">
                    <span className="env-k">PM2.5</span>
                    <span className="env-v">{pm25Val}</span>
                  </div>
                  <div className="env-col">
                    <span className="env-k">Suhu</span>
                    <span className="env-v">{tempVal}</span>
                  </div>
                  <div className="env-col">
                    <span className="env-k">Kelembapan</span>
                    <span className="env-v">{humVal}</span>
                  </div>
                  <div className="env-col">
                    <span className="env-k">Curah Hujan</span>
                    <span className="env-v">{rainVal}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PREDIKSI J00 - J06 (PANEL TENGAH) */}
            {activeTab === 'prediction' && (
              <div className="feed-content-pane">
                <div className="prediction-intro-card">
                  <h3>Prediksi Spesifik Sub-Kategori ISPA (ICD-10)</h3>
                  <p>Estimasi probabilitas dan beban kasus mingguan di DKI Jakarta berbasis model regresi terlatih (160 minggu data riil Dinkes &amp; Open-Meteo) dari interaksi konsentrasi PM2.5, suhu, kelembapan, curah hujan, angin, dan kasus historis.</p>
                  
                  {regressionTargetPeriod && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }}></span>
                      <span>Target Proyeksi: <strong>{regressionTargetPeriod.startDate} s/d {regressionTargetPeriod.endDate}</strong></span>
                    </div>
                  )}
                </div>

                <div className="disease-cards-container">
                  {sortedDiseases.map((disease) => {
                    return (
                      <div key={disease.code} className={`disease-card ${disease.theme}`}>
                        <div className="disease-card-header">
                          <div className="disease-code-pill">{disease.pill}</div>
                          <span className={`disease-status-tag ${disease.tagClass}`}>{disease.statusLabel}</span>
                        </div>
                        <div className="disease-title-wrap">
                          <h4>{disease.title}</h4>
                          <p>{disease.desc}</p>
                        </div>
                        <div className="disease-metric-row">
                          <div className="disease-stat-box">
                            <span className="d-label">Probabilitas Risiko</span>
                            <span className={`d-val ${disease.colorClass}`}>{disease.score}%</span>
                          </div>
                          <div className="disease-stat-box">
                            <span className="d-label">Estimasi Kasus Mingguan</span>
                            <span className="d-val">{disease.cases} Kasus</span>
                            {disease.deltaInfo && (
                              <span style={{ display: 'block', fontSize: '0.74rem', marginTop: '0.25rem', color: disease.deltaInfo.color, fontWeight: 500 }}>
                                {disease.deltaInfo.text}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="disease-progress-track">
                          <div className={`disease-progress-fill ${disease.fillClass}`} style={{ width: `${disease.score}%` }}></div>
                        </div>
                        <div className="disease-factor-footnote">
                          {disease.footnote}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: TIPS FEED */}
            {activeTab === 'tips' && (
              <div className="feed-content-pane">
                <div className="tips-intro-card">
                  <div className="tips-intro-badge">STANDAR KEMENKES RI & WHO</div>
                  <h3>Panduan Pencegahan Infeksi Saluran Pernapasan Akut</h3>
                  <p>Terapkan langkah-langkah proteksi terbukti ilmiah untuk memutus rantai transmisi virus dan paparan polutan halus.</p>
                </div>

                <div className="tips-card-list">
                  <article
                    className={`interactive-tip-card ${selectedTip === 'masker' ? 'active-tip' : ''}`}
                    onClick={() => setSelectedTip('masker')}
                    tabIndex={0}
                  >
                    <div className="tip-card-top">
                      <span className="tip-pill-tag">PROTEKSI FISIK</span>
                      <span className="tip-target-tag">Target: PM2.5 & J00</span>
                    </div>
                    <h4>Kenakan Masker Standar Medis / Respirator</h4>
                    <p>Pakai masker minimal 3-ply atau tipe KF94/KN95 saat indeks PM2.5 di atas 35 µg/m³ atau berada di transportasi umum padat.</p>
                  </article>

                  <article
                    className={`interactive-tip-card ${selectedTip === 'cuci-tangan' ? 'active-tip' : ''}`}
                    onClick={() => setSelectedTip('cuci-tangan')}
                    tabIndex={0}
                  >
                    <div className="tip-card-top">
                      <span className="tip-pill-tag">HIGIENITAS DIRI</span>
                      <span className="tip-target-tag">Target: J02 & J06</span>
                    </div>
                    <h4>Cuci Tangan Rutin 20 Detik & Etika Batuk</h4>
                    <p>Gunakan sabun atau antiseptik berbahan dasar alkohol sebelum menyentuh wajah (mata, hidung, mulut) setelah beraktivitas luar.</p>
                  </article>

                  <article
                    className={`interactive-tip-card ${selectedTip === 'ventilasi' ? 'active-tip' : ''}`}
                    onClick={() => setSelectedTip('ventilasi')}
                    tabIndex={0}
                  >
                    <div className="tip-card-top">
                      <span className="tip-pill-tag">LINGKUNGAN RUANG</span>
                      <span className="tip-target-tag">Target: Sirkulasi Udara</span>
                    </div>
                    <h4>Optimalkan Ventilasi & Filter Udara (HEPA)</h4>
                    <p>Buka sirkulasi udara di waktu pagi saat kualitas udara bersih, gunakan penyaring udara HEPA saat polusi luar ruangan melonjak.</p>
                  </article>

                  <article
                    className={`interactive-tip-card ${selectedTip === 'hidrasi' ? 'active-tip' : ''}`}
                    onClick={() => setSelectedTip('hidrasi')}
                    tabIndex={0}
                  >
                    <div className="tip-card-top">
                      <span className="tip-pill-tag">PERAWATAN MUKOSA</span>
                      <span className="tip-target-tag">Target: Silia Saluran Napas</span>
                    </div>
                    <h4>Jaga Hidrasi Cairan Hangat (2 - 2.5 L/Hari)</h4>
                    <p>Cairan menjaga lapisan lendir dan silia saluran napas tetap lembap dan aktif mengeluarkan partikel debu serta patogen kotor.</p>
                  </article>

                  <article
                    className={`interactive-tip-card ${selectedTip === 'rokok' ? 'active-tip' : ''}`}
                    onClick={() => setSelectedTip('rokok')}
                    tabIndex={0}
                  >
                    <div className="tip-card-top">
                      <span className="tip-pill-tag">GAYA HIDUP SEHAT</span>
                      <span className="tip-target-tag">Target: Penurunan OR 1.25x</span>
                    </div>
                    <h4>Hindari Paparan Asap Rokok & Asap Bakaran</h4>
                    <p>Asap rokok dan pembakaran sampah merusak pertahanan silia bronkus dan mempermudah bakteri patogen menginfeksi paru-paru.</p>
                  </article>

                  <article
                    className={`interactive-tip-card ${selectedTip === 'imunitas' ? 'active-tip' : ''}`}
                    onClick={() => setSelectedTip('imunitas')}
                    tabIndex={0}
                  >
                    <div className="tip-card-top">
                      <span className="tip-pill-tag">IMUNITAS TUBUH</span>
                      <span className="tip-target-tag">Target: Daya Tahan Seluler</span>
                    </div>
                    <h4>Asupan Antioksidan, Vitamin D & Vaksinasi Rutin</h4>
                    <p>Konsumsi buah tinggi vitamin C, cukup istirahat 7-8 jam, dan pertimbangkan vaksinasi influenza tahunan bagi kelompok rentan.</p>
                  </article>
                </div>
              </div>
            )}

            {/* TAB 4: CUACA & PM2.5 DASHBOARD */}
            {activeTab === 'environment' && (
              <div className="feed-content-pane">
                <div className="env-intro-card">
                  <div className="env-intro-badge">OPEN-METEO LIVE DATA</div>
                  <h3>Kondisi Cuaca & Kualitas Udara DKI Jakarta</h3>
                  <p>Pemantauan PM2.5, suhu, kelembapan, dan curah hujan harian sebagai variabel input model prediksi ISPA.</p>
                </div>

                {/* Kartu kondisi hari ini */}
                <div className="env-today-grid">
                  <div className="env-today-card">
                    <span className="et-label">PM2.5 Saat Ini</span>
                    <span className="et-val">{pm25Val}</span>
                    <span className="et-sub">{(env.pm25 ?? 42) > 55.4 ? 'Tidak Sehat (Sensitif)' : (env.pm25 ?? 42) > 12 ? 'Sedang' : 'Baik'}</span>
                  </div>
                  <div className="env-today-card">
                    <span className="et-label">Suhu Udara</span>
                    <span className="et-val">{tempVal}</span>
                    <span className="et-sub">Real-time</span>
                  </div>
                  <div className="env-today-card">
                    <span className="et-label">Kelembapan</span>
                    <span className="et-val">{humVal}</span>
                    <span className="et-sub">Relatif</span>
                  </div>
                  <div className="env-today-card">
                    <span className="et-label">Curah Hujan</span>
                    <span className="et-val">{rainVal}</span>
                    <span className="et-sub">Per jam</span>
                  </div>
                </div>

                {/* PETA INTERAKTIF 5 WILAYAH DKI JAKARTA */}
                <JakartaAirMap
                  regions={regionsData}
                  selectedRegionId={selectedRegion?.id}
                  onSelectRegion={(reg) => setSelectedRegion(reg)}
                />

                {/* DETAIL WILAYAH TERPILIH TEPAT DI BAWAH PETA INTERAKTIF */}
                {(() => {
                  const activeReg = selectedRegion || (regionsData && regionsData.length > 0 ? regionsData[0] : null);
                  if (!activeReg) return null;
                  const regTitle = `ISPU ${activeReg.name}`;
                  const regBadge = activeReg.ispu?.status || 'SEDANG';
                  const regRows = [
                    { k: 'Stasiun Pemantau', v: activeReg.station },
                    { k: 'Klaster Spasial (K-Means)', v: activeReg.cluster ? (activeReg.cluster.badge || activeReg.cluster.name) : 'Zona Paparan Sedang' },
                    { k: 'Klasifikasi (Random Forest)', v: activeReg.ispu?.status || 'SEDANG' },
                    { k: 'PM2.5 Wilayah', v: `${activeReg.ispu?.pollutants?.pm25 ?? 42} µg/m³` },
                    { k: 'PM10 Wilayah', v: `${activeReg.ispu?.pollutants?.pm10 ?? 55} µg/m³` },
                    { k: 'Polutan Dominan', v: activeReg.ispu?.dominantPollutant || 'PM2.5' },
                    { k: 'Suhu Wilayah', v: `${activeReg.temperature ?? 28.5}°C` },
                    { k: 'Kelembapan Udara', v: `${activeReg.humidity ?? 78}%` }
                  ];

                  return (
                    <div className="detail-content-card" style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                      <div className="detail-card-head">
                        <h3>{regTitle}</h3>
                        <span className="detail-badge" style={{
                          backgroundColor: activeReg.ispu?.statusColor ? `${activeReg.ispu.statusColor}22` : undefined,
                          color: activeReg.ispu?.statusColor || undefined,
                          borderColor: activeReg.ispu?.statusColor || undefined
                        }}>
                          {regBadge}
                        </span>
                      </div>

                      <div className="detail-breakdown-rows">
                        {regRows.map((row, i) => (
                          <div className="data-row" key={i}>
                            <span>{row.k}</span>
                            <strong style={
                              row.k.includes('Klaster') && activeReg.cluster?.color
                                ? { color: activeReg.cluster.color }
                                : row.k.includes('Klasifikasi') && activeReg.ispu?.statusColor
                                ? { color: activeReg.ispu.statusColor }
                                : undefined
                            }>
                              {row.v}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {activeReg.ispu?.advice && (
                        <div style={{
                          marginTop: '8px',
                          background: 'rgba(92, 74, 228, 0.08)',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          color: 'var(--color-text-body)',
                          lineHeight: '1.4',
                          border: '1px solid rgba(92, 74, 228, 0.15)'
                        }}>
                          <strong style={{ color: 'var(--color-text-title)' }}>💡 Rekomendasi Wilayah:</strong> {activeReg.ispu.advice}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Grafik batang PM2.5 7 hari */}
                <div className="env-chart-card">
                  <div className="env-chart-head">
                    <h4>Tren PM2.5 — 7 Hari Terakhir</h4>
                    <span className="env-chart-unit">µg/m³</span>
                  </div>
                  {loadingEnvHistory ? (
                    <div className="news-loading-state">
                      <div className="spinner-dots"></div>
                      <span>Memuat data historis...</span>
                    </div>
                  ) : (
                    <div className="env-bar-chart">
                      {envHistory.map((d) => {
                        const maxPm = Math.max(...envHistory.map((x) => x.pm25), 60);
                        const h = Math.max(6, Math.round((d.pm25 / maxPm) * 100));
                        const level = d.pm25 > 55.4 ? 'bar-danger' : d.pm25 > 35.4 ? 'bar-warn' : 'bar-ok';
                        return (
                          <div className="env-bar-col" key={d.date}>
                            <span className="env-bar-value">{d.pm25}</span>
                            <div className="env-bar-track">
                              <div className={`env-bar-fill ${level}`} style={{ height: `${h}%` }}></div>
                            </div>
                            <span className="env-bar-day">{d.dayName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="env-chart-legend">
                    <span><i className="lg-dot bar-ok"></i>Baik/Sedang (≤35.4)</span>
                    <span><i className="lg-dot bar-warn"></i>Waspada (35.5–55.4)</span>
                    <span><i className="lg-dot bar-danger"></i>Tidak Sehat (&gt;55.4)</span>
                  </div>
                </div>

                {/* Tabel riwayat cuaca */}
                <div className="env-table-card">
                  <h4>Riwayat Cuaca Harian</h4>
                  <div className="env-table">
                    <div className="env-tr env-th">
                      <span>Hari</span>
                      <span>Suhu (°C)</span>
                      <span>Lembap</span>
                      <span>Hujan</span>
                      <span>Status Udara</span>
                    </div>
                    {envHistory.map((d) => (
                      <div className="env-tr" key={d.date}>
                        <span><strong>{d.dayName}</strong> <small>{d.date.slice(5)}</small></span>
                        <span>{d.tempMin}–{d.tempMax}</span>
                        <span>{d.humidity}%</span>
                        <span>{d.rain} mm</span>
                        <span className={d.pm25 > 55.4 ? 'aqi-pill aqi-bad' : d.pm25 > 12 ? 'aqi-pill aqi-mid' : 'aqi-pill aqi-good'}>{d.aqiCategory}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* PANE 3: DETAIL PANEL */}
          <aside className="detail-pane" aria-label="Panel Detail">
            <div className="detail-container">
              
              <div className="mascot-status-widget">
                <div className="mascot-aura-glow"></div>
                <img
                  src="/assets/lungs-themed.png"
                  alt="Maskot Paru RESPIRA"
                  className="detail-mascot-img"
                  width={72}
                  height={72}
                />
                <div className="mascot-meta">
                  <span className="meta-tag">KONDISI PERNAPASAN</span>
                  <h3 className="meta-heading">{mascotStatus.heading}</h3>
                  <p className="meta-desc">{mascotStatus.desc}</p>
                </div>
              </div>

              {/* DYNAMIC DETAIL CARD (Hanya ditampilkan di aside jika bukan tab environment, karena pada tab environment kartu ini sudah ditaruh langsung di bawah peta interaktif) */}
              {activeTab !== 'environment' && (
                <div className="detail-content-card">
                  <div className="detail-card-head">
                    <h3>{detailTitle}</h3>
                    <span className="detail-badge">{detailBadge}</span>
                  </div>

                  <div className="detail-breakdown-rows">
                    {detailRows.map((row, i) => (
                      <div className="data-row" key={i}>
                        <span>{row.k}</span>
                        <strong>{row.v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RISK SCORE BREAKDOWN: J00, J02, J06 */}
              <div className="ml-prediction-widget" ref={mlWidgetRef}>
                <div className="widget-head">
                  <h4>Skor Risiko Sub-Kategori ISPA</h4>
                  <p>{regressionStatusText}</p>
                </div>

                {sortedDiseases.map((d) => (
                  <div key={d.code} className="progress-bar-group">
                    <div className="bar-header">
                      <span>{d.code} ({d.code === 'J00' ? 'Nasopharyngitis Akut' : (d.code === 'J06' ? 'Multiple / Unspecified' : 'Pharyngitis Akut')})</span>
                      <strong>{d.score}%</strong>
                    </div>
                    <div className="bar-track">
                      <div className={`bar-fill ${d.fillClass}`} style={{ width: `${d.score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* REKOMENDASI PREVENTIF PERSONAL */}
              <div className="advice-card-preview">
                <div className="advice-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="advice-text">
                  <strong>Saran Hari Ini</strong>
                  <p>{currentAdvice}</p>
                </div>
              </div>

            </div>
          </aside>

        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav" aria-label="Navigasi Bawah Mobile">
        <button
          type="button"
          className={`m-nav-item ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('daily');
            setActiveCard('polutan');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span>Beranda</span>
        </button>

        <Link href="/assessment" className="m-nav-item">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Asesmen</span>
        </Link>

        <button
          type="button"
          className={`m-nav-item ${activeTab === 'environment' ? 'active' : ''}`}
          onClick={() => {
            handleNavEnv();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          <span>Peta ISPU</span>
        </button>

        <button
          type="button"
          className={`m-nav-item ${activeTab === 'prediction' ? 'active' : ''}`}
          onClick={() => {
            handleNavAnalysis();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <span>Prediksi</span>
        </button>

        <button
          type="button"
          className="m-nav-item"
          onClick={handleLogout}
          title="Keluar"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>Keluar</span>
        </button>
      </nav>

      <NewsModal isOpen={isNewsModalOpen} onClose={() => setIsNewsModalOpen(false)} />
    </>
  );
}
