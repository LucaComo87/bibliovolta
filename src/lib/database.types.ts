/**
 * Tipi TypeScript dello schema "public" (corrispondono a supabase/migrations).
 * Dopo aver collegato il progetto Supabase si possono rigenerare con:
 *   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type UserRole = "student" | "teacher";
export type BookingStatus = "confirmed" | "cancelled";
export type BookingSource = "student" | "teacher" | "waitlist_offer";
export type WaitlistStatus = "waiting" | "offered" | "assigned" | "expired" | "withdrawn";
export type OfferStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";
export type AnnouncementAudience = "all_students" | "day_bookings" | "single_student";
export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type AppSettings = {
  id: number;
  season_start: string;
  season_end: string;
  default_capacity: number;
  default_opens_at: string;
  default_closes_at: string;
  cancellation_hours: number;
  student_email_domain: string;
  school_timezone: string;
  offer_minutes: number;
  updated_at: string;
  updated_by: string | null;
}

export type Student = Timestamps & {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  class_name: string | null;
  is_active: boolean;
  registered_at: string | null;
}

export type Teacher = Timestamps & {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  password_changed_at: string | null;
}

export type SchoolDay = Timestamps & {
  id: string;
  day: string;
  is_open: boolean;
  capacity: number;
  opens_at: string;
  closes_at: string;
  closure_reason: string | null;
  note: string | null;
  waitlist_paused: boolean;
  updated_by: string | null;
}

export type Booking = {
  id: string;
  student_id: string;
  school_day_id: string;
  status: BookingStatus;
  source: BookingSource;
  created_at: string;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  updated_at: string;
}

export type WaitlistEntry = {
  id: string;
  student_id: string;
  school_day_id: string;
  status: WaitlistStatus;
  joined_at: string;
  queue_seq: number;
  end_reason: string | null;
  updated_at: string;
}

export type SeatOffer = {
  id: string;
  school_day_id: string;
  student_id: string;
  waitlist_entry_id: string;
  booking_id: string | null;
  status: OfferStatus;
  offered_at: string;
  expires_at: string;
  responded_at: string | null;
  created_by: string | null;
  token_hash: string | null;
  used_at: string | null;
  end_reason: string | null;
  updated_at: string;
}

export type Announcement = Timestamps & {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  school_day_id: string | null;
  student_id: string | null;
  send_email: boolean;
  published_at: string | null;
  include_bookings: boolean;
  include_waitlist: boolean;
  recipients_count: number;
}

export type AnnouncementDelivery = {
  id: string;
  announcement_id: string;
  student_id: string;
  email_status: DeliveryStatus;
  email_provider_id: string | null;
  email_error: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export type AuditLogEntry = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json;
}

export type DayAvailability = {
  school_day_id: string;
  day: string;
  is_open: boolean;
  capacity: number;
  booked: number;
  held: number;
  available: number;
  waiting: number;
  waitlist_open: boolean;
  opens_at: string;
  closes_at: string;
  closure_reason: string | null;
  note: string | null;
}

export type MyBookingRow = {
  booking_id: string;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
  school_day_id: string;
  day: string;
  opens_at: string;
  closes_at: string;
  day_is_open: boolean;
  cancel_deadline: string;
  can_cancel: boolean;
};

export type MyWaitlistRow = {
  entry_id: string;
  entry_status: WaitlistStatus;
  joined_at: string;
  queue_position: number | null;
  waiting_total: number;
  school_day_id: string;
  day: string;
  opens_at: string;
  closes_at: string;
  day_is_open: boolean;
  waitlist_paused: boolean;
  offer_id: string | null;
  offer_status: OfferStatus | null;
  offered_at: string | null;
  offer_expires_at: string | null;
  end_reason: string | null;
};

export type OfferByTokenRow = {
  offer_id: string;
  status: OfferStatus;
  offered_at: string;
  expires_at: string;
  used_at: string | null;
  day: string;
  opens_at: string;
  closes_at: string;
  day_is_open: boolean;
  first_name: string | null;
};

export type NotificationKind =
  | "waitlist_offer"
  | "offer_confirmed"
  | "offer_expired"
  | "day_closed_booked"
  | "day_closed_waitlist"
  | "announcement"
  | "booking_cancelled";

export type TeacherStatsJson = {
  total_bookings: number;
  cancellations: number;
  unique_students: number;
  registered_students: number;
  reference_days: number;
  avg_daily: number;
  avg_occupancy: number;
  waiting: number;
  full_days: number;
  top_days: { day: string; n: number; capacity: number }[];
  classes: { class_name: string; n: number }[];
  weekdays: { dow: number; occupancy: number; avg_n: number }[];
  weeks: { week_start: string; bookings: number; occupancy: number }[];
};

export type NotificationRow = {
  id: number;
  kind: NotificationKind;
  student_id: string | null;
  to_email: string;
  payload: { [key: string]: Json | undefined };
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  provider_id: string | null;
  created_at: string;
  claimed_at: string | null;
  sent_at: string | null;
  delivery_id: string | null;
};

/** Colonne generate dal database: facoltative in inserimento. */
type Generated = "id" | "created_at" | "updated_at";
type TableDef<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional | Extract<Generated, keyof Row>> &
    Partial<Pick<Row, Optional | Extract<Generated, keyof Row>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      app_settings: TableDef<AppSettings, keyof AppSettings>;
      students: TableDef<Student, "full_name" | "first_name" | "last_name" | "class_name" | "is_active" | "registered_at">;
      teachers: TableDef<Teacher, "full_name" | "is_admin" | "is_active" | "must_change_password" | "password_changed_at">;
      school_days: TableDef<
        SchoolDay,
        "is_open" | "capacity" | "opens_at" | "closes_at" | "closure_reason" | "note" | "updated_by" | "waitlist_paused"
      >;
      bookings: TableDef<
        Booking,
        "status" | "source" | "created_by" | "cancelled_at" | "cancelled_by" | "cancel_reason"
      >;
      waitlist_entries: TableDef<WaitlistEntry, "status" | "joined_at" | "queue_seq" | "end_reason">;
      seat_offers: TableDef<SeatOffer, "booking_id" | "status" | "offered_at" | "responded_at" | "created_by" | "token_hash" | "used_at" | "end_reason">;
      announcements: TableDef<
        Announcement,
        "author_id" | "school_day_id" | "student_id" | "send_email" | "published_at" | "include_bookings" | "include_waitlist" | "recipients_count"
      >;
      announcement_deliveries: TableDef<
        AnnouncementDelivery,
        "email_status" | "email_provider_id" | "email_error" | "sent_at" | "read_at"
      >;
      audit_log: TableDef<AuditLogEntry, keyof AuditLogEntry>;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_teacher: { Args: Record<string, never>; Returns: boolean };
      is_admin_teacher: { Args: Record<string, never>; Returns: boolean };
      is_student: { Args: Record<string, never>; Returns: boolean };
      current_app_role: { Args: Record<string, never>; Returns: UserRole | null };
      get_day_availability: { Args: { p_from: string; p_to: string }; Returns: DayAvailability[] };
      generate_school_days: { Args: { p_from: string; p_to: string }; Returns: number };
      is_allowed_student_email: { Args: { p_email: string }; Returns: boolean };
      book_seat: { Args: { p_school_day_id: string }; Returns: Booking };
      cancel_booking: { Args: { p_booking_id: string }; Returns: Booking };
      my_bookings: { Args: Record<string, never>; Returns: MyBookingRow[] };
      set_opening_hours: { Args: { p_opens_at: string; p_closes_at: string }; Returns: number };
      school_today: { Args: Record<string, never>; Returns: string };
      join_waitlist: { Args: { p_school_day_id: string }; Returns: { entry_id: string; joined_at: string; queue_position: number }[] };
      leave_waitlist: { Args: { p_entry_id: string }; Returns: undefined };
      my_waitlist: { Args: Record<string, never>; Returns: MyWaitlistRow[] };
      accept_my_offer: { Args: { p_offer_id: string }; Returns: Booking };
      decline_my_offer: { Args: { p_offer_id: string }; Returns: undefined };
      get_offer_by_token: { Args: { p_token: string }; Returns: OfferByTokenRow[] };
      accept_offer_by_token: { Args: { p_token: string }; Returns: Booking };
      decline_offer_by_token: { Args: { p_token: string }; Returns: undefined };
      set_waitlist_paused: { Args: { p_school_day_id: string; p_paused: boolean }; Returns: undefined };
      teacher_remove_waitlist_entry: { Args: { p_entry_id: string }; Returns: undefined };
      set_offer_minutes: { Args: { p_minutes: number }; Returns: undefined };
      run_waitlist_maintenance: { Args: Record<string, never>; Returns: Json };
      announcement_recipients_count: {
        Args: { p_school_day_id: string; p_include_bookings: boolean; p_include_waitlist: boolean };
        Returns: number;
      };
      send_announcement: {
        Args: {
          p_school_day_id: string;
          p_include_bookings: boolean;
          p_include_waitlist: boolean;
          p_subject: string;
          p_body: string;
          p_category?: string | null;
        };
        Returns: { announcement_id: string; recipients: number }[];
      };
      retry_announcement: { Args: { p_announcement_id: string }; Returns: number };
      teacher_update_day: {
        Args: {
          p_school_day_id: string;
          p_is_open: boolean;
          p_capacity: number;
          p_opens_at: string;
          p_closes_at: string;
          p_note: string | null;
          p_closure_reason: string | null;
          p_notice?: "default" | "custom" | "none";
          p_subject?: string | null;
          p_message?: string | null;
        };
        Returns: { booked: number; waiting: number; notified: number; is_open: boolean };
      };
      teacher_cancel_booking: { Args: { p_booking_id: string; p_reason: string; p_notify?: boolean }; Returns: Booking };
      teacher_stats: { Args: Record<string, never>; Returns: TeacherStatsJson };
      export_my_data: { Args: Record<string, never>; Returns: Json };
      erase_student: { Args: { p_student_id: string }; Returns: Json };
      purge_expired_data: { Args: Record<string, never>; Returns: Json };
      claim_notifications: { Args: { p_limit: number }; Returns: NotificationRow[] };
      complete_notification: {
        Args: { p_id: number; p_ok: boolean; p_provider_id: string | null; p_error: string | null; p_permanent?: boolean };
        Returns: undefined;
      };
      complete_student_registration: {
        Args: { p_first_name: string; p_last_name: string; p_class_name: string };
        Returns: Student;
      };
      mark_teacher_password_changed: { Args: { p_teacher_id: string }; Returns: undefined };
      require_teacher_password_change: { Args: { p_teacher_id: string }; Returns: undefined };
      auth_lockout_seconds: { Args: { p_email: string; p_ip: string }; Returns: number };
      record_auth_attempt: {
        Args: { p_kind: "teacher_login" | "password_change"; p_email: string; p_ip: string; p_succeeded: boolean };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      booking_source: BookingSource;
      waitlist_status: WaitlistStatus;
      offer_status: OfferStatus;
      announcement_audience: AnnouncementAudience;
      delivery_status: DeliveryStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
