import { z } from 'zod';

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const nullishString = z.string().nullish();

export const PropertySchema = z.object({
  id: z.string(),
  title: z.string(),
  address: z.string(),
  district: nullableString.optional(),
  operation_type: nullableString.optional(),
  category: nullableString.optional(),
  status: z.string(),
  price: nullableNumber.optional(),
  currency: nullableString.optional(),
  area_total: nullableNumber.optional(),
  rooms: nullableNumber.optional(),
  owner_phones: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  photos: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  created_at: z.string(),
  manager_id: nullableString.optional(),
});

export const PropertyDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: nullableString.optional(),
  address: nullableString.optional(),
  city: nullableString.optional(),
  district: nullableString.optional(),
  street: nullableString.optional(),
  building_number: nullableString.optional(),
  block: nullableString.optional(),
  floor: nullableNumber.optional(),
  apartment: nullableString.optional(),
  latitude: nullableNumber.optional(),
  longitude: nullableNumber.optional(),
  operation_type: nullableString.optional(),
  category: nullableString.optional(),
  source: nullableString.optional(),
  status: z.string(),
  rooms: nullableNumber.optional(),
  area_total: nullableNumber.optional(),
  land_area_sotky: nullableNumber.optional(),
  area_living: nullableNumber.optional(),
  area_kitchen: nullableNumber.optional(),
  floors_total: nullableNumber.optional(),
  property_condition: nullableString.optional(),
  heating: nullableString.optional(),
  bathroom: nullableString.optional(),
  balcony_type: nullableString.optional(),
  price: nullableNumber.optional(),
  currency: nullableString.optional(),
  price_per_sqm: nullableNumber.optional(),
  negotiable: z.union([z.number(), z.boolean(), z.null()]).optional(),
  additional_costs: nullableString.optional(),
  owner_name: nullableString.optional(),
  owner_phones: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  owner_notes: nullableString.optional(),
  photos: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  tags: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  agent_notes: nullableString.optional(),
  manager_id: nullableString.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ClientSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  phone: nullableString.optional(),
  segment: z.string(),
  budget: nullableNumber.optional(),
  currency: nullableString.optional(),
  tags: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  notes: nullableString.optional(),
  property_type: nullableString.optional(),
  rooms_from: nullableNumber.optional(),
  rooms_to: nullableNumber.optional(),
  district: nullableString.optional(),
  land_area_sotky: nullableNumber.optional(),
  created_by: z.string(),
  manager_id: nullableString.optional(),
  status: nullableString.optional(),
  created_at: nullishString,
});

export const DealSchema = z.object({
  id: z.string(),
  title: z.string(),
  stage: z.enum(['lead', 'viewing', 'offer', 'deal', 'closed']),
  assigned_agent_id: nullableString,
  property_id: nullableString.optional(),
  client_id: nullableString.optional(),
  amount: nullableNumber.optional(),
  currency: nullableString.optional(),
  commission: nullableNumber.optional(),
  commission_currency: nullableString.optional(),
  notes: nullableString.optional(),
  created_at: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: nullishString,
  created_at: nullishString,
  role: nullishString,
  approved: z.union([z.boolean(), z.number()]).optional(),
  approved_at: nullableString.optional(),
  avatar_url: nullableString.optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: nullableString.optional(),
  priority: z.enum(['low', 'medium', 'high']),
  done: z.union([z.boolean(), z.number()]),
  result: z.enum(['done', 'not_done']).nullable().optional(),
  assigned_to: nullableString.optional(),
  assigned_by: nullableString.optional(),
  assigned_by_name: nullableString.optional(),
  assigned_to_name: nullableString.optional(),
  created_by: z.string(),
  created_at: z.string(),
  completed_at: nullableString.optional(),
});

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: nullableString.optional(),
  starts_at: z.string(),
  ends_at: nullableString.optional(),
  event_type: z.string(),
  status: z.string(),
  property_id: nullableString.optional(),
  client_id: nullableString.optional(),
});

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  file_url: z.string(),
  file_name: z.string(),
  created_at: z.string(),
});

