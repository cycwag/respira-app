const http = require('http');
const https = require('https');

// Koordinat DKI Jakarta (Pusat / Monas)
const JAKARTA_LAT = -6.2088;
const JAKARTA_LON = 106.8456;

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
      source: weatherData && airData ? 'open_meteo_live' : 'open_meteo_partial',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.warn('Gagal fetch live data lingkungan, memakai fallback historis:', err.message);
    return fallback;
  }
}

module.exports = {
  fetchJakartaEnvironmentalData
};