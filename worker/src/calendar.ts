import type { Env } from "./types";
import { delegateToLegacy, matchesAnyPrefix } from "./legacy";

const CALENDAR_PREFIXES = ["/api/calendar-events"] as const;

export function canHandleCalendarRoute(path: string): boolean {
  return matchesAnyPrefix(path, CALENDAR_PREFIXES);
}

export function handleCalendarRoute(request: Request, env: Env): Promise<Response> {
  return delegateToLegacy(request, env);
}
