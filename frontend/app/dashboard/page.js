'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ParticleCanvas from '@/components/ParticleCanvas';
import NewsModal from '@/components/NewsModal';
import { assessRisk, getProfile } from '@/lib/api';

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
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'tips'
  const [activeCard, setActiveCard] = useState('polutan'); // 'polutan' | 'penyakit'
  const [selectedTip, setSelectedTip] = useState('masker');
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

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
        const validOR = Math.max(1.0, parseFloat(or) || 1.0);
        const normalizedInternal = Math.min(1.0, Math.max(0.0, (validOR - 1.0) / 4.0));
        const j06Cases = 64;
        const normCase = Math.min(1.0, Math.max(0.05, j06Cases / 150));
        const calculatedRisk = Math.min(99, Math.max(1, Math.round((normCase * 0.6 + normalizedInternal * 0.4) * 100)));

        setAssessmentData({
          oddsRatio: or,
          environmentalData: { pm25: 42.8, temperature: 29.4, humidity: 78, rainfall: 8.2, prevCases: 2412 },
          riskPercentages: { overall: calculatedRisk, j06: 38, j00: 28, j02: 24 },
          riskLevel: 'Sedang - Waspada',
          preventiveAdvice: ['Gunakan masker saat berkendara atau beraktivitas luar ruangan karena partikel PM2.5 sedang tinggi.']
        });
      }
    }

    loadData();
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
  const riskLevel = assessmentData?.riskLevel || 'Sedang - Waspada';
  const orVal = assessmentData?.oddsRatio ? assessmentData.oddsRatio.toFixed(2) : '1.30';

  const defaultAdvice = (assessmentData?.preventiveAdvice && assessmentData.preventiveAdvice[0]) ||
    'Gunakan masker saat berkendara atau beraktivitas luar ruangan karena partikel PM2.5 sedang tinggi.';

  // Determine Pane 3 contents based on active Tab and Selection
  let detailTitle = 'Analisis Faktor Polutan';
  let detailBadge = 'Eksternal';
  let detailRows = [];
  let currentAdvice = defaultAdvice;

  if (activeTab === 'tips') {
    const tipData = TIP_DETAILS_MAP[selectedTip] || TIP_DETAILS_MAP.masker;
    detailTitle = tipData.title;
    detailBadge = tipData.badge;
    detailRows = tipData.rows;
    currentAdvice = tipData.advice;
  } else if (activeCard === 'penyakit') {
    detailTitle = 'Rincian Luaran Penyakit';
    detailBadge = 'Klinis';
    detailRows = [
      { k: 'J06 (Multiple/Unspecified)', v: `${j06Val}% (Prediksi Dominan)` },
      { k: 'J00 (Nasopharyngitis Akut)', v: `${j00Val}%` },
      { k: 'J02 (Pharyngitis Akut)', v: `${j02Val}%` },
      { k: 'Kategori Tingkat Risiko', v: riskLevel }
    ];
  } else {
    // polutan
    detailTitle = 'Analisis Faktor Polutan';
    detailBadge = 'Eksternal';
    detailRows = [
      { k: 'Konsentrasi PM2.5 (Live)', v: pm25Val },
      { k: 'Skor Odds Ratio Personal', v: `${orVal}x` },
      { k: 'Bobot Eksternal vs Internal', v: '60% / 40%' },
      { k: 'Riwayat Kasus Minggu Lalu', v: prevCasesVal }
    ];
  }

  const handleNavAnalysis = (e) => {
    e.preventDefault();
    setActiveTab('daily');
    setActiveCard('penyakit');
    if (mlWidgetRef.current) {
      mlWidgetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mlWidgetRef.current.style.outline = '2px solid var(--color-primary)';
      setTimeout(() => {
        if (mlWidgetRef.current) mlWidgetRef.current.style.outline = 'none';
      }, 1500);
    }
  };

  const handleNavEnv = (e) => {
    e.preventDefault();
    setActiveTab('daily');
    setActiveCard('polutan');
    if (envStripRef.current) {
      envStripRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      envStripRef.current.style.outline = '2px solid var(--color-primary)';
      setTimeout(() => {
        if (envStripRef.current) envStripRef.current.style.outline = 'none';
      }, 1500);
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
                <span className="brand-tag">ML SYSTEM</span>
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

                <button type="button" className="nav-item" onClick={handleNavAnalysis}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                  <span>Prediksi J00-J06</span>
                </button>

                <button type="button" className="nav-item" onClick={handleNavEnv}>
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
              <button type="button" className="bell-action-btn" aria-label="Notifikasi">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
              </button>
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
                  className={`chip ${activeTab === 'tips' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('tips');
                    setSelectedTip('masker');
                  }}
                >
                  Tips
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
                    <div className="mini-rank">1. Polutan</div>
                    <div className="mini-stat">70%</div>
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
                    <div className="mini-rank">1. Influenza</div>
                    <div className="mini-stat">30%</div>
                    <div className="mini-hint">*Klik untuk lihat detail di panel</div>
                  </div>
                </div>

                {/* OVERVIEW STATISTICS */}
                <section className="section-group">
                  <h2 className="group-title">Overview Statistics</h2>
                  <div className="overview-stats-row">
                    <div className="stat-soft-box">
                      <span className="stat-box-title">Persentase anda naik</span>
                      <span className="stat-box-val val-violet">1,5%</span>
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

            {/* TAB 2: TIPS FEED */}
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

            <div
              className="feedback-capsule-btn"
              onClick={() => alert('Terima kasih atas partisipasi Anda dalam evaluasi RESPIRA!')}
            >
              <span>Berikan penilaian untuk aplikasi kami!</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#fbbf24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
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
                  <h3 className="meta-heading">Status Terlindungi</h3>
                  <p className="meta-desc">Indeks paparan lingkungan dalam ambang batas terkontrol.</p>
                </div>
              </div>

              {/* DYNAMIC DETAIL CARD */}
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

              {/* ML PREDICTION BREAKDOWN: J00, J02, J06 */}
              <div className="ml-prediction-widget" ref={mlWidgetRef}>
                <div className="widget-head">
                  <h4>Prediksi Sub-Kategori ISPA (ML)</h4>
                </div>

                <div className="progress-bar-group">
                  <div className="bar-header">
                    <span>J06 (Multiple / Unspecified)</span>
                    <strong>{j06Val}%</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill fill-violet" style={{ width: `${j06Val}%` }}></div>
                  </div>
                </div>

                <div className="progress-bar-group">
                  <div className="bar-header">
                    <span>J00 (Nasopharyngitis Akut)</span>
                    <strong>{j00Val}%</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill fill-cyan" style={{ width: `${j00Val}%` }}></div>
                  </div>
                </div>

                <div className="progress-bar-group">
                  <div className="bar-header">
                    <span>J02 (Pharyngitis Akut)</span>
                    <strong>{j02Val}%</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill fill-indigo" style={{ width: `${j02Val}%` }}></div>
                  </div>
                </div>
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

      <NewsModal isOpen={isNewsModalOpen} onClose={() => setIsNewsModalOpen(false)} />
    </>
  );
}
