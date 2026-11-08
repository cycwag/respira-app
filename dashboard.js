const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
const particleCount = 36;

const colors = [
  'rgba(92, 74, 228, 0.45)',
  'rgba(56, 189, 248, 0.4)',
  'rgba(168, 85, 247, 0.35)',
  'rgba(214, 249, 59, 0.3)'
];

function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}

class Particle {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = Math.random() * width;
    this.y = initial ? Math.random() * height : height + 10;
    this.radius = Math.random() * 2.8 + 1.2;
    this.speedY = Math.random() * 0.4 + 0.2;
    this.speedX = (Math.random() - 0.5) * 0.25;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.wobbleSpeed = Math.random() * 0.02 + 0.005;
    this.wobbleAngle = Math.random() * Math.PI * 2;
  }

  update() {
    this.y -= this.speedY;
    this.wobbleAngle += this.wobbleSpeed;
    this.x += Math.sin(this.wobbleAngle) * 0.5 + this.speedX;

    if (this.y < -20 || this.x < -20 || this.x > width + 20) {
      this.reset(false);
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

function initParticles() {
  resizeCanvas();
  particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
}

function animate() {
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();
  }
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resizeCanvas);
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  initParticles();
  animate();
} else {
  resizeCanvas();
}

// User data sync & Backend Integration
const BACKEND_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
  ? 'http://localhost:5000'
  : (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:5000');

function getAuthHeaders() {
  const token = currentUser?.session?.access_token;
  if (token && typeof token === 'string') {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '#';
}

function sanitizeImg(src) {
  if (typeof src !== 'string') return 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&q=80';
  const trimmed = src.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;
  return 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&q=80';
}

let userOddsRatio = 2.78;
let backendAssessmentData = null;

const userRaw = sessionStorage.getItem('respira_user');
let currentUser = {
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
};

if (userRaw) {
  try {
    const parsed = JSON.parse(userRaw);
    currentUser = { ...currentUser, ...parsed };
    if (parsed.internalFactors) {
      currentUser.internalFactors = parsed.internalFactors;
    }
  } catch (e) {
    console.warn('Gagal membaca data session user:', e);
  }
}

const displayName = currentUser.fullName || currentUser.identifier?.split('@')[0] || 'Bagas Aditya';
document.getElementById('greetingUser').textContent = `${displayName}!`;
document.getElementById('sideUserName').textContent = displayName;

const statusTag = document.getElementById('backendStatusTag');

async function syncWithBackendAPI() {
  if (statusTag) {
    statusTag.textContent = '● Menghubungkan API...';
    statusTag.style.color = '#f59e0b';
  }

  try {
    const validUserId = (currentUser.id && currentUser.id !== 'anon-user') ? currentUser.id : (currentUser.userId || null);

    // Ambil profil dari Supabase jika ada validUserId namun internal factors belum lengkap di session
    if (validUserId && (!currentUser.internalFactors || !currentUser.internalFactors.weightKg)) {
      try {
        const profRes = await fetch(`${BACKEND_BASE_URL}/api/profile/${validUserId}`, {
          headers: { ...getAuthHeaders() }
        });
        if (profRes.ok) {
          const profData = await profRes.json();
          if (profData && (profData.weight_kg || profData.height_cm)) {
            currentUser.internalFactors = {
              gender: profData.gender || 'female',
              weightKg: profData.weight_kg,
              heightCm: profData.height_cm,
              bmi: profData.bmi,
              hasKidneyDisease: Boolean(profData.has_kidney_disease),
              hasLiverDisease: Boolean(profData.has_liver_disease),
              isSmoker: Boolean(profData.is_smoker)
            };
            sessionStorage.setItem('respira_user', JSON.stringify(currentUser));
          }
        }
      } catch (pErr) {
        // fallback profile fetching ignored
      }
    }

    const payload = {
      userId: validUserId,
      internalFactors: currentUser.internalFactors || {}
    };

    const res = await fetch(`${BACKEND_BASE_URL}/api/assess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    backendAssessmentData = data;

    if (statusTag) {
      statusTag.textContent = '● API Terhubung (Live)';
      statusTag.style.color = '#10b981';
    }

    renderAssessmentResults(data);
  } catch (err) {
    console.warn('Backend API offline / tidak merespon, beralih ke mode lokal:', err.message);
    if (statusTag) {
      statusTag.textContent = '● Mode Lokal (Offline)';
      statusTag.style.color = '#94a3b8';
    }
    renderLocalFallback();
  }
}

function renderAssessmentResults(data) {
  const env = data.environmentalData || {};
  const risks = data.riskPercentages || {};

  // Update hero risk
  const overallRisk = risks.overall ?? Math.round((risks.j00 + risks.j02 + risks.j06) / 3);
  document.getElementById('overallRiskValue').textContent = `${overallRisk}%`;

  // Update strip cuaca & PM2.5
  if (env.pm25 !== undefined) document.getElementById('livePm25').textContent = `${env.pm25} µg/m³`;
  if (env.temperature !== undefined) document.getElementById('liveTemp').textContent = `${env.temperature}°C`;
  if (env.humidity !== undefined) document.getElementById('liveHumidity').textContent = `${env.humidity}%`;
  if (env.rainfall !== undefined) document.getElementById('liveRain').textContent = `${env.rainfall} mm`;

  // Update prediction bars
  if (risks.j06 !== undefined) {
    document.getElementById('barLabelJ06').textContent = `${risks.j06}%`;
    document.getElementById('barFillJ06').style.width = `${risks.j06}%`;
  }
  if (risks.j00 !== undefined) {
    document.getElementById('barLabelJ00').textContent = `${risks.j00}%`;
    document.getElementById('barFillJ00').style.width = `${risks.j00}%`;
  }
  if (risks.j02 !== undefined) {
    document.getElementById('barLabelJ02').textContent = `${risks.j02}%`;
    document.getElementById('barFillJ02').style.width = `${risks.j02}%`;
  }

  // Update detail elements
  const pm25El = document.getElementById('detailPm25');
  if (pm25El && env.pm25 !== undefined) pm25El.textContent = `${env.pm25} µg/m³`;

  const prevCasesEl = document.getElementById('detailPrevCases');
  if (prevCasesEl && env.prevCases !== undefined) prevCasesEl.textContent = `${env.prevCases} Kasus`;

  const j06El = document.getElementById('detailJ06');
  if (j06El && risks.j06 !== undefined) j06El.textContent = `${risks.j06}% (Prediksi Dominan)`;

  const j00El = document.getElementById('detailJ00');
  if (j00El && risks.j00 !== undefined) j00El.textContent = `${risks.j00}%`;

  const j02El = document.getElementById('detailJ02');
  if (j02El && risks.j02 !== undefined) j02El.textContent = `${risks.j02}%`;

  const riskLevelEl = document.getElementById('detailRiskLevel');
  if (riskLevelEl && data.riskLevel) riskLevelEl.textContent = data.riskLevel;

  // Update OR
  if (data.oddsRatio) {
    userOddsRatio = data.oddsRatio;
    const orEl = document.getElementById('detailOrScore');
    if (orEl) orEl.textContent = `${data.oddsRatio.toFixed(2)}x`;
  }

  // Update advice
  const adviceTextEl = document.getElementById('adviceText');
  if (adviceTextEl && Array.isArray(data.preventiveAdvice) && data.preventiveAdvice.length > 0) {
    adviceTextEl.textContent = data.preventiveAdvice[0];
  }
}

function renderLocalFallback() {
  const or = currentUser.internalFactors?.oddsRatio || 1.30;
  userOddsRatio = or;
  const validOR = Math.max(1.0, parseFloat(or) || 1.0);
  const normalizedInternal = Math.min(1.0, Math.max(0.0, (validOR - 1.0) / 4.0));
  const j06Cases = 64;
  const normCase = Math.min(1.0, Math.max(0.05, j06Cases / 150));
  const calculatedRisk = Math.min(99, Math.max(1, Math.round((normCase * 0.6 + normalizedInternal * 0.4) * 100)));

  const overallEl = document.getElementById('overallRiskValue');
  if (overallEl) overallEl.textContent = `${calculatedRisk}%`;
  const orEl = document.getElementById('detailOrScore');
  if (orEl) orEl.textContent = `${or.toFixed(2)}x`;
}

// Initial Sync
syncWithBackendAPI();

// Greeting time
const hour = new Date().getHours();
let greetingText = 'Selamat Pagi,';
if (hour >= 11 && hour < 15) greetingText = 'Selamat Siang,';
else if (hour >= 15 && hour < 18) greetingText = 'Selamat Sore,';
else if (hour >= 18 || hour < 4) greetingText = 'Selamat Malam,';
document.getElementById('greetingTime').textContent = greetingText;

// Interactive detail pane content
const cardPolutan = document.getElementById('cardPolutan');
const cardPenyakit = document.getElementById('cardPenyakit');
const detailPaneTitle = document.getElementById('detailPaneTitle');
const detailBadge = document.getElementById('detailBadge');
const breakdownPolutan = document.getElementById('breakdownPolutan');
const breakdownPenyakit = document.getElementById('breakdownPenyakit');

cardPolutan.addEventListener('click', () => {
  cardPolutan.classList.add('active-selection');
  cardPenyakit.classList.remove('active-selection');

  detailPaneTitle.textContent = 'Analisis Faktor Polutan';
  detailBadge.textContent = 'Eksternal';

  if (breakdownPolutan && breakdownPenyakit) {
    breakdownPolutan.style.display = 'flex';
    breakdownPenyakit.style.display = 'none';
  }

  const env = backendAssessmentData?.environmentalData || {};
  const pm25Val = env.pm25 !== undefined ? `${env.pm25} µg/m³` : '42.8 µg/m³';
  const prevVal = env.prevCases !== undefined ? `${env.prevCases} Kasus` : '2.412 Kasus';

  const pm25El = document.getElementById('detailPm25');
  if (pm25El) pm25El.textContent = pm25Val;

  const prevCasesEl = document.getElementById('detailPrevCases');
  if (prevCasesEl) prevCasesEl.textContent = prevVal;

  const orEl = document.getElementById('detailOrScore');
  if (orEl) orEl.textContent = `${userOddsRatio.toFixed(2)}x`;
});

cardPenyakit.addEventListener('click', () => {
  cardPenyakit.classList.add('active-selection');
  cardPolutan.classList.remove('active-selection');

  detailPaneTitle.textContent = 'Rincian Luaran Penyakit';
  detailBadge.textContent = 'Klinis';

  if (breakdownPolutan && breakdownPenyakit) {
    breakdownPolutan.style.display = 'none';
    breakdownPenyakit.style.display = 'flex';
  }

  const risks = backendAssessmentData?.riskPercentages || {};
  const j06Val = risks.j06 !== undefined ? `${risks.j06}%` : '38%';
  const j00Val = risks.j00 !== undefined ? `${risks.j00}%` : '28%';
  const j02Val = risks.j02 !== undefined ? `${risks.j02}%` : '24%';
  const riskLevel = backendAssessmentData?.riskLevel || 'Sedang - Waspada';

  const j06El = document.getElementById('detailJ06');
  if (j06El) j06El.textContent = `${j06Val} (Prediksi Dominan)`;

  const j00El = document.getElementById('detailJ00');
  if (j00El) j00El.textContent = j00Val;

  const j02El = document.getElementById('detailJ02');
  if (j02El) j02El.textContent = j02Val;

  const riskLevelEl = document.getElementById('detailRiskLevel');
  if (riskLevelEl) riskLevelEl.textContent = riskLevel;
});

// Tab Daily vs Tips filter
const tabDaily = document.getElementById('tabDaily');
const tabTips = document.getElementById('tabTips');
const dailyFeed = document.getElementById('dailyFeedContainer');
const tipsFeed = document.getElementById('tipsFeedContainer');

tabDaily.addEventListener('click', () => {
  tabDaily.classList.add('active');
  tabTips.classList.remove('active');
  dailyFeed.style.display = 'flex';
  tipsFeed.style.display = 'none';
  cardPolutan.click();
});

tabTips.addEventListener('click', () => {
  tabTips.classList.add('active');
  tabDaily.classList.remove('active');
  dailyFeed.style.display = 'none';
  tipsFeed.style.display = 'flex';
  
  const firstTip = document.querySelector('.interactive-tip-card[data-tip="masker"]');
  if (firstTip) firstTip.click();
});

// Tip Cards interactive click -> updates Detail Pane (Pane 3)
const tipDetailsMap = {
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

const tipCards = document.querySelectorAll('.interactive-tip-card');
tipCards.forEach(card => {
  card.addEventListener('click', () => {
    tipCards.forEach(c => c.classList.remove('active-tip'));
    card.classList.add('active-tip');

    const key = card.getAttribute('data-tip');
    const data = tipDetailsMap[key];
    if (!data) return;

    detailPaneTitle.textContent = data.title;
    detailBadge.textContent = data.badge;

    detailRows.innerHTML = data.rows.map(r => `
      <div class="data-row">
        <span>${r.k}</span>
        <strong>${r.v}</strong>
      </div>
    `).join('');

    const adviceTextEl = document.getElementById('adviceText');
    if (adviceTextEl) {
      adviceTextEl.textContent = data.advice;
    }
  });
});

// Sidebar & Banner Action Handlers
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('respira_user');
  });
}

const navAnalysis = document.getElementById('navAnalysis');
if (navAnalysis) {
  navAnalysis.addEventListener('click', (e) => {
    e.preventDefault();
    tabDaily.click();
    cardPenyakit.click();
    const mlWidget = document.querySelector('.ml-prediction-widget');
    if (mlWidget) {
      mlWidget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mlWidget.style.outline = '2px solid var(--color-primary)';
      setTimeout(() => { mlWidget.style.outline = 'none'; }, 1500);
    }
  });
}

const navEnv = document.getElementById('navEnv');
if (navEnv) {
  navEnv.addEventListener('click', (e) => {
    e.preventDefault();
    tabDaily.click();
    cardPolutan.click();
    const envStrip = document.querySelector('.env-data-strip');
    if (envStrip) {
      envStrip.scrollIntoView({ behavior: 'smooth', block: 'center' });
      envStrip.style.outline = '2px solid var(--color-primary)';
      setTimeout(() => { envStrip.style.outline = 'none'; }, 1500);
    }
  });
}

// =========================================================
// NEWS MODAL & READER VIEW CONTROLLER
// =========================================================
const newsPill = document.getElementById('newsPill');
const newsModal = document.getElementById('newsModal');
const newsModalContainer = document.getElementById('newsModalContainer');
const newsModalBody = document.getElementById('newsModalBody');
const newsModalHeading = document.getElementById('newsModalHeading');
const closeNewsModalBtn = document.getElementById('closeNewsModalBtn');

let cachedArticlesList = [];

function openNewsModal() {
  if (!newsModal) return;
  newsModal.style.display = 'flex';
  loadNewsArticles();
}

function closeNewsModal() {
  if (!newsModal) return;
  newsModal.style.display = 'none';
}

if (newsPill) {
  newsPill.addEventListener('click', openNewsModal);
}

if (closeNewsModalBtn) {
  closeNewsModalBtn.addEventListener('click', closeNewsModal);
}

if (newsModal) {
  newsModal.addEventListener('click', (e) => {
    if (e.target === newsModal) closeNewsModal();
  });
}

async function loadNewsArticles() {
  newsModalHeading.textContent = 'Berita Terkini Mengenai ISPA & Kualitas Udara';
  newsModalBody.innerHTML = `
    <div class="news-loading-state">
      <div class="spinner-dots"></div>
      <span>Mengambil kurasi berita ISPA terkini...</span>
    </div>
  `;

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/news?limit=8`);
    const data = await res.json();
    cachedArticlesList = data.articles || [];
    renderNewsList(cachedArticlesList);
  } catch (err) {
    newsModalBody.innerHTML = `
      <div class="news-loading-state">
        <p style="color: #ef4444;">Gagal memuat berita terkini. Periksa koneksi backend.</p>
      </div>
    `;
  }
}

function renderNewsList(articles) {
  newsModalHeading.textContent = 'Berita Terkini Mengenai ISPA & Kualitas Udara';
  if (!articles || articles.length === 0) {
    newsModalBody.innerHTML = '<p style="text-align: center; color: #64748b; padding: 24px;">Belum ada berita yang tersedia saat ini.</p>';
    return;
  }

  const gridHtml = `
    <div class="news-cards-grid">
      ${articles.map(art => `
        <div class="news-card-item" data-url="${escapeHtml(art.url)}">
          <div class="news-thumb-wrap">
            <img src="${sanitizeImg(art.thumbnail)}" alt="${escapeHtml(art.title)}" class="news-card-thumb" onerror="this.src='https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&q=80'" />
            <span class="news-source-tag">${escapeHtml(art.source)}</span>
          </div>
          <div class="news-card-content">
            <h4 class="news-card-title">${escapeHtml(art.title)}</h4>
            <p class="news-card-desc">${escapeHtml(art.description)}</p>
            <div class="news-card-footer">
              <span class="news-date-text">${escapeHtml(art.date)}</span>
              <span class="news-read-cta">Baca →</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  newsModalBody.innerHTML = gridHtml;

  document.querySelectorAll('.news-card-item').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-url');
      const item = cachedArticlesList.find(a => a.url === url);
      openReaderView(url, item);
    });
  });
}

