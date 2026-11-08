const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
const particleCount = 32;

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

const BACKEND_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
  ? 'http://localhost:5000'
  : (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:5000');

const heightInput = document.getElementById('heightCm');
const weightInput = document.getElementById('weightKg');
const heightWarnEl = document.getElementById('heightWarn');
const weightWarnEl = document.getElementById('weightWarn');
const bmiScoreEl = document.getElementById('bmiScore');
const bmiTagEl = document.getElementById('bmiTag');
const bmiNoteEl = document.getElementById('bmiNote');
const liveOrValueEl = document.getElementById('liveOrValue');
const orStatusPillEl = document.getElementById('orStatusPill');

const genderRadios = document.querySelectorAll('input[name="gender"]');
const kidneyCheckbox = document.getElementById('hasKidneyDisease');
const liverCheckbox = document.getElementById('hasLiverDisease');
const smokerCheckbox = document.getElementById('isSmoker');
const assessmentForm = document.getElementById('assessmentForm');

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 220;
const MIN_WEIGHT = 30;
const MAX_WEIGHT = 180;

function calculateBMI(weight, height) {
  if (!weight || !height) return 0;
  const hMeter = height / 100;
  return parseFloat((weight / (hMeter * hMeter)).toFixed(2));
}

function validateMeasures() {
  let valid = true;
  const h = parseFloat(heightInput.value);
  const w = parseFloat(weightInput.value);

  if (isNaN(h) || h < MIN_HEIGHT || h > MAX_HEIGHT) {
    heightWarnEl.textContent = `Rentang normal tinggi: ${MIN_HEIGHT} - ${MAX_HEIGHT} cm.`;
    valid = false;
  } else {
    heightWarnEl.textContent = '';
  }

  if (isNaN(w) || w < MIN_WEIGHT || w > MAX_WEIGHT) {
    weightWarnEl.textContent = `Rentang normal berat: ${MIN_WEIGHT} - ${MAX_WEIGHT} kg.`;
    valid = false;
  } else {
    weightWarnEl.textContent = '';
  }

  return valid;
}

function updateOddsRatio() {
  const isValid = validateMeasures();

  const height = parseFloat(heightInput.value) || 170;
  const weight = parseFloat(weightInput.value) || 60;
  const bmi = calculateBMI(weight, height);

  let selectedGender = 'female';
  genderRadios.forEach(r => {
    if (r.checked) selectedGender = r.value;
  });

  const hasKidney = kidneyCheckbox.checked;
  const hasLiver = liverCheckbox.checked;
  const isSmoker = smokerCheckbox.checked;

  bmiScoreEl.textContent = bmi.toFixed(2);

  let isUnderweight = false;
  if (bmi < 18.5) {
    isUnderweight = true;
    bmiTagEl.textContent = 'Underweight (Kurang)';
    bmiTagEl.classList.add('warn');
    bmiNoteEl.textContent = 'Gizi kurang meningkatkan kerentanan ISPA (OR 2.14).';
  } else if (bmi < 25.0) {
    bmiTagEl.textContent = 'Normal (Gizi Baik)';
    bmiTagEl.classList.remove('warn');
    bmiNoteEl.textContent = 'Berat badan ideal mendukung daya tahan tubuh.';
  } else if (bmi < 30.0) {
    bmiTagEl.textContent = 'Kelebihan Berat Badan';
    bmiTagEl.classList.remove('warn');
    bmiNoteEl.textContent = 'Tetap jaga kebugaran dan sirkulasi pernapasan.';
  } else {
    bmiTagEl.textContent = 'Obesitas';
    bmiTagEl.classList.add('warn');
    bmiNoteEl.textContent = 'Perhatikan kapasitas ventilasi paru saat istirahat.';
  }

  let or = 1.0;
  if (isUnderweight) or *= 2.14;
  if (selectedGender === 'male') or *= 1.30;
  if (hasKidney) or *= 1.47;
  if (hasLiver) or *= 1.30;
  if (isSmoker) or *= 1.25;

  const finalOr = parseFloat(or.toFixed(2));
  liveOrValueEl.textContent = `${finalOr.toFixed(2)}x`;

  if (finalOr <= 1.0) {
    orStatusPillEl.textContent = 'Risiko Dasar';
    orStatusPillEl.style.background = '#d6f93b';
    orStatusPillEl.style.color = '#0c0d12';
  } else if (finalOr <= 2.0) {
    orStatusPillEl.textContent = 'Risiko Sedang';
    orStatusPillEl.style.background = '#fef08a';
    orStatusPillEl.style.color = '#713f12';
  } else {
    orStatusPillEl.textContent = 'Kerentanan Tinggi';
    orStatusPillEl.style.background = '#fecaca';
    orStatusPillEl.style.color = '#991b1b';
  }

  return { bmi, gender: selectedGender, hasKidney, hasLiver, isSmoker, or: finalOr, isValid };
}

function loadStoredProfile() {
  const userRaw = sessionStorage.getItem('respira_user');
  if (!userRaw) return;
  try {
    const user = JSON.parse(userRaw);
    if (!user.internalFactors) return;

    const { heightCm, weightKg, gender, hasKidneyDisease, hasLiverDisease, isSmoker } = user.internalFactors;

    if (heightCm) heightInput.value = heightCm;
    if (weightKg) weightInput.value = weightKg;

    if (gender) {
      genderRadios.forEach(r => {
        r.checked = (r.value === gender);
      });
    }

    if (typeof hasKidneyDisease === 'boolean') {
      kidneyCheckbox.checked = hasKidneyDisease;
    }
    if (typeof hasLiverDisease === 'boolean') {
      liverCheckbox.checked = hasLiverDisease;
    }
    if (typeof isSmoker === 'boolean') {
      smokerCheckbox.checked = isSmoker;
    }
  } catch (err) {
    console.warn('Gagal memuat profil tersimpan:', err);
  }
}

[heightInput, weightInput].forEach(inp => {
  inp.addEventListener('input', updateOddsRatio);
  inp.addEventListener('blur', () => {
    let val = parseFloat(inp.value);
    if (inp === heightInput) {
      if (val < MIN_HEIGHT) inp.value = MIN_HEIGHT;
      if (val > MAX_HEIGHT) inp.value = MAX_HEIGHT;
    } else {
      if (val < MIN_WEIGHT) inp.value = MIN_WEIGHT;
      if (val > MAX_WEIGHT) inp.value = MAX_WEIGHT;
    }
    updateOddsRatio();
  });
});

genderRadios.forEach(r => r.addEventListener('change', updateOddsRatio));
[kidneyCheckbox, liverCheckbox, smokerCheckbox].forEach(chk => chk.addEventListener('change', updateOddsRatio));

loadStoredProfile();
updateOddsRatio();

assessmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const assessmentData = updateOddsRatio();

  if (!assessmentData.isValid) {
    return;
  }

  const submitBtn = document.getElementById('submitAssessmentBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan & Menghitung...';
  }

  const userRaw = sessionStorage.getItem('respira_user');
  let user = {};
  if (userRaw) {
    try { user = JSON.parse(userRaw); } catch (err) { console.warn(err); }
  }

  const userId = user.id || user.userId;
  const fullName = user.fullName || '';
  const heightCm = parseFloat(heightInput.value);
  const weightKg = parseFloat(weightInput.value);

  user.internalFactors = {
    heightCm,
    weightKg,
    bmi: assessmentData.bmi,
    gender: assessmentData.gender,
    hasKidneyDisease: assessmentData.hasKidney,
    hasLiverDisease: assessmentData.hasLiver,
    isSmoker: assessmentData.isSmoker,
    oddsRatio: assessmentData.or
  };

  sessionStorage.setItem('respira_user', JSON.stringify(user));

  if (userId) {
    try {
      await fetch(`${BACKEND_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          fullName,
          gender: assessmentData.gender,
          weightKg,
          heightCm,
          hasKidneyDisease: assessmentData.hasKidney,
          hasLiverDisease: assessmentData.hasLiver,
          isSmoker: assessmentData.isSmoker
        })
      });
    } catch (err) {
      console.warn('Gagal sinkronisasi profil ke server:', err);
    }
  }

  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 400);
});