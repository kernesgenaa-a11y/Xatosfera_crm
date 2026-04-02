import { generateId, verifyAuth } from './auth';
import { matchesAnyPrefix } from './legacy';
import type { Env, UserRecord } from './types';
import { errorResponse, jsonResponse, parseBody } from './utils';

const MATCH_PREFIXES = ['/api/matches'] as const;
export const BASE_CURRENCY = 'USD' as const;

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  UAH: 0.024,
};

interface SchemaSupport {
  hasDistrict: boolean;
  hasRoomsFrom: boolean;
  hasRoomsTo: boolean;
  hasStatus: boolean;
  hasLandAreaSotky: boolean;
  hasBudgetMaxUsd: boolean;
}

interface PropertySchemaSupport {
  hasLandAreaSotky: boolean;
  hasPriceUsd: boolean;
}

interface MatchRequirement {
  id: string;
  full_name: string;
  budget: number | null;
  budget_max_usd: number | null;
  currency: string | null;
  property_type: string | null;
  rooms_from: number | null;
  rooms_to: number | null;
  rooms_needed: number | null;
  district: string | null;
  land_area_sotky: number | null;
  phone: string | null;
  segment: string | null;
  manager_id: string | null;
  manager_name: string | null;
}

interface PotentialProperty {
  id: string;
  title: string;
  price: number | null;
  price_usd: number | null;
  rooms: number | null;
  category: string | null;
  currency: string | null;
  district: string | null;
  street: string | null;
  area_total: number | null;
  land_area_sotky: number | null;
  operation_type: string | null;
  manager_id: string | null;
  manager_name: string | null;
}

interface MatchResult {
  id: string;
  propertyId: string;
  clientId: string;
  is_dismissed: boolean;
  property: {
    title: string;
    price: number | null;
    rooms: number | null;
    category: string;
    currency: string;
    manager: string;
    manager_id: string;
    district: string;
    street: string;
    area_total: number | null;
    land_area_sotky: number | null;
    operation_type: string;
  };
  client: {
    name: string;
    budget: number | null;
    rooms_needed: number;
    property_type: string;
    land_area_sotky: number | null;
    district: string;
    currency: string;
    manager: string;
    manager_id: string;
    phone: string;
    segment: string;
  };
  score: number;
  reasons: string[];
  myProperty: boolean;
  myClient: boolean;
}

interface MatchScoreDetails {
  score: number;
  roomDiff: number | null;
  districtMatch: boolean;
  priceDiffPct: number;
  landAreaDiffPct: number | null;
  reasons: string[];
}

interface PropertyQueryGroup {
  category: string;
  district: string | null;
  minBudgetUsd: number;
  maxBudgetUsd: number;
}

type MatchesEnv = Env & {
  __clientMatchSchemaSupport?: SchemaSupport;
  __propertyMatchSchemaSupport?: PropertySchemaSupport;
  __dismissedMatchesTableExists?: boolean;
};

export function canHandleMatchesRoute(path: string): boolean {
  return matchesAnyPrefix(path, MATCH_PREFIXES);
}

export async function handleMatchesRoute(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  const method = request.method;

  if (!env.JWT_SECRET)
    return errorResponse('Server misconfiguration: JWT_SECRET is missing', 500, env, request);

  const auth = await verifyAuth(request, env, env.JWT_SECRET);
  if (!auth.success || !auth.user) return errorResponse('Unauthorized', 401, env, request);

  if (path === '/api/matches/count' && method === 'GET')
    return handleMatchesCount(env, auth.user, request);
  if (path === '/api/matches' && method === 'GET') return handleMatches(request, env, auth.user);
  if (path === '/api/matches/dismiss' && method === 'POST')
    return handleDismissMatch(request, env, auth.user);
  if (path === '/api/matches/restore' && method === 'POST')
    return handleRestoreMatch(request, env, auth.user);

  return errorResponse('Not found', 404, env, request);
}

