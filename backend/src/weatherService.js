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
 * Mengambil parameter cuaca & PM2.5 aktual DKI Jakarta dari Open-Meteo & Air Quality API
 */
async function fetchJakartaEnvironmentalData() {
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

      const pm25 = parseEnvNum(aData.daily.pm2_5_mean?.[actualIndex], 45.0, 0, 500);
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
  { id: 'timur', name: 'Jakarta Timur', station: 'SPKU 5 Lubang Buaya', lat: -6.2908, lon: 106.8967, fallbackPm25: 64.1 }
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

      const pm25 = parseEnvNum(air?.current?.pm2_5, reg.fallbackPm25, 0, 500);
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
  fetchJakarta7DaysHistory,
  fetchJakarta5RegionsAirQuality
};
