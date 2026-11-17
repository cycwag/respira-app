const http = require('http');
const https = require('https');

// Koordinat DKI Jakarta (Pusat / Monas)
const JAKARTA_LAT = -6.2088;
const JAKARTA_LON = 106.8456;
const WEEKLY_ENV_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const weeklyEnvironmentCache = new Map();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = url.startsWith('https') ? https : http;

    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const req = client.get(url, { headers: { 'User-Agent': 'RESPIRA-App/1.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return safeReject(new Error(`HTTP error status code: ${res.statusCode}`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 512 * 1024) { // Max 512KB response
          req.destroy();
          safeReject(new Error('Respons provider terlalu besar (>512KB)'));
        }
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          safeResolve(parsed);
        } catch (err) {
          safeReject(new Error('Gagal parsing JSON: ' + err.message));
        }
      });
    });

    req.on('error', safeReject);
    req.setTimeout(5000, () => {
      req.destroy();
      safeReject(new Error('Request timeout ke provider cuaca'));
    });
  });
}

function parseEnvNum(val, fallback, min = -Infinity, max = Infinity) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Mengambil parameter cuaca & PM2.5 aktual DKI Jakarta dari Open-Meteo & Air Quality API
 * Jika gagal/offline, otomatis fallback ke nilai rata-rata historis DKI Jakarta
 */