function normalizeCurrency(currency: string | null | undefined): string {
  return (currency ?? BASE_CURRENCY).toUpperCase();
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function toBaseCurrency(amount: number | null, currency: string | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const rate = FALLBACK_USD_RATES[normalizeCurrency(currency)] ?? 1;
  return Number((amount * rate).toFixed(2));
}

function getRequirementRooms(requirement: MatchRequirement): number | null {
  if (requirement.rooms_from != null && requirement.rooms_to != null) {
    return requirement.rooms_from;
  }

  return requirement.rooms_from ?? requirement.rooms_needed;
}

function getRequirementBudgetUsd(requirement: MatchRequirement): number | null {
  return requirement.budget_max_usd ?? toBaseCurrency(requirement.budget, requirement.currency);
}

function getPropertyPriceUsd(property: PotentialProperty): number | null {
  return property.price_usd ?? toBaseCurrency(property.price, property.currency);
}

function buildInClause(values: readonly string[]): string {
  return values.map(() => '?').join(', ');
}

async function getClientSchemaSupport(env: MatchesEnv): Promise<SchemaSupport> {
  if (env.__clientMatchSchemaSupport) return env.__clientMatchSchemaSupport;
  const schema = await env.DB.prepare('PRAGMA table_info(clients)').all<{ name?: string }>();
  const names = new Set((schema.results ?? []).map((column) => column.name).filter(Boolean));
  const support: SchemaSupport = {
    hasDistrict: names.has('district'),
    hasRoomsFrom: names.has('rooms_from'),
    hasRoomsTo: names.has('rooms_to'),
    hasStatus: names.has('status'),
    hasLandAreaSotky: names.has('land_area_sotky'),
    hasBudgetMaxUsd: names.has('budget_max_usd'),
  };
  env.__clientMatchSchemaSupport = support;
  return support;
}

async function getPropertySchemaSupport(env: MatchesEnv): Promise<PropertySchemaSupport> {
  if (env.__propertyMatchSchemaSupport) return env.__propertyMatchSchemaSupport;
  const schema = await env.DB.prepare('PRAGMA table_info(properties)').all<{ name?: string }>();
  const names = new Set((schema.results ?? []).map((column) => column.name).filter(Boolean));
  const support: PropertySchemaSupport = {
    hasLandAreaSotky: names.has('land_area_sotky'),
    hasPriceUsd: names.has('price_usd'),
  };
  env.__propertyMatchSchemaSupport = support;
  return support;
}

async function dismissedMatchesTableExists(env: MatchesEnv): Promise<boolean> {
  if (typeof env.__dismissedMatchesTableExists === 'boolean')
    return env.__dismissedMatchesTableExists;
  const table = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'dismissed_matches'",
  ).first<{ name?: string }>();
  env.__dismissedMatchesTableExists = Boolean(table?.name);
  return env.__dismissedMatchesTableExists;
}

async function fetchRequirements(env: MatchesEnv): Promise<MatchRequirement[]> {
  const schema = await getClientSchemaSupport(env);
  const sql = `
    SELECT
      c.id,
      c.full_name,
      c.budget,
      ${schema.hasBudgetMaxUsd ? 'c.budget_max_usd' : 'NULL AS budget_max_usd'},
      c.currency,
      c.property_type,
      ${schema.hasRoomsFrom ? 'c.rooms_from' : 'c.rooms_needed AS rooms_from'},
      ${schema.hasRoomsTo ? 'c.rooms_to' : 'NULL AS rooms_to'},
      c.rooms_needed,
      ${schema.hasDistrict ? 'c.district' : 'NULL AS district'},
      ${schema.hasLandAreaSotky ? 'c.land_area_sotky' : 'NULL AS land_area_sotky'},
      c.phone,
      c.segment,
      COALESCE(c.manager_id, c.created_by) AS manager_id,
      u.full_name AS manager_name
    FROM clients c
    LEFT JOIN users u ON COALESCE(c.manager_id, c.created_by) = u.id
    WHERE ${schema.hasStatus ? "c.status = 'active'" : '1 = 1'}
      AND c.property_type IS NOT NULL
      AND c.budget IS NOT NULL
  `;
  const result = await env.DB.prepare(sql).all<MatchRequirement>();
  return result.results ?? [];
}

