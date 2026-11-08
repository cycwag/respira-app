const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
const particleCount = 42;

const colors = [
  'rgba(92, 74, 228, 0.45)',
  'rgba(56, 189, 248, 0.4)',
  'rgba(168, 85, 247, 0.35)',
  'rgba(214, 249, 59, 0.3)',
  'rgba(148, 163, 184, 0.35)'
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
    this.radius = Math.random() * 3 + 1.2;
    this.speedY = Math.random() * 0.45 + 0.2;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.alpha = Math.random() * 0.5 + 0.25;
    this.pulseSpeed = Math.random() * 0.02 + 0.01;
    this.pulseAngle = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.02 + 0.005;
    this.wobbleAngle = Math.random() * Math.PI * 2;
  }

  update() {
    this.y -= this.speedY;
    this.wobbleAngle += this.wobbleSpeed;
    this.x += Math.sin(this.wobbleAngle) * 0.5 + this.speedX;

    this.pulseAngle += this.pulseSpeed;
    this.currentAlpha = this.alpha + Math.sin(this.pulseAngle) * 0.15;

    if (this.y < -20 || this.x < -20 || this.x > width + 20) {
      this.reset(false);
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = this.radius * 2.5;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.shadowBlur = 0;
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

const authCard = document.getElementById('authCard');
const toRegisterBtn = document.getElementById('toRegisterBtn');
const toLoginBtn = document.getElementById('toLoginBtn');

const visualTitle = document.getElementById('visualTitle');
const visualDesc = document.getElementById('visualDesc');
const welcomeText = document.getElementById('welcomeText');

function setAuthMode(mode, immediate = false) {
  if (immediate) {
    if (mode === 'register') {
      authCard.classList.add('is-register');
      visualTitle.textContent = 'Mulai Bersama';
      visualDesc.textContent = 'Daftarkan profil kesehatan Anda untuk estimasi risiko ISPA personal berbasis Machine Learning.';
    } else {
      authCard.classList.remove('is-register');
      visualTitle.textContent = 'Selamat Datang';
      visualDesc.textContent = 'Bernapas lebih tenang dengan sistem cerdas pemantauan risiko ISPA harian berbasis Machine Learning.';
    }
    return;
  }

  welcomeText.style.opacity = '0';
  if (mode === 'register') {
    authCard.classList.add('is-register');
    history.replaceState(null, '', '#register');
  } else {
    authCard.classList.remove('is-register');
    history.replaceState(null, '', '#login');
  }

  setTimeout(() => {
    if (mode === 'register') {
      visualTitle.textContent = 'Mulai Bersama';
      visualDesc.textContent = 'Daftarkan profil kesehatan Anda untuk estimasi risiko ISPA personal berbasis Machine Learning.';
    } else {
      visualTitle.textContent = 'Selamat Datang';
      visualDesc.textContent = 'Bernapas lebih tenang dengan sistem cerdas pemantauan risiko ISPA harian berbasis Machine Learning.';
    }
    welcomeText.style.opacity = '1';
  }, 220);
}

toRegisterBtn.addEventListener('click', () => setAuthMode('register'));
toLoginBtn.addEventListener('click', () => setAuthMode('login'));

if (window.location.hash === '#register' || window.location.pathname.endsWith('register.html')) {
  setAuthMode('register', true);
}

function setupPasswordToggle(inputEl, btnEl, iconEl) {
  btnEl.addEventListener('click', () => {
    const isPass = inputEl.getAttribute('type') === 'password';
    inputEl.setAttribute('type', isPass ? 'text' : 'password');
    if (isPass) {
      iconEl.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      iconEl.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });
}

setupPasswordToggle(
  document.getElementById('password'),
  document.getElementById('togglePassword'),
  document.getElementById('eyeIcon')
);

setupPasswordToggle(
  document.getElementById('regPassword'),
  document.getElementById('toggleRegPassword'),
  document.getElementById('eyeRegIcon')
);

const BACKEND_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
  ? 'http://localhost:5000'
  : (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:5000');

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const submitBtn = document.getElementById('submitBtn');

emailInput.addEventListener('input', () => { emailError.textContent = ''; });
passwordInput.addEventListener('input', () => { passwordError.textContent = ''; });

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let valid = true;
  if (!emailInput.value.trim()) {
    emailError.textContent = 'Email atau username wajib diisi.';
    valid = false;
  }
  if (!passwordInput.value) {
    passwordError.textContent = 'Kata sandi wajib diisi.';
    valid = false;
  } else if (passwordInput.value.length < 6) {
    passwordError.textContent = 'Kata sandi minimal 6 karakter.';
    valid = false;
  }

  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memverifikasi...';

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data.error || 'Gagal masuk. Periksa kembali kredensial Anda.';
      passwordError.textContent = message;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk ke Dashboard';
      return;
    }

    const internalFactors = data.user?.profile ? {
      gender: data.user.profile.gender,
      weightKg: data.user.profile.weightKg,
      heightCm: data.user.profile.heightCm,
      bmi: data.user.profile.bmi,
      hasKidneyDisease: data.user.profile.hasKidneyDisease,
      hasLiverDisease: data.user.profile.hasLiverDisease,
      isSmoker: data.user.profile.isSmoker
    } : null;

    sessionStorage.setItem('respira_user', JSON.stringify({
      id: data.user?.id,
      identifier: data.user?.email || emailInput.value.trim(),
      fullName: data.user?.fullName || '',
      session: data.session,
      ...(internalFactors ? { internalFactors } : {}),
      loggedInAt: new Date().toISOString()
    }));

    window.location.href = 'dashboard.html';
  } catch (err) {
    passwordError.textContent = 'Gagal menghubungi server backend. Pastikan server aktif di port 5000.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Masuk ke Dashboard';
  }
});

