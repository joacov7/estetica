/**
 * Hand-written database types aligned with supabase/migrations.
 *
 * Covers the tables the application queries today. When the schema grows,
 * regenerate/extend with `supabase gen types typescript`.
 *
 * NOTE: row types are `type` aliases (not `interface`s) on purpose — Supabase's
 * generics require each Row to be assignable to Record<string, unknown>, which
 * interfaces are not (they can be augmented), but object type aliases are.
 */

export type MemberRole = "owner" | "admin" | "professional" | "receptionist";
export type AppointmentStatus =
  | "reservado"
  | "confirmado"
  | "atendido"
  | "cancelado"
  | "no_show";
export type AppointmentSource = "online" | "manual";
export type DepositType = "none" | "fixed" | "percentage";
export type CommissionType = "percentage" | "fixed";

type Timestamped = { created_at: string };

export type Organization = Timestamped & {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  instagram: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_url: string | null;
  timezone: string;
  currency: string;
  locale: string;
};

export type ServiceCategory = Timestamped & {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
};

export type Service = Timestamped & {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  duration_min: number;
  buffer_min: number;
  deposit_type: DepositType;
  deposit_value: number;
  is_active: boolean;
  sort_order: number;
};

export type Professional = Timestamped & {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  photo_url: string | null;
  specialties: string[];
  is_active: boolean;
  sort_order: number;
};

export type BusinessHour = {
  id: string;
  organization_id: string;
  professional_id: string | null;
  weekday: number; // 0=Sun..6=Sat
  start_time: string; // 'HH:MM:SS'
  end_time: string;
};

export type BlockedTime = Timestamped & {
  id: string;
  organization_id: string;
  professional_id: string | null;
  start_at: string;
  end_at: string;
  reason: string | null;
};

export type Client = Timestamped & {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  preferred_professional_id: string | null;
};

export type Appointment = Timestamped & {
  id: string;
  organization_id: string;
  professional_id: string;
  client_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  booking_code: string;
  notes: string | null;
};

export type AppointmentService = {
  id: string;
  appointment_id: string;
  service_id: string | null;
  name: string;
  price_cents: number;
  duration_min: number;
};

export type OrganizationMember = Timestamped & {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
};

/** Helper to build the Supabase table shape from a row type. */
type TableShape<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableShape<Organization>;
      organization_members: TableShape<OrganizationMember>;
      service_categories: TableShape<ServiceCategory>;
      services: TableShape<Service>;
      professionals: TableShape<Professional>;
      professional_services: TableShape<{
        professional_id: string;
        service_id: string;
      }>;
      business_hours: TableShape<BusinessHour>;
      blocked_times: TableShape<BlockedTime>;
      clients: TableShape<Client>;
      appointments: TableShape<Appointment>;
      appointment_services: TableShape<AppointmentService>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      member_role: MemberRole;
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
      deposit_type: DepositType;
      commission_type: CommissionType;
    };
    CompositeTypes: Record<string, never>;
  };
};
