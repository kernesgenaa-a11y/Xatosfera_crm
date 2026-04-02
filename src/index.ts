import type { Env } from './types';
import { handleAuthRoute } from './auth';
import { canHandleCalendarRoute, handleCalendarRoute } from './calendar';
import { canHandleClientsRoute, handleClientsRoute } from './clients';
import { canHandleDealsRoute, handleDealsRoute } from './deals';
import { handleFilesRoute } from './files';
import { handleGetImageManifest, handleImageUpload, processImageQueue } from './images';
import { delegateToLegacy } from './legacy';
import { canHandleMatchesRoute, handleMatchesRoute } from './matches';
import { canHandleNotesRoute, handleNotesRoute } from './notes';
import { canHandleNotificationsRoute, handleNotificationsRoute } from './notifications';
import { canHandlePropertiesRoute, handlePropertiesRoute } from './properties';
import { canHandleReportsRoute, handleReportsRoute } from './reports';
import { canHandleUsersRoute, handleUsersRoute } from './users';
import { errorResponse, handleOptions } from './utils';

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return handleOptions(request, env);
    if (!env.JWT_SECRET)
      return errorResponse('Server misconfiguration: JWT_SECRET is missing', 500, env, request);

    const authResponse = await handleAuthRoute(request, env, path, method, env.JWT_SECRET);
    if (authResponse) return authResponse;

    const imageUploadResponse = await handleImageUpload(request, env, env.JWT_SECRET);
    if (imageUploadResponse) return imageUploadResponse;

    const imageManifestResponse = await handleGetImageManifest(request, env, env.JWT_SECRET);
    if (imageManifestResponse) return imageManifestResponse;

    const fileResponse = await handleFilesRoute(request, env, path, method, env.JWT_SECRET);
    if (fileResponse) return fileResponse;

    if (canHandleUsersRoute(path)) return handleUsersRoute(request, env);
    if (canHandlePropertiesRoute(path)) return handlePropertiesRoute(request, env);
    if (canHandleClientsRoute(path)) return handleClientsRoute(request, env);
    if (canHandleDealsRoute(path)) return handleDealsRoute(request, env);
    if (canHandleNotesRoute(path)) return handleNotesRoute(request, env);
    if (canHandleCalendarRoute(path)) return handleCalendarRoute(request, env);
    if (canHandleNotificationsRoute(path)) return handleNotificationsRoute(request, env);
    if (canHandleMatchesRoute(path)) return handleMatchesRoute(request, env);
    if (canHandleReportsRoute(path)) return handleReportsRoute(request, env);

    return delegateToLegacy(request, env);
  },

  async queue(batch: { messages: Array<{ body: unknown }> }, env: Env): Promise<void> {
    await processImageQueue(
      batch as {
        messages: Array<{ body: { id: string; originalKey: string; contentType: string } }>;
      },
      env,
    );
  },
};

export default worker;
