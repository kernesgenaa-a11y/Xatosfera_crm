import type { Env } from "./types";
import { delegateToLegacy, matchesAnyPrefix } from "./legacy";

const NOTIFICATION_PREFIXES = ["/api/notifications"] as const;

export function canHandleNotificationsRoute(path: string): boolean {
  return matchesAnyPrefix(path, NOTIFICATION_PREFIXES);
}

export function handleNotificationsRoute(request: Request, env: Env): Promise<Response> {
  return delegateToLegacy(request, env);
}
