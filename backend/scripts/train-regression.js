const fs = require('fs');
const path = require('path');
const { trainRespiraRegression } = require('../src/scoring');

const datasetPath = process.argv[2];
const outputPath = process.argv[3] || path.join(__dirname, '..', 'models', 'respira-regression.json');

if (!datasetPath) {
  console.error('Pemakaian: node scripts/train-regression.js <dataset.json> [model-output.json]');
  process.exitCode = 1;
} else {
  try {
    const rows = JSON.parse(fs.readFileSync(path.resolve(datasetPath), 'utf8'));
    const model = trainRespiraRegression(rows);
    const resolvedOutputPath = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
    fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(model, null, 2)}\n`);
    console.log(`Model regresi tersimpan: ${resolvedOutputPath} (${model.sampleCount} baris data).`);
  } catch (error) {
    console.error(`Gagal melatih regresi: ${error.message}`);
    process.exitCode = 1;
  }
}
