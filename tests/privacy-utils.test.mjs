import test from 'node:test';
import assert from 'node:assert/strict';
import privacy from '../assets/privacy-utils.js';

test('deterministic blur stays stable for same job id', () => {
  const first = privacy.blurCoordinate(53.3498, -6.2603, 'job-42');
  const second = privacy.blurCoordinate(53.3498, -6.2603, 'job-42');
  assert.equal(first.lat, second.lat);
  assert.equal(first.lng, second.lng);
});

test('blur distance always inside 300-500m range', () => {
  for (let i = 0; i < 50; i += 1) {
    const p = privacy.blurCoordinate(53.35, -6.26, `job-${i}`);
    assert.ok(p.blurMeters >= 300, `expected >=300m, got ${p.blurMeters}`);
    assert.ok(p.blurMeters <= 500, `expected <=500m, got ${p.blurMeters}`);
  }
});

test('public sanitization drops non-consented jobs and identifiers', () => {
  const rows = [
    {
      id: '1',
      lat: 53.34,
      lng: -6.26,
      address: '12 Fake Street, Dublin 7',
      owner_name: 'Secret Name',
      owner_email: 'secret@example.com',
      owner_phone: '012345678',
      berAfter: 'B2',
      annualSaving: 1200,
      type: '3-bed semi-detached',
      consent_to_display: true
    },
    {
      id: '2',
      lat: 53.33,
      lng: -6.27,
      address: '13 Other Street, Dublin 8',
      consent_to_display: false
    }
  ];
  const result = privacy.sanitizePublicJobs(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].areaText, 'Dublin 7');
  assert.equal(Object.hasOwn(result[0], 'address'), false);
  assert.equal(Object.hasOwn(result[0], 'owner_name'), false);
  assert.equal(Object.hasOwn(result[0], 'owner_email'), false);
  assert.equal(Object.hasOwn(result[0], 'owner_phone'), false);
});
