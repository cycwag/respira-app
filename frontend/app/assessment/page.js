'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ParticleCanvas from '@/components/ParticleCanvas';
import { saveProfile } from '@/lib/api';

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 220;
const MIN_WEIGHT = 30;
const MAX_WEIGHT = 180;

export default function AssessmentPage() {
  const router = useRouter();

  const [gender, setGender] = useState('female');
  const [heightCm, setHeightCm] = useState('170');
  const [weightKg, setWeightKg] = useState('60');
  const [hasKidneyDisease, setHasKidneyDisease] = useState(false);
  const [hasLiverDisease, setHasLiverDisease] = useState(false);
  const [isSmoker, setIsSmoker] = useState(false);

  const [heightWarn, setHeightWarn] = useState('');
  const [weightWarn, setWeightWarn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Load existing profile from session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = sessionStorage.getItem('respira_user');
      if (!stored) {
        router.replace('/');
        return;
      }
      const user = JSON.parse(stored);
      if (!user || (!user.id && !user.identifier && !user.fullName)) {
        sessionStorage.removeItem('respira_user');
        router.replace('/');
        return;
      }

      setCurrentUser(user);

      if (user.internalFactors) {
        const { heightCm: h, weightKg: w, gender: g, hasKidneyDisease: k, hasLiverDisease: l, isSmoker: s } = user.internalFactors;
        if (h) setHeightCm(String(h));
        if (w) setWeightKg(String(w));
        if (g) setGender(g);
        if (typeof k === 'boolean') setHasKidneyDisease(k);
        if (typeof l === 'boolean') setHasLiverDisease(l);
        if (typeof s === 'boolean') setIsSmoker(s);
      }
    } catch (e) {
      router.replace('/');
    }
  }, [router]);

  // Calculate live BMI
  const hNum = parseFloat(heightCm) || 170;
  const wNum = parseFloat(weightKg) || 60;
  const heightM = hNum / 100;
  const bmi = heightM > 0 ? parseFloat((wNum / (heightM * heightM)).toFixed(2)) : 0;

  let isUnderweight = false;
  let bmiCategory = 'Normal (Gizi Baik)';
  let bmiNote = 'Berat badan ideal mendukung daya tahan tubuh.';
  let isBmiWarn = false;

  if (bmi < 18.5) {
    isUnderweight = true;
    bmiCategory = 'Underweight (Kurang)';
    bmiNote = 'Gizi kurang meningkatkan kerentanan ISPA (OR 2.14).';
    isBmiWarn = true;
  } else if (bmi < 25.0) {
    bmiCategory = 'Normal (Gizi Baik)';
    bmiNote = 'Berat badan ideal mendukung daya tahan tubuh.';
    isBmiWarn = false;
  } else if (bmi < 30.0) {
    bmiCategory = 'Kelebihan Berat Badan';
    bmiNote = 'Tetap jaga kebugaran dan sirkulasi pernapasan.';
    isBmiWarn = false;
  } else {
    bmiCategory = 'Obesitas';
    bmiNote = 'Perhatikan kapasitas ventilasi paru saat istirahat.';
    isBmiWarn = true;
  }

  // Calculate live Odds Ratio (OR)
  let calculatedOR = 1.0;
  if (isUnderweight) calculatedOR *= 2.14;
  if (gender === 'male') calculatedOR *= 1.30;
  if (hasKidneyDisease) calculatedOR *= 1.47;
  if (hasLiverDisease) calculatedOR *= 1.30;
  if (isSmoker) calculatedOR *= 1.25;

  const finalOR = parseFloat(calculatedOR.toFixed(2));

  let pillText = 'Risiko Dasar';
  let pillStyle = { background: '#d6f93b', color: '#0c0d12' };
  if (finalOR > 2.0) {
    pillText = 'Kerentanan Tinggi';
    pillStyle = { background: '#fecaca', color: '#991b1b' };
  } else if (finalOR > 1.0) {
    pillText = 'Risiko Sedang';
    pillStyle = { background: '#fef08a', color: '#713f12' };
  }

  const handleHeightBlur = () => {
    let val = parseFloat(heightCm);
    if (isNaN(val) || val < MIN_HEIGHT) {
      setHeightCm(String(MIN_HEIGHT));
      setHeightWarn('');
    } else if (val > MAX_HEIGHT) {
      setHeightCm(String(MAX_HEIGHT));
      setHeightWarn('');
    }
  };

  const handleWeightBlur = () => {
    let val = parseFloat(weightKg);
    if (isNaN(val) || val < MIN_WEIGHT) {
      setWeightKg(String(MIN_WEIGHT));
      setWeightWarn('');
    } else if (val > MAX_WEIGHT) {
      setWeightKg(String(MAX_WEIGHT));
      setWeightWarn('');
    }
  };

  const handleHeightChange = (e) => {
    const val = e.target.value;
    setHeightCm(val);
    const num = parseFloat(val);
    if (isNaN(num) || num < MIN_HEIGHT || num > MAX_HEIGHT) {
      setHeightWarn(`Rentang normal tinggi: ${MIN_HEIGHT} - ${MAX_HEIGHT} cm.`);
    } else {
      setHeightWarn('');
    }
  };

  const handleWeightChange = (e) => {
    const val = e.target.value;
    setWeightKg(val);
    const num = parseFloat(val);
    if (isNaN(num) || num < MIN_WEIGHT || num > MAX_WEIGHT) {
      setWeightWarn(`Rentang normal berat: ${MIN_WEIGHT} - ${MAX_WEIGHT} kg.`);
    } else {
      setWeightWarn('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    let valid = true;

    if (isNaN(h) || h < MIN_HEIGHT || h > MAX_HEIGHT) {
      setHeightWarn(`Rentang normal tinggi: ${MIN_HEIGHT} - ${MAX_HEIGHT} cm.`);
      valid = false;
    }
    if (isNaN(w) || w < MIN_WEIGHT || w > MAX_WEIGHT) {
      setWeightWarn(`Rentang normal berat: ${MIN_WEIGHT} - ${MAX_WEIGHT} kg.`);
      valid = false;
    }

    if (!valid) return;

    setIsSubmitting(true);

    const userObj = currentUser || {};
    const userId = userObj.id || userObj.userId;

    if (!userId) {
      alert('Sesi masuk tidak ditemukan. Silakan masuk kembali.');
      router.replace('/');
      return;
    }

    const fullName = userObj.fullName || '';

    const internalFactors = {
      heightCm: h,
      weightKg: w,
      bmi,
      gender,
      hasKidneyDisease,
      hasLiverDisease,
      isSmoker,
      oddsRatio: finalOR
    };

    const updatedUser = {
      ...userObj,
      internalFactors
    };
    sessionStorage.setItem('respira_user', JSON.stringify(updatedUser));

    try {
      await saveProfile({
        id: userId,
        fullName,
        gender,
        weightKg: w,
        heightCm: h,
        hasKidneyDisease,
        hasLiverDisease,
        isSmoker
      });
    } catch (err) {
      console.warn('Gagal sinkronisasi profil ke server:', err.message);
    }

    setTimeout(() => {
      router.push('/dashboard');
    }, 350);
  };

  return (
    <>
      <ParticleCanvas particleCount={32} />

      <main className="page-container">
        <div className="assessment-card">
          <header className="card-header">
            <div className="card-header-top">
              <div className="brand-badge">RESPIRA HEALTH TECH</div>
              <Link href="/dashboard" className="back-link">
                ← Kembali ke Dashboard
              </Link>
            </div>
            <h1>Profil Kerentanan Personal</h1>
            <p>Lengkapi data internal untuk menghitung skor Odds Ratio kerentanan ISPA Anda.</p>
          </header>

          <div className="or-summary-banner">
            <div className="or-info">
              <span className="or-label">Estimasi Odds Ratio (OR) Personal</span>
              <span className="or-value" id="liveOrValue">{finalOR.toFixed(2)}x</span>
            </div>
            <div className="or-status-pill" style={pillStyle}>
              {pillText}
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* 1. Karakteristik Fisik */}
            <section className="form-section">
              <h2 className="section-title">1. Karakteristik Fisik</h2>

              <div className="gender-selector">
                <label className="gender-option">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={gender === 'female'}
                    onChange={() => setGender('female')}
                  />
                  <span className="gender-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M12 13v8M9 18h6" />
                    </svg>
                    <span>Perempuan</span>
                  </span>
                </label>

                <label className="gender-option">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={gender === 'male'}
                    onChange={() => setGender('male')}
                  />
                  <span className="gender-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="10" cy="14" r="5" />
                      <path d="M19 5l-5.5 5.5M14 5h5v5" />
                    </svg>
                    <span>Laki-Laki (OR 1.30)</span>
                  </span>
                </label>
              </div>

              <div className="measure-grid">
                <div className="input-field">
                  <label htmlFor="heightCm">
                    Tinggi Badan <span className="range-hint">({MIN_HEIGHT} – {MAX_HEIGHT} cm)</span>
                  </label>
                  <div className="input-control">
                    <input
                      type="number"
                      id="heightCm"
                      min={MIN_HEIGHT}
                      max={MAX_HEIGHT}
                      value={heightCm}
                      onChange={handleHeightChange}
                      onBlur={handleHeightBlur}
                      required
                    />
                  </div>
                  {heightWarn && <span className="field-range-warn">{heightWarn}</span>}
                </div>

                <div className="input-field">
                  <label htmlFor="weightKg">
                    Berat Badan <span className="range-hint">({MIN_WEIGHT} – {MAX_WEIGHT} kg)</span>
                  </label>
                  <div className="input-control">
                    <input
                      type="number"
                      id="weightKg"
                      min={MIN_WEIGHT}
                      max={MAX_WEIGHT}
                      value={weightKg}
                      onChange={handleWeightChange}
                      onBlur={handleWeightBlur}
                      required
                    />
                  </div>
                  {weightWarn && <span className="field-range-warn">{weightWarn}</span>}
                </div>
              </div>

              <div className="bmi-result-card">
                <div className="bmi-left">
                  <span className="bmi-label">Indeks Massa Tubuh (BMI)</span>
                  <span className="bmi-score">{bmi.toFixed(2)}</span>
                </div>
                <div className="bmi-right">
                  <span className={`bmi-tag ${isBmiWarn ? 'warn' : ''}`}>{bmiCategory}</span>
                  <span className="bmi-note">{bmiNote}</span>
                </div>
              </div>
            </section>

            {/* 2. Riwayat Medis & Komorbid */}
            <section className="form-section">
              <h2 className="section-title">2. Riwayat Medis & Komorbid</h2>

              <div className="toggle-list">
                <label className="toggle-card">
                  <div className="toggle-info">
                    <strong>Riwayat Penyakit Ginjal Kronis</strong>
                    <span>Kondisi ginjal kronis mempengaruhi respon imun (OR 1.47)</span>
                  </div>
                  <div className="switch">
                    <input
                      type="checkbox"
                      checked={hasKidneyDisease}
                      onChange={(e) => setHasKidneyDisease(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </div>
                </label>

                <label className="toggle-card">
                  <div className="toggle-info">
                    <strong>Riwayat Penyakit Hati Kronis</strong>
                    <span>Penurunan filtrasi imunitas sistem pernapasan (OR 1.30)</span>
                  </div>
                  <div className="switch">
                    <input
                      type="checkbox"
                      checked={hasLiverDisease}
                      onChange={(e) => setHasLiverDisease(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </div>
                </label>
              </div>
            </section>

            {/* 3. Gaya Hidup */}
            <section className="form-section">
              <h2 className="section-title">3. Gaya Hidup</h2>

              <label className="toggle-card">
                <div className="toggle-info">
                  <strong>Status Perokok Aktif</strong>
                  <span>Paparan iritasi mukosa bronkus dan silia paru harian (OR 1.25)</span>
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    checked={isSmoker}
                    onChange={(e) => setIsSmoker(e.target.checked)}
                  />
                  <span className="slider"></span>
                </div>
              </label>
            </section>

            <footer className="form-footer">
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                <span>{isSubmitting ? 'Menyimpan & Menghitung...' : 'Simpan Profil & Lihat Dashboard'}</span>
              </button>
            </footer>
          </form>
        </div>
      </main>
    </>
  );
}
