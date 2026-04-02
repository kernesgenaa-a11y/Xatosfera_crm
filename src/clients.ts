import { generateId, verifyAuth } from './auth';
import { convertToUsd } from './currency';
import { matchesAnyPrefix } from './legacy';
import type { Env, UserRecord } from './types';
import {
  buildOrderClause,
  buildPaginatedPayload,
  decodeCursor,
  errorResponse,
  jsonResponse,
  parseBody,
  parsePagination,
  parseQuery,
} from './utils';

const CLIENT_PREFIXES = ['/api/clients', '/api/client-interactions'] as const;

type ClientsEnv = Env & {
  __historyTablesReady?: boolean;
  __clientSchemaSupport?: {
    hasDistrict: boolean;
    hasRoomsFrom: boolean;
    hasRoomsTo: boolean;
    hasStatus: boolean;
    hasLandAreaSotky: boolean;
    hasBudgetMaxUsd: boolean;
  };
  __ensureLandAreaColumnsPromise?: Promise<void>;
};

export function canHandleClientsRoute(path: string): boolean {
  return matchesAnyPrefix(path, CLIENT_PREFIXES);
}

export async function handleClientsRoute(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  const method = request.method;

  if (!env.JWT_SECRET) {
    return errorResponse('Server misconfiguration: JWT_SECRET is missing', 500, env, request);
  }

  const auth = await verifyAuth(request, env, env.JWT_SECRET);
  if (!auth.success || !auth.user) return errorResponse('Unauthorized', 401, env, request);

  if (path === '/api/clients' && method === 'GET') {
    return handleGetClients(new URL(request.url), env as ClientsEnv, request);
  }
  if (path === '/api/clients' && method === 'POST') {
    return handleCreateClient(request, env as ClientsEnv, auth.user);
  }
  if (/^\/api\/clients\/[^/]+$/.test(path) && (method === 'PUT' || method === 'PATCH')) {
    return handleUpdateClient(request, env as ClientsEnv, path.split('/')[3], auth.user);
  }
  if (/^\/api\/clients\/[^/]+\/history$/.test(path) && method === 'GET') {
    return handleGetClientHistory(env as ClientsEnv, path.split('/')[3], request);
  }
  if (/^\/api\/clients\/[^/]+$/.test(path) && method === 'DELETE') {
    return handleDeleteClient(env as ClientsEnv, path.split('/')[3], request);
  }
  if (path === '/api/client-interactions' && method === 'GET') {
    return handleGetInteractions(new URL(request.url), env as ClientsEnv, request);
  }
  if (path === '/api/client-interactions' && method === 'POST') {
    return handleCreateInteraction(request, env as ClientsEnv, auth.user);
  }
  if (/^\/api\/client-interactions\/[^/]+$/.test(path) && method === 'DELETE') {
    return handleDeleteInteraction(env as ClientsEnv, path.split('/')[3], auth.user, request);
  }

  return errorResponse('Not found', 404, env, request);
}

async function ensureLandAreaColumns(env: ClientsEnv): Promise<void> {
  if (env.__ensureLandAreaColumnsPromise) return env.__ensureLandAreaColumnsPromise;
  env.__ensureLandAreaColumnsPromise = (async () => {
    const clientSchema = await env.DB.prepare('PRAGMA table_info(clients)').all<{
      name?: string;
    }>();
    const clientColumns = new Set(
      (clientSchema.results ?? []).map((column) => column?.name).filter(Boolean),
    );
    if (!clientColumns.has('land_area_sotky')) {
      await env.DB.prepare('ALTER TABLE clients ADD COLUMN land_area_sotky REAL').run();
    }
    if (!clientColumns.has('budget_max_usd')) {
      await env.DB.prepare('ALTER TABLE clients ADD COLUMN budget_max_usd REAL').run();
      await env.DB.prepare(
        "UPDATE clients SET budget_max_usd = CASE UPPER(COALESCE(currency, 'USD')) WHEN 'USD' THEN budget WHEN 'EUR' THEN ROUND(budget * 1.08, 2) WHEN 'UAH' THEN ROUND(budget * 0.024, 2) ELSE budget END WHERE budget IS NOT NULL AND budget_max_usd IS NULL",
      ).run();
    }
    delete env.__clientSchemaSupport;
  })();
  return env.__ensureLandAreaColumnsPromise;
}

