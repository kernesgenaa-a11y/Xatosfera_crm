const WORKER_FALLBACK_URL = 'https://crm-api.0991597753r.workers.dev';

export function getApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  const normalizedConfigured = configured?.trim().replace(/\/$/, '') || '';

  if (normalizedConfigured) return normalizedConfigured;

  return WORKER_FALLBACK_URL;
}
