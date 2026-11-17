const fs = require('fs');
const path = require('path');
const { fetchJakartaEnvironmentalDataForWeek } = require('../src/weatherService');

const inputPath = process.argv[2];
const outputPath = path.resolve(
  process.argv[3] || path.join(__dirname, '..', 'data', 'respira-regression-dataset.json')
);

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} tidak memiliki tanggal YYYY-MM-DD yang valid.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} tidak valid: ${value}.`);
  }
  return date;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!inputPath) {
    throw new Error('Pemakaian: node scripts/build-regression-dataset.js <dinkes-weekly.json> [dataset-output.json]');
  }
  const source = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  if (!Array.isArray(source.periods) || source.periods.length < 2) {
    throw new Error('Data Dinkes harus berisi minimal dua minggu berurutan.');
  }
  const periods = [...source.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index];
    const start = parseDate(period.startDate, `Minggu ke-${index + 1}`);
    const end = parseDate(period.endDate, `Minggu ke-${index + 1}`);
    if (start.getUTCDay() !== 1 || end.getUTCDay() !== 0 ||
        end.getTime() - start.getTime() !== 6 * 86400000) {
      throw new Error(`Periode ${period.startDate} - ${period.endDate} bukan satu minggu Senin-Minggu.`);
    }
    if (index > 0) {
      const previousEnd = parseDate(periods[index - 1].endDate, `Akhir minggu ke-${index}`);
      if (start.getTime() - previousEnd.getTime() !== 86400000) {
        throw new Error('Data Dinkes memiliki minggu yang hilang atau tidak berurutan.');
      }
    }
    for (const field of ['j00Cases', 'j02Cases', 'j06Cases']) {
      if (!Number.isSafeInteger(period[field]) || period[field] < 0) {
        throw new Error(`Data ${field} pada periode ${period.startDate} tidak valid.`);
      }
    }
  }

  const environmentalByWeek = new Map();
  for (const period of periods.slice(0, -1)) {
    const environment = await fetchJakartaEnvironmentalDataForWeek(period.startDate, period.endDate);
    environmentalByWeek.set(period.startDate, environment);
    console.log(`Lingkungan ${period.startDate} - ${period.endDate}: PM2.5=${environment.pm25} µg/m³`);
    await sleep(1100);
  }

  const rows = [];
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    const target = periods[index];
    const environment = environmentalByWeek.get(previous.startDate);
    rows.push({
      featurePeriodStart: previous.startDate,
      featurePeriodEnd: previous.endDate,
      targetPeriodStart: target.startDate,
      targetPeriodEnd: target.endDate,
      pm25: environment.pm25,
      temperature: environment.temperature,
      humidity: environment.humidity,
      rainfall: environment.rainfall,
      windSpeed: environment.windSpeed,
      prevCases: previous.j00Cases + previous.j02Cases + previous.j06Cases,
      j00Cases: target.j00Cases,
      j02Cases: target.j02Cases,
      j06Cases: target.j06Cases
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`Dataset ${rows.length} baris berhasil dibuat: ${outputPath}`);
}

main().catch((error) => {
  console.error(`Pembuatan dataset regresi gagal: ${error.message}`);
  process.exitCode = 1;
});