async function getClientSchemaSupport(env: ClientsEnv): Promise<{
  hasDistrict: boolean;
  hasRoomsFrom: boolean;
  hasRoomsTo: boolean;
  hasStatus: boolean;
  hasLandAreaSotky: boolean;
  hasBudgetMaxUsd: boolean;
}> {
  await ensureLandAreaColumns(env);
  if (env.__clientSchemaSupport) return env.__clientSchemaSupport;

  const schema = await env.DB.prepare('PRAGMA table_info(clients)').all<{ name?: string }>();
  const columnNames = new Set((schema.results ?? []).map((column) => column?.name).filter(Boolean));
  env.__clientSchemaSupport = {
    hasDistrict: columnNames.has('district'),
    hasRoomsFrom: columnNames.has('rooms_from'),
    hasRoomsTo: columnNames.has('rooms_to'),
    hasStatus: columnNames.has('status'),
    hasLandAreaSotky: columnNames.has('land_area_sotky'),
    hasBudgetMaxUsd: columnNames.has('budget_max_usd'),
  };
  return env.__clientSchemaSupport;
}

async function ensureHistoryTables(env: ClientsEnv): Promise<void> {
  if (env.__historyTablesReady) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS property_history (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    changed_by TEXT,
    action TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS client_history (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    changed_by TEXT,
    action TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  ).run();
  env.__historyTablesReady = true;
}

async function appendClientHistory(
  env: ClientsEnv,
  clientId: string,
  changedBy: string | null,
  action: string,
  payload: unknown,
): Promise<void> {
  await ensureHistoryTables(env);
  await env.DB.prepare(
    "INSERT INTO client_history (id, client_id, changed_by, action, payload, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
  )
    .bind(generateId(), clientId, changedBy, action, JSON.stringify(payload ?? {}))
    .run();
}

async function handleGetClients(url: URL, env: ClientsEnv, request: Request): Promise<Response> {
  type ClientListRow = Record<string, unknown> & {
    id?: string;
    created_at?: string;
  };
  const query = parseQuery(url);
  const { limit, cursor } = parsePagination(url);
  const orderBy = limit ? 'ORDER BY created_at DESC, id DESC' : buildOrderClause(query.sort);
  const cursorFilter = decodeCursor(cursor);
  const clientSchema = await getClientSchemaSupport(env);
  const sql = `SELECT id,full_name,phone,email,segment,age,budget,budget_max_usd,currency,property_type,
                      ${clientSchema.hasRoomsFrom ? 'rooms_from,' : 'rooms_needed AS rooms_from,'}
                      ${clientSchema.hasRoomsTo ? 'rooms_to,' : 'NULL AS rooms_to,'}
                      ${clientSchema.hasDistrict ? 'district,' : 'NULL AS district,'}
                      ${clientSchema.hasLandAreaSotky ? 'land_area_sotky,' : 'NULL AS land_area_sotky,'}
                      status,tags,notes,manager_id,linked_property_id,
                      created_by,created_at,updated_at
               FROM clients
               ${cursorFilter ? 'WHERE (created_at < ? OR (created_at = ? AND id < ?))' : ''}
               ${orderBy}
               ${limit ? 'LIMIT ?' : ''}`;
  const bindings: Array<string | number> = [];
  if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
  if (limit) bindings.push(limit + 1);
  const results = await env.DB.prepare(sql)
    .bind(...bindings)
    .all<ClientListRow>();
  const clients = (results.results ?? []).map((client) => ({
    ...client,
    tags: typeof client.tags === 'string' && client.tags ? JSON.parse(client.tags) : [],
  }));
  return jsonResponse(buildPaginatedPayload(clients, limit), 200, env, request);
}

async function handleCreateClient(
  request: Request,
  env: ClientsEnv,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body || !body.full_name) return errorResponse('Full name is required', 400, env, request);

  const id = generateId();
  const managerId = String(body.manager_id || currentUser.id);
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const segment = String(body.segment || 'buyer');
  const currency = String(body.currency || 'UAH');
  const propertyType = String(body.property_type || 'apartment');
  const clientSchema = await getClientSchemaSupport(env);
  const roomsFrom = body.rooms_from ?? body.rooms_needed ?? 1;
  const roomsTo = body.rooms_to ?? null;
  const budget = body.budget != null ? Number(body.budget) : null;
  const budgetMaxUsd = convertToUsd(budget, currency);

  const insertColumns = [
    'id',
    'full_name',
    'phone',
    'email',
    'segment',
    'age',
    'budget',
    'budget_max_usd',
    'currency',
    'tags',
    'notes',
    'property_type',
  ];
  const insertValues: unknown[] = [
    id,
    body.full_name,
    body.phone || null,
    body.email || null,
    segment,
    body.age != null ? Number(body.age) : null,
    budget,
    budgetMaxUsd,
    currency,
    JSON.stringify(tags),
    body.notes || null,
    propertyType,
  ];

  if (clientSchema.hasRoomsFrom) {
    insertColumns.push('rooms_from');
    insertValues.push(roomsFrom != null ? Number(roomsFrom) : null);
  } else {
    insertColumns.push('rooms_needed');
    insertValues.push(roomsFrom != null ? Number(roomsFrom) : null);
  }
  if (clientSchema.hasRoomsTo) {
    insertColumns.push('rooms_to');
    insertValues.push(roomsTo != null ? Number(roomsTo) : null);
  }
  if (clientSchema.hasDistrict) {
    insertColumns.push('district');
    insertValues.push(body.district || null);
  }
  if (clientSchema.hasLandAreaSotky) {
    insertColumns.push('land_area_sotky');
    insertValues.push(body.land_area_sotky != null ? Number(body.land_area_sotky) : null);
  }

  insertColumns.push('manager_id', 'created_by', 'created_at', 'updated_at');
  insertValues.push(managerId, currentUser.id);

  await env.DB.prepare(
    `INSERT INTO clients (${insertColumns.join(', ')}) VALUES (${insertColumns
      .map((column) =>
        column === 'created_at' || column === 'updated_at' ? "datetime('now')" : '?',
      )
      .join(', ')})`,
  )
    .bind(...insertValues)
    .run();

  await appendClientHistory(env, id, currentUser.id, 'created', body);

  if (managerId !== currentUser.id) {
    const notifId = generateId();
    const senderName = currentUser.full_name || 'Топ-менеджер';
    const clientName = String(body.full_name || 'Новий клієнт');
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, 'assignment', 'client', ?, 0, datetime('now'))`,
    )
      .bind(
        notifId,
        managerId,
        'Новий клієнт призначено',
        `${senderName} призначив вам клієнта: ${clientName}`,
        id,
      )
      .run();
  }

  return jsonResponse(
    {
      id,
      full_name: body.full_name,
      phone: body.phone || null,
      email: body.email || null,
      segment,
      age: body.age != null ? Number(body.age) : null,
      budget,
      budget_max_usd: budgetMaxUsd,
      currency,
      tags,
      notes: body.notes || null,
      property_type: propertyType,
      rooms_from: roomsFrom,
      rooms_to: roomsTo,
      manager_id: managerId,
      created_by: currentUser.id,
      status: body.status || null,
      linked_property_id: body.linked_property_id || null,
      district: body.district || null,
      land_area_sotky: body.land_area_sotky != null ? Number(body.land_area_sotky) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    201,
    env,
    request,
  );
}

async function handleUpdateClient(
  request: Request,
  env: ClientsEnv,
  id: string,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body) return errorResponse('Invalid body', 400, env, request);

  const clientSchema = await getClientSchemaSupport(env);
  const current = await env.DB.prepare('SELECT budget, currency FROM clients WHERE id = ?')
    .bind(id)
    .first<{ budget: number | null; currency: string | null }>();

  const updates: string[] = [];
  const values: unknown[] = [];
  const fields = [
    'full_name',
    'phone',
    'email',
    'segment',
    'notes',
    'property_type',
    'manager_id',
    'status',
    'linked_property_id',
  ];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (body.age !== undefined) {
    updates.push('age = ?');
    values.push(body.age != null ? Number(body.age) : null);
  }

  const nextBudget = body.budget !== undefined ? Number(body.budget) : (current?.budget ?? null);
  const nextCurrency =
    body.currency !== undefined ? String(body.currency) : (current?.currency ?? 'UAH');
  if (body.budget !== undefined) {
    updates.push('budget = ?');
    values.push(nextBudget);
  }
  if (body.currency !== undefined) {
    updates.push('currency = ?');
    values.push(nextCurrency);
  }
  if (body.budget !== undefined || body.currency !== undefined) {
    updates.push('budget_max_usd = ?');
    values.push(convertToUsd(nextBudget, nextCurrency));
  }

  if (body.rooms_from !== undefined) {
    updates.push(`${clientSchema.hasRoomsFrom ? 'rooms_from' : 'rooms_needed'} = ?`);
    values.push(body.rooms_from != null ? Number(body.rooms_from) : null);
  }
  if (body.rooms_to !== undefined && clientSchema.hasRoomsTo) {
    updates.push('rooms_to = ?');
    values.push(body.rooms_to != null ? Number(body.rooms_to) : null);
  }
  if (body.district !== undefined && clientSchema.hasDistrict) {
    updates.push('district = ?');
    values.push(body.district);
  }
  if (body.land_area_sotky !== undefined && clientSchema.hasLandAreaSotky) {
    updates.push('land_area_sotky = ?');
    values.push(body.land_area_sotky != null ? Number(body.land_area_sotky) : null);
  }
  if (body.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(body.tags));
  }

  if (updates.length === 0) return errorResponse('No fields to update', 400, env, request);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  await env.DB.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
  await appendClientHistory(env, id, currentUser.id, 'updated', body);

  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}

async function handleGetClientHistory(
  env: ClientsEnv,
  id: string,
  request: Request,
): Promise<Response> {
  await ensureHistoryTables(env);
  const rows = await env.DB.prepare(
    `SELECT h.id, h.client_id, h.changed_by, h.action, h.payload, h.created_at, u.full_name AS changed_by_name
     FROM client_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.client_id = ?
     ORDER BY h.created_at DESC
     LIMIT 100`,
  )
    .bind(id)
    .all<Record<string, unknown>>();

  const data = (rows.results ?? []).map((row) => ({
    ...row,
    payload: typeof row.payload === 'string' && row.payload ? JSON.parse(row.payload) : {},
  }));
  return jsonResponse(data, 200, env, request);
}

async function handleDeleteClient(
  env: ClientsEnv,
  id: string,
  request: Request,
): Promise<Response> {
  await env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}

async function handleGetInteractions(
  url: URL,
  env: ClientsEnv,
  request: Request,
): Promise<Response> {
  const query = parseQuery(url);
  let sql =
    'SELECT id, client_id, user_id, interaction_type, notes, created_at FROM client_interactions';
  const values: string[] = [];
  if (query.client_id) {
    sql += ' WHERE client_id = ?';
    values.push(query.client_id);
  }
  sql += ' ORDER BY created_at DESC';
  const result =
    values.length > 0
      ? await env.DB.prepare(sql)
          .bind(...values)
          .all<Record<string, unknown>>()
      : await env.DB.prepare(sql).all<Record<string, unknown>>();
  return jsonResponse(result.results ?? [], 200, env, request);
}

function mapInteractionTypeToEventType(interactionType: unknown): string {
  switch (interactionType) {
    case 'meeting':
      return 'meeting';
    case 'viewing':
    case 'showing':
      return 'viewing';
    case 'deadline':
    case 'call':
      return String(interactionType);
    default:
      return 'other';
  }
}

function normalizeDateTimeValue(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const withFallbackTime = new Date(`${value}T09:00:00`);
  if (!Number.isNaN(withFallbackTime.getTime())) return withFallbackTime.toISOString();
  return null;
}

async function createCalendarEventFromInteraction(
  env: ClientsEnv,
  currentUser: UserRecord,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const startsAt = normalizeDateTimeValue(
    body.starts_at || body.scheduled_at || body.interaction_at || body.date,
  );
  if (!startsAt) return null;
  const endsAt =
    normalizeDateTimeValue(body.ends_at) ||
    new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();

  let clientName = 'Клієнт';
  if (body.client_id) {
    const client = await env.DB.prepare('SELECT full_name FROM clients WHERE id = ?')
      .bind(body.client_id)
      .first<{ full_name?: string }>();
    if (client?.full_name) clientName = client.full_name;
  }

  const eventType = mapInteractionTypeToEventType(body.interaction_type);
  const title = String(
    body.calendar_title ||
      body.title ||
      `${clientName}: ${String(body.interaction_type || 'interaction')}`,
  );
  const eventId = generateId();

  await env.DB.prepare(
    `INSERT INTO calendar_events (id, title, description, starts_at, ends_at, event_type, status, user_id, property_id, client_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  )
    .bind(
      eventId,
      title,
      body.calendar_description || body.notes || null,
      startsAt,
      endsAt,
      eventType,
      body.calendar_status || 'planned',
      currentUser.id,
      body.property_id || null,
      body.client_id || null,
    )
    .run();

  return {
    id: eventId,
    title,
    description: body.calendar_description || body.notes || null,
    starts_at: startsAt,
    ends_at: endsAt,
    event_type: eventType,
    status: body.calendar_status || 'planned',
    user_id: currentUser.id,
    property_id: body.property_id || null,
    client_id: body.client_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function handleCreateInteraction(
  request: Request,
  env: ClientsEnv,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body || !body.client_id) return errorResponse('Client ID is required', 400, env, request);

  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO client_interactions (id, client_id, user_id, interaction_type, notes, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(id, body.client_id, currentUser.id, body.interaction_type || null, body.notes || null)
    .run();

  const interaction = {
    id,
    client_id: body.client_id,
    user_id: currentUser.id,
    interaction_type: body.interaction_type || null,
    notes: body.notes || null,
    created_at: new Date().toISOString(),
  };

  let calendarEvent: Record<string, unknown> | null = null;
  if (
    body.create_calendar_event ||
    body.sync_to_calendar ||
    body.starts_at ||
    body.scheduled_at ||
    body.interaction_at ||
    body.date
  ) {
    calendarEvent = await createCalendarEventFromInteraction(env, currentUser, body);
  }

  return jsonResponse({ ...interaction, calendar_event: calendarEvent }, 201, env, request);
}

async function handleDeleteInteraction(
  env: ClientsEnv,
  id: string,
  currentUser: UserRecord,
  request: Request,
): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id, user_id FROM client_interactions WHERE id = ?')
    .bind(id)
    .first<{ id: string; user_id: string }>();
  if (!existing) return errorResponse('Interaction not found', 404, env, request);

  const isPrivileged = currentUser.role === 'top_manager' || currentUser.role === 'superuser';
  if (!isPrivileged && existing.user_id !== currentUser.id) {
    return errorResponse('Forbidden', 403, env, request);
  }

  await env.DB.prepare('DELETE FROM client_interactions WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