function buildPropertyQueryGroups(requirements: MatchRequirement[]): PropertyQueryGroup[] {
  const groups = new Map<string, PropertyQueryGroup>();

  for (const requirement of requirements) {
    const category = requirement.property_type?.trim();
    const budgetUsd = getRequirementBudgetUsd(requirement);
    if (!category || budgetUsd == null || budgetUsd <= 0) continue;

    const district = normalizeText(requirement.district);
    const key = `${category}::${district ?? '*'}`;
    const current = groups.get(key);
    const nextMin = budgetUsd * 0.85;
    const nextMax = budgetUsd * 1.15;

    if (!current) {
      groups.set(key, { category, district, minBudgetUsd: nextMin, maxBudgetUsd: nextMax });
      continue;
    }

    current.minBudgetUsd = Math.min(current.minBudgetUsd, nextMin);
    current.maxBudgetUsd = Math.max(current.maxBudgetUsd, nextMax);
  }

  return Array.from(groups.values());
}

function buildMatchJoinSql(
  groups: PropertyQueryGroup[],
  propertySchema: PropertySchemaSupport,
): {
  sql: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const group of groups) {
    const parts = [
      'p.category = ?',
      `${propertySchema.hasPriceUsd ? 'p.price_usd' : 'p.price'} IS NOT NULL`,
      `${propertySchema.hasPriceUsd ? 'p.price_usd' : 'p.price'} BETWEEN ? AND ?`,
    ];
    params.push(group.category, group.minBudgetUsd, group.maxBudgetUsd);

    if (group.district) {
      parts.push("LOWER(TRIM(COALESCE(p.district, ''))) = ?");
      params.push(group.district);
    }

    conditions.push(`(${parts.join(' AND ')})`);
  }

  const sql = `
    SELECT
      p.id,
      p.title,
      p.price,
      ${propertySchema.hasPriceUsd ? 'p.price_usd' : 'NULL AS price_usd'},
      p.rooms,
      p.category,
      p.currency,
      p.district,
      p.street,
      p.area_total,
      ${propertySchema.hasLandAreaSotky ? 'p.land_area_sotky' : 'NULL AS land_area_sotky'},
      p.operation_type,
      p.manager_id,
      u.full_name AS manager_name
    FROM properties p
    LEFT JOIN users u ON p.manager_id = u.id
    WHERE p.status = 'active'
      AND (${conditions.join(' OR ')})
  `;

  return { sql, params };
}

async function fetchPotentialProperties(
  env: MatchesEnv,
  requirements: MatchRequirement[],
): Promise<PotentialProperty[]> {
  const groups = buildPropertyQueryGroups(requirements);
  if (groups.length === 0) return [];

  const propertySchema = await getPropertySchemaSupport(env);
  const { sql, params } = buildMatchJoinSql(groups, propertySchema);
  const result = await env.DB.prepare(sql)
    .bind(...params)
    .all<PotentialProperty>();
  return result.results ?? [];
}

