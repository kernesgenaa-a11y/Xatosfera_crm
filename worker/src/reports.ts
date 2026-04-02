import type { Env } from "./types";
import { delegateToLegacy, matchesAnyPrefix } from "./legacy";

const REPORT_PREFIXES = ["/api/reports"] as const;

export function canHandleReportsRoute(path: string): boolean {
  return matchesAnyPrefix(path, REPORT_PREFIXES);
}

export function handleReportsRoute(request: Request, env: Env): Promise<Response> {
  return delegateToLegacy(request, env);
}
