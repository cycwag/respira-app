const fs = require('fs');
const path = require('path');
const { fetchDinkesWeeklyCases } = require('../src/dinkesService');

const startDate = process.argv[2];
const endDate = process.argv[3];
const outputPath = path.resolve(
  process.argv[4] || path.join(__dirname, '..', 'data', 'dinkes-weekly.json')
);

function parseDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error(`${label} harus berformat YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} tidak valid: ${value}.`);
  }
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function persist(periods) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({
    source: 'Dinkes DKI Jakarta - Rawat Jalan',
    endpoint: 'https://dashboard-dinkes.jakarta.go.id/puskesmas/get_diagnosa_all',
    retrievedAt: new Date().toISOString(),
    periods
  }, null, 2)}\n`);
}

async function main() {
  const start = parseDate(startDate, 'Tanggal mulai');
  const end = parseDate(endDate, 'Tanggal akhir');
  if (start.getUTCDay() !== 1 || end.getUTCDay() !== 0) {
    throw new Error('Gunakan rentang minggu penuh: tanggal mulai hari Senin dan tanggal akhir hari Minggu.');
  }
  const totalDays = (end.getTime() - start.getTime()) / 86400000 + 1;
  const weekCount = totalDays / 7;
  if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > 260) {
    throw new Error('Rentang harus berisi 1-260 minggu penuh (maksimal sekitar 5 tahun) per proses.');
  }

  let periods = [];
  if (fs.existsSync(outputPath)) {
    const saved = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (!Array.isArray(saved.periods)) {
      throw new Error(`File keluaran tidak memiliki array periods: ${outputPath}`);
    }
    periods = saved.periods;
  }
  const existing = new Set(periods.map((period) => `${period.startDate}:${period.endDate}`));

  for (let week = 0; week < weekCount; week += 1) {
    const from = new Date(start.getTime() + week * 7 * 86400000);
    const to = new Date(from.getTime() + 6 * 86400000);
    const periodStart = formatDate(from);
    const periodEnd = formatDate(to);
    const key = `${periodStart}:${periodEnd}`;
    if (existing.has(key)) {
      console.log(`Lewati data yang sudah ada: ${key}`);
      continue;
    }

    const result = await fetchDinkesWeeklyCases(periodStart, periodEnd);
    periods.push(result);
    periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
    persist(periods);
    console.log(`${key}: J00=${result.j00Cases}, J02=${result.j02Cases}, J06=${result.j06Cases}`);
  }

  console.log(`Selesai. ${periods.length} minggu tersimpan di ${outputPath}`);
}

main().catch((error) => {
  console.error(`Pengambilan data Dinkes gagal: ${error.message}`);
  process.exitCode = 1;
});
