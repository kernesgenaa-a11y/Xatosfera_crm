#!/usr/bin/env node
/*
  Converts existing property photos to AVIF via CRM API.

  Required env:
    API_URL        - e.g. https://hatosfera-crm.pp.ua or worker URL
    ACCESS_TOKEN   - Bearer token of authorized user

  Optional env:
    DRY_RUN=1      - do not upload or update properties
    LIMIT=50       - process only first N properties
    QUALITY=60     - AVIF quality for sharp (0-100)
*/

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default || mod;
  } catch {
    console.error('Missing dependency: sharp. Install with: npm i -D sharp');
    process.exit(1);
  }
}

const API_URL = (process.env.API_URL || '').replace(/\/$/, '');
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = Number(process.env.LIMIT || 0);
const QUALITY = Math.max(1, Math.min(100, Number(process.env.QUALITY || 60)));

if (!API_URL || !ACCESS_TOKEN) {
  console.error('API_URL and ACCESS_TOKEN are required env vars.');
  process.exit(1);
}

const sharp = await loadSharp();

const authHeaders = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
};

async function apiJson(endpoint, init = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...init,
    headers: { ...authHeaders, ...(init.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`${endpoint} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchBinary(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`, { headers: authHeaders });
  if (!res.ok) throw new Error(`${endpoint} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toAvif(sourceBuffer) {
  return sharp(sourceBuffer).rotate().avif({ quality: QUALITY }).toBuffer();
}

function isAvifKey(key) {
  return key.toLowerCase().endsWith('.avif');
}

function buildAvifFilename(sourceKey) {
  const filename = sourceKey.split('/').pop() || `photo-${Date.now()}`;
  return filename.replace(/\.[^.]+$/, '') + '.avif';
}

async function uploadAvif(fileName, buffer) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'image/avif' });
  form.append('file', blob, fileName);
  form.append('folder', 'properties');

  const res = await fetch(`${API_URL}/api/files/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  });

  if (!res.ok) {
    throw new Error(`upload failed ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

const allProperties = await apiJson('/api/properties');
const properties = LIMIT > 0 ? allProperties.slice(0, LIMIT) : allProperties;

let changed = 0;
let processedPhotos = 0;
let convertedPhotos = 0;

for (const property of properties) {
  const photos = Array.isArray(property.photos) ? property.photos : [];
  if (photos.length === 0) continue;

  const updatedPhotos = [];
  let propertyChanged = false;

  for (const key of photos) {
    if (typeof key !== 'string' || !key.trim()) {
      updatedPhotos.push(key);
      continue;
    }

    processedPhotos += 1;
    if (isAvifKey(key)) {
      updatedPhotos.push(key);
      continue;
    }

    const binary = await fetchBinary(`/api/files/${encodeURIComponent(key)}`);
    const avifBuffer = await toAvif(binary);

    if (DRY_RUN) {
      updatedPhotos.push(key);
    } else {
      const uploaded = await uploadAvif(buildAvifFilename(key), avifBuffer);
      updatedPhotos.push(uploaded.key);
      propertyChanged = true;
      convertedPhotos += 1;
    }

    process.stdout.write(`\rProcessed photos: ${processedPhotos}`);
  }

  if (!DRY_RUN && propertyChanged) {
    await apiJson(`/api/properties/${property.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: updatedPhotos }),
    });
    changed += 1;
    console.log(`\nUpdated property ${property.id}`);
  }
}

console.log(
  `\nDone. Processed photos: ${processedPhotos}. Converted: ${DRY_RUN ? 0 : convertedPhotos}. Updated properties: ${DRY_RUN ? 0 : changed}. Dry run: ${DRY_RUN}`,
);
