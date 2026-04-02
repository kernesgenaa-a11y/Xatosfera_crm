import type { Env } from "./types";
import { delegateToLegacy, matchesAnyPrefix } from "./legacy";

const NOTE_PREFIXES = ["/api/notes"] as const;

export function canHandleNotesRoute(path: string): boolean {
  return matchesAnyPrefix(path, NOTE_PREFIXES);
}

export function handleNotesRoute(request: Request, env: Env): Promise<Response> {
  return delegateToLegacy(request, env);
}
