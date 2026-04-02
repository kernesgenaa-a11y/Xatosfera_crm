import legacyWorker from "../../worker-index.js";
import type { Env, LegacyWorkerModule } from "./types";

const worker = legacyWorker as LegacyWorkerModule;

export function delegateToLegacy(request: Request, env: Env): Promise<Response> {
  return worker.fetch(request, env);
}

export function matchesAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export default worker;
