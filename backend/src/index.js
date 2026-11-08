const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { supabase, supabaseAdmin, isConfigured } = require('./supabase');
const { calculatePersonalOddsRatio, mockRegressionInference, calculateWeightedRisk } = require('./scoring');
const { fetchJakartaEnvironmentalData } = require('./weatherService');
const { getIspaNewsList, getArticleDetail, validateNewsUrl } = require('./newsService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

const isValidUUID = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

function sanitizeString(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

// In-Memory Rate Limiting
function createRateLimiter({ windowMs, maxRequests, message }) {
  const hits = new Map();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (record.resetAt <= now) {
        hits.delete(ip);
      }
    }
  }, Math.max(windowMs, 60000));
  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let record = hits.get(ip);

    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
    } else {
      record.count += 1;
    }

    hits.set(ip, record);

    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: message || 'Terlalu banyak permintaan. Silakan tunggu beberapa saat lagi.'
      });
    }

    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu 15 menit.'
});

const newsLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Batas frekuensi permintaan berita tercapai. Coba lagi dalam 1 menit.'
});

const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Batas frekuensi permintaan API tercapai.'
});

// Helper otentikasi Bearer token
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  if (isConfigured && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return null;
      return user;
    } catch {
      return null;
    }
  }
  return null;
}

// Apply general API rate limiting to all /api routes
app.use('/api', generalLimiter);

app.get('/', (req, res) => {
  res.json({
    service: 'RESPIRA Backend API',
    version: '1.0.0',
    status: 'running',
    frontend: 'http://localhost:3000',
    health: '/api/health'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'RESPIRA Backend API', time: new Date().toISOString() });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (cleanEmail.length > 254 || cleanPassword.length > 128) {
      return res.status(400).json({ error: 'Panjang input melebihi batas yang diizinkan.' });
    }

    if (!isConfigured) {
      return res.status(503).json({ error: 'Konfigurasi Supabase belum disetel di server.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });

    if (error) {
      const isInvalidCreds = error.message && error.message.toLowerCase().includes('invalid login credentials');
      return res.status(error.status || 401).json({
        error: isInvalidCreds ? 'Email atau kata sandi salah.' : error.message
      });
    }

    let fullName = data.user?.user_metadata?.full_name || '';
    let userProfile = null;
    if (data.user?.id) {
      try {
        const clientForProfile = supabaseAdmin || supabase;
        const { data: profile } = await clientForProfile
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        if (profile) {
          if (profile.full_name) {
            fullName = profile.full_name;
          }
          userProfile = profile;
        }
      } catch (profErr) {
        // Abaikan error profiling sekunder
      }
    }

    return res.json({
      status: 'success',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName,
        profile: userProfile ? {
          gender: userProfile.gender,
          weightKg: userProfile.weight_kg,
          heightCm: userProfile.height_cm,
          bmi: userProfile.bmi,
          hasKidneyDisease: userProfile.has_kidney_disease,
          hasLiverDisease: userProfile.has_liver_disease,
          isSmoker: userProfile.is_smoker
        } : null
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat proses masuk.', details: err.message });
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const trimmedFullName = sanitizeString(fullName, 100);
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (cleanEmail.length > 254 || cleanPassword.length > 128) {
      return res.status(400).json({ error: 'Panjang input melebihi batas yang diizinkan.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Format email tidak valid.' });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }

    if (!isConfigured) {
      return res.status(503).json({ error: 'Konfigurasi Supabase belum disetel di server.' });
    }

    let createdUser = null;
    let authSession = null;

    if (supabaseAdmin) {
      const { data: adminData, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          full_name: trimmedFullName
        }
      });

      if (adminErr) {
        return res.status(adminErr.status || 400).json({
          error: adminErr.message
        });
      }

      createdUser = adminData.user;

      // Auto sign-in to issue session tokens for the created user
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (!signInErr && signInData) {
        authSession = signInData.session;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: trimmedFullName
          }
        }
      });

      if (error) {
        return res.status(error.status || 400).json({
          error: error.message
        });
      }

      createdUser = data.user;
      authSession = data.session;
    }

    if (createdUser?.id) {
      try {
        const clientForProfile = supabaseAdmin || supabase;
        await clientForProfile.from('profiles').upsert({
          id: createdUser.id,
          full_name: trimmedFullName,
          updated_at: new Date().toISOString()
        });
      } catch (profileErr) {
        console.warn('Gagal membuat profil awal:', profileErr.message);
      }
    }

    return res.json({
      status: 'success',
      user: {
        id: createdUser?.id,
        email: createdUser?.email,
        fullName: trimmedFullName
      },
      session: authSession ? {
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
        expires_at: authSession.expires_at
      } : null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat registrasi.', details: err.message });
  }
});

app.get('/api/environment', async (req, res) => {
  try {
    const envData = await fetchJakartaEnvironmentalData();
    res.json(envData);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat data lingkungan', details: err.message });
  }
});

app.get('/api/news', newsLimiter, async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const articles = await getIspaNewsList(limit);
    res.json({
      status: 'success',
      total: articles.length,
      lastUpdated: new Date().toISOString(),
      articles
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat berita ISPA', details: err.message });
  }
});

// SSRF Protected endpoint
app.get('/api/news/detail', newsLimiter, async (req, res) => {
  try {
    const articleUrl = req.query.url;
    if (!articleUrl || typeof articleUrl !== 'string') {
      return res.status(400).json({ error: 'Parameter url artikel wajib disertakan.' });
    }

    // SSRF Validation: hanya izinkan domain berita publik terverifikasi
    if (!validateNewsUrl(articleUrl)) {
      return res.status(400).json({
        error: 'URL artikel tidak diizinkan atau tidak valid. Hanya domain berita terpercaya yang didukung.'
      });
    }

    const detail = await getArticleDetail(articleUrl);
    if (!detail) {
      return res.status(404).json({ error: 'Artikel tidak ditemukan.' });
    }

    res.json({
      status: 'success',
      article: detail
    });
  } catch (err) {
    const status = err.message.includes('tidak diizinkan') ? 400 : 500;
    res.status(status).json({ error: 'Gagal memuat detail artikel', details: err.message });
  }
});

// Protected Profile Read Endpoint
app.get('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ error: 'Parameter ID profil tidak valid atau bukan UUID.' });
    }

    if (isConfigured) {
      const authUser = await getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Autentikasi diperlukan untuk mengakses profil.' });
      }
      if (authUser.id !== id) {
        return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk melihat profil ini.' });
      }
    }

    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Profil tidak ditemukan.', details: error.message });
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan server.', details: err.message });
  }
});

