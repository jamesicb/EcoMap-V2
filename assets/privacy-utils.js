/* eslint-disable no-var */
(function initEcoMapPrivacy(globalScope) {
  'use strict';

  var EARTH_RADIUS_METERS = 6371000;
  var MIN_BLUR_METERS = 300;
  var MAX_BLUR_METERS = 500;

  function normalizeNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function hashSeed(value) {
    var input = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function random() {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function toRadians(deg) {
    return deg * (Math.PI / 180);
  }

  function toDegrees(rad) {
    return rad * (180 / Math.PI);
  }

  function blurCoordinate(latitude, longitude, jobId) {
    var lat = normalizeNumber(latitude, 0);
    var lng = normalizeNumber(longitude, 0);
    var rng = mulberry32(hashSeed(jobId));
    var distanceMeters = MIN_BLUR_METERS + (rng() * (MAX_BLUR_METERS - MIN_BLUR_METERS));
    var bearing = rng() * Math.PI * 2;
    var angularDistance = distanceMeters / EARTH_RADIUS_METERS;
    var lat1 = toRadians(lat);
    var lng1 = toRadians(lng);

    var sinLat1 = Math.sin(lat1);
    var cosLat1 = Math.cos(lat1);
    var sinAd = Math.sin(angularDistance);
    var cosAd = Math.cos(angularDistance);

    var lat2 = Math.asin((sinLat1 * cosAd) + (cosLat1 * sinAd * Math.cos(bearing)));
    var lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * sinAd * cosLat1,
      cosAd - (sinLat1 * Math.sin(lat2))
    );

    return {
      lat: toDegrees(lat2),
      lng: toDegrees(lng2),
      blurMeters: distanceMeters
    };
  }

  function areaFromAddress(rawAddress, fallbackArea) {
    var value = String(rawAddress || '').trim();
    if (!value) return String(fallbackArea || 'Dublin area');
    var parts = value.split(',').map(function trimPart(part) { return part.trim(); }).filter(Boolean);
    if (!parts.length) return String(fallbackArea || 'Dublin area');

    var lastPart = parts[parts.length - 1];
    var dublinMatch = lastPart.match(/^Dublin\s*\d+$/i) || value.match(/Dublin\s*\d+/i);
    if (dublinMatch) {
      var dublin = dublinMatch[0].replace(/\s+/g, ' ').trim();
      if (parts.length >= 3) return parts[parts.length - 2] + ', ' + dublin;
      return dublin;
    }

    var eircodeMatch = lastPart.match(/^([A-Z]\d{2})\s+[A-Z0-9]{4}$/i);
    if (eircodeMatch && parts.length >= 2) {
      return parts[parts.length - 2] + ', ' + eircodeMatch[1].toUpperCase();
    }

    var routingOnly = lastPart.match(/^([A-Z]\d{2})$/i);
    if (routingOnly && parts.length >= 2) {
      return parts[parts.length - 2] + ', ' + routingOnly[1].toUpperCase();
    }

    if (parts.length >= 2) return parts[parts.length - 1];
    return parts[0];
  }

  function toPublicJob(rawJob) {
    if (!rawJob || !rawJob.id) return null;
    if (rawJob.consent_to_display === false || rawJob.consentToDisplay === false) return null;
    var id = rawJob.id;
    var blurred = blurCoordinate(rawJob.lat, rawJob.lng, id);
    var areaText = rawJob.address
      ? areaFromAddress(rawJob.address, rawJob.areaText || rawJob.area || rawJob.location)
      : String(rawJob.areaText || rawJob.area || 'Dublin area').trim();
    areaText = String(areaText || 'Dublin area').trim();

    return {
      id: id,
      lat: blurred.lat,
      lng: blurred.lng,
      blurMeters: blurred.blurMeters,
      areaText: areaText || 'Dublin area',
      type: String(rawJob.type || ''),
      completedDate: String(rawJob.completedDate || ''),
      berBefore: String(rawJob.berBefore || ''),
      berAfter: String(rawJob.berAfter || ''),
      annualSaving: normalizeNumber(rawJob.annualSaving, 0),
      valueIncrease: normalizeNumber(rawJob.valueIncrease, 0),
      co2Reduction: normalizeNumber(rawJob.co2Reduction, 0),
      warmthGain: normalizeNumber(rawJob.warmthGain, 0),
      seaiGrant: normalizeNumber(rawJob.seaiGrant, 0) || undefined,
      treesEquivalent: normalizeNumber(rawJob.treesEquivalent, 0) || undefined,
      bathrooms: rawJob.bathrooms == null ? null : normalizeNumber(rawJob.bathrooms, null),
      beforePhotos: Array.isArray(rawJob.beforePhotos) ? rawJob.beforePhotos.slice() : [],
      afterPhotos: Array.isArray(rawJob.afterPhotos) ? rawJob.afterPhotos.slice() : [],
      consentToDisplay: true,
      cardType: rawJob.cardType === 'warm-build' ? 'warm-build' : undefined,
      buildPrice: normalizeNumber(rawJob.buildPrice, 0) || undefined,
      cabinSize: normalizeNumber(rawJob.cabinSize, 0) || undefined,
      weeksToCompletion: normalizeNumber(rawJob.weeksToCompletion, 0) || undefined,
      finishType: rawJob.finishType ? String(rawJob.finishType) : undefined,
      buildTitle: rawJob.buildTitle ? String(rawJob.buildTitle) : undefined,
      buildSubtitle: rawJob.buildSubtitle ? String(rawJob.buildSubtitle) : undefined,
      buildDescription: rawJob.buildDescription ? String(rawJob.buildDescription) : undefined
    };
  }

  function sanitizePublicJobs(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
      .map(toPublicJob)
      .filter(function hasJob(row) { return !!row; });
  }

  var api = {
    MIN_BLUR_METERS: MIN_BLUR_METERS,
    MAX_BLUR_METERS: MAX_BLUR_METERS,
    blurCoordinate: blurCoordinate,
    areaFromAddress: areaFromAddress,
    toPublicJob: toPublicJob,
    sanitizePublicJobs: sanitizePublicJobs
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.EcoMapPrivacy = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
