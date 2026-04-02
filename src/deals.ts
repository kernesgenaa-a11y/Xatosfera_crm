import type { Env } from './types';
import { delegateToLegacy, matchesAnyPrefix } from './legacy';

const DEAL_PREFIXES = ['/api/deals'] as const;

export function canHandleDealsRoute(path: string): boolean {
  return matchesAnyPrefix(path, DEAL_PREFIXES);
}

export function handleDealsRoute(request: Request, env: Env): Promise<Response> {
  return delegateToLegacy(request, env);
}