// Protected Profile Update Endpoint
app.post('/api/profile', async (req, res) => {
  try {
    const { id, fullName, gender, weightKg, heightCm, hasKidneyDisease, hasLiverDisease, isSmoker } = req.body || {};

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ error: 'Field id pengguna wajib diisi dengan format UUID valid.' });
    }

    if (isConfigured) {
      const authUser = await getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Autentikasi diperlukan untuk memperbarui profil.' });
      }
      if (authUser.id !== id) {
        return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk mengubah profil pengguna lain.' });
      }
    }

    let bmi = null;
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    const validWeight = Number.isFinite(w) && w >= 20 && w <= 300 ? w : null;
    const validHeight = Number.isFinite(h) && h >= 50 && h <= 250 ? h : null;

    if (validWeight && validHeight) {
      const heightM = validHeight / 100;
      bmi = parseFloat((validWeight / (heightM * heightM)).toFixed(2));
      if (!Number.isFinite(bmi) || bmi < 5 || bmi > 100) {
        bmi = null;
      }
    }

    const validGender = ['male', 'female'].includes(gender) ? gender : null;

    const payload = {
      id,
      gender: validGender,
      weight_kg: validWeight,
      height_cm: validHeight,
      bmi,
      has_kidney_disease: Boolean(hasKidneyDisease),
      has_liver_disease: Boolean(hasLiverDisease),
      is_smoker: Boolean(isSmoker),
      updated_at: new Date().toISOString()
    };

    if (typeof fullName === 'string' && fullName.trim().length > 0) {
      payload.full_name = sanitizeString(fullName, 100);
    }

    const clientForProfile = supabaseAdmin || supabase;
    const { data, error } = await clientForProfile
      .from('profiles')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: 'Gagal menyimpan profil.', details: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan server.', details: err.message });
  }
});

