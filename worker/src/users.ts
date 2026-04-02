import type { Env } from "./types";
import { delegateToLegacy, matchesAnyPrefix } from "./legacy";

const USER_PREFIXES = ["/api/users"] as const;

export function canHandleUsersRoute(path: string): boolean {
  return matchesAnyPrefix(path, USER_PREFIXES);
}

export function handleUsersRoute(request: Request, env: Env): Promise<Response> {
  return delegateToLegacy(request, env);
}
