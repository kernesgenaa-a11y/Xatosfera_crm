import { buildPropertyPresentationHtml } from "./src/lib/presentation-preview-template.js";

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/auth.ts
function generateId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateId, "generateId");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" }, keyMaterial, 256);
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" }, keyMaterial, 256);
  const newHashArray = new Uint8Array(derivedBits);
  const newHashHex = Array.from(newHashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  return newHashHex === hashHex;
}
__name(verifyPassword, "verifyPassword");
function base64UrlEncode(data) {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  const decoded = atob(base64 + padding);
  return new Uint8Array([...decoded].map((c) => c.charCodeAt(0)));
}
__name(base64UrlDecode, "base64UrlDecode");
async function createJWT(payload, secret, expiresIn = 3600) {
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${headerB64}.${payloadB64}`));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
__name(createJWT, "createJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signature = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(`${headerB64}.${payloadB64}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch { return null; }
}
__name(verifyJWT, "verifyJWT");
function generateRefreshToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateRefreshToken, "generateRefreshToken");
const USER_AUTH_COLUMNS = "id, email, password_hash, full_name, role, phone, avatar_url, approved, approved_at, approved_by, is_active, created_at, updated_at";
const USER_PUBLIC_COLUMNS = "id, email, full_name, role, phone, avatar_url, approved, approved_at, approved_by, is_active, created_at, updated_at";
const PROPERTY_FULL_COLUMNS = "id, title, description, address, city, district, street, building_number, block, floor, apartment, latitude, longitude, operation_type, category, source, status, rooms, area_total, area_living, area_kitchen, floors_total, property_condition, heating, bathroom, balcony_type, price, currency, price_per_sqm, negotiable, additional_costs, owner_name, owner_phones, owner_notes, photos, documents, tags, agent_notes, linked_client_id, linked_deal_id, manager_id, created_by, created_at, updated_at";
const NOTE_COLUMNS = "n.id, n.title, n.content, n.priority, n.done, n.created_by, n.assigned_to, n.assigned_by, n.created_at, n.updated_at";
const REPORT_COLUMNS = "r.id, r.manager_id, r.period_type, r.period_start, r.period_end, r.properties_added, r.clients_added, r.deals_closed, r.viewings_done, r.revenue, r.summary, r.status, r.reviewed_by, r.reviewed_at, r.created_at, r.updated_at";
async function getUserById(env, userId, columns = USER_PUBLIC_COLUMNS) {
  return env.DB.prepare(`SELECT ${columns} FROM users WHERE id = ?`).bind(userId).first();
}
__name(getUserById, "getUserById");
function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}
__name(sanitizeUser, "sanitizeUser");

// src/utils.ts — FIXED: dynamic CORS that allows localhost + github.dev + custom origin
function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  // Always allow if no restriction set
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN === "*") return "*";
  // Explicit match against configured origin
  if (origin === env.CORS_ORIGIN) return origin;
  // Allow localhost on any port (dev)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  // Allow Cloudflare Pages deployments: *.pages.dev
  if (/^https:\/\/[^.]+\.pages\.dev$/.test(origin)) return origin;
  // Allow custom production domain
  if (origin === "https://hatosfera-crm.pp.ua") return origin;
  if (origin === "https://hatosfera.business") return origin;
  // Allow GitHub Codespaces: *.app.github.dev
  if (/^https:\/\/[^.]+\.app\.github\.dev$/.test(origin)) return origin;
  // Allow GitHub Codespaces preview ports: *.preview.app.github.dev
  if (/^https:\/\/[^.]+\.preview\.app\.github\.dev$/.test(origin)) return origin;
  // Fallback to configured origin
  return env.CORS_ORIGIN;
}
__name(getAllowedOrigin, "getAllowedOrigin");
function corsHeaders(env, request) {
  const origin = getAllowedOrigin(request || { headers: { get: () => null } }, env);
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status = 200, env, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env, request) }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400, env, request) {
  return jsonResponse({ error: message }, status, env, request);
}
__name(errorResponse, "errorResponse");
function handleOptions(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(env, request) });
}
__name(handleOptions, "handleOptions");
async function parseBody(request) {
  try { return await request.json(); } catch { return null; }
}
__name(parseBody, "parseBody");
function extractToken(request) {
  const auth = request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/files/")) return null;
  const token = url.searchParams.get("token");
  return token || null;
}
__name(extractToken, "extractToken");
function parseQuery(url) {
  const params = {};
  url.searchParams.forEach((value, key) => { params[key] = value; });
  return params;
}
__name(parseQuery, "parseQuery");
function buildOrderClause(sort) {
  if (!sort) return "ORDER BY created_at DESC";
  const isDesc = sort.startsWith("-");
  const column = sort.replace(/^-/, "");
  const direction = isDesc ? "DESC" : "ASC";
  const allowedColumns = ["created_at", "updated_at", "title", "full_name", "email", "price", "status", "stage", "starts_at"];
  if (!allowedColumns.includes(column)) return "ORDER BY created_at DESC";
  return `ORDER BY ${column} ${direction}`;
}
__name(buildOrderClause, "buildOrderClause");
function parsePagination(url) {
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : null;
  const cursor = url.searchParams.get("cursor");
  return { limit, cursor };
}
__name(parsePagination, "parsePagination");
function decodeCursor(cursor) {
  if (!cursor || !cursor.includes("::")) return null;
  const separatorIndex = cursor.indexOf("::");
  const createdAt = cursor.slice(0, separatorIndex);
  const id = cursor.slice(separatorIndex + 2);
  if (!createdAt || !id) return null;
  return { createdAt, id };
}
__name(decodeCursor, "decodeCursor");
function encodeCursor(row) {
  if (!row?.created_at || !row?.id) return null;
  return `${row.created_at}::${row.id}`;
}
__name(encodeCursor, "encodeCursor");
function buildPaginatedPayload(rows, limit) {
  if (!limit) return rows;
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    hasMore,
    nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null
  };
}
__name(buildPaginatedPayload, "buildPaginatedPayload");

// src/index.ts
var ACCESS_TOKEN_EXPIRY = 60 * 60 * 8; // 8 hours (was 1 hour — too short)
var REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 30 days
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") return handleOptions(request, env);
    // SECURITY: JWT_SECRET must be set via Cloudflare Worker secrets — never fall back to a hardcoded value
    if (!env.JWT_SECRET) {
      return new Response(JSON.stringify({ error: "Server misconfiguration: JWT_SECRET is missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(env, request) }
      });
    }
    const jwtSecret = env.JWT_SECRET;
    // Helper to pass request into responses for correct CORS
    const jr = (data, status) => jsonResponse(data, status, env, request);
    const er = (msg, status) => errorResponse(msg, status, env, request);
    try {
      if (path === "/api/auth/register" && method === "POST") return handleRegister(request, env, jwtSecret);
      if (path === "/api/auth/login" && method === "POST") return handleLogin(request, env, jwtSecret);
      if (path === "/api/auth/refresh" && method === "POST") return handleRefresh(request, env, jwtSecret);
      if (path === "/api/auth/logout" && method === "POST") return handleLogout(request, env, jwtSecret);
      if (path === "/api/auth/me" && method === "GET") return handleGetMe(request, env, jwtSecret);
      const authResult = await verifyAuth(request, env, jwtSecret);
      if (!authResult.success) return er("Unauthorized", 401);
      const currentUser = authResult.user;
      if (path.match(/^\/api\/files\/.+$/) && method === "GET") {
        const key = decodeURIComponent(path.slice("/api/files/".length));
        return handleGetFile(env, key, currentUser, request);
      }
      if (path === "/api/users" && method === "GET") return handleGetUsers(env, currentUser, request);
      if (path.match(/^\/api\/users\/[^/]+$/) && method === "GET") return handleGetUser(env, path.split("/")[3], currentUser, request);
      if (path.match(/^\/api\/users\/[^/]+$/) && method === "PUT") return handleUpdateUser(request, env, path.split("/")[3], currentUser);
      if (path.match(/^\/api\/users\/[^/]+$/) && method === "DELETE") return handleDeleteUser(env, path.split("/")[3], currentUser, request);
      if (path === "/api/properties" && method === "GET") return handleGetProperties(url, env, currentUser, request);
      if (path === "/api/properties" && method === "POST") return handleCreateProperty(request, env, currentUser);
      if (path.match(/^\/api\/properties\/[^/]+$/) && method === "GET") return handleGetProperty(env, path.split("/")[3], request);
      if (path.match(/^\/api\/properties\/[^/]+\/history$/) && method === "GET") return handleGetPropertyHistory(env, path.split("/")[3], request);
      if (path.match(/^\/api\/properties\/[^/]+$/) && method === "PUT") return handleUpdateProperty(request, env, path.split("/")[3], currentUser);
      if (path.match(/^\/api\/properties\/[^/]+$/) && method === "DELETE") return handleDeleteProperty(env, path.split("/")[3], currentUser, request);
      if (path === "/api/clients" && method === "GET") return handleGetClients(url, env, request);
      if (path === "/api/clients" && method === "POST") return handleCreateClient(request, env, currentUser);
      if (path.match(/^\/api\/clients\/[^/]+$/) && method === "PUT") return handleUpdateClient(request, env, path.split("/")[3], currentUser);
      if (path.match(/^\/api\/clients\/[^/]+\/history$/) && method === "GET") return handleGetClientHistory(env, path.split("/")[3], request);
      if (path.match(/^\/api\/clients\/[^/]+$/) && method === "DELETE") return handleDeleteClient(env, path.split("/")[3], request);
      if (path === "/api/client-interactions" && method === "GET") return handleGetInteractions(url, env, request);
      if (path === "/api/client-interactions" && method === "POST") return handleCreateInteraction(request, env, currentUser);
      if (path.match(/^\/api\/client-interactions\/[^/]+$/) && method === "DELETE") return handleDeleteInteraction(env, path.split("/")[3], currentUser, request);
      if (path === "/api/deals" && method === "GET") return handleGetDeals(url, env, currentUser, request);
      if (path === "/api/deals" && method === "POST") return handleCreateDeal(request, env, currentUser);
      if (path.match(/^\/api\/deals\/[^/]+$/) && method === "PUT") return handleUpdateDeal(request, env, path.split("/")[3]);
      if (path.match(/^\/api\/deals\/[^/]+$/) && method === "DELETE") return handleDeleteDeal(env, path.split("/")[3], request);
      if (path === "/api/notes" && method === "GET") return handleGetNotes(url, env, currentUser, request);
      if (path === "/api/notes" && method === "POST") return handleCreateNote(request, env, currentUser);
      if (path.match(/^\/api\/notes\/[^/]+$/) && method === "PUT") return handleUpdateNote(request, env, path.split("/")[3], currentUser);
      if (path.match(/^\/api\/notes\/[^/]+$/) && method === "DELETE") return handleDeleteNote(env, path.split("/")[3], request);
      if (path === "/api/calendar-events" && method === "GET") return handleGetCalendarEvents(url, env, currentUser, request);
      if (path === "/api/calendar-events" && method === "POST") return handleCreateCalendarEvent(request, env, currentUser);
      if (path.match(/^\/api\/calendar-events\/[^/]+$/) && method === "PUT") return handleUpdateCalendarEvent(request, env, path.split("/")[3], currentUser);
      if (path.match(/^\/api\/calendar-events\/[^/]+$/) && method === "DELETE") return handleDeleteCalendarEvent(env, path.split("/")[3], currentUser, request);
      if (path === "/api/documents" && method === "GET") return handleGetDocuments(url, env, currentUser, request);
      if (path === "/api/documents" && method === "POST") return handleUploadDocument(request, env, currentUser);
      if (path.match(/^\/api\/documents\/[^/]+$/) && method === "DELETE") return handleDeleteDocument(env, path.split("/")[3], currentUser, request);
      if (path === "/api/files/upload" && method === "POST") return handleFileUpload(request, env, currentUser);
      if (path === "/api/dashboard/stats" && method === "GET") return handleDashboardStats(env, currentUser, request);
      if (path === "/api/dashboard/activity" && method === "GET") return handleDashboardActivity(env, request);
      if (path.match(/^\/api\/properties\/[^\/]+\/presentation$/) && method === "GET") return handlePropertyPresentation(env, path.split("/")[3], currentUser, request);
      if (path === "/api/matches/count" && method === "GET") return handleMatchesCount(env, currentUser, request);
      if (path === "/api/matches" && method === "GET") return handleMatches(url, env, currentUser, request);
      if (path === "/api/matches/dismiss" && method === "POST") return handleDismissMatch(request, env, currentUser);
      if (path === "/api/matches/restore" && method === "POST") return handleRestoreMatch(request, env, currentUser);
      if (path === "/api/notifications" && method === "GET") return handleGetNotifications(env, currentUser, request);
      if (path.match(/^\/api\/notifications\/[^/]+\/read$/) && method === "PUT") return handleMarkNotificationRead(env, path.split("/")[3], currentUser, request);
      if (path === "/api/notifications/read-all" && method === "PUT") return handleMarkAllNotificationsRead(env, currentUser, request);
      if (path === "/api/reports" && method === "GET") return handleGetReports(env, currentUser, request);
      if (path === "/api/reports" && method === "POST") return handleCreateReport(request, env, currentUser);
      if (path.match(/^\/api\/reports\/[^/]+$/) && method === "PUT") return handleUpdateReport(request, env, path.split("/")[3], currentUser);
      if (path === "/api/reports/stats" && method === "GET") return handleReportStats(url, env, currentUser, request);
      return er("Not found", 404);
    } catch (error) {
      console.error("Error:", error);
      return er("Internal server error", 500);
    }
  }
};