function calculateMatchScore(
  property: PotentialProperty,
  requirement: MatchRequirement,
): MatchScoreDetails | null {
  if (
    !property.category ||
    !requirement.property_type ||
    property.category !== requirement.property_type
  )
    return null;

  const propertyPriceUsd = getPropertyPriceUsd(property);
  const requirementBudgetUsd = getRequirementBudgetUsd(requirement);
  if (propertyPriceUsd == null || requirementBudgetUsd == null || requirementBudgetUsd <= 0)
    return null;

  const priceDiffPct = Number(
    ((Math.abs(propertyPriceUsd - requirementBudgetUsd) / requirementBudgetUsd) * 100).toFixed(1),
  );
  if (priceDiffPct > 15) return null;

  const districtMatch =
    normalizeText(requirement.district) != null &&
    normalizeText(requirement.district) === normalizeText(property.district);

  let roomDiff: number | null = null;
  let landAreaDiffPct: number | null = null;
  let fitScore = 0;

  if (property.category === 'land_plot') {
    if (
      property.land_area_sotky == null ||
      requirement.land_area_sotky == null ||
      requirement.land_area_sotky <= 0
    ) {
      return null;
    }
    landAreaDiffPct = Number(
      (
        (Math.abs(property.land_area_sotky - requirement.land_area_sotky) /
          requirement.land_area_sotky) *
        100
      ).toFixed(1),
    );
    if (landAreaDiffPct > 15) return null;
    fitScore = landAreaDiffPct <= 5 ? 20 : landAreaDiffPct <= 10 ? 14 : 9;
  } else {
    const targetRooms = getRequirementRooms(requirement);
    if (property.rooms == null || targetRooms == null) return null;

    if (requirement.rooms_from != null && requirement.rooms_to != null) {
      const inRange =
        property.rooms >= requirement.rooms_from && property.rooms <= requirement.rooms_to;
      roomDiff = Math.min(
        Math.abs(property.rooms - requirement.rooms_from),
        Math.abs(property.rooms - requirement.rooms_to),
      );
      if (!inRange && roomDiff > 1) return null;
    } else {
      roomDiff = Math.abs(property.rooms - targetRooms);
      if (roomDiff > 1) return null;
    }

    fitScore = roomDiff === 0 ? 20 : 10;
  }

  const priceScore = priceDiffPct <= 5 ? 45 : priceDiffPct <= 10 ? 32 : 20;
  const districtScore = districtMatch ? 25 : 0;
  const typeScore = 10;
  const score = Math.min(100, priceScore + fitScore + districtScore + typeScore);

  const reasons: string[] = [];
  if (priceDiffPct <= 5) reasons.push('Ціна ідеально підходить');
  else if (priceDiffPct <= 10) reasons.push('Ціна підходить');
  else reasons.push('Ціна близька (±15%)');

  reasons.push('Тип збігається');
  if (property.category === 'land_plot' && landAreaDiffPct != null) {
    reasons.push(`Сотки близькі (${landAreaDiffPct}%)`);
  } else if (roomDiff === 0) {
    reasons.push('Кімнати збігаються');
  } else {
    reasons.push('Кімнати ±1');
  }
  if (districtMatch) reasons.push('Район збігається');

  return { score, roomDiff, districtMatch, priceDiffPct, landAreaDiffPct, reasons };
}

function filterAndScoreMatches(
  properties: PotentialProperty[],
  requirements: MatchRequirement[],
  currentUser: UserRecord,
  dismissedPairs: Set<string>,
): MatchResult[] {
  const isTopManager = currentUser.role === 'top_manager' || currentUser.role === 'superuser';
  const matches: MatchResult[] = [];

  for (const requirement of requirements) {
    for (const property of properties) {
      const score = calculateMatchScore(property, requirement);
      if (!score) continue;

      const myProperty = property.manager_id === currentUser.id;
      const myClient = requirement.manager_id === currentUser.id;
      if (!isTopManager && !myProperty && !myClient) continue;

      const dismissKey = `${property.id}:${requirement.id}:${currentUser.id}`;
      matches.push({
        id: `${property.id}-${requirement.id}`,
        propertyId: property.id,
        clientId: requirement.id,
        is_dismissed: dismissedPairs.has(dismissKey),
        property: {
          title: property.title,
          price: property.price,
          rooms: property.rooms,
          category: property.category ?? 'other',
          currency: normalizeCurrency(property.currency),
          manager: property.manager_name ?? 'Невідомий',
          manager_id: property.manager_id ?? '',
          district: property.district ?? '',
          street: property.street ?? '',
          area_total: property.area_total,
          land_area_sotky: property.land_area_sotky,
          operation_type: property.operation_type ?? 'sale',
        },
        client: {
          name: requirement.full_name,
          budget: requirement.budget,
          rooms_needed: getRequirementRooms(requirement) ?? 0,
          property_type: requirement.property_type ?? 'other',
          land_area_sotky: requirement.land_area_sotky,
          district: requirement.district ?? '',
          currency: normalizeCurrency(requirement.currency),
          manager: requirement.manager_name ?? 'Невідомий',
          manager_id: requirement.manager_id ?? '',
          phone: requirement.phone ?? '',
          segment: requirement.segment ?? 'buyer',
        },
        score: score.score,
        reasons: score.reasons,
        myProperty,
        myClient,
      });
    }
  }

  return matches.sort((left, right) => {
    if (Number(left.is_dismissed) !== Number(right.is_dismissed)) {
      return Number(left.is_dismissed) - Number(right.is_dismissed);
    }
    return right.score - left.score;
  });
}

