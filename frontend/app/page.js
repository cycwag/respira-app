'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ParticleCanvas from '@/components/ParticleCanvas';
import { loginUser, registerUser } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginErrors, setLoginErrors] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regErrors, setRegErrors] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [regLoading, setRegLoading] = useState(false);

  // Welcome panel text state with fade
  const [welcomeTextFade, setWelcomeTextFade] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#register') {
      setIsRegister(true);
    }
  }, []);

  const handleToggleMode = (mode) => {
    setWelcomeTextFade(false);
    setTimeout(() => {
      setIsRegister(mode === 'register');
      setWelcomeTextFade(true);
    }, 200);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const errors = { email: '', password: '' };
    let valid = true;

    if (!loginEmail.trim()) {
      errors.email = 'Email atau username wajib diisi.';
      valid = false;
    }
    if (!loginPassword) {
      errors.password = 'Kata sandi wajib diisi.';
      valid = false;
    } else if (loginPassword.length < 6) {
      errors.password = 'Kata sandi minimal 6 karakter.';
      valid = false;
    }

    setLoginErrors(errors);
    if (!valid) return;

    setLoginLoading(true);
    try {
      const data = await loginUser(loginEmail, loginPassword);

      const internalFactors = data.user?.profile ? {
        gender: data.user.profile.gender,
        weightKg: data.user.profile.weightKg,
        heightCm: data.user.profile.heightCm,
        bmi: data.user.profile.bmi,
        hasKidneyDisease: data.user.profile.hasKidneyDisease,
        hasLiverDisease: data.user.profile.hasLiverDisease,
        isSmoker: data.user.profile.isSmoker
      } : null;

      const userSession = {
        id: data.user?.id,
        identifier: data.user?.email || loginEmail.trim(),
        fullName: data.user?.fullName || '',
        session: data.session,
        ...(internalFactors ? { internalFactors } : {}),
        loggedInAt: new Date().toISOString()
      };

      sessionStorage.setItem('respira_user', JSON.stringify(userSession));
      if (rememberMe) {
        localStorage.setItem('respira_remembered_email', loginEmail.trim());
      }

      router.push('/dashboard');
    } catch (err) {
      setLoginErrors((prev) => ({
        ...prev,
        password: err.message || 'Gagal masuk. Periksa kembali kredensial Anda.'
      }));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const errors = { fullName: '', email: '', password: '', confirmPassword: '' };
    let valid = true;

    if (!regFullName.trim()) {
      errors.fullName = 'Nama lengkap wajib diisi.';
      valid = false;
    }
    if (!regEmail.trim()) {
      errors.email = 'Email wajib diisi.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      errors.email = 'Format email tidak valid.';
      valid = false;
    }
    if (!regPassword) {
      errors.password = 'Kata sandi wajib diisi.';
      valid = false;
    } else if (regPassword.length < 6) {
      errors.password = 'Kata sandi minimal 6 karakter.';
      valid = false;
    }
    if (!regConfirmPassword) {
      errors.confirmPassword = 'Konfirmasi sandi wajib diisi.';
      valid = false;
    } else if (regConfirmPassword !== regPassword) {
      errors.confirmPassword = 'Konfirmasi sandi tidak cocok.';
      valid = false;
    }

    setRegErrors(errors);
    if (!valid) return;

    setRegLoading(true);
    try {
      const data = await registerUser(regFullName, regEmail, regPassword);

      sessionStorage.setItem('respira_user', JSON.stringify({
        id: data.user?.id,
        fullName: data.user?.fullName || regFullName.trim(),
        identifier: data.user?.email || regEmail.trim(),
        isNewUser: true,
        session: data.session,
        registeredAt: new Date().toISOString()
      }));

      router.push('/assessment');
    } catch (err) {
      setRegErrors((prev) => ({
        ...prev,
        email: err.message || 'Gagal mendaftar. Silakan coba lagi.'
      }));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <>
      <ParticleCanvas particleCount={42} />

      <main className="page-container">
        <div className={`split-auth-card ${isRegister ? 'is-register' : ''}`} id="authCard">
          <div className="forms-wrapper">
            
            {/* LOGIN PANE */}
            <div className="form-pane pane-login">
              <div className="brand-header">
                <div className="brand-logo">RESPIRA</div>
              </div>

              <div className="form-title-group">
                <h1>Masuk Akun</h1>
                <p>Pantau estimasi risiko ISPA harian personal Anda berbasis Machine Learning.</p>
              </div>

              <form onSubmit={handleLoginSubmit} noValidate>
                <div className="input-field">
                  <label htmlFor="loginEmail">Email atau Username</label>
                  <div className="input-control">
                    <input
                      type="text"
                      id="loginEmail"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginErrors.email) setLoginErrors((p) => ({ ...p, email: '' }));
                      }}
                      placeholder="nama@email.com"
                      autoComplete="username"
                    />
                  </div>
                  {loginErrors.email && <span className="field-error">{loginErrors.email}</span>}
                </div>

                <div className="input-field">
                  <div className="label-split">
                    <label htmlFor="loginPassword">Kata Sandi</label>
                    <a href="#" className="forgot-pwd" onClick={(e) => e.preventDefault()}>Lupa sandi?</a>
                  </div>
                  <div className="input-control pwd-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="loginPassword"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginErrors.password) setLoginErrors((p) => ({ ...p, password: '' }));
                      }}
                      placeholder="Minimal 6 karakter"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="pwd-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Lihat kata sandi"
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {loginErrors.password && <span className="field-error">{loginErrors.password}</span>}
                </div>

                <div className="form-actions-row">
                  <label className="remember-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Ingat sesi saya</span>
                  </label>
                </div>

                <button type="submit" className="btn-primary" disabled={loginLoading}>
                  <span>{loginLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}</span>
                </button>

                <div className="switch-auth">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    className="btn-inline-switch"
                    onClick={() => handleToggleMode('register')}
                  >
                    Daftar profil baru
                  </button>
                </div>
              </form>
            </div>

            {/* REGISTER PANE */}
            <div className="form-pane pane-register">
              <div className="brand-header">
                <div className="brand-logo">RESPIRA</div>
              </div>

              <div className="form-title-group">
                <h1>Buat Akun</h1>
                <p>Daftarkan profil untuk mulai memantau risiko pernapasan ISPA personal.</p>
              </div>

              <form onSubmit={handleRegisterSubmit} noValidate>
                <div className="input-field">
                  <label htmlFor="regFullName">Nama Lengkap</label>
                  <div className="input-control">
                    <input
                      type="text"
                      id="regFullName"
                      value={regFullName}
                      onChange={(e) => {
                        setRegFullName(e.target.value);
                        if (regErrors.fullName) setRegErrors((p) => ({ ...p, fullName: '' }));
                      }}
                      placeholder="Bagas Aditya"
                      autoComplete="name"
                    />
                  </div>
                  {regErrors.fullName && <span className="field-error">{regErrors.fullName}</span>}
                </div>

                <div className="input-field">
                  <label htmlFor="regEmail">Alamat Email</label>
                  <div className="input-control">
                    <input
                      type="email"
                      id="regEmail"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (regErrors.email) setRegErrors((p) => ({ ...p, email: '' }));
                      }}
                      placeholder="nama@email.com"
                      autoComplete="email"
                    />
                  </div>
                  {regErrors.email && <span className="field-error">{regErrors.email}</span>}
                </div>

                <div className="input-field">
                  <label htmlFor="regPassword">Kata Sandi</label>
                  <div className="input-control pwd-control">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      id="regPassword"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (regErrors.password) setRegErrors((p) => ({ ...p, password: '' }));
                      }}
                      placeholder="Minimal 6 karakter"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pwd-toggle"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      aria-label="Lihat kata sandi"
                    >
                      {showRegPassword ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {regErrors.password && <span className="field-error">{regErrors.password}</span>}
                </div>

                <div className="input-field">
                  <label htmlFor="regConfirmPassword">Konfirmasi Kata Sandi</label>
                  <div className="input-control">
                    <input
                      type="password"
                      id="regConfirmPassword"
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        if (regErrors.confirmPassword) setRegErrors((p) => ({ ...p, confirmPassword: '' }));
                      }}
                      placeholder="Ulangi kata sandi"
                      autoComplete="new-password"
                    />
                  </div>
                  {regErrors.confirmPassword && <span className="field-error">{regErrors.confirmPassword}</span>}
                </div>

                <button type="submit" className="btn-primary" disabled={regLoading}>
                  <span>{regLoading ? 'Mendaftarkan...' : 'Daftar Akun Baru'}</span>
                </button>

                <div className="switch-auth">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    className="btn-inline-switch"
                    onClick={() => handleToggleMode('login')}
                  >
                    Masuk di sini
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* VISUAL MASCOT SLIDING SIDE */}
          <aside className="visual-side" aria-label="Mascot Showcase">
            <div className="welcome-hero-panel">
              <div className="welcome-mascot-wrap">
                <div className="mascot-glow-bg"></div>
                <img
                  src="/assets/lungs-themed.png"
                  alt="Maskot Paru-Paru RESPIRA"
                  className="welcome-mascot-img"
                  width={210}
                  height={210}
                />
              </div>

              <div
                className="welcome-text-wrap"
                style={{ opacity: welcomeTextFade ? 1 : 0 }}
              >
                <h2>{isRegister ? 'Mulai Bersama' : 'Selamat Datang'}</h2>
                <p>
                  {isRegister
                    ? 'Daftarkan profil kesehatan Anda untuk estimasi risiko ISPA personal berbasis Machine Learning.'
                    : 'Bernapas lebih tenang dengan sistem cerdas pemantauan risiko ISPA harian berbasis Machine Learning.'}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
