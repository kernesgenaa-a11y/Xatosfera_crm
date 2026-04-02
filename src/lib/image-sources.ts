import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl();
const PIPELINE_IMAGE_ID_RE = /^[a-f0-9]{32}$/i;

function getAccessToken(): string {
  return localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token') ?? '';
}

function buildFileUrl(key: string): string {
  if (key.startsWith('http://') || key.startsWith('https://')) return '';
  const url = new URL(`${API_URL}/api/files/${encodeURIComponent(key)}`);
  const token = getAccessToken();
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function getImageSources(imageId: string | null | undefined) {
  if (!imageId) return { thumb: '', card: '', detail: '', full: '' };

  if (!PIPELINE_IMAGE_ID_RE.test(imageId)) {
    const legacyUrl = buildFileUrl(imageId);
    return { thumb: legacyUrl, card: legacyUrl, detail: legacyUrl, full: legacyUrl };
  }

  return {
    thumb: buildFileUrl(`images/${imageId}/thumb.webp`),
    card: buildFileUrl(`images/${imageId}/card.webp`),
    detail: buildFileUrl(`images/${imageId}/detail.webp`),
    full: buildFileUrl(`images/${imageId}/full.webp`),
  };
}