const regForm = document.getElementById('registerForm');
const regFullName = document.getElementById('regFullName');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regConfirmPassword = document.getElementById('regConfirmPassword');
const regFullNameError = document.getElementById('regFullNameError');
const regEmailError = document.getElementById('regEmailError');
const regPasswordError = document.getElementById('regPasswordError');
const regConfirmPasswordError = document.getElementById('regConfirmPasswordError');
const regSubmitBtn = document.getElementById('regSubmitBtn');

regFullName.addEventListener('input', () => { regFullNameError.textContent = ''; });
regEmail.addEventListener('input', () => { regEmailError.textContent = ''; });
regPassword.addEventListener('input', () => { regPasswordError.textContent = ''; });
regConfirmPassword.addEventListener('input', () => { regConfirmPasswordError.textContent = ''; });

regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let valid = true;

  if (!regFullName.value.trim()) {
    regFullNameError.textContent = 'Nama lengkap wajib diisi.';
    valid = false;
  }

  if (!regEmail.value.trim()) {
    regEmailError.textContent = 'Email wajib diisi.';
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value.trim())) {
    regEmailError.textContent = 'Format email tidak valid.';
    valid = false;
  }

  if (!regPassword.value) {
    regPasswordError.textContent = 'Kata sandi wajib diisi.';
    valid = false;
  } else if (regPassword.value.length < 6) {
    regPasswordError.textContent = 'Kata sandi minimal 6 karakter.';
    valid = false;
  }

  if (!regConfirmPassword.value) {
    regConfirmPasswordError.textContent = 'Konfirmasi sandi wajib diisi.';
    valid = false;
  } else if (regConfirmPassword.value !== regPassword.value) {
    regConfirmPasswordError.textContent = 'Konfirmasi sandi tidak cocok.';
    valid = false;
  }

  if (!valid) return;

  regSubmitBtn.disabled = true;
  regSubmitBtn.textContent = 'Mendaftarkan...';

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: regFullName.value.trim(),
        email: regEmail.value.trim(),
        password: regPassword.value
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data.error || 'Gagal mendaftar. Silakan coba lagi.';
      regEmailError.textContent = message;
      regSubmitBtn.disabled = false;
      regSubmitBtn.textContent = 'Daftar Akun Baru';
      return;
    }

    sessionStorage.setItem('respira_user', JSON.stringify({
      id: data.user?.id,
      fullName: data.user?.fullName || regFullName.value.trim(),
      identifier: data.user?.email || regEmail.value.trim(),
      isNewUser: true,
      session: data.session,
      registeredAt: new Date().toISOString()
    }));

    window.location.href = 'profile-assessment.html';
  } catch (err) {
    regEmailError.textContent = 'Gagal menghubungi server backend. Pastikan server aktif di port 5000.';
    regSubmitBtn.disabled = false;
    regSubmitBtn.textContent = 'Daftar Akun Baru';
  }
});