import { z } from 'zod';
import {
  CalendarEventSchema,
  DashboardActivityItemSchema,
  DashboardStatsSchema,
  DashboardTopManagerSchema,
  ChangeHistorySchema,
  ClientInteractionSchema,
  ClientSchema,
  DealSchema,
  DocumentSchema,
  MatchItemSchema,
  NoteSchema,
  NotificationSchema,
  PaginatedResponseSchema,
  PropertyDetailSchema,
  PropertySchema,
  ReportsStatsSchema,
  ReportSchema,
  UserSchema,
} from '@/lib/schemas';

export type Property = z.infer<typeof PropertySchema>;
export type PropertyDetail = z.infer<typeof PropertyDetailSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type Deal = z.infer<typeof DealSchema>;
export type User = z.infer<typeof UserSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type ClientInteraction = z.infer<typeof ClientInteractionSchema>;
export type ChangeHistory = z.infer<typeof ChangeHistorySchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ReportsStats = z.infer<typeof ReportsStatsSchema>;
export type MatchItem = z.infer<typeof MatchItemSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type DashboardTopManager = z.infer<typeof DashboardTopManagerSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DashboardActivityItem = z.infer<typeof DashboardActivityItemSchema>;

export type DealPropertyOption = Pick<Property, 'id' | 'title' | 'address'>;
export type DealClientOption = Pick<Client, 'id' | 'full_name'>;
export type NoteManager = Pick<User, 'id' | 'full_name'>;
export type ClientManager = Pick<User, 'id' | 'full_name'>;
export type ClientCalendarEvent = Pick<
  CalendarEvent,
  'id' | 'title' | 'description' | 'starts_at' | 'event_type' | 'status'
>;
