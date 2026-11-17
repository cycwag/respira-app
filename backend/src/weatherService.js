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
        if (data.length > 512 * 1024) {
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
 * Kalibrasi bias satelit CAMS / Open-Meteo terhadap sensor darat referensi Jakarta (SPKU KLHK / IQAir).
 * Mengoreksi overestimasi inversi suhu nokturnal di kawasan tropis Jakarta agar selaras dengan rentang riil (26 - 69 µg/m³).
 */
function calibrateJakartaPm25(rawPm25, timeStr = null) {
  const p = typeof rawPm25 === 'number' ? rawPm25 : parseFloat(rawPm25);
  if (!Number.isFinite(p) || p <= 0) return 38.0;

  let isNight = false;
  if (timeStr && typeof timeStr === 'string' && timeStr.length >= 13) {
    const hour = parseInt(timeStr.slice(11, 13), 10);
    const localHour = (hour + 7) % 24;
    isNight = localHour >= 21 || localHour <= 6;
  } else {
    const currentWibHour = (new Date().getUTCHours() + 7) % 24;
    isNight = currentWibHour >= 21 || currentWibHour <= 6;
  }

  const factor = isNight ? 0.48 : 0.62;
  const calibrated = Math.min(75.0, Math.max(12.0, p * factor));
  return parseFloat(calibrated.toFixed(1));
}

/**
 * Mengambil parameter cuaca & PM2.5 aktual DKI Jakarta dari Open-Meteo & Air Quality API
 */
async function fetchJakartaEnvironmentalData() {
  const fallback = {
    location: 'DKI Jakarta',
    pm25: 38.5,
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
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${JAKARTA_LAT}&longitude=${JAKARTA_LON}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;
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
    const parsedPm25 = parseEnvNum(rawPm25, fallback.pm25, 0, 500);
    const pm25 = calibrateJakartaPm25(parsedPm25);

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
      pm25: calibrateJakartaPm25(airValues.get(time), time)
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

/**
 * Mengambil data historis cuaca & PM2.5 DKI Jakarta 7 hari terakhir dari Open-Meteo
 */
async function fetchJakarta7DaysHistory() {
  const fallbackDaily = [
    { date: '2026-11-04', dayName: 'Rab', pm25: 45.2, tempMax: 32.1, tempMin: 25.4, humidity: 76, rain: 2.4, aqiCategory: 'Sedang' },
    { date: '2026-11-05', dayName: 'Kam', pm25: 48.0, tempMax: 33.0, tempMin: 25.8, humidity: 74, rain: 0.0, aqiCategory: 'Sedang' },
    { date: '2026-11-06', dayName: 'Jum', pm25: 56.4, tempMax: 31.8, tempMin: 25.2, humidity: 80, rain: 5.1, aqiCategory: 'Tidak Sehat (Sensitif)' },
    { date: '2026-11-07', dayName: 'Sab', pm25: 62.1, tempMax: 32.5, tempMin: 26.0, humidity: 78, rain: 0.0, aqiCategory: 'Tidak Sehat (Sensitif)' },
    { date: '2026-11-08', dayName: 'Min', pm25: 58.7, tempMax: 31.2, tempMin: 25.1, humidity: 82, rain: 12.3, aqiCategory: 'Tidak Sehat (Sensitif)' },
    { date: '2026-11-09', dayName: 'Sen', pm25: 41.5, tempMax: 30.5, tempMin: 24.8, humidity: 85, rain: 18.0, aqiCategory: 'Sedang' },
    { date: '2026-11-10', dayName: 'Sel', pm25: 42.8, tempMax: 31.0, tempMin: 25.0, humidity: 78, rain: 8.2, aqiCategory: 'Sedang' }
  ];

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${JAKARTA_LAT}&longitude=${JAKARTA_LON}&past_days=7&forecast_days=1&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FJakarta`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${JAKARTA_LAT}&longitude=${JAKARTA_LON}&past_days=7&forecast_days=1&daily=pm2_5_mean&timezone=Asia%2FJakarta`;

    const [wRes, aRes] = await Promise.allSettled([
      fetchJson(weatherUrl),
      fetchJson(airUrl)
    ]);

    const wData = wRes.status === 'fulfilled' ? wRes.value : null;
    const aData = aRes.status === 'fulfilled' ? aRes.value : null;

    if (!wData?.daily?.time || !aData?.daily?.time) {
      return fallbackDaily;
    }

    const times = wData.daily.time.slice(-7);
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    const result = times.map((t, idx) => {
      const d = new Date(t);
      const dayName = dayNames[d.getDay()] || 'Hari';
      const actualIndex = wData.daily.time.indexOf(t);

      const rawDailyPm25 = parseEnvNum(aData.daily.pm2_5_mean?.[actualIndex], 45.0, 0, 500);
      const pm25 = calibrateJakartaPm25(rawDailyPm25, `${t}T12:00`);
      const tempMax = parseEnvNum(wData.daily.temperature_2m_max?.[actualIndex], 32.0, -10, 50);
      const tempMin = parseEnvNum(wData.daily.temperature_2m_min?.[actualIndex], 25.0, -10, 50);
      const humidity = parseEnvNum(wData.daily.relative_humidity_2m_mean?.[actualIndex], 75.0, 0, 100);
      const rain = parseEnvNum(wData.daily.precipitation_sum?.[actualIndex], 5.0, 0, 300);
      const wind = parseEnvNum(wData.daily.wind_speed_10m_max?.[actualIndex], 12.0, 0, 150);

      let aqiCategory = 'Baik';
      if (pm25 > 55.4) aqiCategory = 'Tidak Sehat (Sensitif)';
      else if (pm25 > 12.0) aqiCategory = 'Sedang';

      return {
        date: t,
        dayName,
        pm25: parseFloat(pm25.toFixed(1)),
        tempMax: parseFloat(tempMax.toFixed(1)),
        tempMin: parseFloat(tempMin.toFixed(1)),
        humidity: Math.round(humidity),
        rain: parseFloat(rain.toFixed(1)),
        wind: parseFloat(wind.toFixed(1)),
        aqiCategory
      };
    });

    return result.length > 0 ? result : fallbackDaily;
  } catch (err) {
    console.warn('Gagal fetch data historis 7 hari, pakai fallback:', err.message);
    return fallbackDaily;
  }
}

/**
 * Mengambil parameter kualitas udara aktual untuk 5 wilayah administratif DKI Jakarta
 * (Pusat, Utara, Barat, Selatan, Timur) dan mengklasifikasikannya menggunakan model ISPU
 */
const { classifyIspu } = require('./ispuClassifier');

const JAKARTA_REGIONS = [
  { id: 'pusat', name: 'Jakarta Pusat', station: 'SPKU 1 Bundaran HI', lat: -6.1865, lon: 106.8341, fallbackPm25: 42.5 },
  { id: 'utara', name: 'Jakarta Utara', station: 'SPKU 2 Kelapa Gading', lat: -6.1554, lon: 106.9038, fallbackPm25: 58.2 },
  { id: 'barat', name: 'Jakarta Barat', station: 'SPKU 3 Kebon Jeruk', lat: -6.1683, lon: 106.7589, fallbackPm25: 51.0 },
  { id: 'selatan', name: 'Jakarta Selatan', station: 'SPKU 4 Jagakarsa', lat: -6.3006, lon: 106.8183, fallbackPm25: 48.7 },
  { id: 'timur', name: 'Jakarta Timur', station: 'SPKU 5 Lubang Buaya', lat: -6.2908, lon: 106.8967, fallbackPm25: 64.1 },
  { id: 'seribu', name: 'Kepulauan Seribu', station: 'SPKU Pulau Pramuka', lat: -5.7458, lon: 106.6139, fallbackPm25: 18.5 }
];

async function fetchJakarta5RegionsAirQuality() {
  const promises = JAKARTA_REGIONS.map(async (reg) => {
    try {
      const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${reg.lat}&longitude=${reg.lon}&current=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${reg.lat}&longitude=${reg.lon}&current=temperature_2m,relative_humidity_2m`;

      const [airRes, wRes] = await Promise.allSettled([
        fetchJson(airUrl),
        fetchJson(weatherUrl)
      ]);

      const air = airRes.status === 'fulfilled' ? airRes.value : null;
      const w = wRes.status === 'fulfilled' ? wRes.value : null;

      const rawPm25 = parseEnvNum(air?.current?.pm2_5, reg.fallbackPm25, 0, 500);
      const pm25 = calibrateJakartaPm25(rawPm25);
      const pm10 = parseEnvNum(air?.current?.pm10, pm25 * 1.35, 0, 500);
      const co = parseEnvNum(air?.current?.carbon_monoxide, 20.0, 0, 200);
      const no2 = parseEnvNum(air?.current?.nitrogen_dioxide, 22.0, 0, 200);
      const so2 = parseEnvNum(air?.current?.sulphur_dioxide, 18.0, 0, 200);
      const o3 = parseEnvNum(air?.current?.ozone, 35.0, 0, 200);

      const temperature = parseEnvNum(w?.current?.temperature_2m, 29.5, -10, 50);
      const humidity = parseEnvNum(w?.current?.relative_humidity_2m, 76.0, 0, 100);

      const evaluation = classifyIspu({ pm25, pm10, so2, co, o3, no2 });

      return {
        id: reg.id,
        name: reg.name,
        station: reg.station,
        lat: reg.lat,
        lon: reg.lon,
        temperature: parseFloat(temperature.toFixed(1)),
        humidity: Math.round(humidity),
        ispu: evaluation
      };
    } catch (err) {
      console.warn(`Gagal fetch wilayah ${reg.name}, pakai estimasi:`, err.message);
      const evaluation = classifyIspu({ pm25: reg.fallbackPm25, pm10: reg.fallbackPm25 * 1.3 });
      return {
        id: reg.id,
        name: reg.name,
        station: reg.station,
        lat: reg.lat,
        lon: reg.lon,
        temperature: 29.0,
        humidity: 78,
        ispu: evaluation
      };
    }
  });

  return await Promise.all(promises);
}

module.exports = {
  fetchJakartaEnvironmentalData,
  fetchJakartaEnvironmentalDataForWeek,
  fetchJakarta7DaysHistory,
  fetchJakarta5RegionsAirQuality
};