async function fetchJakartaEnvironmentalData() {
  // Nilai default/fallback berdasarkan data historis proposal PBL DKI Jakarta
  const fallback = {
    location: 'DKI Jakarta',
    pm25: 42.8,
    temperature: 29.4,
    humidity: 78.0,
    rainfall: 8.2,
    windSpeed: 5.4,
    prevCases: 2412,
    prevCasesSource: 'placeholder',
    source: 'historical_fallback',
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Fetch Cuaca dari Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${JAKARTA_LAT}&longitude=${JAKARTA_LON}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;
    // 2. Fetch Kualitas Udara (PM2.5) dari Open-Meteo Air Quality API
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${JAKARTA_LAT}&longitude=${JAKARTA_LON}&current=pm2_5`;

    const [weatherRes, airRes] = await Promise.allSettled([
      fetchJson(weatherUrl),
      fetchJson(airQualityUrl)
    ]);

    const weatherData = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
    const airData = airRes.status === 'fulfilled' ? airRes.value : null;

    const rawTemp = weatherData?.current?.temperature_2m;
    const rawHum = weatherData?.current?.relative_humidity_2m;
    const rawRain = weatherData?.current?.precipitation;
    const rawWind = weatherData?.current?.wind_speed_10m;
    const rawPm25 = airData?.current?.pm2_5;

    const temperature = parseEnvNum(rawTemp, fallback.temperature, -10, 50);
    const humidity = parseEnvNum(rawHum, fallback.humidity, 0, 100);
    const rainfall = parseEnvNum(rawRain, fallback.rainfall, 0, 300);
    const windSpeed = parseEnvNum(rawWind, fallback.windSpeed, 0, 150);
    const pm25 = parseEnvNum(rawPm25, fallback.pm25, 0, 500);

    return {
      location: 'DKI Jakarta',
      pm25: parseFloat(pm25.toFixed(1)),
      temperature: parseFloat(temperature.toFixed(1)),
      humidity: parseFloat(humidity.toFixed(1)),
      rainfall: parseFloat(rainfall.toFixed(1)),
      windSpeed: parseFloat(windSpeed.toFixed(1)),
      prevCases: 2412,
      prevCasesSource: 'placeholder',
      source: weatherData && airData ? 'open_meteo_live' : 'open_meteo_partial',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.warn('Gagal fetch live data lingkungan, memakai fallback historis:', err.message);
    return fallback;
  }
}

function assertDateRange(startDate, endDate) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    throw new Error('Rentang data lingkungan harus menggunakan format YYYY-MM-DD.');
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      start.toISOString().slice(0, 10) !== startDate ||
      end.toISOString().slice(0, 10) !== endDate ||
      end.getTime() - start.getTime() !== 6 * 86400000) {
    throw new Error('Rentang data lingkungan harus berupa satu minggu penuh yang valid.');
  }
}

function buildOpenMeteoUrl(base, parameters) {
  const query = new URLSearchParams({
    latitude: String(JAKARTA_LAT),
    longitude: String(JAKARTA_LON),
    timezone: 'Asia/Jakarta',
    ...parameters
  });
  return `${base}?${query.toString()}`;
}

function aggregateWeeklyEnvironment(weatherData, airData, startDate, endDate) {
  const weather = weatherData?.hourly;
  const air = airData?.hourly;
  if (!weather || !air || !Array.isArray(weather.time) || !Array.isArray(air.time) ||
      !Array.isArray(weather.temperature_2m) ||
      !Array.isArray(weather.relative_humidity_2m) ||
      !Array.isArray(weather.precipitation) ||
      !Array.isArray(weather.wind_speed_10m) ||
      !Array.isArray(air.pm2_5)) {
    throw new Error('Respons riwayat Open-Meteo tidak memuat deret waktu lingkungan yang diperlukan.');
  }

  const airValues = new Map(air.time.map((time, index) => [time, air.pm2_5[index]]));
  const totals = { pm25: 0, temperature: 0, humidity: 0, rainfall: 0, windSpeed: 0 };
  const counts = { pm25: 0, temperature: 0, humidity: 0, rainfall: 0, windSpeed: 0 };
  const firstHour = `${startDate}T00:00`;
  const lastHour = `${endDate}T23:00`;

  for (let index = 0; index < weather.time.length; index += 1) {
    const time = weather.time[index];
    if (time < firstHour || time > lastHour) continue;

    const values = {
      temperature: weather.temperature_2m[index],
      humidity: weather.relative_humidity_2m[index],
      rainfall: weather.precipitation[index],
      windSpeed: weather.wind_speed_10m[index],
      pm25: airValues.get(time)
    };
    for (const [name, value] of Object.entries(values)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        totals[name] += value;
        counts[name] += 1;
      }
    }
  }

  const expectedHours = 7 * 24;
  const coverage = Object.fromEntries(
    Object.entries(counts).map(([name, count]) => [name, count / expectedHours])
  );
  const insufficient = Object.entries(coverage).filter(([, ratio]) => ratio < 0.9);
  if (insufficient.length > 0) {
    throw new Error(`Data lingkungan mingguan tidak lengkap (cakupan di bawah 90%): ${insufficient.map(([name]) => name).join(', ')}.`);
  }

  return {
    location: 'DKI Jakarta',
    startDate,
    endDate,
    pm25: parseFloat((totals.pm25 / counts.pm25).toFixed(2)),
    temperature: parseFloat((totals.temperature / counts.temperature).toFixed(2)),
    humidity: parseFloat((totals.humidity / counts.humidity).toFixed(2)),
    rainfall: parseFloat(totals.rainfall.toFixed(2)),
    windSpeed: parseFloat((totals.windSpeed / counts.windSpeed).toFixed(2)),
    coverage,
    source: 'open_meteo_weekly'
  };
}

async function fetchJakartaEnvironmentalDataForWeek(startDate, endDate, { recent = false } = {}) {
  assertDateRange(startDate, endDate);
  const cacheKey = `${recent ? 'recent' : 'archive'}:${startDate}:${endDate}`;
  const cached = weeklyEnvironmentCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let weatherUrl;
  let airQualityUrl;
  if (recent) {
    weatherUrl = buildOpenMeteoUrl('https://api.open-meteo.com/v1/forecast', {
      hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
      past_days: '14',
      forecast_days: '1'
    });
    airQualityUrl = buildOpenMeteoUrl('https://air-quality-api.open-meteo.com/v1/air-quality', {
      hourly: 'pm2_5',
      past_days: '14',
      forecast_days: '1'
    });
  } else {
    weatherUrl = buildOpenMeteoUrl('https://archive-api.open-meteo.com/v1/archive', {
      start_date: startDate,
      end_date: endDate,
      hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m'
    });
    airQualityUrl = buildOpenMeteoUrl('https://air-quality-api.open-meteo.com/v1/air-quality', {
      start_date: startDate,
      end_date: endDate,
      hourly: 'pm2_5'
    });
  }

  const [weatherData, airData] = await Promise.all([
    fetchJson(weatherUrl),
    fetchJson(airQualityUrl)
  ]);
  const result = aggregateWeeklyEnvironment(weatherData, airData, startDate, endDate);
  result.source = recent ? 'open_meteo_recent_week' : 'open_meteo_archive_week';
  weeklyEnvironmentCache.set(cacheKey, { data: result, expiresAt: Date.now() + WEEKLY_ENV_CACHE_TTL_MS });
  if (weeklyEnvironmentCache.size > 100) {
    const oldestKey = weeklyEnvironmentCache.keys().next().value;
    weeklyEnvironmentCache.delete(oldestKey);
  }
  return result;
}

module.exports = {
  fetchJakartaEnvironmentalData,
  fetchJakartaEnvironmentalDataForWeek
};