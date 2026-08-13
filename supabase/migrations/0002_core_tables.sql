-- ============================================================================
-- 0002 · Core tables
--
-- Multi-tenant from day one: every business-owned row carries organization_id.
-- Money is stored as integer cents. Timestamps are timestamptz (UTC); the
-- organization's timezone drives presentation and availability math.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Organizations (tenants)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 40),
  name         text not null,
  description  text,
  address      text,
  instagram    text,
  whatsapp     text,
  logo_url     text,
  cover_url    text,
  timezone     text not null default 'America/Argentina/Buenos_Aires',
  currency     text not null default 'ARS',
  locale       text not null default 'es-AR',
  created_at   timestamptz not null default now()
);

comment on column public.organizations.timezone is 'IANA tz; all availability math is done in this zone.';

-- Reserved slugs that must never be used as an organization slug (they collide
-- with app routes). Enforced in application code + this helper table.
create table public.reserved_slugs (
  slug text primary key
);
insert into public.reserved_slugs (slug) values
  ('dashboard'), ('api'), ('login'), ('signup'), ('auth'),
  ('admin'), ('app'), ('book'), ('reservar'), ('settings');

-- ---------------------------------------------------------------------------
-- Membership: links Supabase auth users to organizations with a role.
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.member_role not null default 'owner',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index on public.organization_members (user_id);
create index on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- Service categories
-- ---------------------------------------------------------------------------
create table public.service_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.service_categories (organization_id);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  category_id      uuid references public.service_categories(id) on delete set null,
  name             text not null,
  description      text,
  image_url        text,
  price_cents      int not null default 0 check (price_cents >= 0),
  duration_min     int not null check (duration_min > 0),
  buffer_min       int not null default 0 check (buffer_min >= 0),
  deposit_type     public.deposit_type not null default 'none',
  -- fixed → cents; percentage → 0..100
  deposit_value    numeric(10,2) not null default 0 check (deposit_value >= 0),
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index on public.services (organization_id);
create index on public.services (organization_id, is_active);

-- ---------------------------------------------------------------------------
-- Professionals (a bookable resource; may optionally link to a member user).
-- NOTE: pay/commission data lives in professional_pay (member-only), NOT here,
-- so the public booking page can read professionals without leaking finances.
-- ---------------------------------------------------------------------------
create table public.professionals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  name             text not null,
  photo_url        text,
  specialties      text[] not null default '{}',
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index on public.professionals (organization_id);
create index on public.professionals (organization_id, is_active);

-- Which services each professional performs (empty set = performs all).
create table public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete cascade,
  primary key (professional_id, service_id)
);

-- Sensitive pay configuration — never exposed to anon.
create table public.professional_pay (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  commission_type public.commission_type not null default 'percentage',
  commission_value numeric(10,2) not null default 0 check (commission_value >= 0)
);

-- ---------------------------------------------------------------------------
-- Working hours. professional_id NULL = the shop's default opening hours;
-- a row with professional_id set overrides for that professional.
-- weekday: 0=Sunday .. 6=Saturday (matches JS getDay / date-fns).
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  weekday         int not null check (weekday between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  check (end_time > start_time)
);
create index on public.business_hours (organization_id, professional_id, weekday);

-- Ad-hoc closures / blocks (holidays, breaks, personal time).
create table public.blocked_times (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade, -- NULL = whole shop
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  reason          text,
  created_at      timestamptz not null default now(),
  check (end_at > start_at)
);
create index on public.blocked_times (organization_id, start_at, end_at);

-- ---------------------------------------------------------------------------
-- Clients (recognised by phone within an organization)
-- ---------------------------------------------------------------------------
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  phone            text not null,
  email            text,
  birthday         date,
  preferred_professional_id uuid references public.professionals(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, phone)
);
create index on public.clients (organization_id);

create table public.client_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  body            text not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on public.client_notes (client_id);

create table public.client_photos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  url             text not null,
  caption         text,
  created_at      timestamptz not null default now()
);
create index on public.client_photos (client_id);

-- ---------------------------------------------------------------------------
-- Appointments — the heart of the system.
-- The exclusion constraint is the hard guarantee against double-booking:
-- no two active appointments for the same professional may overlap in time.
-- ---------------------------------------------------------------------------
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  professional_id  uuid not null references public.professionals(id) on delete restrict,
  client_id        uuid references public.clients(id) on delete set null,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  status           public.appointment_status not null default 'reservado',
  source           public.appointment_source not null default 'manual',
  booking_code     text not null unique,
  notes            text,
  created_at       timestamptz not null default now(),
  check (end_at > start_at),

  -- No overlapping active appointments for the same professional.
  constraint appointments_no_overlap
    exclude using gist (
      professional_id with =,
      tstzrange(start_at, end_at) with &&
    )
    where (status in ('reservado', 'confirmado', 'atendido'))
);
create index on public.appointments (organization_id, start_at);
create index on public.appointments (professional_id, start_at);
create index on public.appointments (client_id);

-- Services attached to an appointment (price/duration snapshotted at booking).
create table public.appointment_services (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  service_id      uuid references public.services(id) on delete set null,
  name            text not null,
  price_cents     int not null default 0,
  duration_min    int not null
);
create index on public.appointment_services (appointment_id);

-- Nail technical record, tied to an appointment (Fase 3, schema-ready now).
create table public.nail_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete set null,
  shape           text,
  length          text,
  color           text,
  design          text,
  technique       text,
  product         text,
  observations    text,
  photo_before_url text,
  photo_after_url  text,
  created_at      timestamptz not null default now()
);
create index on public.nail_records (client_id);

-- ---------------------------------------------------------------------------
-- Money: payments, commissions (Fase 2, schema-ready now)
-- ---------------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete set null,
  client_id       uuid references public.clients(id) on delete set null,
  kind            public.payment_kind not null,
  method          public.payment_method,
  amount_cents    int not null,
  status          public.payment_status not null default 'paid',
  provider        text,          -- e.g. 'mercadopago'
  provider_ref    text,          -- external id (unique per provider, idempotency)
  created_at      timestamptz not null default now()
);
create index on public.payments (organization_id, created_at);
create index on public.payments (appointment_id);

create table public.commissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete set null,
  base_cents      int not null default 0,
  rate            numeric(10,2),
  amount_cents    int not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.commissions (organization_id, professional_id, created_at);

-- ---------------------------------------------------------------------------
-- Promotions, waitlist, notifications, settings (Fase 2/3, schema-ready now)
-- ---------------------------------------------------------------------------
create table public.promotions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  code            text,
  discount_type   text not null default 'percentage', -- percentage | fixed
  discount_value  numeric(10,2) not null default 0,
  is_active       boolean not null default true,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  service_id      uuid references public.services(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  desired_date    date,
  time_from       time,
  time_to         time,
  phone           text,
  notified_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.waitlist (organization_id, desired_date);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete cascade,
  type            text not null, -- confirmation | reminder_24h | reminder_2h | cancelled | rescheduled | slot_freed
  channel         text not null default 'in_app', -- in_app | email | whatsapp
  payload         jsonb not null default '{}',
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.notifications (organization_id, created_at);

-- Free-form per-organization settings (deposit policy defaults, etc.).
create table public.settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  data            jsonb not null default '{}'
);
