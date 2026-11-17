const test = require('node:test');
const assert = require('node:assert/strict');
const { predictCluster } = require('../src/kmeansClusterService');

test('predicts Klaster Risiko Terkontrol for clean air pollutants', () => {
  const result = predictCluster({
    pm25: 18.0,
    pm10: 25.0,
    so2: 12.0,
    co: 8.0,
    o3: 20.0,
    no2: 10.0
  });

  assert.equal(result.level, 'low');
  assert.equal(result.rank, 0);
  assert.ok(result.name.includes('Terkontrol'));
  assert.ok(Number.isFinite(result.distanceToCentroid));
});

test('predicts Klaster Risiko Tinggi for acute industrial pollutants', () => {
  const result = predictCluster({
    pm25: 115.0,
    pm10: 85.0,
    so2: 55.0,
    co: 22.0,
    o3: 65.0,
    no2: 35.0
  });

  assert.equal(result.level, 'high');
  assert.equal(result.rank, 2);
  assert.ok(result.name.includes('Tinggi'));
  assert.ok(Number.isFinite(result.distanceToCentroid));
});

test('handles missing or partial pollutant features gracefully with centroid distance', () => {
  const result = predictCluster({});
  assert.ok(result.name);
  assert.ok(result.badge);
  assert.ok(result.level);
  assert.ok(Number.isFinite(result.distanceToCentroid));
});