async function fetchDismissedPairSet(
  env: MatchesEnv,
  currentUser: UserRecord,
): Promise<Set<string>> {
  if (!(await dismissedMatchesTableExists(env))) return new Set<string>();

  const result = await env.DB.prepare(
    'SELECT property_id, client_id, dismissed_by FROM dismissed_matches WHERE dismissed_by = ?',
  )
    .bind(currentUser.id)
    .all<{ property_id: string; client_id: string; dismissed_by: string }>();

  return new Set(
    (result.results ?? []).map((row) => `${row.property_id}:${row.client_id}:${row.dismissed_by}`),
  );
}

async function handleMatchesCount(
  env: Env,
  currentUser: UserRecord,
  request: Request,
): Promise<Response> {
  try {
    const typedEnv = env as MatchesEnv;
    const [requirements, dismissedPairs] = await Promise.all([
      fetchRequirements(typedEnv),
      fetchDismissedPairSet(typedEnv, currentUser),
    ]);
    const properties = await fetchPotentialProperties(typedEnv, requirements);
    const count = filterAndScoreMatches(
      properties,
      requirements,
      currentUser,
      dismissedPairs,
    ).filter((match) => !match.is_dismissed).length;
    return jsonResponse({ count }, 200, env, request);
  } catch (error) {
    console.error('handleMatchesCount failed', error);
    return errorResponse(
      `Matches count failed: ${error instanceof Error ? error.message : String(error)}`,
      500,
      env,
      request,
    );
  }
}

async function handleMatches(
  request: Request,
  env: Env,
  currentUser: UserRecord,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number.parseInt(url.searchParams.get('limit') ?? '200', 10), 500);
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') ?? '0', 10), 0);
    const typedEnv = env as MatchesEnv;

    const [requirements, dismissedPairs] = await Promise.all([
      fetchRequirements(typedEnv),
      fetchDismissedPairSet(typedEnv, currentUser),
    ]);
    const properties = await fetchPotentialProperties(typedEnv, requirements);
    const matches = filterAndScoreMatches(properties, requirements, currentUser, dismissedPairs);

    return jsonResponse(
      { matches: matches.slice(offset, offset + limit), total: matches.length },
      200,
      env,
      request,
    );
  } catch (error) {
    console.error('handleMatches failed', error);
    return errorResponse(
      `Matches failed: ${error instanceof Error ? error.message : String(error)}`,
      500,
      env,
      request,
    );
  }
}

async function handleDismissMatch(
  request: Request,
  env: Env,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body?.property_id || !body?.client_id) {
    return errorResponse('property_id and client_id required', 400, env, request);
  }

  await env.DB.prepare(
    'INSERT OR IGNORE INTO dismissed_matches (id, property_id, client_id, dismissed_by) VALUES (?, ?, ?, ?)',
  )
    .bind(generateId(), body.property_id, body.client_id, currentUser.id)
    .run();

  return jsonResponse({ success: true }, 200, env, request);
}

async function handleRestoreMatch(
  request: Request,
  env: Env,
  currentUser: UserRecord,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body?.property_id || !body?.client_id) {
    return errorResponse('property_id and client_id required', 400, env, request);
  }

  await env.DB.prepare(
    'DELETE FROM dismissed_matches WHERE property_id = ? AND client_id = ? AND dismissed_by = ?',
  )
    .bind(body.property_id, body.client_id, currentUser.id)
    .run();

  return jsonResponse({ success: true }, 200, env, request);
}
