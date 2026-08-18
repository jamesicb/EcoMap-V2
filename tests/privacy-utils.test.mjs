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

test('public sanitization works without raw address when areaText is set', () => {
  const rows = [{
    id: 7,
    lat: 53.34,
    lng: -6.26,
    areaText: 'Raheny, Dublin 5',
    type: 'semi-detached',
    consent_to_display: true
  }];
  const result = privacy.sanitizePublicJobs(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].areaText, 'Raheny, Dublin 5');
  assert.equal(Object.hasOwn(result[0], 'address'), false);
});

test('areaFromAddress returns neighbourhood and postal district only', () => {
  assert.equal(
    privacy.areaFromAddress('Killester Park, Killester, Dublin 5'),
    'Killester, Dublin 5'
  );
  assert.equal(
    privacy.areaFromAddress('4 Lakelands Close, Stillorgan, A94 W586'),
    'Stillorgan, A94'
  );
  assert.equal(
    privacy.areaFromAddress('69 Woodbine Park, Raheny, Dublin 5'),
    'Raheny, Dublin 5'
  );
  assert.equal(
    privacy.areaFromAddress('64 South Park, Deansgrange, D18 DX32'),
    'Deansgrange, D18'
  );
  assert.equal(
    privacy.areaFromAddress('15 Greendale Avenue, Dublin 5'),
    'Dublin 5'
  );
});

test('warm-build fields pass through public sanitization', () => {
  const result = privacy.sanitizePublicJobs([{
    id: 55,
    lat: 53.34,
    lng: -6.26,
    areaText: 'Dublin',
    type: 'Warm Build Cabin · White Dash',
    cardType: 'warm-build',
    finishType: 'White Dash',
    buildTitle: 'Stand Alone Warm Build',
    consent_to_display: true
  }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].cardType, 'warm-build');
  assert.equal(result[0].finishType, 'White Dash');
  assert.equal(result[0].buildTitle, 'Stand Alone Warm Build');
  assert.equal(Object.hasOwn(result[0], 'address'), false);
});
