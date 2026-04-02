#!/usr/bin/env node
/*
  Adds watermarks to all existing property photos through CRM API.

  Required env:
    API_URL        - e.g. https://hatosfera-crm.pp.ua or worker URL
    ACCESS_TOKEN   - Bearer token of authorized user

  Optional env:
    WATERMARK_PATH - local PNG/SVG logo (default: ./public/angels-logo.png)
    DRY_RUN=1      - do not upload or update properties
    LIMIT=50       - process only first N properties (for staged rollout)
*/

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const WATERMARK_PATH = process.env.WATERMARK_PATH
  ? path.resolve(process.cwd(), process.env.WATERMARK_PATH)
  : path.resolve(__dirname, '../public/angels-logo.png');

if (!API_URL || !ACCESS_TOKEN) {
  console.error('API_URL and ACCESS_TOKEN are required env vars.');
  process.exit(1);
}

const sharp = await loadSharp();
const watermarkBuffer = await readFile(WATERMARK_PATH);

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

async function watermarkPhoto(sourceBuffer) {
  const image = sharp(sourceBuffer);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return sourceBuffer;

  const wmWidth = Math.max(120, Math.round(meta.width * 0.18));
  const padding = Math.max(12, Math.round(meta.width * 0.015));

  const wm = await sharp(watermarkBuffer)
    .resize({ width: wmWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  return image
    .composite([{
      input: wm,
      gravity: 'southeast',
      blend: 'over',
      top: padding,
      left: padding,
      premultiplied: true,
    }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function uploadWatermarked(fileName, buffer) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  form.append('file', blob, fileName.replace(/\.[^.]+$/, '') + '_wm.jpg');
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

    const filename = key.split('/').pop() || `photo-${Date.now()}.jpg`;
    const binary = await fetchBinary(`/api/files/${encodeURIComponent(key)}`);
    const watermarked = await watermarkPhoto(binary);

    if (DRY_RUN) {
      updatedPhotos.push(key);
    } else {
      const uploaded = await uploadWatermarked(filename, watermarked);
      updatedPhotos.push(uploaded.key);
      propertyChanged = true;
    }

    processedPhotos += 1;
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

console.log(`\nDone. Processed photos: ${processedPhotos}. Updated properties: ${DRY_RUN ? 0 : changed}. Dry run: ${DRY_RUN}`);
