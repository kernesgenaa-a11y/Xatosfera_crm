import { generateId, verifyAuth } from './auth';
import type { Env } from './types';
import { errorResponse, jsonResponse } from './utils';

const IMAGE_UPLOAD_PATH = '/upload';
const IMAGE_STATUS_PREFIX = '/images/';
const DERIVATIVE_SPECS = [
  { name: 'thumb', width: 300 },
  { name: 'card', width: 600 },
  { name: 'detail', width: 1200 },
  { name: 'full', width: 2400 },
] as const;

type DerivativeName = (typeof DERIVATIVE_SPECS)[number]['name'];

type ImageJobPayload = {
  id: string;
  originalKey: string;
  contentType: string;
};

type ImageManifest = {
  id: string;
  status: 'processing' | 'ready' | 'failed';
  originalKey: string;
  derivatives: Record<DerivativeName, string | null>;
  createdAt: string;
  updatedAt: string;
};

type QueueMessage<T> = {
  body: T;
};

type MessageBatch<T> = {
  messages: Array<QueueMessage<T>>;
};

function createDerivativeMap(): Record<DerivativeName, string | null> {
  return {
    thumb: null,
    card: null,
    detail: null,
    full: null,
  };
}

function buildOriginalKey(id: string, contentType: string): string {
  const extension = contentType.split('/')[1]?.toLowerCase() || 'bin';
  return `images/${id}/original.${extension}`;
}

function buildDerivativeKey(id: string, name: DerivativeName): string {
  return `images/${id}/${name}.webp`;
}

function buildManifestKey(id: string): string {
  return `images/${id}/manifest.json`;
}

function buildFileUrl(request: Request, key: string): string {
  const url = new URL(request.url);
  return `${url.origin}/api/files/${encodeURIComponent(key)}`;
}

function applyNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  return response;
}

async function saveManifest(env: Env, manifest: ImageManifest): Promise<void> {
  await env.R2.put(buildManifestKey(manifest.id), JSON.stringify(manifest), {
    httpMetadata: { contentType: 'application/json' },
  });
}

async function getManifest(env: Env, id: string): Promise<ImageManifest | null> {
  const manifestObject = await env.R2.get(buildManifestKey(id));
  if (!manifestObject) return null;
  const manifestText = await new Response(manifestObject.body).text();
  return JSON.parse(manifestText) as ImageManifest;
}

function scaleDimensions(width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) {
    return { width, height };
  }

  const ratio = maxWidth / width;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function renderVariant(
  blob: Blob,
  maxWidth: number,
): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);

  try {
    const { width, height } = scaleDimensions(bitmap.width, bitmap.height, maxWidth);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    ctx.drawImage(bitmap, 0, 0, width, height);
    const output = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });

    return {
      data: await output.arrayBuffer(),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

export async function handleImageUpload(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<Response | null> {
  if (new URL(request.url).pathname !== IMAGE_UPLOAD_PATH || request.method !== 'POST') {
    return null;
  }

  const authResult = await verifyAuth(request, env, jwtSecret);
  if (!authResult.success) return errorResponse('Unauthorized', 401, env, request);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return errorResponse('File is required', 400, env, request);
    if (!file.type.startsWith('image/'))
      return errorResponse('Image file is required', 400, env, request);
    if (file.size === 0) return errorResponse('Empty file', 400, env, request);
    if (file.size > 20 * 1024 * 1024) {
      return errorResponse('File too large (max 20MB)', 400, env, request);
    }
    if (!env.IMAGES_QUEUE || typeof env.IMAGES_QUEUE.send !== 'function') {
      return errorResponse('Image queue is not configured', 500, env, request);
    }

    const id = generateId();
    const now = new Date().toISOString();
    const originalKey = buildOriginalKey(id, file.type);
    const manifest: ImageManifest = {
      id,
      status: 'processing',
      originalKey,
      derivatives: createDerivativeMap(),
      createdAt: now,
      updatedAt: now,
    };

    await env.R2.put(originalKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    await saveManifest(env, manifest);
    await env.IMAGES_QUEUE.send({
      id,
      originalKey,
      contentType: file.type,
    } satisfies ImageJobPayload);

    return applyNoStore(jsonResponse({ id, status: 'processing' }, 202, env, request));
  } catch (error) {
    console.error('Image upload error:', error);
    return errorResponse('Failed to upload image', 500, env, request);
  }
}

export async function handleGetImageManifest(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (request.method !== 'GET' || !path.startsWith(IMAGE_STATUS_PREFIX)) {
    return null;
  }

  const authResult = await verifyAuth(request, env, jwtSecret);
  if (!authResult.success) return errorResponse('Unauthorized', 401, env, request);

  const id = path.slice(IMAGE_STATUS_PREFIX.length);
  if (!id) return errorResponse('Image id is required', 400, env, request);

  const manifest = await getManifest(env, id);
  if (!manifest) return errorResponse('Image not found', 404, env, request);

  const derivatives =
    manifest.status === 'ready'
      ? {
          thumb: manifest.derivatives.thumb
            ? buildFileUrl(request, manifest.derivatives.thumb)
            : null,
          card: manifest.derivatives.card ? buildFileUrl(request, manifest.derivatives.card) : null,
          detail: manifest.derivatives.detail
            ? buildFileUrl(request, manifest.derivatives.detail)
            : null,
          full: manifest.derivatives.full ? buildFileUrl(request, manifest.derivatives.full) : null,
        }
      : null;

  return applyNoStore(
    jsonResponse(
      {
        id: manifest.id,
        status: manifest.status,
        derivatives,
      },
      200,
      env,
      request,
    ),
  );
}

export async function processImageQueue(
  batch: MessageBatch<ImageJobPayload>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const { id, originalKey } = message.body;
    const manifest = await getManifest(env, id);
    if (!manifest) continue;

    try {
      const original = await env.R2.get(originalKey);
      if (!original) throw new Error('Original image not found');

      const contentType = original.httpMetadata?.contentType || 'application/octet-stream';
      const sourceBlob = new Blob([await original.arrayBuffer()], { type: contentType });

      for (const spec of DERIVATIVE_SPECS) {
        const derivativeKey = buildDerivativeKey(id, spec.name);
        const rendered = await renderVariant(sourceBlob, spec.width);
        await env.R2.put(derivativeKey, rendered.data, {
          httpMetadata: { contentType: 'image/webp' },
        });
        manifest.derivatives[spec.name] = derivativeKey;
      }

      manifest.status = 'ready';
      manifest.updatedAt = new Date().toISOString();
      await saveManifest(env, manifest);
    } catch (error) {
      console.error('Image derivative generation error:', error);
      manifest.status = 'failed';
      manifest.updatedAt = new Date().toISOString();
      await saveManifest(env, manifest);
    }
  }
}