export const ClientInteractionSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  user_id: z.string(),
  interaction_type: nullableString.optional(),
  notes: nullableString.optional(),
  created_at: z.string(),
});

export const ChangeHistorySchema = z.object({
  id: z.string(),
  action: z.string(),
  changed_by_name: nullableString.optional(),
  created_at: z.string(),
});

export const ReportSchema = z.object({
  id: z.string(),
  manager_id: z.string(),
  manager_name: nullableString.optional(),
  period_type: z.enum(['week', 'month']),
  period_start: z.string(),
  period_end: z.string(),
  properties_added: z.number(),
  clients_added: z.number(),
  deals_closed: z.number(),
  viewings_done: z.number(),
  revenue: z.number(),
  summary: nullableString.optional(),
  status: z.enum(['draft', 'sent', 'reviewed']),
  reviewed_at: nullableString.optional(),
});

export const ReportStatsRowSchema = z.object({
  week: z.string(),
  count: z.number(),
  stage: nullableString.optional(),
});

export const ManagerStatsSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  props_30d: z.number(),
  clients_30d: z.number(),
  deals_closed_30d: z.number(),
  deals_total_30d: z.number(),
});

export const ReportsStatsSchema = z.object({
  deals: z.array(ReportStatsRowSchema),
  properties: z.array(ReportStatsRowSchema),
  clients: z.array(ReportStatsRowSchema),
  managers: z.array(ManagerStatsSchema),
});

export const DashboardTopManagerSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  closed_count: z.number(),
  total_amount: z.number(),
  currency: z.string(),
});

export const DashboardStatsSchema = z.object({
  properties: z.number(),
  closedDeals: z.number(),
  conversion: z.number(),
  noPhoto: z.number(),
  noNotes: z.number(),
  archived: z.number(),
  topManagers: z.array(DashboardTopManagerSchema),
});

export const DashboardActivityItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
  manager: nullableString.optional(),
  type: z.enum(['deal', 'property', 'client']),
  stage: nullableString.optional(),
  status: nullableString.optional(),
});

export const MatchPropertySchema = z.object({
  title: z.string(),
  price: z.number(),
  rooms: z.number(),
  category: z.string(),
  currency: z.string(),
  manager: z.string(),
  manager_id: z.string(),
  district: z.string(),
  street: z.string(),
  area_total: nullableNumber,
  land_area_sotky: nullableNumber.optional(),
  operation_type: z.string(),
});

export const MatchClientSchema = z.object({
  name: z.string(),
  budget: z.number(),
  rooms_needed: z.number(),
  property_type: z.string(),
  land_area_sotky: nullableNumber.optional(),
  currency: z.string(),
  manager: z.string(),
  manager_id: z.string(),
  phone: z.string(),
  segment: z.string(),
});

export const MatchItemSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  clientId: z.string(),
  property: MatchPropertySchema,
  client: MatchClientSchema,
  score: z.number(),
  reasons: z.array(z.string()),
  myProperty: z.union([z.boolean(), z.number()]),
  myClient: z.union([z.boolean(), z.number()]),
  is_dismissed: z.union([z.boolean(), z.number()]),
});

export const PaginatedResponseSchema = z.object({
  data: z.unknown().optional(),
  hasMore: z.boolean().optional(),
  nextCursor: z.string().nullable().optional(),
});

export const MatchesResponseSchema = z.object({
  matches: z.unknown().optional(),
});

export const CountResponseSchema = z.object({
  count: z.number().optional(),
});

export const NotificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  entity_type: nullableString.optional(),
  entity_id: nullableString.optional(),
  is_read: z.union([z.number(), z.boolean()]),
  created_at: z.string(),
});

export function parseApiArray<T>(schema: z.ZodType<T>, data: unknown, label: string): T[] {
  const parsed = z.array(schema).safeParse(data);
  if (!parsed.success) {
    console.error(`Invalid ${label} response`, parsed.error);
    return [];
  }
  return parsed.data;
}

export function parseApiObject<T>(schema: z.ZodType<T>, data: unknown, label: string): T | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`Invalid ${label} response`, parsed.error);
    return null;
  }
  return parsed.data;
}
