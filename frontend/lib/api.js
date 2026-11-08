import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oixvdgrcyathdewfqvat.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function getAuthHeaders() {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('respira_user');
      if (stored) {
        const u = JSON.parse(stored);
        const token = u?.session?.access_token;
        if (token && typeof token === 'string') {
          return { Authorization: `Bearer ${token}` };
        }
      }
    } catch {
      // Abaikan error parsing storage
    }
  }
  return {};
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Koneksi ke server timeout (melebihi 8 detik).');
    }
    throw new Error('Gagal terhubung ke server backend.');
  } finally {
    clearTimeout(id);
  }
}

export async function loginUser(email, password) {
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gagal masuk. Periksa kembali kredensial Anda.');
  }
  return data;
}

export async function registerUser(fullName, email, password) {
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: fullName.trim(),
      email: email.trim(),
      password
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mendaftar. Silakan coba lagi.');
  }
  return data;
}

export async function saveProfile(profileData) {
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(profileData)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan profil.');
  }
  return data;
}

export async function getProfile(userId) {
  if (!userId) throw new Error('ID profil diperlukan.');
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/profile/${userId}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Gagal mengambil profil (status ${res.status}).`);
  }
  return data;
}

export async function assessRisk({ userId, internalFactors, externalFactors }) {
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ userId, internalFactors, externalFactors })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Gagal menghitung risiko (status ${res.status}).`);
  }
  return data;
}

export async function getEnvironmentData() {
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/environment`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Gagal memuat data cuaca (status ${res.status}).`);
  }
  return data;
}

export async function fetchIspaNews(limit = 8) {
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/news?limit=${limit}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Gagal memuat berita (status ${res.status}).`);
  }
  return data;
}

export async function fetchArticleDetail(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('URL artikel tidak valid.');
  }
  const res = await fetchWithTimeout(`${BACKEND_URL}/api/news/detail?url=${encodeURIComponent(url)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Gagal memuat detail artikel (status ${res.status}).`);
  }
  return data;
}