async function openReaderView(url, fallbackItem) {
  newsModalHeading.textContent = 'Reader View';
  if (newsModalBody) newsModalBody.scrollTop = 0;
  newsModalBody.innerHTML = `
    <div class="news-loading-state">
      <div class="spinner-dots"></div>
      <span>Memuat isi lengkap artikel...</span>
    </div>
  `;

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/news/detail?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    const article = data.article || fallbackItem;
    // Jaga konsistensi gambar agar tidak berganti mendadak
    if (fallbackItem && fallbackItem.thumbnail) {
      article.thumbnail = fallbackItem.thumbnail;
    }
    renderReaderView(article);
  } catch (err) {
    console.warn('Gagal load detail, pakai fallback list item:', err);
    renderReaderView(fallbackItem);
  }
}

function renderReaderView(article) {
  if (!article) return;
  if (newsModalBody) newsModalBody.scrollTop = 0;
  const paragraphs = article.paragraphs && article.paragraphs.length > 0
    ? article.paragraphs.map(p => `<p class="reader-p">${escapeHtml(p)}</p>`).join('')
    : `<p class="reader-p">${escapeHtml(article.description || 'Klik tombol di bawah untuk membaca artikel selengkapnya di portal sumber asli.')}</p>`;

  newsModalBody.innerHTML = `
    <div class="article-reader-view">
      <button type="button" class="btn-back-to-list" id="backToNewsListBtn">
        ← Kembali ke Daftar Berita
      </button>

      <h2 class="reader-title">${escapeHtml(article.title)}</h2>

      <div class="reader-meta-bar">
        <span class="meta-item">Penulis: <strong>${escapeHtml(article.author || 'Redaksi Kesehatan')}</strong></span>
        <span class="meta-separator">•</span>
        <span class="meta-item">📅 ${escapeHtml(article.date || 'Terbaru')}</span>
      </div>

      ${article.thumbnail ? `
        <div class="reader-image-wrap">
          <img src="${sanitizeImg(article.thumbnail)}" alt="${escapeHtml(article.title)}" class="reader-cover-img" onerror="this.src='https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=800&q=80'" />
        </div>
      ` : ''}

      <div class="reader-paragraphs">
        ${paragraphs}
      </div>

      <div class="reader-footer-actions">
        <a href="${sanitizeUrl(article.url)}" target="_blank" rel="noopener noreferrer" class="btn-open-original">
          <span>Buka di Sumber Asli ↗</span>
        </a>
      </div>
    </div>
  `;
          <span>Buka di Sumber Asli ↗</span>
        </a>
      </div>
    </div>
  `;

  document.getElementById('backToNewsListBtn').addEventListener('click', () => {
    renderNewsList(cachedArticlesList);
  });
}