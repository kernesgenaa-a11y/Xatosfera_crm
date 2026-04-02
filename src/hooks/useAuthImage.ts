import { useEffect, useState } from 'react';
import { authFetch } from '@/integrations/cloudflare/client';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const imageCache = new Map<string, { objectURL: string; expiresAt: number }>();
const pendingImageLoads = new Map<string, Promise<string>>();

function buildFileUrl(key: string): string {
  if (key.startsWith('http://') || key.startsWith('https://')) return '';
  return `${API_URL}/api/files/${encodeURIComponent(key)}`;
}

function deleteCacheEntry(cacheKey: string) {
  const cached = imageCache.get(cacheKey);
  if (!cached) return;
  URL.revokeObjectURL(cached.objectURL);
  imageCache.delete(cacheKey);
}

function getCachedImage(cacheKey: string): string | null {
  const cached = imageCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    deleteCacheEntry(cacheKey);
    return null;
  }
  imageCache.delete(cacheKey);
  imageCache.set(cacheKey, cached);
  return cached.objectURL;
}

function setCachedImage(cacheKey: string, objectURL: string) {
  deleteCacheEntry(cacheKey);
  imageCache.set(cacheKey, { objectURL, expiresAt: Date.now() + CACHE_TTL_MS });
  while (imageCache.size > MAX_CACHE_SIZE) {
    const oldestKey = imageCache.keys().next().value;
    if (!oldestKey) break;
    deleteCacheEntry(oldestKey);
  }
}

async function loadAndCacheImage(key: string, signal: AbortSignal): Promise<string> {
  const pending = pendingImageLoads.get(key);
  if (pending) return pending;

  const request = authFetch(buildFileUrl(key), {
    signal,
    headers: { Accept: 'image/webp,image/*,*/*' },
  })
    .then(async (response) => {
      if (!response.ok) return '';
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setCachedImage(key, objectUrl);
      return objectUrl;
    })
    .finally(() => {
      pendingImageLoads.delete(key);
    });

  pendingImageLoads.set(key, request);
  return request;
}

export function useAuthImage(key: string | null | undefined): string {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!key) {
      setSrc('');
      return;
    }

    if (key.startsWith('http://') || key.startsWith('https://')) {
      setSrc('');
      return;
    }

    const cachedSrc = getCachedImage(key);
    if (cachedSrc) {
      setSrc(cachedSrc);
      return;
    }

    const controller = new AbortController();

    const loadImage = async () => {
      try {
        const objectUrl = await loadAndCacheImage(key, controller.signal);
        if (!objectUrl) {
          setSrc('');
          return;
        }
        setSrc(objectUrl);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to load auth image:', error);
        setSrc('');
      }
    };

    void loadImage();

    return () => {
      controller.abort();
    };
  }, [key]);

  return src;
}