async function handleDashboardStats(env, currentUser, request) {
  const isManager = currentUser.role === "manager";
  const uid = currentUser.id;

  // OPT: 7 sequential queries → 3 parallel queries
  // statsRow: all property/client counts in a single conditional-aggregation pass
  const [statsRow, dealsRow, topMgrRows] = await Promise.all([
    isManager
      ? env.DB.prepare(`
          SELECT
            COUNT(*)                                                                    AS total_props,
            COUNT(*) FILTER (WHERE photos IS NULL OR photos='[]' OR photos='')         AS no_photo,
            COUNT(*) FILTER (WHERE status IN ('sold','rented','archived'))             AS archived,
            COALESCE((SELECT COUNT(*) FROM clients
                      WHERE manager_id=? AND (notes IS NULL OR notes='')), 0)          AS no_notes
          FROM properties WHERE manager_id=?
        `).bind(uid, uid).first()
      : env.DB.prepare(`
          SELECT
            COUNT(*)                                                                    AS total_props,
            COUNT(*) FILTER (WHERE photos IS NULL OR photos='[]' OR photos='')         AS no_photo,
            COUNT(*) FILTER (WHERE status IN ('sold','rented','archived'))             AS archived,
            COALESCE((SELECT COUNT(*) FROM clients
                      WHERE notes IS NULL OR notes=''), 0)                             AS no_notes
          FROM properties
        `).first(),
    isManager
      ? env.DB.prepare(`
          SELECT
            COUNT(*) AS total_deals,
            COUNT(*) FILTER (WHERE stage = 'closed') AS closed_deals,
            COUNT(*) FILTER (WHERE stage IN ('lead', 'closed')) AS leads_total
          FROM deals
          WHERE assigned_agent_id = ?
        `).bind(uid).first()
      : env.DB.prepare(`
          SELECT
            COUNT(*) AS total_deals,
            COUNT(*) FILTER (WHERE stage = 'closed') AS closed_deals,
            COUNT(*) FILTER (WHERE stage IN ('lead', 'closed')) AS leads_total
          FROM deals
        `).first(),
    env.DB.prepare(
      `SELECT d.assigned_agent_id AS id, u.full_name,
              COUNT(*) AS closed_count, COALESCE(SUM(d.amount),0) AS total_amount
       FROM deals d LEFT JOIN users u ON d.assigned_agent_id=u.id
       WHERE d.stage='closed' AND d.assigned_agent_id IS NOT NULL
       GROUP BY d.assigned_agent_id ORDER BY closed_count DESC LIMIT 3`
    ).all(),
  ]);

  const closedDeals = Number(dealsRow?.closed_deals ?? 0);
  const totalDeals  = Number(dealsRow?.total_deals ?? 0);
  const leadsTotal  = Number(dealsRow?.leads_total ?? 0);
  const conversion  = leadsTotal > 0
    ? Math.round((closedDeals / leadsTotal) * 100)
    : (totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0);

  return jsonResponse({
    properties:  Number(statsRow?.total_props ?? 0),
    closedDeals, conversion,
    noPhoto:     Number(statsRow?.no_photo    ?? 0),
    noNotes:     Number(statsRow?.no_notes    ?? 0),
    archived:    Number(statsRow?.archived    ?? 0),
    topManagers: topMgrRows?.results ?? [],
  }, 200, env, request);
}

async function handleDashboardActivity(env, request) {
  const hasUpdatedBy = await propertiesHasUpdatedByColumn(env);
  // OPT: 3 separate queries + JS-sort → 1 UNION query, DB does the sort
  const result = await env.DB.prepare(`
    SELECT id, title, stage, status, updated_at, manager, type FROM (
      SELECT d.id, d.title, d.stage, NULL AS status, d.updated_at,
             u.full_name AS manager, 'deal' AS type
      FROM deals d LEFT JOIN users u ON d.assigned_agent_id = u.id
      UNION ALL
      SELECT p.id, p.title, NULL AS stage, p.status, p.updated_at,
             u.full_name AS manager, 'property' AS type
      FROM properties p LEFT JOIN users u ON ${hasUpdatedBy ? "COALESCE(p.updated_by, p.manager_id, p.created_by)" : "COALESCE(p.manager_id, p.created_by)"} = u.id
      UNION ALL
      SELECT c.id, c.full_name AS title, NULL AS stage, NULL AS status, c.updated_at,
             u.full_name AS manager, 'client' AS type
      FROM clients c LEFT JOIN users u ON c.manager_id = u.id
    ) ORDER BY updated_at DESC LIMIT 20
  `).all();
  return jsonResponse(result?.results ?? [], 200, env, request);
}