// Protected & Validated Assessment Endpoint
app.post('/api/assess', async (req, res) => {
  try {
    const { userId, internalFactors, externalFactors } = req.body || {};

    let validUserId = null;
    if (userId && isValidUUID(userId)) {
      if (isConfigured) {
        const authUser = await getAuthenticatedUser(req);
        if (authUser && authUser.id !== userId) {
          return res.status(403).json({ error: 'ID pengguna tidak sesuai dengan sesi token autentikasi Anda.' });
        }
        if (authUser && authUser.id === userId) {
          validUserId = userId;
        }
      } else {
        validUserId = userId;
      }
    }

    // Jika externalFactors tidak disertakan, otomatis fetch data aktual Jakarta
    let activeEnv = externalFactors;
    if (!activeEnv || typeof activeEnv !== 'object' || !Number.isFinite(parseFloat(activeEnv.pm25))) {
      activeEnv = await fetchJakartaEnvironmentalData();
    }

    const oddsRatio = calculatePersonalOddsRatio(internalFactors || {});
    const regressionCases = mockRegressionInference(activeEnv || {});
    const risks = calculateWeightedRisk({ internalOR: oddsRatio, regressionCases });

    const maxRisk = Math.max(risks.j00, risks.j02, risks.j06);
    let riskLevel = 'Rendah - Terkontrol';
    if (maxRisk >= 60) riskLevel = 'Tinggi - Bahaya';
    else if (maxRisk >= 35) riskLevel = 'Sedang - Waspada';

    const parseBounded = (v, def, min, max) => {
      const n = typeof v === 'number' ? v : parseFloat(v);
      if (!Number.isFinite(n)) return def;
      return Math.min(max, Math.max(min, n));
    };

    const record = {
      user_id: validUserId,
      pm25: parseBounded(activeEnv.pm25, 35.0, 0, 500),
      temperature: parseBounded(activeEnv.temperature, 28.0, -10, 50),
      humidity: parseBounded(activeEnv.humidity, 75.0, 0, 100),
      rainfall: parseBounded(activeEnv.rainfall, 10.0, 0, 300),
      wind_speed: parseBounded(activeEnv.windSpeed, 5.0, 0, 150),
      prev_cases: parseBounded(activeEnv.prevCases, 1000, 0, 100000),
      score_j00: risks.j00,
      score_j02: risks.j02,
      score_j06: risks.j06
    };

    if (validUserId) {
      try {
        const clientForAssess = supabaseAdmin || supabase;
        await clientForAssess.from('risk_assessments').insert(record);
      } catch (dbErr) {
        console.warn('Gagal mencatat asesmen ke Supabase (db offline/mock):', dbErr.message);
      }
    }

    return res.json({
      status: 'success',
      calculatedAt: new Date().toISOString(),
      environmentalData: activeEnv,
      oddsRatio,
      regressionCases,
      riskPercentages: {
        overall: Math.round((risks.j00 + risks.j02 + risks.j06) / 3),
        ...risks
      },
      riskLevel,
      dominantDisease: risks.j06 >= risks.j00 && risks.j06 >= risks.j02 ? 'J06' : (risks.j00 >= risks.j02 ? 'J00' : 'J02'),
      preventiveAdvice: generateAdvice(risks, internalFactors)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal melakukan kalkulasi risiko.', details: err.message });
  }
});

function generateAdvice(risks, internal) {
  const advice = [];
  const maxRisk = Math.max(risks?.j00 || 0, risks?.j02 || 0, risks?.j06 || 0);

  if (maxRisk > 60) {
    advice.push('Gunakan masker medis saat beraktivitas di luar ruangan.');
    advice.push('Kurangi aktivitas fisik berat di luar ruang.');
  } else {
    advice.push('Kualitas pernapasan terkontrol, tetap jaga hidrasi tubuh.');
  }

  if (internal?.isSmoker) {
    advice.push('Kurangi frekuensi merokok untuk menekan iritasi bronkus.');
  }

  if (internal?.bmi && internal.bmi < 18.5) {
    advice.push('Tingkatkan asupan nutrisi untuk menjaga daya tahan imunitas.');
  }

  return advice;
}

app.listen(PORT, () => {
  console.log(`RESPIRA Backend berjalan di port ${PORT}`);
});