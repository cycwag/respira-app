const { execSync } = require('child_process');
const path = require('path');

const chunks = [
  ['2024-07-01', '2024-12-29'],
  ['2024-12-30', '2025-06-29'],
  ['2025-06-30', '2025-12-28'],
  ['2025-12-29', '2026-06-28'],
  ['2026-06-29', '2026-11-08']
];

const scriptPath = path.join(__dirname, 'collect-dinkes-weekly.js');
const outputPath = path.join(__dirname, '..', 'data', 'dinkes-weekly.json');

for (const [start, end] of chunks) {
  console.log(`\n========================================`);
  console.log(`Menjalankan koleksi chunk: ${start} s/d ${end}...`);
  console.log(`========================================`);
  try {
    execSync(`node "${scriptPath}" ${start} ${end} "${outputPath}"`, {
      stdio: 'inherit'
    });
  } catch (err) {
    console.error(`Gagal pada chunk ${start} - ${end}: ${err.message}`);
  }
}

console.log('\nSemua chunk selesai!');