async function handleRegister(request, env, jwtSecret) {
  const body = await parseBody(request);
  if (!body || !body.email || !body.password || !body.full_name) return errorResponse("Missing required fields", 400, env, request);
  // SECURITY: Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(body.email))) return errorResponse("Invalid email format", 400, env, request);
  // SECURITY: Enforce minimum password length
  if (String(body.password).length < 8) return errorResponse("Password must be at least 8 characters", 400, env, request);
  // SECURITY: Limit input lengths
  if (String(body.email).length > 254) return errorResponse("Email too long", 400, env, request);
  if (String(body.full_name).length > 200) return errorResponse("Name too long", 400, env, request);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email).first();
  if (existing) return errorResponse("User already exists", 409, env, request);
  const id = generateId();
  const passwordHash = await hashPassword(body.password);
  await env.DB.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, approved, created_at, updated_at) VALUES (?, ?, ?, ?, 'manager', 0, datetime('now'), datetime('now'))`).bind(id, body.email, passwordHash, body.full_name).run();
  const user = {
    id,
    email: body.email,
    password_hash: passwordHash,
    full_name: body.full_name,
    role: "manager",
    phone: null,
    avatar_url: null,
    approved: 0,
    approved_at: null,
    approved_by: null,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const accessToken = await createJWT({ sub: user.id, email: user.email, role: user.role }, jwtSecret, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateRefreshToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1e3).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).bind(sessionId, user.id, refreshToken, expiresAt).run();
  return jsonResponse({ user: sanitizeUser(user), access_token: accessToken, refresh_token: refreshToken }, 201, env, request);
}
__name(handleRegister, "handleRegister");
async function handleLogin(request, env, jwtSecret) {
  const body = await parseBody(request);
  if (!body || !body.email || !body.password) return errorResponse("Missing email or password", 400, env, request);
  const user = await env.DB.prepare(`SELECT ${USER_AUTH_COLUMNS} FROM users WHERE email = ?`).bind(body.email).first();
  if (!user) return errorResponse("Invalid credentials", 401, env, request);
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) return errorResponse("Invalid credentials", 401, env, request);
  const accessToken = await createJWT({ sub: user.id, email: user.email, role: user.role }, jwtSecret, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateRefreshToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1e3).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).bind(sessionId, user.id, refreshToken, expiresAt).run();
  return jsonResponse({ user: sanitizeUser(user), access_token: accessToken, refresh_token: refreshToken }, 200, env, request);
}
__name(handleLogin, "handleLogin");
async function handleRefresh(request, env, jwtSecret) {
  const body = await parseBody(request);
  if (!body || !body.refresh_token) return errorResponse("Missing refresh token", 400, env, request);
  const session = await env.DB.prepare(
    `SELECT s.user_id, ${USER_AUTH_COLUMNS}
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.refresh_token = ? AND s.expires_at > datetime('now')`
  ).bind(body.refresh_token).first();
  if (!session) return errorResponse("Invalid or expired refresh token", 401, env, request);
  await env.DB.prepare("DELETE FROM sessions WHERE refresh_token = ?").bind(body.refresh_token).run();
  const user = { id: session.user_id, email: session.email, password_hash: session.password_hash, full_name: session.full_name, role: session.role, phone: session.phone, avatar_url: session.avatar_url, approved: session.approved, approved_at: session.approved_at, approved_by: session.approved_by, created_at: session.created_at, updated_at: session.updated_at };
  const accessToken = await createJWT({ sub: user.id, email: user.email, role: user.role }, jwtSecret, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateRefreshToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1e3).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).bind(sessionId, user.id, refreshToken, expiresAt).run();
  return jsonResponse({ user: sanitizeUser(user), access_token: accessToken, refresh_token: refreshToken }, 200, env, request);
}
__name(handleRefresh, "handleRefresh");
async function handleLogout(request, env, jwtSecret) {
  const body = await parseBody(request);
  if (body?.refresh_token) await env.DB.prepare("DELETE FROM sessions WHERE refresh_token = ?").bind(body.refresh_token).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleLogout, "handleLogout");
async function handleGetMe(request, env, jwtSecret) {
  const token = extractToken(request);
  if (!token) return errorResponse("No token provided", 401, env, request);
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) return errorResponse("Invalid token", 401, env, request);
  const user = await getUserById(env, payload.sub, USER_AUTH_COLUMNS);
  if (!user) return errorResponse("User not found", 404, env, request);
  return jsonResponse(sanitizeUser(user), 200, env, request);
}
__name(handleGetMe, "handleGetMe");
async function verifyAuth(request, env, jwtSecret) {
  const token = extractToken(request);
  if (!token) return { success: false };
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) return { success: false };
  const user = await getUserById(env, payload.sub, USER_AUTH_COLUMNS);
  if (!user) return { success: false };
  return { success: true, user };
}
__name(verifyAuth, "verifyAuth");
async function handleGetUsers(env, currentUser, request) {
    const results = await env.DB.prepare(`SELECT ${USER_PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`).all();
  // OPT: user list changes rarely — allow 60s private cache
  const res = jsonResponse(results.results, 200, env, request);
  res.headers.set("Cache-Control", "private, max-age=60");
  return res;
}
__name(handleGetUsers, "handleGetUsers");
async function handleGetUser(env, id, currentUser, request) {
   const user = await getUserById(env, id);
  if (!user) return errorResponse("User not found", 404, env, request);
  return jsonResponse(user, 200, env, request);
}
__name(handleGetUser, "handleGetUser");
async function handleUpdateUser(request, env, id, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const updates = []; const values = [];
  if (body.full_name !== void 0) { updates.push("full_name = ?"); values.push(body.full_name); }
  if (body.phone !== void 0) { updates.push("phone = ?"); values.push(body.phone); }
  if (body.avatar_url !== void 0) { updates.push("avatar_url = ?"); values.push(body.avatar_url); }
  if (body.role !== void 0 && (currentUser.role === "superuser" || currentUser.role === "top_manager" && body.role === "manager")) { updates.push("role = ?"); values.push(body.role); }
  if (body.approved !== void 0) { updates.push("approved = ?"); values.push(body.approved); }
  if (body.approved_at !== void 0) { updates.push("approved_at = ?"); values.push(body.approved_at); }
  if (body.approved_by !== void 0) { updates.push("approved_by = ?"); values.push(body.approved_by); }
  if (body.is_active !== void 0 && (currentUser.role === "superuser" || currentUser.role === "top_manager")) { updates.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
  if (updates.length === 0) return errorResponse("No fields to update", 400, env, request);
  updates.push("updated_at = datetime('now')"); values.push(id);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
   const user = await getUserById(env, id);
  return jsonResponse(user, 200, env, request);
}
__name(handleUpdateUser, "handleUpdateUser");
async function handleDeleteUser(env, id, currentUser, request) {
  if (currentUser.role !== "superuser") return errorResponse("Only superuser can delete users", 403, env, request);
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteUser, "handleDeleteUser");
async function handleGetProperties(url, env, currentUser, request) {
  const query = parseQuery(url);
  const { limit, cursor } = parsePagination(url);
  const orderBy = limit ? "ORDER BY created_at DESC, id DESC" : buildOrderClause(query.sort);
  const cursorFilter = decodeCursor(cursor);
  // OPT: skip agent_notes & documents columns — not needed by list/map view, saves bandwidth
  const sql = `SELECT id,title,description,address,city,district,street,building_number,block,
                      floor,apartment,floors_total,latitude,longitude,operation_type,category,
                      source,status,rooms,area_total,area_living,area_kitchen,property_condition,
                      heating,bathroom,balcony_type,price,currency,price_per_sqm,negotiable,
                      additional_costs,owner_name,owner_phones,tags,photos,
                      linked_client_id,linked_deal_id,manager_id,created_by,created_at,updated_at
               FROM properties
               ${cursorFilter ? "WHERE (created_at < ? OR (created_at = ? AND id < ?))" : ""}
               ${orderBy}
               ${limit ? "LIMIT ?" : ""}`;
  const bindings = [];
  if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
  if (limit) bindings.push(limit + 1);
  const results = await env.DB.prepare(sql).bind(...bindings).all();
  const properties = results.results.map((p) => ({
    ...p,
    photos:       p.photos       ? JSON.parse(p.photos)       : [],
    tags:         p.tags         ? JSON.parse(p.tags)         : [],
    owner_phones: p.owner_phones ? JSON.parse(p.owner_phones) : [],
  }));
  return jsonResponse(buildPaginatedPayload(properties, limit), 200, env, request);
}
__name(handleGetProperties, "handleGetProperties");

// ─── Auto-upsert property owner as a "seller" client ───────────────────────
async function upsertOwnerAsClient(env, ownerName, ownerPhones, ownerEmail, ownerNotes, managerId, propertyId) {
  if (!ownerName || !ownerName.trim()) return null;
  ownerName = ownerName.trim();
  // phones: normalize to array
  let phones = [];
  if (Array.isArray(ownerPhones)) phones = ownerPhones;
  else if (typeof ownerPhones === 'string') {
    try { phones = JSON.parse(ownerPhones); } catch { phones = ownerPhones ? [ownerPhones] : []; }
  }
  const firstPhone = phones[0] || null;

  // Check if client (seller) with same phone already exists; fallback: same full_name
  let existing = null;
  if (firstPhone) {
    existing = await env.DB.prepare(
      "SELECT id FROM clients WHERE phone = ? AND segment = 'seller' LIMIT 1"
    ).bind(firstPhone).first().catch(() => null);
  }
  if (!existing) {
    existing = await env.DB.prepare(
      "SELECT id FROM clients WHERE full_name = ? AND segment = 'seller' LIMIT 1"
    ).bind(ownerName).first().catch(() => null);
  }

  if (existing) {
    // Update with latest data + ensure property link
    const clientId = existing.id;
    await env.DB.prepare(
      `UPDATE clients SET
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        manager_id = ?,
        linked_property_id = ?,
        updated_at = datetime('now')
      WHERE id = ?`
    ).bind(firstPhone || null, ownerEmail || null, ownerNotes || null, managerId, propertyId, clientId).run();
    return clientId;
  } else {
    // Create new seller client — use schema-aware insert (rooms_from/rooms_to vs rooms_needed)
    const clientId = generateId();
    const schema = await getClientSchemaSupport(env);
    if (schema.hasRoomsFrom) {
      if (schema.hasRoomsTo && schema.hasDistrict) {
        await env.DB.prepare(
          `INSERT INTO clients (id, full_name, phone, email, notes, segment, budget, currency, property_type, rooms_from, rooms_to, district, manager_id, linked_property_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'seller', NULL, 'UAH', 'apartment', NULL, NULL, NULL, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(clientId, ownerName, firstPhone, ownerEmail || null, ownerNotes || null, managerId, propertyId, managerId).run();
      } else if (schema.hasRoomsTo) {
        await env.DB.prepare(
          `INSERT INTO clients (id, full_name, phone, email, notes, segment, budget, currency, property_type, rooms_from, rooms_to, manager_id, linked_property_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'seller', NULL, 'UAH', 'apartment', NULL, NULL, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(clientId, ownerName, firstPhone, ownerEmail || null, ownerNotes || null, managerId, propertyId, managerId).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO clients (id, full_name, phone, email, notes, segment, budget, currency, property_type, rooms_from, manager_id, linked_property_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'seller', NULL, 'UAH', 'apartment', NULL, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(clientId, ownerName, firstPhone, ownerEmail || null, ownerNotes || null, managerId, propertyId, managerId).run();
      }
    } else {
      // Legacy schema: rooms_needed column
      await env.DB.prepare(
        `INSERT INTO clients (id, full_name, phone, email, segment, budget, currency, notes, property_type, rooms_needed, manager_id, linked_property_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'seller', NULL, 'UAH', ?, 'apartment', NULL, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(clientId, ownerName, firstPhone, ownerEmail || null, ownerNotes || null, managerId, propertyId, managerId).run();
    }
    return clientId;
  }
}
__name(upsertOwnerAsClient, "upsertOwnerAsClient");
function getPropertyCategoryTitleUa(category) {
  switch (category) {
    case "apartment":
      return "Квартира";
    case "house":
      return "Будинок";
    case "commercial":
      return "Комерція";
    case "land_plot":
      return "Ділянка";
    default:
      return "Об'єкт";
  }
}
__name(getPropertyCategoryTitleUa, "getPropertyCategoryTitleUa");
function buildAutoPropertyTitle(category, street, buildingNumber) {
  return [getPropertyCategoryTitleUa(category), street || "", buildingNumber || ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
__name(buildAutoPropertyTitle, "buildAutoPropertyTitle");
async function propertiesHasUpdatedByColumn(env) {
  if (env.__propertiesHasUpdatedByColumn !== void 0) return env.__propertiesHasUpdatedByColumn;
  const schema = await env.DB.prepare("PRAGMA table_info(properties)").all();
  env.__propertiesHasUpdatedByColumn = (schema.results || []).some((column) => column?.name === "updated_by");
  return env.__propertiesHasUpdatedByColumn;
}
__name(propertiesHasUpdatedByColumn, "propertiesHasUpdatedByColumn");
async function getPropertySchemaSupport(env) {
  await ensureLandAreaColumns(env);
  if (env.__propertySchemaSupport) return env.__propertySchemaSupport;
  const schema = await env.DB.prepare("PRAGMA table_info(properties)").all();
  const columnNames = new Set((schema.results ?? []).map((column) => column?.name).filter(Boolean));
  env.__propertySchemaSupport = {
    hasUpdatedBy: columnNames.has("updated_by"),
    hasLandAreaSotky: columnNames.has("land_area_sotky"),
  };
  env.__propertiesHasUpdatedByColumn = env.__propertySchemaSupport.hasUpdatedBy;
  return env.__propertySchemaSupport;
}
__name(getPropertySchemaSupport, "getPropertySchemaSupport");
async function ensureHistoryTables(env) {
  if (env.__historyTablesReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS property_history (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    changed_by TEXT,
    action TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_history (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    changed_by TEXT,
    action TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();
  env.__historyTablesReady = true;
}
__name(ensureHistoryTables, "ensureHistoryTables");
async function appendPropertyHistory(env, propertyId, changedBy, action, payload) {
  await ensureHistoryTables(env);
  await env.DB.prepare("INSERT INTO property_history (id, property_id, changed_by, action, payload, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .bind(generateId(), propertyId, changedBy || null, action, JSON.stringify(payload || {})).run();
}
__name(appendPropertyHistory, "appendPropertyHistory");
async function appendClientHistory(env, clientId, changedBy, action, payload) {
  await ensureHistoryTables(env);
  await env.DB.prepare("INSERT INTO client_history (id, client_id, changed_by, action, payload, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .bind(generateId(), clientId, changedBy || null, action, JSON.stringify(payload || {})).run();
}
__name(appendClientHistory, "appendClientHistory");
function isLegacyAutoPropertyTitle(title, category, street, buildingNumber) {
  if (!title || !category) return false;
  const normalizedTitle = String(title).replace(/\s+/g, " ").trim().toLowerCase();
  const legacyTitle = [category, street || "", buildingNumber || ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().toLowerCase();
  return normalizedTitle === legacyTitle;
}
__name(isLegacyAutoPropertyTitle, "isLegacyAutoPropertyTitle");

async function handleCreateProperty(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const propertySchema = await getPropertySchemaSupport(env);
  const normalizedTitle = String(body.title || "").trim() || buildAutoPropertyTitle(body.category, body.street, body.building_number);
  if (!normalizedTitle) return errorResponse("Title is required", 400, env, request);
  const id = generateId();
  const insertColumns = ["id","title","description","address","city","district","street","building_number","block","floor","apartment","latitude","longitude","operation_type","category","source","status","rooms","area_total","area_living","area_kitchen","floors_total","property_condition","heating","bathroom","balcony_type","price","currency","price_per_sqm","negotiable","additional_costs","owner_name","owner_phones","owner_notes","photos","documents","tags","agent_notes","linked_client_id","linked_deal_id","created_by","manager_id","created_at","updated_at"];
  const insertValues = [id, normalizedTitle, body.description||null, body.address||null, body.city||"\u041A\u0440\u043E\u043F\u0438\u0432\u043D\u0438\u0446\u044C\u043A\u0438\u0439", body.district||null, body.street||null, body.building_number||null, body.block||null, body.floor||null, body.apartment||null, body.latitude||null, body.longitude||null, body.operation_type||null, body.category||null, body.source||null, body.status||"active", body.rooms||null, body.area_total||null, body.area_living||null, body.area_kitchen||null, body.floors_total||null, body.property_condition||null, body.heating||null, body.bathroom||null, body.balcony_type||null, body.price||null, body.currency||"UAH", body.price_per_sqm||null, body.negotiable?1:0, body.additional_costs||null, body.owner_name||null, JSON.stringify(body.owner_phones||[]), body.owner_notes||null, JSON.stringify(body.photos||[]), JSON.stringify(body.documents||[]), JSON.stringify(body.tags||[]), body.agent_notes||null, body.linked_client_id||null, body.linked_deal_id||null, currentUser.id, body.manager_id||currentUser.id];
  if (propertySchema.hasLandAreaSotky) {
    insertColumns.splice(26, 0, "land_area_sotky");
    insertValues.splice(26, 0, body.land_area_sotky || null);
  }
  await env.DB.prepare(`INSERT INTO properties (${insertColumns.join(", ")}) VALUES (${insertColumns.map((column) => column === "created_at" || column === "updated_at" ? "datetime('now')" : "?").join(", ")})`).bind(...insertValues).run();
  if (propertySchema.hasUpdatedBy) {
    await env.DB.prepare("UPDATE properties SET updated_by = ? WHERE id = ?").bind(currentUser.id, id).run();
  }
  await appendPropertyHistory(env, id, currentUser.id, "created", body);
  // Auto-upsert owner as seller client
  if (body.owner_name) {
    const managerId = body.manager_id || currentUser.id;
    const clientId = await upsertOwnerAsClient(env, body.owner_name, body.owner_phones, null, body.owner_notes, managerId, id);
    if (clientId) {
      await env.DB.prepare("UPDATE properties SET linked_client_id = ? WHERE id = ?").bind(clientId, id).run();
    }
  }
  // Notify manager if property assigned by another user (top manager)
  const assignedManagerId = body.manager_id || currentUser.id;
  if (assignedManagerId !== currentUser.id) {
    const notifId = generateId();
    const senderName = currentUser.full_name || "Топ-менеджер";
    const propTitle = body.title || "Новий об'єкт";
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, 'assignment', 'property', ?, 0, datetime('now'))`
    ).bind(notifId, assignedManagerId, "Новий об'єкт призначено", `${senderName} призначив вам об'єкт: ${propTitle}`, id).run();
  }
  // OPT: avoid re-fetching — construct response from known values
  return jsonResponse({
    id, ...body,
    title: normalizedTitle,
    city: body.city || "\u041a\u0440\u043e\u043f\u0438\u0432\u043d\u0438\u0446\u044c\u043a\u0438\u0439",
    status: body.status || "active", currency: body.currency || "UAH",
    photos: body.photos || [], documents: body.documents || [],
    tags: body.tags || [], owner_phones: body.owner_phones || [],
    negotiable: body.negotiable ? 1 : 0,
    created_by: currentUser.id, manager_id: body.manager_id || currentUser.id,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, 201, env, request);
}
__name(handleCreateProperty, "handleCreateProperty");
async function handleGetProperty(env, id, request) {
  const property = await env.DB.prepare(`SELECT ${PROPERTY_FULL_COLUMNS} FROM properties WHERE id = ?`).bind(id).first();
  if (!property) return errorResponse("Property not found", 404, env, request);
  const parsed = { ...property, photos: property.photos ? JSON.parse(property.photos) : [], documents: property.documents ? JSON.parse(property.documents) : [], tags: property.tags ? JSON.parse(property.tags) : [], owner_phones: property.owner_phones ? JSON.parse(property.owner_phones) : [] };
  return jsonResponse(parsed, 200, env, request);
}
__name(handleGetProperty, "handleGetProperty");
async function handleGetPropertyHistory(env, id, request) {
  await ensureHistoryTables(env);
  const rows = await env.DB.prepare(
    `SELECT h.id, h.property_id, h.changed_by, h.action, h.payload, h.created_at, u.full_name AS changed_by_name
     FROM property_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.property_id = ?
     ORDER BY h.created_at DESC
     LIMIT 100`
  ).bind(id).all();
  const data = (rows.results ?? []).map((row) => ({ ...row, payload: row.payload ? JSON.parse(row.payload) : {} }));
  return jsonResponse(data, 200, env, request);
}
__name(handleGetPropertyHistory, "handleGetPropertyHistory");
async function handleUpdateProperty(request, env, id, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const fallbackTitle = buildAutoPropertyTitle(body.category, body.street, body.building_number);
  if (body.title !== void 0 && (!String(body.title || "").trim() || isLegacyAutoPropertyTitle(body.title, body.category, body.street, body.building_number))) {
    body.title = fallbackTitle || body.title;
  }
  const updates = []; const values = [];
  const propertySchema = await getPropertySchemaSupport(env);
  const fields = ["title","description","address","city","district","street","building_number","block","floor","apartment","latitude","longitude","operation_type","category","source","status","rooms","area_total","area_living","area_kitchen","floors_total","property_condition","heating","bathroom","balcony_type","price","currency","price_per_sqm","additional_costs","owner_name","owner_notes","agent_notes","linked_client_id","linked_deal_id","manager_id"];
  if (propertySchema.hasLandAreaSotky) fields.push("land_area_sotky");
  for (const field of fields) { if (body[field] !== void 0) { updates.push(`${field} = ?`); values.push(body[field]); } }
  if (body.negotiable !== void 0) { updates.push("negotiable = ?"); values.push(body.negotiable ? 1 : 0); }
  if (body.photos !== void 0) { updates.push("photos = ?"); values.push(JSON.stringify(body.photos)); }
  if (body.documents !== void 0) { updates.push("documents = ?"); values.push(JSON.stringify(body.documents)); }
  if (body.tags !== void 0) { updates.push("tags = ?"); values.push(JSON.stringify(body.tags)); }
  if (body.owner_phones !== void 0) { updates.push("owner_phones = ?"); values.push(JSON.stringify(body.owner_phones)); }
  if (updates.length === 0) return errorResponse("No fields to update", 400, env, request);
  if (propertySchema.hasUpdatedBy) { updates.push("updated_by = ?"); values.push(currentUser.id); }
  updates.push("updated_at = datetime('now')"); values.push(id);
  await env.DB.prepare(`UPDATE properties SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  await appendPropertyHistory(env, id, currentUser.id, "updated", body);
  // Auto-upsert owner as seller client when owner_name provided
  if (body.owner_name !== undefined) {
    const prop = await env.DB.prepare("SELECT manager_id, created_by, owner_phones, owner_notes FROM properties WHERE id = ?").bind(id).first();
    const managerId = prop?.manager_id || prop?.created_by || currentUser.id;
    const phones = body.owner_phones !== undefined ? body.owner_phones : (prop?.owner_phones || '[]');
    const notes  = body.owner_notes  !== undefined ? body.owner_notes  : (prop?.owner_notes  || null);
    if (body.owner_name) {
      const clientId = await upsertOwnerAsClient(env, body.owner_name, phones, null, notes, managerId, id);
      if (clientId) {
        await env.DB.prepare("UPDATE properties SET linked_client_id = ? WHERE id = ?").bind(clientId, id).run();
      }
    }
  }
  // OPT: avoid re-fetching — return the patched fields only
  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}
__name(handleUpdateProperty, "handleUpdateProperty");
async function handleDeleteProperty(env, id, currentUser, request) {
  await env.DB.prepare("DELETE FROM properties WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteProperty, "handleDeleteProperty");
// FIXED: includes property_type and rooms_needed
async function handleGetClients(url, env, request) {
  const query = parseQuery(url);
  const { limit, cursor } = parsePagination(url);
  const orderBy = limit ? "ORDER BY created_at DESC, id DESC" : buildOrderClause(query.sort);
  const cursorFilter = decodeCursor(cursor);
  const clientSchema = await getClientSchemaSupport(env);
  // OPT: explicit columns only — same payload, skips any future heavy text columns
  const sql = `SELECT id,full_name,phone,email,segment,age,budget,currency,property_type,
                      ${clientSchema.hasRoomsFrom ? "rooms_from," : "rooms_needed AS rooms_from,"}
                      ${clientSchema.hasRoomsTo ? "rooms_to," : "NULL AS rooms_to,"}
                      ${clientSchema.hasDistrict ? "district," : "NULL AS district,"}
                      ${clientSchema.hasLandAreaSotky ? "land_area_sotky," : "NULL AS land_area_sotky,"}
                      status,tags,notes,manager_id,linked_property_id,
                      created_by,created_at,updated_at
               FROM clients
               ${cursorFilter ? "WHERE (created_at < ? OR (created_at = ? AND id < ?))" : ""}
               ${orderBy}
               ${limit ? "LIMIT ?" : ""}`;
  const bindings = [];
  if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
  if (limit) bindings.push(limit + 1);
  const results = await env.DB.prepare(sql).bind(...bindings).all();
  const clients = results.results.map((c) => ({ ...c, tags: c.tags ? JSON.parse(c.tags) : [] }));
  return jsonResponse(buildPaginatedPayload(clients, limit), 200, env, request);
}
__name(handleGetClients, "handleGetClients");
async function handleCreateClient(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body || !body.full_name) return errorResponse("Full name is required", 400, env, request);
  const id = generateId();
  const managerId = body.manager_id || currentUser.id;
  const tags = body.tags || [];
  const segment = body.segment || "buyer";
  const currency = body.currency || "UAH";
  const propertyType = body.property_type || "apartment";
  const clientSchema = await getClientSchemaSupport(env);
  const roomsFrom = body.rooms_from ?? body.rooms_needed ?? 1;
  const roomsTo = body.rooms_to ?? null;
  const insertColumns = ["id", "full_name", "phone", "email", "segment", "age", "budget", "currency", "tags", "notes", "property_type"];
  const insertValues = [id, body.full_name, body.phone || null, body.email || null, segment, body.age || null, body.budget || null, currency, JSON.stringify(tags), body.notes || null, propertyType];
  if (clientSchema.hasRoomsFrom) {
    insertColumns.push("rooms_from");
    insertValues.push(roomsFrom);
  } else {
    insertColumns.push("rooms_needed");
    insertValues.push(roomsFrom);
  }
  if (clientSchema.hasRoomsTo) {
    insertColumns.push("rooms_to");
    insertValues.push(roomsTo);
  }
  if (clientSchema.hasDistrict) {
    insertColumns.push("district");
    insertValues.push(body.district || null);
  }
  if (clientSchema.hasLandAreaSotky) {
    insertColumns.push("land_area_sotky");
    insertValues.push(body.land_area_sotky || null);
  }
  insertColumns.push("manager_id", "created_by", "created_at", "updated_at");
  insertValues.push(managerId, currentUser.id);
  await env.DB.prepare(`INSERT INTO clients (${insertColumns.join(", ")}) VALUES (${insertColumns.map((column) => column === "created_at" || column === "updated_at" ? "datetime('now')" : "?").join(", ")})`).bind(...insertValues).run();
  await appendClientHistory(env, id, currentUser.id, "created", body);
  // Notify manager if client assigned by another user (top manager)
  if (managerId !== currentUser.id) {
    const notifId = generateId();
    const senderName = currentUser.full_name || "Топ-менеджер";
    const clientName = body.full_name || "Новий клієнт";
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, 'assignment', 'client', ?, 0, datetime('now'))`
    ).bind(notifId, managerId, "Новий клієнт призначено", `${senderName} призначив вам клієнта: ${clientName}`, id).run();
  }
  return jsonResponse({
    id,
    full_name: body.full_name,
    phone: body.phone || null,
    email: body.email || null,
    segment,
    age: body.age || null,
    budget: body.budget || null,
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
    land_area_sotky: body.land_area_sotky || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, 201, env, request);
}
__name(handleCreateClient, "handleCreateClient");
async function handleUpdateClient(request, env, id, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const updates = []; const values = [];
  const clientSchema = await getClientSchemaSupport(env);
  const fields = ["full_name","phone","email","segment","age","budget","currency","notes","property_type","rooms_needed","manager_id","status","linked_property_id"];
  for (const field of fields) { if (body[field] !== void 0) { updates.push(`${field} = ?`); values.push(body[field]); } }
  if (body.rooms_from !== void 0) {
    updates.push(`${clientSchema.hasRoomsFrom ? "rooms_from" : "rooms_needed"} = ?`);
    values.push(body.rooms_from);
  }
  if (body.rooms_to !== void 0 && clientSchema.hasRoomsTo) {
    updates.push("rooms_to = ?");
    values.push(body.rooms_to);
  }
  if (body.district !== void 0 && clientSchema.hasDistrict) {
    updates.push("district = ?");
    values.push(body.district);
  }
  if (body.land_area_sotky !== void 0 && clientSchema.hasLandAreaSotky) {
    updates.push("land_area_sotky = ?");
    values.push(body.land_area_sotky);
  }
  if (body.tags !== void 0) { updates.push("tags = ?"); values.push(JSON.stringify(body.tags)); }
  if (updates.length === 0) return errorResponse("No fields to update", 400, env, request);
  updates.push("updated_at = datetime('now')"); values.push(id);
  await env.DB.prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  await appendClientHistory(env, id, currentUser?.id || null, "updated", body);
  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}
__name(handleUpdateClient, "handleUpdateClient");
async function handleGetClientHistory(env, id, request) {
  await ensureHistoryTables(env);
  const rows = await env.DB.prepare(
    `SELECT h.id, h.client_id, h.changed_by, h.action, h.payload, h.created_at, u.full_name AS changed_by_name
     FROM client_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.client_id = ?
     ORDER BY h.created_at DESC
     LIMIT 100`
  ).bind(id).all();
  const data = (rows.results ?? []).map((row) => ({ ...row, payload: row.payload ? JSON.parse(row.payload) : {} }));
  return jsonResponse(data, 200, env, request);
}
__name(handleGetClientHistory, "handleGetClientHistory");
async function handleDeleteClient(env, id, request) {
  await env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteClient, "handleDeleteClient");
async function clientsHasDistrictColumn(env) {
  if (env.__clientsHasDistrictColumn !== void 0) return env.__clientsHasDistrictColumn;
  const schema = await env.DB.prepare("PRAGMA table_info(clients)").all();
  env.__clientsHasDistrictColumn = (schema.results ?? []).some((column) => column?.name === "district");
  return env.__clientsHasDistrictColumn;
}
__name(clientsHasDistrictColumn, "clientsHasDistrictColumn");
async function clientsHasLandAreaSotkyColumn(env) {
  if (env.__clientsHasLandAreaSotkyColumn !== void 0) return env.__clientsHasLandAreaSotkyColumn;
  const schema = await env.DB.prepare("PRAGMA table_info(clients)").all();
  env.__clientsHasLandAreaSotkyColumn = (schema.results ?? []).some((column) => column?.name === "land_area_sotky");
  return env.__clientsHasLandAreaSotkyColumn;
}
__name(clientsHasLandAreaSotkyColumn, "clientsHasLandAreaSotkyColumn");
async function propertiesHasLandAreaSotkyColumn(env) {
  if (env.__propertiesHasLandAreaSotkyColumn !== void 0) return env.__propertiesHasLandAreaSotkyColumn;
  const schema = await env.DB.prepare("PRAGMA table_info(properties)").all();
  env.__propertiesHasLandAreaSotkyColumn = (schema.results ?? []).some((column) => column?.name === "land_area_sotky");
  return env.__propertiesHasLandAreaSotkyColumn;
}
__name(propertiesHasLandAreaSotkyColumn, "propertiesHasLandAreaSotkyColumn");
async function ensureLandAreaColumns(env) {
  if (env.__ensureLandAreaColumnsPromise) return env.__ensureLandAreaColumnsPromise;
  env.__ensureLandAreaColumnsPromise = (async () => {
    const [clientSchema, propertySchema] = await Promise.all([
      env.DB.prepare("PRAGMA table_info(clients)").all(),
      env.DB.prepare("PRAGMA table_info(properties)").all()
    ]);
    const clientColumns = new Set((clientSchema.results ?? []).map((column) => column?.name).filter(Boolean));
    const propertyColumns = new Set((propertySchema.results ?? []).map((column) => column?.name).filter(Boolean));
    if (!clientColumns.has("land_area_sotky")) {
      await env.DB.prepare("ALTER TABLE clients ADD COLUMN land_area_sotky REAL").run();
    }
    if (!propertyColumns.has("land_area_sotky")) {
      await env.DB.prepare("ALTER TABLE properties ADD COLUMN land_area_sotky REAL").run();
      await env.DB.prepare(
        "UPDATE properties SET land_area_sotky = area_total WHERE category = 'land_plot' AND land_area_sotky IS NULL AND area_total IS NOT NULL"
      ).run();
    }
    delete env.__clientSchemaSupport;
    delete env.__propertySchemaSupport;
    delete env.__clientsHasLandAreaSotkyColumn;
    delete env.__propertiesHasLandAreaSotkyColumn;
  })();
  return env.__ensureLandAreaColumnsPromise;
}
__name(ensureLandAreaColumns, "ensureLandAreaColumns");
async function getClientSchemaSupport(env) {
  await ensureLandAreaColumns(env);
  if (env.__clientSchemaSupport) return env.__clientSchemaSupport;
  const schema = await env.DB.prepare("PRAGMA table_info(clients)").all();
  const columnNames = new Set((schema.results ?? []).map((column) => column?.name).filter(Boolean));
  env.__clientSchemaSupport = {
    hasDistrict: columnNames.has("district"),
    hasRoomsFrom: columnNames.has("rooms_from"),
    hasRoomsTo: columnNames.has("rooms_to"),
    hasStatus: columnNames.has("status"),
    hasLandAreaSotky: columnNames.has("land_area_sotky"),
  };
  env.__clientsHasDistrictColumn = env.__clientSchemaSupport.hasDistrict;
  return env.__clientSchemaSupport;
}
__name(getClientSchemaSupport, "getClientSchemaSupport");
async function dismissedMatchesTableExists(env) {
  if (env.__dismissedMatchesTableExists !== void 0) return env.__dismissedMatchesTableExists;
  const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'dismissed_matches'").first();
  env.__dismissedMatchesTableExists = Boolean(table?.name);
  return env.__dismissedMatchesTableExists;
}
__name(dismissedMatchesTableExists, "dismissedMatchesTableExists");
async function handleGetInteractions(url, env, request) {
  const query = parseQuery(url);
  let sql = "SELECT id, client_id, user_id, interaction_type, notes, created_at FROM client_interactions"; const values = [];
  if (query.client_id) { sql += " WHERE client_id = ?"; values.push(query.client_id); }
  sql += " ORDER BY created_at DESC";
  const results = values.length > 0 ? await env.DB.prepare(sql).bind(...values).all() : await env.DB.prepare(sql).all();
  return jsonResponse(results.results, 200, env, request);
}
__name(handleGetInteractions, "handleGetInteractions");
function mapInteractionTypeToEventType(interactionType) {
  switch (interactionType) {
    case "meeting":
      return "meeting";
    case "viewing":
    case "showing":
      return "viewing";
    case "deadline":
    case "call":
      return interactionType;
    default:
      return "other";
  }
}
__name(mapInteractionTypeToEventType, "mapInteractionTypeToEventType");
function normalizeCalendarEventType(eventType) {
  switch (eventType) {
    case "meeting":
    case "viewing":
    case "deadline":
    case "call":
    case "other":
      return eventType;
    default:
      return "meeting";
  }
}
__name(normalizeCalendarEventType, "normalizeCalendarEventType");
function normalizeDateTimeValue(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const withFallbackTime = new Date(`${value}T09:00:00`);
  if (!Number.isNaN(withFallbackTime.getTime())) return withFallbackTime.toISOString();
  return null;
}
__name(normalizeDateTimeValue, "normalizeDateTimeValue");
async function createCalendarEventFromInteraction(env, currentUser, body) {
  const startsAt = normalizeDateTimeValue(body.starts_at || body.scheduled_at || body.interaction_at || body.date);
  if (!startsAt) return null;
  const endsAt = normalizeDateTimeValue(body.ends_at) || new Date(new Date(startsAt).getTime() + 60 * 60 * 1e3).toISOString();
  let clientName = "Клієнт";
  if (body.client_id) {
    const client = await env.DB.prepare("SELECT full_name FROM clients WHERE id = ?").bind(body.client_id).first();
    if (client?.full_name) clientName = client.full_name;
  }
  const eventType = mapInteractionTypeToEventType(body.interaction_type);
  const title = body.calendar_title || body.title || `${clientName}: ${body.interaction_type || "interaction"}`;
  const eventId = generateId();
  await env.DB.prepare(
    `INSERT INTO calendar_events (id, title, description, starts_at, ends_at, event_type, status, user_id, property_id, client_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    eventId,
    title,
    body.calendar_description || body.notes || null,
    startsAt,
    endsAt,
    eventType,
    body.calendar_status || "planned",
    currentUser.id,
    body.property_id || null,
    body.client_id || null
  ).run();
  return {
    id: eventId,
    title,
    description: body.calendar_description || body.notes || null,
    starts_at: startsAt,
    ends_at: endsAt,
    event_type: eventType,
    status: body.calendar_status || "planned",
    user_id: currentUser.id,
    property_id: body.property_id || null,
    client_id: body.client_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
__name(createCalendarEventFromInteraction, "createCalendarEventFromInteraction");
async function handleCreateInteraction(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body || !body.client_id) return errorResponse("Client ID is required", 400, env, request);
  const id = generateId();
  await env.DB.prepare(`INSERT INTO client_interactions (id, client_id, user_id, interaction_type, notes, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind(id, body.client_id, currentUser.id, body.interaction_type||null, body.notes||null).run();
  const interaction = {
    id,
    client_id: body.client_id,
    user_id: currentUser.id,
    interaction_type: body.interaction_type || null,
    notes: body.notes || null,
    created_at: new Date().toISOString(),
  };
  let calendarEvent = null;
  if (body.create_calendar_event || body.sync_to_calendar || body.starts_at || body.scheduled_at || body.interaction_at || body.date) {
    calendarEvent = await createCalendarEventFromInteraction(env, currentUser, body);
  }
  return jsonResponse({ ...interaction, calendar_event: calendarEvent }, 201, env, request);
}
__name(handleCreateInteraction, "handleCreateInteraction");
async function handleDeleteInteraction(env, id, currentUser, request) {
  const existing = await env.DB.prepare("SELECT id, user_id FROM client_interactions WHERE id = ?").bind(id).first();
  if (!existing) return errorResponse("Interaction not found", 404, env, request);
  const isPrivileged = currentUser.role === "top_manager" || currentUser.role === "superuser";
  if (!isPrivileged && existing.user_id !== currentUser.id) {
    return errorResponse("Forbidden", 403, env, request);
  }
  await env.DB.prepare("DELETE FROM client_interactions WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteInteraction, "handleDeleteInteraction");
async function handleGetDeals(url, env, currentUser, request) {
  const query = parseQuery(url);
  const { limit, cursor } = parsePagination(url);
  const orderBy = limit ? "ORDER BY created_at DESC, id DESC" : buildOrderClause(query.sort);
  const cursorFilter = decodeCursor(cursor);
  const isManager = currentUser.role === "manager";
  // OPT: explicit columns only
  const cols = `id,title,stage,amount,currency,property_id,client_id,
                assigned_agent_id,notes,commission,commission_currency,
                created_by,created_at,updated_at`;
  let results;
  if (isManager) {
    const sql = `SELECT ${cols}
                 FROM deals
                 WHERE (created_by = ? OR assigned_agent_id = ?)
                 ${cursorFilter ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""}
                 ${orderBy}
                 ${limit ? "LIMIT ?" : ""}`;
    const bindings = [currentUser.id, currentUser.id];
    if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
    if (limit) bindings.push(limit + 1);
    results = await env.DB.prepare(sql).bind(...bindings).all();
  } else {
    const sql = `SELECT ${cols}
                 FROM deals
                 ${cursorFilter ? "WHERE (created_at < ? OR (created_at = ? AND id < ?))" : ""}
                 ${orderBy}
                 ${limit ? "LIMIT ?" : ""}`;
    const bindings = [];
    if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
    if (limit) bindings.push(limit + 1);
    results = await env.DB.prepare(sql).bind(...bindings).all();
  }
  return jsonResponse(buildPaginatedPayload(results.results, limit), 200, env, request);
}
__name(handleGetDeals, "handleGetDeals");
async function handleCreateDeal(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body || !body.title) return errorResponse("Title is required", 400, env, request);
  const id = generateId();
  await env.DB.prepare(`INSERT INTO deals (id, title, stage, property_id, client_id, assigned_agent_id, created_by, notes, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).bind(id, body.title, body.stage||"lead", body.property_id||null, body.client_id||null, body.assigned_agent_id||null, currentUser.id, body.notes||null, body.amount||null).run();
  // OPT: return constructed object instead of re-fetching
  return jsonResponse({
    id, ...body,
    stage: body.stage || "lead",
    created_by: currentUser.id,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, 201, env, request);
}
__name(handleCreateDeal, "handleCreateDeal");
async function handleUpdateDeal(request, env, id) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const updates = []; const values = [];
  const fields = ["title","stage","property_id","client_id","assigned_agent_id","notes","amount","currency","commission","commission_currency"];
  for (const field of fields) { if (body[field] !== void 0) { updates.push(`${field} = ?`); values.push(body[field]); } }
  if (updates.length === 0) return errorResponse("No fields to update", 400, env, request);
  updates.push("updated_at = datetime('now')"); values.push(id);
  await env.DB.prepare(`UPDATE deals SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  // OPT: return patched fields instead of re-fetching
  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}
__name(handleUpdateDeal, "handleUpdateDeal");
async function handleDeleteDeal(env, id, request) {
  await env.DB.prepare("DELETE FROM deals WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteDeal, "handleDeleteDeal");
async function handleGetNotes(url, env, currentUser, request) {
  const query = parseQuery(url);
  const { limit, cursor } = parsePagination(url);
  const orderBy = limit ? "ORDER BY n.created_at DESC, n.id DESC" : buildOrderClause(query.sort).replaceAll("created_at", "n.created_at");
  const cursorFilter = decodeCursor(cursor);
  let results;
  if (currentUser.role === "manager") {
    // Manager sees own personal notes + tasks assigned to them
    const sql = `SELECT ${NOTE_COLUMNS}, u.full_name as assigned_by_name
                 FROM notes n
                 LEFT JOIN users u ON u.id = n.assigned_by
                 WHERE (n.created_by = ? OR n.assigned_to = ?)
                 ${cursorFilter ? "AND (n.created_at < ? OR (n.created_at = ? AND n.id < ?))" : ""}
                 ${orderBy}
                 ${limit ? "LIMIT ?" : ""}`;
    const bindings = [currentUser.id, currentUser.id];
    if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
    if (limit) bindings.push(limit + 1);
    results = await env.DB.prepare(sql).bind(...bindings).all();
  } else {
    // top_manager/superuser sees everything
    const sql = `SELECT ${NOTE_COLUMNS}, u.full_name as assigned_by_name, u2.full_name as assigned_to_name
                 FROM notes n
                 LEFT JOIN users u ON u.id = n.assigned_by
                 LEFT JOIN users u2 ON u2.id = n.assigned_to
                 ${cursorFilter ? "WHERE (n.created_at < ? OR (n.created_at = ? AND n.id < ?))" : ""}
                 ${orderBy}
                 ${limit ? "LIMIT ?" : ""}`;
    const bindings = [];
    if (cursorFilter) bindings.push(cursorFilter.createdAt, cursorFilter.createdAt, cursorFilter.id);
    if (limit) bindings.push(limit + 1);
    results = await env.DB.prepare(sql).bind(...bindings).all();
  }
  return jsonResponse(buildPaginatedPayload(results.results, limit), 200, env, request);
}
__name(handleGetNotes, "handleGetNotes");
async function handleCreateNote(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body || !body.title) return errorResponse("Title is required", 400, env, request);
  const id = generateId();
  const isTask = !!body.assigned_to;
  await env.DB.prepare(
    `INSERT INTO notes (id, title, content, priority, done, created_by, assigned_to, assigned_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, body.title, body.content||null, body.priority||"medium", 0, currentUser.id, body.assigned_to||null, isTask ? currentUser.id : null).run();

  // If assigning to another user → create notification
  if (isTask && body.assigned_to) {
    const notifId = generateId();
    const assignerName = currentUser.full_name || "Менеджер";
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, 'assignment', 'note', ?, 0, datetime('now'))`
    ).bind(notifId, body.assigned_to, "Нове завдання", `${assignerName}: ${body.title}`, id).run();
  }

  return jsonResponse({
    id,
    title: body.title,
    content: body.content || null,
    priority: body.priority || "medium",
    done: 0,
    created_by: currentUser.id,
    assigned_to: body.assigned_to || null,
    assigned_by: isTask ? currentUser.id : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, 201, env, request);
}
__name(handleCreateNote, "handleCreateNote");
async function handleUpdateNote(request, env, id, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const updates = []; const values = [];
  if (body.title !== undefined)        { updates.push("title = ?");        values.push(body.title); }
  if (body.content !== undefined)      { updates.push("content = ?");      values.push(body.content); }
  if (body.priority !== undefined)     { updates.push("priority = ?");     values.push(body.priority); }
  if (body.done !== undefined)         { updates.push("done = ?");         values.push(body.done?1:0); }
  if (body.result !== undefined)       { updates.push("result = ?");       values.push(body.result); }
  if (body.completed_at !== undefined) { updates.push("completed_at = ?"); values.push(body.completed_at); }
  if (updates.length === 0) return errorResponse("No fields to update", 400, env, request);
  updates.push("updated_at = datetime('now')"); values.push(id);
  await env.DB.prepare(`UPDATE notes SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  // If task is being completed (result set) → notify the assigned_by (top manager)
  if (body.result !== undefined && body.done) {
    const note = await env.DB.prepare(
      "SELECT title, assigned_by, assigned_to FROM notes WHERE id = ?"
    ).bind(id).first();
    if (note && note.assigned_by) {
      const managerName = currentUser?.full_name || "Менеджер";
      const resultLabel = body.result === "done" ? "✅ Виконано" : "❌ Не виконано";
      const nid = (typeof generateId === "function") ? generateId() : crypto.randomUUID().replace(/-/g, "");
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
         VALUES (?, ?, ?, ?, 'update', 'note', ?, 0, datetime('now'))`
      ).bind(
        nid,
        note.assigned_by,
        "Завдання завершено",
        `${managerName}: «${note.title}» — ${resultLabel}`,
        id
      ).run();
    }
  }

  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}
__name(handleUpdateNote, "handleUpdateNote");
async function handleDeleteNote(env, id, request) {
  await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteNote, "handleDeleteNote");
async function handleGetNotifications(env, currentUser, request) {
  const results = await env.DB.prepare(
    `SELECT id, user_id, title, message, type, entity_type, entity_id, is_read, created_at
     FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(currentUser.id).all();
  return jsonResponse(results.results, 200, env, request);
}
__name(handleGetNotifications, "handleGetNotifications");
async function handleMarkNotificationRead(env, id, currentUser, request) {
  await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleMarkNotificationRead, "handleMarkNotificationRead");
async function handleMarkAllNotificationsRead(env, currentUser, request) {
  await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(currentUser.id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleMarkAllNotificationsRead, "handleMarkAllNotificationsRead");
async function handleGetCalendarEvents(url, env, currentUser, request) {
  const query = parseQuery(url);
  const orderBy = buildOrderClause(query.sort || "starts_at");
  let sql = `SELECT id, title, description, starts_at, ends_at, event_type, status, user_id, property_id, client_id, created_at, updated_at
     FROM calendar_events WHERE user_id = ?`;
  const values = [currentUser.id];
  if (query.client_id) {
    sql += " AND client_id = ?";
    values.push(query.client_id);
  }
  if (query.property_id) {
    sql += " AND property_id = ?";
    values.push(query.property_id);
  }
  if (query.status) {
    sql += " AND status = ?";
    values.push(query.status);
  }
  sql += ` ${orderBy}`;
  const results = await env.DB.prepare(sql).bind(...values).all();
  return jsonResponse(results.results, 200, env, request);
}
__name(handleGetCalendarEvents, "handleGetCalendarEvents");
async function normalizeCalendarEventRefs(env, body) {
  const normalized = {
    property_id: body.property_id || null,
    client_id: body.client_id || null,
  };
  if (normalized.property_id === "__none__" || normalized.property_id === "") normalized.property_id = null;
  if (normalized.client_id === "__none__" || normalized.client_id === "") normalized.client_id = null;
  if (normalized.property_id) {
    const property = await env.DB.prepare("SELECT id FROM properties WHERE id = ?").bind(normalized.property_id).first();
    if (!property) normalized.property_id = null;
  }
  if (normalized.client_id) {
    const client = await env.DB.prepare("SELECT id FROM clients WHERE id = ?").bind(normalized.client_id).first();
    if (!client) normalized.client_id = null;
  }
  return normalized;
}
__name(normalizeCalendarEventRefs, "normalizeCalendarEventRefs");
async function handleCreateCalendarEvent(request, env, currentUser) {
  try {
    const body = await parseBody(request);
    if (!body || !body.title || !body.starts_at) return errorResponse("Title and starts_at are required", 400, env, request);
    const startsAt = normalizeDateTimeValue(body.starts_at);
    const endsAt = body.ends_at ? normalizeDateTimeValue(body.ends_at) : null;
    if (!startsAt) return errorResponse("Invalid starts_at value", 400, env, request);
    if (body.ends_at && !endsAt) return errorResponse("Invalid ends_at value", 400, env, request);
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      return errorResponse("ends_at must be after starts_at", 400, env, request);
    }
    const refs = await normalizeCalendarEventRefs(env, body);
    const id = generateId();
    const eventType = normalizeCalendarEventType(body.event_type);
    const status = body.status || "planned";
    await env.DB.prepare(`INSERT INTO calendar_events (id, title, description, starts_at, ends_at, event_type, status, user_id, property_id, client_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).bind(id, body.title, body.description||null, startsAt, endsAt, eventType, status, currentUser.id, refs.property_id, refs.client_id).run();
    return jsonResponse({
      id,
      title: body.title,
      description: body.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      event_type: eventType,
      status,
      user_id: currentUser.id,
      property_id: refs.property_id,
      client_id: refs.client_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 201, env, request);
  } catch (error) {
    console.error("Create calendar event error:", error);
    return errorResponse("Failed to create calendar event", 500, env, request);
  }
}
__name(handleCreateCalendarEvent, "handleCreateCalendarEvent");
async function handleUpdateCalendarEvent(request, env, id, currentUser) {
  try {
    const body = await parseBody(request);
    if (!body) return errorResponse("Invalid body", 400, env, request);
    const updates = []; const values = [];
    const refs = await normalizeCalendarEventRefs(env, body);
    const normalizedBody = { ...body };
    if (body.starts_at !== void 0) {
      const startsAt = normalizeDateTimeValue(body.starts_at);
      if (!startsAt) return errorResponse("Invalid starts_at value", 400, env, request);
      normalizedBody.starts_at = startsAt;
    }
    if (body.ends_at !== void 0) {
      if (body.ends_at === null || body.ends_at === "") normalizedBody.ends_at = null;
      else {
        const endsAt = normalizeDateTimeValue(body.ends_at);
        if (!endsAt) return errorResponse("Invalid ends_at value", 400, env, request);
        normalizedBody.ends_at = endsAt;
      }
    }
    const nextStartsAt = normalizedBody.starts_at;
    const nextEndsAt = normalizedBody.ends_at;
    if (nextStartsAt && nextEndsAt && new Date(nextEndsAt).getTime() < new Date(nextStartsAt).getTime()) {
      return errorResponse("ends_at must be after starts_at", 400, env, request);
    }
    if (body.event_type !== void 0) normalizedBody.event_type = normalizeCalendarEventType(body.event_type);
    const fields = ["title","description","starts_at","ends_at","event_type","status"];
    for (const field of fields) { if (normalizedBody[field] !== void 0) { updates.push(`${field} = ?`); values.push(normalizedBody[field]); } }
    if (body.property_id !== void 0) { updates.push("property_id = ?"); values.push(refs.property_id); normalizedBody.property_id = refs.property_id; }
    if (body.client_id !== void 0) { updates.push("client_id = ?"); values.push(refs.client_id); normalizedBody.client_id = refs.client_id; }
    if (updates.length === 0) return errorResponse("No fields to update", 400, env, request);
    updates.push("updated_at = datetime('now')");
    values.push(id, currentUser.id);
    const result = await env.DB.prepare(`UPDATE calendar_events SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).bind(...values).run();
    if (!result.meta?.changes) return errorResponse("Calendar event not found", 404, env, request);
    return jsonResponse({ id, ...normalizedBody, updated_at: new Date().toISOString() }, 200, env, request);
  } catch (error) {
    console.error("Update calendar event error:", error);
    return errorResponse("Failed to update calendar event", 500, env, request);
  }
}
__name(handleUpdateCalendarEvent, "handleUpdateCalendarEvent");
async function handleDeleteCalendarEvent(env, id, currentUser, request) {
  try {
    const result = await env.DB.prepare("DELETE FROM calendar_events WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
    if (!result.meta?.changes) return errorResponse("Calendar event not found", 404, env, request);
    return jsonResponse({ success: true }, 200, env, request);
  } catch (error) {
    console.error("Delete calendar event error:", error);
    return errorResponse("Failed to delete calendar event", 500, env, request);
  }
}
__name(handleDeleteCalendarEvent, "handleDeleteCalendarEvent");
async function handleGetDocuments(url, env, currentUser, request) {
  const query = parseQuery(url);
  const orderBy = buildOrderClause(query.sort);
  const results = await env.DB.prepare(
    `SELECT id, user_id, title, category, file_url, file_name, file_size, mime_type, created_at
     FROM user_documents WHERE user_id = ? ${orderBy}`
  ).bind(currentUser.id).all();
  return jsonResponse(results.results, 200, env, request);
}
__name(handleGetDocuments, "handleGetDocuments");
async function handleUploadDocument(request, env, currentUser) {
  try {
    const formData = await request.formData();
    const file = formData.get("file"); const title = formData.get("title"); const category = formData.get("category") || "fop";
    if (!(file instanceof File) || !title) return errorResponse("File and title are required", 400, env, request);
    // SECURITY: Server-side file validation
    const ALLOWED_MIME_TYPES = ["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const extension = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
    const EXTENSION_TO_MIME = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
    const effectiveMimeType = ALLOWED_MIME_TYPES.includes(file.type) ? file.type : (file.type === "application/octet-stream" || !file.type) ? EXTENSION_TO_MIME[extension] : null;
    if (!effectiveMimeType) return errorResponse("File type not allowed", 400, env, request);
    if (file.size > MAX_FILE_SIZE) return errorResponse("File too large (max 10MB)", 400, env, request);
    if (file.size === 0) return errorResponse("Empty file", 400, env, request);
    // SECURITY: Sanitize filename
    const safeName = file.name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").slice(0, 200);
    const id = generateId();
    const fileKey = `documents/${currentUser.id}/${id}_${safeName}`;
    await env.R2.put(fileKey, file.stream(), { httpMetadata: { contentType: effectiveMimeType } });
    await env.DB.prepare(`INSERT INTO user_documents (id, user_id, title, category, file_url, file_name, file_size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).bind(id, currentUser.id, title, category, fileKey, safeName, file.size, effectiveMimeType).run();
    return jsonResponse({
      id,
      user_id: currentUser.id,
      title,
      category,
      file_url: fileKey,
      file_name: safeName,
      file_size: file.size,
      mime_type: effectiveMimeType,
      created_at: new Date().toISOString(),
    }, 201, env, request);
  } catch (error) { console.error("Upload error:", error); return errorResponse("Failed to upload file", 500, env, request); }
}
__name(handleUploadDocument, "handleUploadDocument");
async function handleDeleteDocument(env, id, currentUser, request) {
  const doc = await env.DB.prepare("SELECT id, file_url FROM user_documents WHERE id = ? AND user_id = ?").bind(id, currentUser.id).first();
  if (!doc) return errorResponse("Document not found", 404, env, request);
  try { await env.R2.delete(doc.file_url); } catch (error) { console.error("R2 delete error:", error); }
  await env.DB.prepare("DELETE FROM user_documents WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDeleteDocument, "handleDeleteDocument");

async function handleGetFile(env, key, currentUser, request) {
  const object = await env.R2.get(key);
  if (!object) return errorResponse("File not found", 404, env, request);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  const contentType = headers.get("Content-Type") || "";
  if (contentType.startsWith("image/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("CDN-Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Cloudflare-CDN-Cache-Control", "public, max-age=31536000, immutable");
  } else {
    headers.set("Cache-Control", "private, max-age=3600");
  }
  // Add CORS to file responses too
  const cors = corsHeaders(env, request);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new Response(object.body, { headers });
}
__name(handleGetFile, "handleGetFile");
async function handleFileUpload(request, env, currentUser) {
  try {
    const formData = await request.formData();
    const file = formData.get("file"); const folder = formData.get("folder") || "uploads";
    if (!(file instanceof File)) return errorResponse("File is required", 400, env, request);
    // SECURITY: Server-side file validation
    const ALLOWED_MIME_TYPES = ["image/jpeg","image/png","image/gif","image/webp","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const extension = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
    const EXTENSION_TO_MIME = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
    const effectiveMimeType = ALLOWED_MIME_TYPES.includes(file.type) ? file.type : (file.type === "application/octet-stream" || !file.type) ? EXTENSION_TO_MIME[extension] : null;
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    // SECURITY: Whitelist allowed folder names to prevent path traversal
    const ALLOWED_FOLDERS = ["uploads", "avatars", "properties", "documents"];
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "uploads";
    if (!effectiveMimeType) return errorResponse("File type not allowed", 400, env, request);
    if (file.size > MAX_FILE_SIZE) return errorResponse("File too large (max 10MB)", 400, env, request);
    if (file.size === 0) return errorResponse("Empty file", 400, env, request);
    // SECURITY: Sanitize filename
    const safeName = file.name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").slice(0, 200);
    const id = generateId();
    const fileKey = `${safeFolder}/${currentUser.id}/${id}_${safeName}`;
    await env.R2.put(fileKey, file.stream(), { httpMetadata: { contentType: effectiveMimeType } });
    return jsonResponse({ key: fileKey, name: safeName, size: file.size, type: effectiveMimeType }, 201, env, request);
  } catch (error) { console.error("Upload error:", error); return errorResponse("Failed to upload file", 500, env, request); }
}
__name(handleFileUpload, "handleFileUpload");

// ─── Property PDF Presentation ────────────────────────────────────────────────
async function handlePropertyPresentation(env, id, currentUser, request) {
  try {
    // Parse query params for preview mode and custom edits
    const url = new URL(request.url);
    const isPreview = url.searchParams.get('preview') === '1';
    const template = url.searchParams.get('template') || 'classic';
    const customTitle = url.searchParams.get('custom_title') || null;
    const customPrice = url.searchParams.get('custom_price') || null;
    const customDesc  = url.searchParams.get('custom_desc')  || null;
    const selectedPhotosParam = url.searchParams.get('selected_photos') || null;

    // 1. Load property
    const property = await env.DB.prepare(`SELECT ${PROPERTY_FULL_COLUMNS} FROM properties WHERE id = ?`).bind(id).first();
    if (!property) return new Response("Property not found", { status: 404, headers: corsHeaders(env, request) });

    // 2. Load manager info
    const managerId = property.manager_id || property.created_by;
    const manager = managerId ? await getUserById(env, managerId, "full_name, phone, email") : null;

    // 3. Parse photos (max 6 for presentation), filtered by selected_photos if provided
    let photos = [];
    try { photos = JSON.parse(property.photos || "[]"); } catch {}
    if (selectedPhotosParam) {
      const selected = selectedPhotosParam.split(',').map(s => s.trim()).filter(Boolean);
      // preserve order as selected by user
      photos = selected.filter(k => photos.includes(k));
    }
    photos = photos.slice(0, 6);

    // 4. Convert photos to base64 from R2
    const photoDataUrls = (await Promise.all(photos.map(async (key) => {
      try {
        const obj = await env.R2.get(key);
        if (!obj) return null;
        const buf = await obj.arrayBuffer();
        // btoa with chunked approach to avoid call stack overflow on large images
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const b64 = btoa(binary);
        const ct = obj.httpMetadata?.contentType || "image/jpeg";
        return `data:${ct};base64,${b64}`;
      } catch {
        return null;
      }
    }))).filter(Boolean);

    // 5. Parse tags
    let tags = [];
    try { tags = JSON.parse(property.tags || "[]"); } catch {}

    // 6. Helper labels
    const opLabel = { sale: "Продаж", rent: "Оренда", new_build: "Новобудова" }[property.operation_type] || property.operation_type || "";
    const catLabel = { apartment: "Квартира", house: "Будинок", commercial: "Комерція", land_plot: "Ділянка", other: "Інше" }[property.category] || property.category || "";
    const condLabel = { no_repair: "Без ремонту", cosmetic: "Косметичний", euro: "Євроремонт", furnished: "З меблями", after_build: "Після забудовника" }[property.property_condition] || "";
    const heatingLabel = { central: "Центральне", autonomous: "Автономне", electric: "Електричне", gas: "Газове", none: "Відключене" }[property.heating] || "";
    const bathroomLabel = { separate: "Роздільний", combined: "Суміщений" }[property.bathroom] || "";
    const balconyLabel = { none: "Немає", balcony: "Балкон", loggia: "Лоджія", terrace: "Тераса" }[property.balcony_type] || "";
    const currSym = { UAH: "₴", USD: "$", EUR: "€" }[property.currency] || "₴";
    const price = customPrice || (property.price ? `${Number(property.price).toLocaleString("uk-UA")} ${currSym}` : "За домовленістю");
    const pricePerSqm = property.price_per_sqm ? `${Number(property.price_per_sqm).toLocaleString("uk-UA")} ${currSym}/м²` : "";
    const address = [property.street, property.building_number ? `${property.building_number}` : null, property.district ? `(${property.district})` : null].filter(Boolean).join(", ");
    const displayTitle = customTitle || property.title || catLabel;
    const displayDesc  = customDesc  ?? property.description ?? null;

    // 7. Build photo grid HTML
    const photoGrid = photoDataUrls.length
      ? `<div class="photo-grid photos-${Math.min(photoDataUrls.length, 6)}">
          ${photoDataUrls.map((src, i) => `<div class="photo-cell ${i===0?'photo-main':''}"><img src="${src}" alt="Фото ${i+1}" /></div>`).join("")}
        </div>`
      : `<div class="no-photo"><span>Фото відсутні</span></div>`;

    // 8. Build specs table rows
    const specs = [
      property.rooms ? ["Кімнат", property.rooms] : null,
      property.area_total ? ["Загальна площа", `${property.area_total} м²`] : null,
      property.area_living ? ["Житлова площа", `${property.area_living} м²`] : null,
      property.area_kitchen ? ["Кухня", `${property.area_kitchen} м²`] : null,
      property.floor && property.floors_total ? ["Поверх", `${property.floor} з ${property.floors_total}`] : property.floor ? ["Поверх", property.floor] : null,
      condLabel ? ["Стан", condLabel] : null,
      heatingLabel ? ["Опалення", heatingLabel] : null,
      bathroomLabel ? ["Санвузол", bathroomLabel] : null,
      balconyLabel && property.balcony_type !== "none" ? ["Балкон/Лоджія", balconyLabel] : null,
      property.negotiable ? ["Торг", "Можливий"] : null,
    ].filter(Boolean);

    const specsRows = specs.map(([k, v]) => `<tr><td class="spec-key">${k}</td><td class="spec-val">${v}</td></tr>`).join("");
    const classicDetailsGrid = isPreview ? "1fr" : specs.length ? "1fr 1fr" : "1fr";

    // 9. Manager block
    const managerBlock = manager ? `
      <div class="manager-block">
        <div class="manager-icon">👤</div>
        <div class="manager-info">
          <div class="manager-name">${manager.full_name}</div>
          ${manager.phone ? `<div class="manager-phone">${manager.phone}</div>` : ""}
        </div>
      </div>` : "";

    // 10. Tags
    const tagsHtml = tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>` : "";

    // 11. Full HTML
    const logoHtml = '<img src="data:image/png;base64,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NrzlkAPX5N1+lXHBMX8xmRT7LqyJmXeFXsg8ptCVlfTDmjiiyVhAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAUveFe8uoOJf1Y935O6U74eX1e332/wBk/pURDuvZwu7vsOX2q8s/7JVMlcPVoPUfo2o2XSr6J1+qNtNjrsTRfULK+cbmvaHsdzNcNg+oPZcydL5PJaejqkfKuqYqOllqqhwZDCx0kjz2a1o2T+hUQzO9SZDldzvcg06sqXygegJ6D8BoK1/iKvn1Nwvr2seGy3AijYN+8eY7dr+q1ypuu3/C+Ny0yul3fT6IpuJ2bkoGPNZRY2uqKkwiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiALIPXawgQF4ODt4+vuGtkry/mkFOIJt9/aRksP6eUH8VtxUD+EO+mWzXfHpZCfo0jauEHya4crv1gfpU6v6/h1PyXzDiuN4OZOC9d/c6jFtVtSkitni5yBlTkFsxuCQllDCaidoPT2kmtfjygfpUFeS2DiNe3ZFm13u7nOLaiqeY+buIwdMH+yAte8ivonDsf8AL40K/Rfuc7kWOyxtmCsBZ800FLNJhERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQEmeG69fVHFSgjc7Ude11K4783dW/7zWq0XEK6NsmDXu6no6Cik5OuvecOVv8AvFqo3a6yW3XSkuEBIlppmSsIOurSCP2K1PiFvtPVcE2VdG/miuz6fkIPdh/Kf8IXLcZwlZmUz10bSf0LTDvUKJxfkVOKIi6nsVZxREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQHJbzkeWuuPCnG8cfUF81BVVBe3faM8pj3/ALTwFoyOWEoRk035dTJScexxREWZiEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAE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6qpbFG1jZGknZ6k6B6AErfPFhU2y+cS5cksl7tVzoKmnhjBpKtkj2Pa0ghzd78t77dR1UOaQI6P1la31S19//wAPVZ7HIYREW81hERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAZ2sIiAztYREAREQBZ2sIgM7WERAEREAREQBERAEREAREQBZ2sIgM7WERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAf/Z" style="height:52px;width:52px;object-fit:contain;border-radius:8px;" alt="ANGELS" />';
    const html = buildPropertyPresentationHtml({
      template,
      isPreview,
      logoHtml,
      opLabel,
      catLabel,
      price,
      pricePerSqm,
      address,
      displayTitle,
      displayDesc,
      photoDataUrls,
      photoGrid,
      specs,
      specsRows,
      classicDetailsGrid,
      manager,
      managerBlock,
      tagsHtml
    });

    // If preview=1 — return HTML directly, skip PDF rendering
    if (isPreview) {
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders(env, request) },
      });
    }

    // 12. Call CF Browser Rendering REST API
    const cfAccountId = env.CF_ACCOUNT_ID;
    const cfApiToken = env.CF_API_TOKEN;
    if (!cfAccountId || !cfApiToken) {
      console.error("Browser Rendering secrets are not configured");
      return new Response("Browser Rendering is not configured", { status: 500, headers: corsHeaders(env, request) });
    }

    const pdfResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/browser-rendering/pdf`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html,
          options: {
            printBackground: true,
            format: "A4",
            landscape: false,
            margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
          },
        }),
      }
    );

    if (!pdfResp.ok) {
      const errText = await pdfResp.text();
      console.error("Browser Rendering error:", errText);
      return new Response("PDF generation failed", { status: 500, headers: corsHeaders(env, request) });
    }

    const pdfBytes = await pdfResp.arrayBuffer();
    const safeTitle = (property.title || "presentation").replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, "_").slice(0, 50);
    const cors = corsHeaders(env, request);

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
        ...cors,
      },
    });

  } catch (err) {
    console.error("Presentation error:", err);
    return new Response("Error generating presentation", { status: 500, headers: corsHeaders(env, request) });
  }
}
__name(handlePropertyPresentation, "handlePropertyPresentation");

// ── MATCHING HELPERS ─────────────────────────────────────────
// Конвертація в USD через SQL CASE — множники мають збігатись з фронтом
// USD=1, EUR=1.08, UAH=0.024
const MATCH_JOIN = `
  FROM properties p
  JOIN clients c ON (
    p.category = c.property_type
    AND p.price      IS NOT NULL AND c.budget       IS NOT NULL
    AND p.rooms      IS NOT NULL AND c.rooms_needed IS NOT NULL
    AND ABS(p.rooms - c.rooms_needed) <= 1
    AND ABS(
        (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
    ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.15
  )
  WHERE p.status = 'active' AND c.status = 'active'
`;

// score обчислюється так само як на фронті
const SCORE_EXPR = `(
  CASE
    WHEN ABS(
        (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
    ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.05 THEN 50
    WHEN ABS(
        (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
    ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.10 THEN 35
    ELSE 20
  END
  + CASE WHEN ABS(p.rooms - c.rooms_needed) = 0 THEN 30 ELSE 15 END
  + 20
)`;

// GET /api/matches/count  — мінімальний трафік: { count, myCount }
function buildMatchRoomsExpr(clientSchema) {
  if (clientSchema.hasRoomsFrom && clientSchema.hasRoomsTo) return "COALESCE(c.rooms_from, c.rooms_to)";
  if (clientSchema.hasRoomsFrom) return "c.rooms_from";
  return "c.rooms_needed";
}
__name(buildMatchRoomsExpr, "buildMatchRoomsExpr");

function buildMatchJoinSql(clientSchema, propertySchema) {
  const clientRoomsExpr = buildMatchRoomsExpr(clientSchema);
  const roomMatchCondition = clientSchema.hasRoomsFrom && clientSchema.hasRoomsTo
    ? `(
        (c.rooms_from IS NOT NULL AND c.rooms_to IS NOT NULL AND p.rooms BETWEEN c.rooms_from AND c.rooms_to)
        OR (${clientRoomsExpr} IS NOT NULL AND ABS(p.rooms - ${clientRoomsExpr}) <= 1)
      )`
    : `${clientRoomsExpr} IS NOT NULL AND ABS(p.rooms - ${clientRoomsExpr}) <= 1`;
  const hasLandArea = clientSchema.hasLandAreaSotky && propertySchema.hasLandAreaSotky;
  const landMatchCondition = hasLandArea
    ? `(
        p.land_area_sotky IS NOT NULL
        AND c.land_area_sotky IS NOT NULL
        AND ABS(p.land_area_sotky - c.land_area_sotky) / NULLIF(c.land_area_sotky, 0) <= 0.15
      )`
    : "0 = 1";

  return `
    FROM properties p
    JOIN clients c ON (
      p.category = c.property_type
      AND p.price IS NOT NULL AND c.budget IS NOT NULL
      AND (
        (p.category = 'land_plot' AND ${landMatchCondition})
        OR
        (p.category != 'land_plot' AND p.rooms IS NOT NULL AND ${roomMatchCondition})
      )
      AND ABS(
          (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
        - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.15
    )
    WHERE p.status = 'active' AND ${clientSchema.hasStatus ? "c.status = 'active'" : "1 = 1"}
  `;
}
__name(buildMatchJoinSql, "buildMatchJoinSql");

function buildMatchScoreSql(clientSchema, propertySchema) {
  const clientRoomsExpr = buildMatchRoomsExpr(clientSchema);
  const hasLandArea = clientSchema.hasLandAreaSotky && propertySchema.hasLandAreaSotky;
  const landAreaScoreExpr = hasLandArea
    ? `CASE
         WHEN ABS(p.land_area_sotky - c.land_area_sotky) / NULLIF(c.land_area_sotky, 0) <= 0.05 THEN 30
         WHEN ABS(p.land_area_sotky - c.land_area_sotky) / NULLIF(c.land_area_sotky, 0) <= 0.10 THEN 22
         ELSE 15
       END`
    : "0";
  return `(
    CASE
      WHEN ABS(
          (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
        - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.05 THEN 50
      WHEN ABS(
          (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
        - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.10 THEN 35
      ELSE 20
    END
    + CASE
        WHEN p.category = 'land_plot' THEN ${landAreaScoreExpr}
        WHEN ABS(p.rooms - ${clientRoomsExpr}) = 0 THEN 30
        ELSE 15
      END
    + 20
  )`;
}
__name(buildMatchScoreSql, "buildMatchScoreSql");

async function handleMatchesCount(env, currentUser, request) {
  try {
    const isTop = currentUser.role === 'top_manager' || currentUser.role === 'superuser';
    const uid = currentUser.id;
    const clientSchema = await getClientSchemaSupport(env);
    const propertySchema = await getPropertySchemaSupport(env);
    const matchJoin = buildMatchJoinSql(clientSchema, propertySchema);
    const hasDismissedMatches = await dismissedMatchesTableExists(env);
    let countSql, countParams;
    if (isTop) {
      countSql = `SELECT COUNT(*) AS cnt ${matchJoin}
        ${hasDismissedMatches ? "AND NOT EXISTS (SELECT 1 FROM dismissed_matches dm WHERE dm.property_id = p.id AND dm.client_id = c.id AND dm.dismissed_by = ?)" : ""}`;
      countParams = hasDismissedMatches ? [uid] : [];
    } else {
      countSql = `SELECT COUNT(*) AS cnt ${matchJoin}
        AND (p.manager_id = ? OR COALESCE(c.manager_id, c.created_by) = ?)
        ${hasDismissedMatches ? "AND NOT EXISTS (SELECT 1 FROM dismissed_matches dm WHERE dm.property_id = p.id AND dm.client_id = c.id AND dm.dismissed_by = ?)" : ""}`;
      countParams = hasDismissedMatches ? [uid, uid, uid] : [uid, uid];
    }

    const row = await env.DB.prepare(countSql).bind(...countParams).first();
    return jsonResponse({ count: row?.cnt ?? 0 }, 200, env, request);
  } catch (error) {
    console.error("handleMatchesCount failed", error);
    return errorResponse(`Matches count failed: ${error?.message || String(error)}`, 500, env, request);
  }
}
__name(handleMatchesCount, "handleMatchesCount");

// GET /api/matches  — повний список для сторінки матчів
async function handleMatches(url, env, currentUser, request) {
  try {
    const isTop = currentUser.role === 'top_manager' || currentUser.role === 'superuser';
    const uid = currentUser.id;
    const params = new URL(request.url).searchParams;
    const limit  = Math.min(parseInt(params.get('limit')  || '200'), 500);
    const offset = parseInt(params.get('offset') || '0');
    const clientSchema = await getClientSchemaSupport(env);
    const propertySchema = await getPropertySchemaSupport(env);
    const hasDismissedMatches = await dismissedMatchesTableExists(env);
    const clientRoomsExpr = buildMatchRoomsExpr(clientSchema);
    const scoreExpr = buildMatchScoreSql(clientSchema, propertySchema);
    const hasClientDistrict = clientSchema.hasDistrict;
    const hasClientLandArea = clientSchema.hasLandAreaSotky;
    const hasPropertyLandArea = propertySchema.hasLandAreaSotky;
    const districtScoreExpr = hasClientDistrict
      ? ` + CASE
            WHEN c.district IS NOT NULL AND TRIM(c.district) != ''
             AND p.district IS NOT NULL AND TRIM(p.district) != ''
             AND LOWER(TRIM(c.district)) = LOWER(TRIM(p.district)) THEN 10
            ELSE 0
          END`
      : '';

    const managerFilter = isTop
      ? ''
      : `AND (p.manager_id = ? OR COALESCE(c.manager_id, c.created_by) = ?)`;

    const fullSql = `
    SELECT
      p.id             AS property_id,
      p.title,
      p.price,
      p.rooms,
      p.category,
      p.currency       AS prop_currency,
      p.district,
      p.street,
      p.area_total,
      ${hasPropertyLandArea ? "p.land_area_sotky AS property_land_area_sotky," : "NULL AS property_land_area_sotky,"}
      p.operation_type,
      p.manager_id     AS prop_manager_id,
      pu.full_name     AS prop_manager_name,
      c.id             AS client_id,
      c.full_name      AS client_name,
      c.budget,
      ${clientRoomsExpr} AS rooms_needed,
      c.property_type,
      ${hasClientLandArea ? "c.land_area_sotky AS client_land_area_sotky," : "NULL AS client_land_area_sotky,"}
      ${hasClientDistrict ? "c.district       AS client_district," : "NULL             AS client_district,"}
      c.currency       AS client_currency,
      c.phone,
      c.segment,
      COALESCE(c.manager_id, c.created_by) AS client_manager_id,
      cu.full_name     AS client_manager_name,
      MIN(100, ${scoreExpr}${districtScoreExpr}) AS score,
      ABS(p.rooms - ${clientRoomsExpr})    AS room_diff,
      ROUND(ABS(
          (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
        - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) * 100, 1) AS price_diff_pct,
      CASE
        WHEN ${hasClientDistrict ? "c.district IS NOT NULL AND TRIM(c.district) != ''" : "0"}
         AND p.district IS NOT NULL AND TRIM(p.district) != ''
         AND LOWER(TRIM(c.district)) = LOWER(TRIM(p.district)) THEN 1
        ELSE 0
      END AS district_match,
      CASE
        WHEN p.category = 'land_plot' AND ${hasPropertyLandArea ? "p.land_area_sotky IS NOT NULL" : "0"} AND ${hasClientLandArea ? "c.land_area_sotky IS NOT NULL" : "0"}
        THEN ROUND(ABS(p.land_area_sotky - c.land_area_sotky) / NULLIF(c.land_area_sotky, 0) * 100, 1)
        ELSE NULL
      END AS land_area_diff_pct,
      ${hasDismissedMatches ? "CASE WHEN dm.property_id IS NOT NULL THEN 1 ELSE 0 END AS is_dismissed" : "0 AS is_dismissed"}
    FROM properties p
    JOIN clients c ON (
      p.category = c.property_type
      AND p.price      IS NOT NULL AND c.budget       IS NOT NULL
      AND (
        (
          p.category = 'land_plot'
          AND ${hasPropertyLandArea ? "p.land_area_sotky IS NOT NULL" : "0"}
          AND ${hasClientLandArea ? "c.land_area_sotky IS NOT NULL" : "0"}
          AND ABS(p.land_area_sotky - c.land_area_sotky) / NULLIF(c.land_area_sotky, 0) <= 0.15
        )
        OR
        (
          p.category != 'land_plot'
          AND p.rooms      IS NOT NULL AND ${clientRoomsExpr} IS NOT NULL
          AND ${
            clientSchema.hasRoomsFrom && clientSchema.hasRoomsTo
              ? `(
                  (c.rooms_from IS NOT NULL AND c.rooms_to IS NOT NULL AND p.rooms BETWEEN c.rooms_from AND c.rooms_to)
                  OR ABS(p.rooms - ${clientRoomsExpr}) <= 1
                )`
              : `ABS(p.rooms - ${clientRoomsExpr}) <= 1`
          }
        )
      )
      AND ABS(
          (p.price  * CASE p.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
        - (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END)
      ) / (c.budget * CASE c.currency WHEN 'USD' THEN 1.0 WHEN 'EUR' THEN 1.08 ELSE 0.024 END) <= 0.15
    )
    LEFT JOIN users pu ON p.manager_id = pu.id
    LEFT JOIN users cu ON COALESCE(c.manager_id, c.created_by) = cu.id
    ${hasDismissedMatches ? "LEFT JOIN dismissed_matches dm ON dm.property_id = p.id AND dm.client_id = c.id AND dm.dismissed_by = ?" : ""}
    WHERE p.status = 'active' AND ${clientSchema.hasStatus ? "c.status = 'active'" : "1 = 1"}
    ${managerFilter}
    ORDER BY is_dismissed ASC, score DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
    const queryParams = isTop
      ? (hasDismissedMatches ? [uid] : [])
      : (hasDismissedMatches ? [uid, uid, uid] : [uid, uid]);
    const result = await env.DB.prepare(fullSql).bind(...queryParams).all();
    const rows = result.results ?? [];

    // Convert DB rows into frontend-friendly shape.
    const matches = rows.map((r) => {
      const score = r.score;
      const reasons = [];
      if (r.price_diff_pct <= 5) reasons.push('Ціна ідеально підходить');
      else if (r.price_diff_pct <= 10) reasons.push('Ціна підходить');
      else reasons.push('Ціна близька (±15%)');
      reasons.push('Тип збігається');
      if (r.category === 'land_plot' && r.land_area_diff_pct !== null) {
        reasons.push(`Сотки близькі (${r.land_area_diff_pct}%)`);
      } else if (r.category !== 'land_plot' && r.room_diff === 0) {
        reasons.push('Кімнати збігаються');
      } else if (r.category !== 'land_plot') {
        reasons.push('Кімнати ±1');
      }
      if (r.district_match) reasons.push('Район збігається');

      return {
        id: `${r.property_id}-${r.client_id}`,
        propertyId: r.property_id,
        clientId: r.client_id,
        is_dismissed: Boolean(r.is_dismissed),
        property: {
          title: r.title,
          price: r.price,
          rooms: r.rooms,
          category: r.category,
          currency: r.prop_currency,
          manager: r.prop_manager_name ?? 'Невідомий',
          manager_id: r.prop_manager_id ?? '',
          district: r.district ?? '',
          street: r.street ?? '',
          area_total: r.area_total ?? null,
          land_area_sotky: r.property_land_area_sotky ?? null,
          operation_type: r.operation_type ?? 'sale',
        },
        client: {
          name: r.client_name,
          budget: r.budget,
          rooms_needed: r.rooms_needed,
          property_type: r.property_type,
          land_area_sotky: r.client_land_area_sotky ?? null,
          district: r.client_district ?? '',
          currency: r.client_currency,
          manager: r.client_manager_name ?? 'Невідомий',
          manager_id: r.client_manager_id ?? '',
          phone: r.phone ?? '',
          segment: r.segment ?? 'buyer',
        },
        score,
        reasons,
        myProperty: r.prop_manager_id === uid,
        myClient: r.client_manager_id === uid,
      };
    });

    return jsonResponse({ matches, total: matches.length }, 200, env, request);
  } catch (error) {
    console.error("handleMatches failed", error);
    return errorResponse(`Matches[v3] failed: ${error?.message || String(error)}`, 500, env, request);
  }
}
__name(handleMatches, "handleMatches");

async function handleDismissMatch(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body?.property_id || !body?.client_id) return errorResponse("property_id and client_id required", 400, env, request);
  const id = generateId();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO dismissed_matches (id, property_id, client_id, dismissed_by) VALUES (?, ?, ?, ?)`
  ).bind(id, body.property_id, body.client_id, currentUser.id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleDismissMatch, "handleDismissMatch");

async function handleRestoreMatch(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body?.property_id || !body?.client_id) return errorResponse("property_id and client_id required", 400, env, request);
  await env.DB.prepare(
    `DELETE FROM dismissed_matches WHERE property_id = ? AND client_id = ? AND dismissed_by = ?`
  ).bind(body.property_id, body.client_id, currentUser.id).run();
  return jsonResponse({ success: true }, 200, env, request);
}
__name(handleRestoreMatch, "handleRestoreMatch");

export { index_default as default };

// ─── Reports ──────────────────────────────────────────────────────────────────

async function handleGetReports(env, currentUser, request) {
  const isTop = currentUser.role === 'top_manager' || currentUser.role === 'superuser';
  let results;
  if (isTop) {
    results = await env.DB.prepare(
      `SELECT ${REPORT_COLUMNS}, u.full_name as manager_name
       FROM reports r LEFT JOIN users u ON u.id = r.manager_id
       ORDER BY r.created_at DESC`
    ).all();
  } else {
    results = await env.DB.prepare(
      `SELECT ${REPORT_COLUMNS}, u.full_name as manager_name
       FROM reports r LEFT JOIN users u ON u.id = r.manager_id
       WHERE r.manager_id = ?
       ORDER BY r.created_at DESC`
    ).bind(currentUser.id).all();
  }
  return jsonResponse(results.results, 200, env, request);
}
__name(handleGetReports, "handleGetReports");

async function handleCreateReport(request, env, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const id = generateId();
  const isSending = body.status === 'sent';

  await env.DB.prepare(
    `INSERT INTO reports (id, manager_id, period_type, period_start, period_end,
      properties_added, clients_added, deals_closed, viewings_done, revenue, summary, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id, currentUser.id, body.period_type || 'week',
    body.period_start, body.period_end,
    body.properties_added || 0, body.clients_added || 0,
    body.deals_closed || 0, body.viewings_done || 0,
    body.revenue || 0, body.summary || null,
    body.status || 'draft'
  ).run();

  // If sending → notify all top managers
  if (isSending) {
    const tops = await env.DB.prepare(
      `SELECT id FROM users WHERE role IN ('top_manager','superuser')`
    ).all();
    await Promise.all((tops.results ?? []).map((top) => {
      const nid = generateId();
      return env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
         VALUES (?, ?, ?, ?, 'update', 'note', ?, 0, datetime('now'))`
      ).bind(
        nid,
        top.id,
        'Новий звіт менеджера',
        `${currentUser.full_name} надіслав звіт за ${body.period_type === 'week' ? 'тиждень' : 'місяць'}`,
        id
      ).run();
    }));
  }

  // OPT: return constructed object instead of re-fetching
  return jsonResponse({
    id, manager_id: currentUser.id,
    period_type: body.period_type || 'week',
    period_start: body.period_start, period_end: body.period_end,
    properties_added: body.properties_added || 0, clients_added: body.clients_added || 0,
    deals_closed: body.deals_closed || 0, viewings_done: body.viewings_done || 0,
    revenue: body.revenue || 0, summary: body.summary || null,
    status: body.status || 'draft',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, 201, env, request);
}
__name(handleCreateReport, "handleCreateReport");

async function handleUpdateReport(request, env, id, currentUser) {
  const body = await parseBody(request);
  if (!body) return errorResponse("Invalid body", 400, env, request);
  const updates = []; const values = [];
  if (body.status !== undefined) { updates.push("status = ?"); values.push(body.status); }
  if (body.summary !== undefined) { updates.push("summary = ?"); values.push(body.summary); }
  if (body.reviewed_by !== undefined) { updates.push("reviewed_by = ?"); values.push(body.reviewed_by); }
  if (body.reviewed_at !== undefined) { updates.push("reviewed_at = ?"); values.push(body.reviewed_at); }
  if (body.properties_added !== undefined) { updates.push("properties_added = ?"); values.push(body.properties_added); }
  if (body.clients_added !== undefined) { updates.push("clients_added = ?"); values.push(body.clients_added); }
  if (body.deals_closed !== undefined) { updates.push("deals_closed = ?"); values.push(body.deals_closed); }
  if (body.viewings_done !== undefined) { updates.push("viewings_done = ?"); values.push(body.viewings_done); }
  if (body.revenue !== undefined) { updates.push("revenue = ?"); values.push(body.revenue); }
  if (updates.length === 0) return errorResponse("Nothing to update", 400, env, request);
  updates.push("updated_at = datetime('now')");
  values.push(id);
  await env.DB.prepare(`UPDATE reports SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  // If top manager marks as reviewed → notify the manager
  if (body.status === 'reviewed') {
    const report = await env.DB.prepare("SELECT manager_id FROM reports WHERE id = ?").bind(id).first();
    if (report?.manager_id) {
      const nid = generateId();
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, entity_type, entity_id, is_read, created_at)
         VALUES (?, ?, ?, ?, 'update', 'note', ?, 0, datetime('now'))`
      ).bind(nid, report.manager_id, 'Звіт переглянуто', `${currentUser.full_name} переглянув ваш звіт`, id).run();
    }
  }

  // OPT: return patched fields instead of re-fetching
  return jsonResponse({ id, ...body, updated_at: new Date().toISOString() }, 200, env, request);
}
__name(handleUpdateReport, "handleUpdateReport");

async function handleReportStats(url, env, currentUser, request) {
  const params = parseQuery(url);
  const managerId = params.manager_id || null;
  const isTop = currentUser.role === 'top_manager' || currentUser.role === 'superuser';
  const uid = managerId || (isTop ? null : currentUser.id);

  // OPT: run all report queries in parallel instead of sequentially
  const [dealsQuery, propsQuery, clientsQuery, managersResult] = await Promise.all([
    uid
      ? env.DB.prepare(
          `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count, stage
           FROM deals WHERE (created_by = ? OR assigned_agent_id = ?) AND created_at >= date('now','-84 days')
           GROUP BY week, stage ORDER BY week`
        ).bind(uid, uid).all()
      : env.DB.prepare(
          `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count, stage
           FROM deals WHERE created_at >= date('now','-84 days')
           GROUP BY week, stage ORDER BY week`
        ).all(),
    uid
      ? env.DB.prepare(
          `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
           FROM properties WHERE manager_id = ? AND created_at >= date('now','-84 days')
           GROUP BY week ORDER BY week`
        ).bind(uid).all()
      : env.DB.prepare(
          `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
           FROM properties WHERE created_at >= date('now','-84 days')
           GROUP BY week ORDER BY week`
        ).all(),
    uid
      ? env.DB.prepare(
          `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
           FROM clients WHERE manager_id = ? AND created_at >= date('now','-84 days')
           GROUP BY week ORDER BY week`
        ).bind(uid).all()
      : env.DB.prepare(
          `SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
           FROM clients WHERE created_at >= date('now','-84 days')
           GROUP BY week ORDER BY week`
        ).all(),
    // OPT: managersStats query runs in parallel with chart queries (only for top_manager)
    isTop
      ? env.DB.prepare(
          `SELECT
             u.id,
             u.full_name,
             COALESCE(p.props_30d, 0) AS props_30d,
             COALESCE(c.clients_30d, 0) AS clients_30d,
             COALESCE(d.deals_closed_30d, 0) AS deals_closed_30d,
             COALESCE(d.deals_total_30d, 0) AS deals_total_30d
           FROM users u
           LEFT JOIN (
             SELECT manager_id, COUNT(*) AS props_30d
             FROM properties
             WHERE created_at >= date('now','-30 days')
             GROUP BY manager_id
           ) p ON p.manager_id = u.id
           LEFT JOIN (
             SELECT manager_id, COUNT(*) AS clients_30d
             FROM clients
             WHERE created_at >= date('now','-30 days')
             GROUP BY manager_id
           ) c ON c.manager_id = u.id
           LEFT JOIN (
             SELECT manager_id,
                    SUM(deals_closed_30d) AS deals_closed_30d,
                    SUM(deals_total_30d) AS deals_total_30d
             FROM (
               SELECT created_by AS manager_id,
                      COUNT(*) FILTER (WHERE stage='closed') AS deals_closed_30d,
                      COUNT(*) AS deals_total_30d
               FROM deals
               WHERE created_at >= date('now','-30 days') AND created_by IS NOT NULL
               GROUP BY created_by
               UNION ALL
               SELECT assigned_agent_id AS manager_id,
                      COUNT(*) FILTER (WHERE stage='closed') AS deals_closed_30d,
                      COUNT(*) AS deals_total_30d
               FROM deals
               WHERE created_at >= date('now','-30 days')
                 AND assigned_agent_id IS NOT NULL
                 AND (created_by IS NULL OR assigned_agent_id != created_by)
               GROUP BY assigned_agent_id
             )
             GROUP BY manager_id
           ) d ON d.manager_id = u.id
           WHERE u.role = 'manager'
           ORDER BY props_30d DESC`
        ).all()
      : Promise.resolve({ results: [] }),
  ]);

  return jsonResponse({
    deals:      dealsQuery.results,
    properties: propsQuery.results,
    clients:    clientsQuery.results,
    managers:   managersResult.results,
  }, 200, env, request);
}
__name(handleReportStats, "handleReportStats");
