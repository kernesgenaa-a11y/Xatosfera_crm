import type { Env } from './types';
import { delegateToLegacy } from './legacy';
import { generateId, verifyAuth } from './auth';
import { corsHeaders, errorResponse, jsonResponse, sanitizeUrlForLogging } from './utils';

const IMAGE_PUBLIC_CACHE_CONTROL = 'public, max-age=31536000';
const TRANSFORMABLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function acceptsWebp(request: Request): boolean {
  const accept = request.headers.get('Accept') || '';
  return /\bimage\/webp\b/i.test(accept);
}

function isTransformableImage(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  return TRANSFORMABLE_IMAGE_TYPES.has(normalized);
}

function appendVary(headers: Headers, value: string) {
  const current = headers.get('Vary');
  if (!current) {
    headers.set('Vary', value);
    return;
  }
  const parts = current.split(',').map((part) => part.trim().toLowerCase());
  if (!parts.includes(value.toLowerCase())) {
    headers.set('Vary', `${current}, ${value}`);
  }
}

function applyImageCacheHeaders(headers: Headers) {
  headers.set('Cache-Control', IMAGE_PUBLIC_CACHE_CONTROL);
  headers.set('CDN-Cache-Control', IMAGE_PUBLIC_CACHE_CONTROL);
  headers.set('Cloudflare-CDN-Cache-Control', IMAGE_PUBLIC_CACHE_CONTROL);
  appendVary(headers, 'Accept');
}

function applyCorsHeaders(headers: Headers, env: Env, request: Request) {
  Object.entries(corsHeaders(env, request)).forEach(([header, value]) =>
    headers.set(header, value),
  );
}

function buildDerivedEtag(sourceEtag: string, suffix: string): string {
  const normalized = sourceEtag.replace(/^W\//, '').replace(/^"|"$/g, '');
  return `W/"${normalized}-${suffix}"`;
}

async function maybeTransformToWebp(
  request: Request,
  env: Env,
  objectBytes: ArrayBuffer,
  sourceEtag: string,
): Promise<Response | null> {
  if (!env.IMAGES || !acceptsWebp(request)) return null;

  try {
    const transformed = await env.IMAGES.input(new Blob([objectBytes]).stream()).output({
      format: 'image/webp',
      quality: 82,
    });
    const response = transformed.response();
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'image/webp');
    headers.set('etag', buildDerivedEtag(sourceEtag, 'webp'));
    applyImageCacheHeaders(headers);
    applyCorsHeaders(headers, env, request);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('Image transform error:', error);
    return null;
  }
}

export async function handleGetFile(request: Request, env: Env, key: string): Promise<Response> {
  const object = await env.R2.get(key);
  if (!object) return errorResponse('File not found', 404, env, request);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  const contentType = headers.get('Content-Type') || '';
  if (contentType.startsWith('image/')) {
    const canTransform = isTransformableImage(contentType) && contentType !== 'image/webp';
    console.log(
      '[images-debug]',
      JSON.stringify({
        key,
        contentType,
        acceptHeader: request.headers.get('Accept'),
        hasImagesBinding: !!env.IMAGES,
        acceptsWebp: acceptsWebp(request),
        canTransform,
      }),
    );
    const objectBytes = canTransform && acceptsWebp(request) ? await object.arrayBuffer() : null;
    const transformedResponse =
      canTransform && objectBytes
        ? await maybeTransformToWebp(request, env, objectBytes, object.httpEtag)
        : null;
    if (transformedResponse) return transformedResponse;
    applyImageCacheHeaders(headers);
    if (objectBytes) {
      applyCorsHeaders(headers, env, request);
      return new Response(objectBytes, { headers });
    }
  } else {
    headers.set('Cache-Control', 'private, max-age=3600');
  }
  applyCorsHeaders(headers, env, request);
  return new Response(object.body, { headers });
}

export async function handleFileUpload(
  request: Request,
  env: Env,
  currentUserId: string,
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folderValue = formData.get('folder');
    const folder = typeof folderValue === 'string' ? folderValue : 'uploads';
    if (!(file instanceof File)) return errorResponse('File is required', 400, env, request);
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const extension = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
    const extensionToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const effectiveMimeType = allowedMimeTypes.includes(file.type)
      ? file.type
      : file.type === 'application/octet-stream' || !file.type
        ? extensionToMime[extension]
        : null;
    const allowedFolders = ['uploads', 'avatars', 'properties', 'documents'];
    const safeFolder = allowedFolders.includes(folder) ? folder : 'uploads';
    if (!effectiveMimeType) return errorResponse('File type not allowed', 400, env, request);
    if (file.size > 10 * 1024 * 1024)
      return errorResponse('File too large (max 10MB)', 400, env, request);
    if (file.size === 0) return errorResponse('Empty file', 400, env, request);
    const safeName = file.name
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        if (code <= 31) return '_';
        return /[/\\<>:"|?*]/.test(char) ? '_' : char;
      })
      .join('')
      .slice(0, 200);
    const fileKey = `${safeFolder}/${currentUserId}/${generateId()}_${safeName}`;
    await env.R2.put(fileKey, file.stream(), { httpMetadata: { contentType: effectiveMimeType } });
    const response = jsonResponse(
      { key: fileKey, name: safeName, size: file.size, type: effectiveMimeType },
      201,
      env,
      request,
    );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('Failed to upload file', 500, env, request);
  }
}

export async function handleFilesRoute(
  request: Request,
  env: Env,
  path: string,
  method: string,
  jwtSecret: string,
): Promise<Response | null> {
  if (method === 'GET' && /^\/api\/files\/.+$/.test(path)) {
    const authResult = await verifyAuth(request, env, jwtSecret);
    if (!authResult.success) return errorResponse('Unauthorized', 401, env, request);
    const key = decodeURIComponent(path.slice('/api/files/'.length));
    return handleGetFile(request, env, key);
  }

  if (path === '/api/files/upload' && method === 'POST') {
    const authResult = await verifyAuth(request, env, jwtSecret);
    if (!authResult.success || !authResult.user)
      return errorResponse('Unauthorized', 401, env, request);
    return handleFileUpload(request, env, authResult.user.id);
  }

  if (path === '/api/documents' || path.startsWith('/api/documents/')) {
    return delegateToLegacy(request, env);
  }

  return null;
}
