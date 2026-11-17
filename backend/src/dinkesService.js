const DINKES_URL = 'https://dashboard-dinkes.jakarta.go.id/puskesmas/get_diagnosa_all';
const TARGET_CODES = ['J00', 'J02', 'J06'];
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;
const cache = new Map();
let lastRequestAt = 0;

function parseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Tanggal Dinkes harus berformat YYYY-MM-DD.');
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Tanggal Dinkes tidak valid: ${date}.`);
  }
  return parsed;
}

function getJakartaDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function getPreviousCompleteJakartaWeek(now = new Date()) {
  const parts = getJakartaDateParts(now);
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localMidnight = parseDate(localDate);
  const dayOfWeek = localMidnight.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const currentWeekMonday = new Date(localMidnight.getTime() - daysSinceMonday * 86400000);
  const start = new Date(currentWeekMonday.getTime() - 7 * 86400000);
  const end = new Date(currentWeekMonday.getTime() - 86400000);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function getJakartaDate(date) {
  const parts = getJakartaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseCaseTotal(value, code) {
  const total = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error(`Total diagnosis ${code} dari Dinkes bukan bilangan bulat non-negatif.`);
  }
  return total;
}

async function waitForRequestSlot() {
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();
}

async function fetchDinkesWeeklyCases(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount !== 7) {
    throw new Error('Pengambilan data Dinkes harus berupa satu minggu penuh (7 hari).');
  }
  if (endDate > getJakartaDate(new Date())) {
    throw new Error('Tanggal akhir data Dinkes tidak boleh berada di masa depan.');
  }

  const cacheKey = `${startDate}:${endDate}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  await waitForRequestSlot();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  let response;
  let payload;

  try {
    response = await fetch(DINKES_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'RESPIRA-Research/1.0',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        filter_data: 'rentang_waktu',
        start_date: startDate,
        end_date: endDate
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Endpoint Dinkes merespons HTTP ${response.status}.`);
    }

    const responseText = await response.text();
    if (Buffer.byteLength(responseText, 'utf8') > MAX_RESPONSE_SIZE) {
      throw new Error('Respons Dinkes melebihi batas ukuran 2 MB.');
    }
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Respons Dinkes bukan JSON yang valid: ${error.message}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Permintaan ke endpoint Dinkes timeout setelah 20 detik.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const diagnoses = payload?.data?.list_diagnosa_ralan;
  if (payload?.success !== true || !Array.isArray(diagnoses)) {
    throw new Error('Struktur respons Dinkes tidak sesuai: list_diagnosa_ralan tidak ditemukan.');
  }

  const totals = Object.fromEntries(TARGET_CODES.map((code) => [code, 0]));
  const foundCodes = new Set();
  for (const diagnosis of diagnoses) {
    const code = typeof diagnosis?.kode_diagnosa === 'string'
      ? diagnosis.kode_diagnosa.trim().toUpperCase()
      : '';
    if (TARGET_CODES.includes(code)) {
      totals[code] += parseCaseTotal(diagnosis.total, code);
      foundCodes.add(code);
    }
  }
  const missingCodes = TARGET_CODES.filter((code) => !foundCodes.has(code));
  if (missingCodes.length > 0) {
    throw new Error(`Respons Dinkes tidak memuat diagnosis ${missingCodes.join(', ')} untuk periode ${startDate} - ${endDate}; data tidak diasumsikan nol.`);
  }

  const data = {
    startDate,
    endDate,
    j00Cases: totals.J00,
    j02Cases: totals.J02,
    j06Cases: totals.J06,
    prevCases: totals.J00 + totals.J02 + totals.J06,
    source: 'dinkes_dki_rawat_jalan',
    retrievedAt: new Date().toISOString()
  };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  return data;
}

module.exports = {
  fetchDinkesWeeklyCases,
  getPreviousCompleteJakartaWeek
};
