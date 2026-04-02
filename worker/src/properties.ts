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
  parseJsonArray,
  parsePagination,
  parseQuery,
} from './utils';

const PROPERTY_PREFIXES = ['/api/properties'] as const;
const PROPERTY_FULL_COLUMNS =
  'id, title, description, address, city, district, street, building_number, block, floor, apartment, latitude, longitude, operation_type, category, source, status, rooms, area_total, area_living, area_kitchen, floors_total, property_condition, heating, bathroom, balcony_type, price, price_usd, currency, price_per_sqm, negotiable, additional_costs, owner_name, owner_phones, owner_notes, photos, documents, tags, agent_notes, linked_client_id, linked_deal_id, manager_id, created_by, created_at, updated_at';

type PropertiesEnv = Env & {
  __historyTablesReady?: boolean;
  __propertySchemaSupport?: {
    hasUpdatedBy: boolean;
    hasLandAreaSotky: boolean;
  };
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

export function canHandlePropertiesRoute(path: string): boolean {
  return matchesAnyPrefix(path, PROPERTY_PREFIXES);
}

export async function handlePropertiesRoute(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  const method = request.method;

  if (!env.JWT_SECRET) {
    return errorResponse('Server misconfiguration: JWT_SECRET is missing', 500, env, request);
  }

  const auth = await verifyAuth(request, env, env.JWT_SECRET);
  if (!auth.success || !auth.user) return errorResponse('Unauthorized', 401, env, request);

  if (path === '/api/properties' && method === 'GET') {
    return handleGetProperties(new URL(request.url), env as PropertiesEnv, auth.user, request);
  }
  if (path === '/api/properties' && method === 'POST') {
    return handleCreateProperty(request, env as PropertiesEnv, auth.user);
  }
  if (/^\/api\/properties\/[^/]+$/.test(path) && method === 'GET') {
    return handleGetProperty(env as PropertiesEnv, path.split('/')[3], request);
  }
  if (/^\/api\/properties\/[^/]+\/history$/.test(path) && method === 'GET') {
    return handleGetPropertyHistory(env as PropertiesEnv, path.split('/')[3], request);
  }
  if (/^\/api\/properties\/[^/]+$/.test(path) && (method === 'PUT' || method === 'PATCH')) {
    return handleUpdateProperty(request, env as PropertiesEnv, path.split('/')[3], auth.user);
  }
  if (/^\/api\/properties\/[^/]+$/.test(path) && method === 'DELETE') {
    return handleDeleteProperty(env as PropertiesEnv, path.split('/')[3], request);
  }

  return errorResponse('Not found', 404, env, request);
}

async function ensureLandAreaColumns(env: PropertiesEnv): Promise<void> {
  if (env.__ensureLandAreaColumnsPromise) return env.__ensureLandAreaColumnsPromise;
  env.__ensureLandAreaColumnsPromise = (async () => {
    const [clientSchema, propertySchema] = await Promise.all([
      env.DB.prepare('PRAGMA table_info(clients)').all<{ name?: string }>(),
      env.DB.prepare('PRAGMA table_info(properties)').all<{ name?: string }>(),
    ]);
    const clientColumns = new Set(
      (clientSchema.results ?? []).map((column) => column?.name).filter(Boolean),
    );
    const propertyColumns = new Set(
      (propertySchema.results ?? []).map((column) => column?.name).filter(Boolean),
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
    if (!propertyColumns.has('land_area_sotky')) {
      await env.DB.prepare('ALTER TABLE properties ADD COLUMN land_area_sotky REAL').run();
      await env.DB.prepare(
        "UPDATE properties SET land_area_sotky = area_total WHERE category = 'land_plot' AND land_area_sotky IS NULL AND area_total IS NOT NULL",
      ).run();
    }
    if (!propertyColumns.has('price_usd')) {
      await env.DB.prepare('ALTER TABLE properties ADD COLUMN price_usd REAL').run();
      await env.DB.prepare(
        "UPDATE properties SET price_usd = CASE UPPER(COALESCE(currency, 'USD')) WHEN 'USD' THEN price WHEN 'EUR' THEN ROUND(price * 1.08, 2) WHEN 'UAH' THEN ROUND(price * 0.024, 2) ELSE price END WHERE price IS NOT NULL AND price_usd IS NULL",
      ).run();
    }

    delete env.__propertySchemaSupport;
    delete env.__clientSchemaSupport;
  })();
  return env.__ensureLandAreaColumnsPromise;
}

async function getPropertySchemaSupport(env: PropertiesEnv): Promise<{
  hasUpdatedBy: boolean;
  hasLandAreaSotky: boolean;
}> {
  await ensureLandAreaColumns(env);
  if (env.__propertySchemaSupport) return env.__propertySchemaSupport;

  const schema = await env.DB.prepare('PRAGMA table_info(properties)').all<{ name?: string }>();
  const columnNames = new Set((schema.results ?? []).map((column) => column?.name).filter(Boolean));
  env.__propertySchemaSupport = {
    hasUpdatedBy: columnNames.has('updated_by'),
    hasLandAreaSotky: columnNames.has('land_area_sotky'),
  };
  return env.__propertySchemaSupport;
}

async function getClientSchemaSupport(env: PropertiesEnv): Promise<{
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

async function ensureHistoryTables(env: PropertiesEnv): Promise<void> {
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

async function appendPropertyHistory(
  env: PropertiesEnv,
  propertyId: string,
  changedBy: string | null,
  action: string,
  payload: unknown,
): Promise<void> {
  await ensureHistoryTables(env);
  await env.DB.prepare(
    "INSERT INTO property_history (id, property_id, changed_by, action, payload, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
  )
    .bind(generateId(), propertyId, changedBy, action, JSON.stringify(payload ?? {}))
    .run();
}

function parsePropertyRow<T extends Record<string, unknown>>(
  property: T,
): T & {
  photos: string[];
  documents: string[];
  tags: string[];
  owner_phones: string[];
} {
  return {
    ...property,
    photos: parseJsonArray(property.photos),
    documents: parseJsonArray(property.documents),
    tags: parseJsonArray(property.tags),
    owner_phones: parseJsonArray(property.owner_phones),
  };
}

async function handleGetProperties(
  url: URL,
  env: PropertiesEnv,
  _currentUser: UserRecord,
  request: Request,
): Promise<Response> {
  type PropertyListRow = Record<string, unknown> & {
    id?: string;
    created_at?: string;
  };
  const query = parseQuery(url);
  const { limit, cursor } = parsePagination(url);
  const orderBy = limit ? 'ORDER BY created_at DESC, id DESC' : buildOrderClause(query.sort);
  const cursorFilter = decodeCursor(cursor);
  const sql = `SELECT id,title,description,address,city,district,street,building_number,block,
                      floor,apartment,floors_total,latitude,longitude,operation_type,category,
                      source,status,rooms,area_total,area_living,area_kitchen,property_condition,
                      heating,bathroom,balcony_type,price,price_usd,currency,price_per_sqm,negotiable,
                      additional_costs,owner_name,owner_phones,tags,photos,
                      linked_client_id,linked_deal_id,manager_id,created_by,created_at,updated_at
               FROM properties
               ${cursorFilter ? 'WHERE (created_at < ? OR (created_at = ? AND id < ?))' : ''}
               ${orderBy}
               ${limit ? 'LIMIT ?' : ''}`;
  const bindings: Array<string | number> = [];
  if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
  if (limit) bindings.push(limit + 1);
  const results = await env.DB.prepare(sql)
    .bind(...bindings)
    .all<PropertyListRow>();
  const properties = (results.results ?? []).map((property) => parsePropertyRow(property));
  return jsonResponse(buildPaginatedPayload(properties, limit), 200, env, request);
}

async function upsertOwnerAsClient(
  env: PropertiesEnv,
  ownerName: string,
  ownerPhones: unknown,
  ownerEmail: string | null,
  ownerNotes: string | null,
  managerId: string,
  propertyId: string,
): Promise<string | null> {
  const normalizedOwnerName = ownerName.trim();
  if (!normalizedOwnerName) return null;

  const phones = parseJsonArray(ownerPhones);
  const firstPhone = phones[0] ?? null;
  let existing: { id: string } | null = null;

  if (firstPhone) {
    existing = await env.DB.prepare(
      "SELECT id FROM clients WHERE phone = ? AND segment = 'seller' LIMIT 1",
    )
      .bind(firstPhone)
      .first<{ id: string }>();
  }
  if (!existing) {
    existing = await env.DB.prepare(
      "SELECT id FROM clients WHERE full_name = ? AND segment = 'seller' LIMIT 1",
    )
      .bind(normalizedOwnerName)
      .first<{ id: string }>();
  }

  if (existing) {
    await env.DB.prepare(
      `UPDATE clients SET
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        manager_id = ?,
        linked_property_id = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
    )
      .bind(firstPhone, ownerEmail, ownerNotes, managerId, propertyId, existing.id)
      .run();
    return existing.id;
  }

  const clientId = generateId();
  const schema = await getClientSchemaSupport(env);
  const insertColumns = [
    'id',
    'full_name',
    'phone',
    'email',
    'notes',
    'segment',
    'budget',
    'budget_max_usd',
    'currency',
    'property_type',
    'manager_id',
    'linked_property_id',
    'created_by',
    'created_at',
    'updated_at',
  ];
  const insertValues: unknown[] = [
    clientId,
    normalizedOwnerName,
    firstPhone,
    ownerEmail,
    ownerNotes,
    'seller',
    null,
    null,
    'UAH',
    'apartment',
    managerId,
    propertyId,
    managerId,
  ];

  if (schema.hasRoomsFrom) {
    insertColumns.splice(10, 0, 'rooms_from');
    insertValues.splice(10, 0, null);
  } else {
    insertColumns.splice(10, 0, 'rooms_needed');
    insertValues.splice(10, 0, null);
  }
  if (schema.hasRoomsTo) {
    insertColumns.splice(11, 0, 'rooms_to');
    insertValues.splice(11, 0, null);
  }
  if (schema.hasDistrict) {
    insertColumns.splice(12, 0, 'district');
    insertValues.splice(12, 0, null);
  }

  await env.DB.prepare(
    `INSERT INTO clients (${insertColumns.join(', ')}) VALUES (${insertColumns
      .map((column) =>
        column === 'created_at' || column === 'updated_at' ? "datetime('now')" : '?',
      )
      .join(', ')})`,
  )
    .bind(...insertValues)
    .run();

  return clientId;
}

function getPropertyCategoryTitleUa(category: unknown): string {
  switch (category) {
    case 'apartment':
      return 'Квартира';
    case 'house':
      return 'Будинок';
    case 'commercial':
      return 'Комерція';
    case 'land_plot':
      return 'Ділянка';
    default:
      return "Об'єкт";
  }
}

function buildAutoPropertyTitle(
  category: unknown,
  street: unknown,
  buildingNumber: unknown,
): string {
  return [getPropertyCategoryTitleUa(category), String(street ?? ''), String(buildingNumber ?? '')]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLegacyAutoPropertyTitle(
  title: unknown,
  category: unknown,
  street: unknown,
  buildingNumber: unknown,
): boolean {
  if (!title || !category) return false;
  const normalizedTitle = String(title).replace(/\s+/g, ' ').trim().toLowerCase();
  const legacyTitle = [category, street ?? '', buildingNumber ?? '']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalizedTitle === legacyTitle;
}

async function handleCreateProperty(
  request: Request,
  env: PropertiesEnv,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body) return errorResponse('Invalid body', 400, env, request);

  const propertySchema = await getPropertySchemaSupport(env);
  const normalizedTitle =
    String(body.title || '').trim() ||
    buildAutoPropertyTitle(body.category, body.street, body.building_number);
  if (!normalizedTitle) return errorResponse('Title is required', 400, env, request);

  const id = generateId();
  const price = body.price != null ? Number(body.price) : null;
  const currency = String(body.currency || 'UAH');
  const priceUsd = convertToUsd(price, currency);

  const insertColumns = [
    'id',
    'title',
    'description',
    'address',
    'city',
    'district',
    'street',
    'building_number',
    'block',
    'floor',
    'apartment',
    'latitude',
    'longitude',
    'operation_type',
    'category',
    'source',
    'status',
    'rooms',
    'area_total',
    'area_living',
    'area_kitchen',
    'floors_total',
    'property_condition',
    'heating',
    'bathroom',
    'balcony_type',
    'price',
    'price_usd',
    'currency',
    'price_per_sqm',
    'negotiable',
    'additional_costs',
    'owner_name',
    'owner_phones',
    'owner_notes',
    'photos',
    'documents',
    'tags',
    'agent_notes',
    'linked_client_id',
    'linked_deal_id',
    'created_by',
    'manager_id',
    'created_at',
    'updated_at',
  ];
  const insertValues: unknown[] = [
    id,
    normalizedTitle,
    body.description || null,
    body.address || null,
    body.city || 'Кропивницький',
    body.district || null,
    body.street || null,
    body.building_number || null,
    body.block || null,
    body.floor != null ? Number(body.floor) : null,
    body.apartment || null,
    body.latitude != null ? Number(body.latitude) : null,
    body.longitude != null ? Number(body.longitude) : null,
    body.operation_type || null,
    body.category || null,
    body.source || null,
    body.status || 'active',
    body.rooms != null ? Number(body.rooms) : null,
    body.area_total != null ? Number(body.area_total) : null,
    body.area_living != null ? Number(body.area_living) : null,
    body.area_kitchen != null ? Number(body.area_kitchen) : null,
    body.floors_total != null ? Number(body.floors_total) : null,
    body.property_condition || null,
    body.heating || null,
    body.bathroom || null,
    body.balcony_type || null,
    price,
    priceUsd,
    currency,
    body.price_per_sqm != null ? Number(body.price_per_sqm) : null,
    body.negotiable ? 1 : 0,
    body.additional_costs || null,
    body.owner_name || null,
    JSON.stringify(body.owner_phones || []),
    body.owner_notes || null,
    JSON.stringify(body.photos || []),
    JSON.stringify(body.documents || []),
    JSON.stringify(body.tags || []),
    body.agent_notes || null,
    body.linked_client_id || null,
    body.linked_deal_id || null,
    currentUser.id,
    body.manager_id || currentUser.id,
  ];

  if (propertySchema.hasLandAreaSotky) {
    insertColumns.splice(26, 0, 'land_area_sotky');
    insertValues.splice(26, 0, body.land_area_sotky != null ? Number(body.land_area_sotky) : null);
  }

  await env.DB.prepare(
    `INSERT INTO properties (${insertColumns.join(', ')}) VALUES (${insertColumns
      .map((column) =>
        column === 'created_at' || column === 'updated_at' ? "datetime('now')" : '?',
      )
      .join(', ')})`,
  )
    .bind(...insertValues)
    .run();

  if (propertySchema.hasUpdatedBy) {
    await env.DB.prepare('UPDATE properties SET updated_by = ? WHERE id = ?')
      .bind(currentUser.id, id)
      .run();
  }

  await appendPropertyHistory(env, id, currentUser.id, 'created', body);

  if (body.owner_name) {
    const managerId = String(body.manager_id || currentUser.id);
    const clientId = await upsertOwnerAsClient(
      env,
      String(body.owner_name),
      body.owner_phones,
      null,
      typeof body.owner_notes === 'string' ? body.owner_notes : null,
      managerId,
      id,
    );
    if (clientId) {
      await env.DB.prepare('UPDATE properties SET linked_client_id = ? WHERE id = ?')
        .bind(clientId, id)
        .run();
    }
  }

  const assignedManagerId = String(body.manager_id || currentUser.id);
  if (assignedManagerId !== currentUser.id) {
    const notifId = generateId();
    const senderName = currentUser.full_name || 'Топ-менеджер';
    const propertyTitle = normalizedTitle || "Новий об'єкт";
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, 'assignment', 'property', ?, 0, datetime('now'))`,
    )
      .bind(
        notifId,
        assignedManagerId,
        "Новий об'єкт призначено",
        `${senderName} призначив вам об'єкт: ${propertyTitle}`,
        id,
      )
      .run();
  }

  return jsonResponse(
    {
      id,
      ...body,
      title: normalizedTitle,
      city: body.city || 'Кропивницький',
      status: body.status || 'active',
      currency,
      price,
      price_usd: priceUsd,
      photos: body.photos || [],
      documents: body.documents || [],
      tags: body.tags || [],
      owner_phones: body.owner_phones || [],
      negotiable: body.negotiable ? 1 : 0,
      created_by: currentUser.id,
      manager_id: body.manager_id || currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    201,
    env,
    request,
  );
}

async function handleGetProperty(
  env: PropertiesEnv,
  id: string,
  request: Request,
): Promise<Response> {
  const property = await env.DB.prepare(
    `SELECT ${PROPERTY_FULL_COLUMNS} FROM properties WHERE id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!property) return errorResponse('Property not found', 404, env, request);
  return jsonResponse(parsePropertyRow(property), 200, env, request);
}

async function handleGetPropertyHistory(
  env: PropertiesEnv,
  id: string,
  request: Request,
): Promise<Response> {
  await ensureHistoryTables(env);
  const rows = await env.DB.prepare(
    `SELECT h.id, h.property_id, h.changed_by, h.action, h.payload, h.created_at, u.full_name AS changed_by_name
     FROM property_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.property_id = ?
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

async function handleUpdateProperty(
  request: Request,
  env: PropertiesEnv,
  id: string,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body) return errorResponse('Invalid body', 400, env, request);

  const fallbackTitle = buildAutoPropertyTitle(body.category, body.street, body.building_number);
  if (
    body.title !== undefined &&
    (!String(body.title || '').trim() ||
      isLegacyAutoPropertyTitle(body.title, body.category, body.street, body.building_number))
  ) {
    body.title = fallbackTitle || body.title;
  }

  const propertySchema = await getPropertySchemaSupport(env);
  const current = await env.DB.prepare('SELECT price, currency FROM properties WHERE id = ?')
    .bind(id)
    .first<{ price: number | null; currency: string | null }>();

  const updates: string[] = [];
  const values: unknown[] = [];
  const fields = [
    'title',
    'description',
    'address',
    'city',
    'district',
    'street',
    'building_number',
    'block',
    'apartment',
    'operation_type',
    'category',
    'source',
    'status',
    'property_condition',
    'heating',
    'bathroom',
    'balcony_type',
    'additional_costs',
    'owner_name',
    'owner_notes',
    'agent_notes',
    'linked_client_id',
    'linked_deal_id',
    'manager_id',
  ];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  const numericFields = [
    'floor',
    'latitude',
    'longitude',
    'rooms',
    'area_total',
    'area_living',
    'area_kitchen',
    'floors_total',
    'price_per_sqm',
  ] as const;
  for (const field of numericFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field] != null ? Number(body[field]) : null);
    }
  }

  const nextPrice = body.price !== undefined ? Number(body.price) : (current?.price ?? null);
  const nextCurrency =
    body.currency !== undefined ? String(body.currency) : (current?.currency ?? 'UAH');
  if (body.price !== undefined) {
    updates.push('price = ?');
    values.push(nextPrice);
  }
  if (body.currency !== undefined) {
    updates.push('currency = ?');
    values.push(nextCurrency);
  }
  if (body.price !== undefined || body.currency !== undefined) {
    updates.push('price_usd = ?');
    values.push(convertToUsd(nextPrice, nextCurrency));
  }

  if (propertySchema.hasLandAreaSotky && body.land_area_sotky !== undefined) {
    updates.push('land_area_sotky = ?');
    values.push(body.land_area_sotky != null ? Number(body.land_area_sotky) : null);
  }
  if (body.negotiable !== undefined) {
    updates.push('negotiable = ?');
    values.push(body.negotiable ? 1 : 0);
  }
  if (body.photos !== undefined) {
    updates.push('photos = ?');
    values.push(JSON.stringify(body.photos));
  }
  if (body.documents !== undefined) {
    updates.push('documents = ?');
    values.push(JSON.stringify(body.documents));
  }
  if (body.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(body.tags));
  }
  if (body.owner_phones !== undefined) {
    updates.push('owner_phones = ?');
    values.push(JSON.stringify(body.owner_phones));
  }

  if (updates.length === 0) return errorResponse('No fields to update', 400, env, request);

  if (propertySchema.hasUpdatedBy) {
    updates.push('updated_by = ?');
    values.push(currentUser.id);
  }
  updates.push("updated_at = datetime('now')");
  values.push(id);

  await env.DB.prepare(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
  await appendPropertyHistory(env, id, currentUser.id, 'updated', body);

  if (body.owner_name !== undefined) {
    const property = await env.DB.prepare(
      'SELECT manager_id, created_by, owner_phones, owner_notes FROM properties WHERE id = ?',
    )
      .bind(id)
      .first<{
        manager_id: string | null;
        created_by: string | null;
        owner_phones: string | null;
        owner_notes: string | null;
      }>();
    const managerId = property?.manager_id || property?.created_by || currentUser.id;
    const phones = body.owner_phones !== undefined ? body.owner_phones : property?.owner_phones;
    const notes =
      body.owner_notes !== undefined ? (body.owner_notes as string | null) : property?.owner_notes;
    if (body.owner_name) {
      const clientId = await upsertOwnerAsClient(
        env,
        String(body.owner_name),
        phones,
        null,
        typeof notes === 'string' ? notes : null,
        managerId,
        id,
      );
      if (clientId) {
        await env.DB.prepare('UPDATE properties SET linked_client_id = ? WHERE id = ?')
          .bind(clientId, id)
          .run();
      }
    }
  }

  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}

async function handleDeleteProperty(
  env: PropertiesEnv,
  id: string,
  request: Request,
): Promise<Response> {
  await env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
