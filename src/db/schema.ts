/**
 * Drizzle schema — single source of truth for tables and query typing.
 *
 * Multi-tenant: every business-owned row carries organizationId. Money is
 * stored as integer cents. Timestamps are timestamptz returned as ISO strings.
 *
 * Tenancy is enforced in the query layer (see src/db/tenant.ts), not by
 * Postgres RLS — we connect as a single application role, so every read/write
 * must be scoped by organizationId against the authenticated member's org.
 *
 * The booking overlap guarantee is a Postgres EXCLUDE constraint added in a
 * custom migration (drizzle/*_booking_exclusion.sql), since Drizzle can't
 * express it in the schema DSL.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  time,
  date,
  jsonb,
  primaryKey,
  unique,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// --- enums ------------------------------------------------------------------
export const memberRole = pgEnum("member_role", [
  "owner",
  "admin",
  "professional",
  "receptionist",
]);
export const appointmentStatus = pgEnum("appointment_status", [
  "reservado",
  "confirmado",
  "atendido",
  "cancelado",
  "no_show",
]);
export const appointmentSource = pgEnum("appointment_source", ["online", "manual"]);
export const depositType = pgEnum("deposit_type", ["none", "fixed", "percentage"]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "paid",
  "refunded",
  "forfeited",
]);
export const paymentKind = pgEnum("payment_kind", ["deposit", "payment", "refund", "tip"]);
export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "transfer",
  "mercadopago",
  "card",
]);
export const commissionType = pgEnum("commission_type", ["percentage", "fixed"]);

const ts = () => timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull();

// --- auth: users ------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: ts(),
});

// --- organizations ----------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address"),
  instagram: text("instagram"),
  whatsapp: text("whatsapp"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
  currency: text("currency").notNull().default("ARS"),
  locale: text("locale").notNull().default("es-AR"),
  createdAt: ts(),
});

export const reservedSlugs = pgTable("reserved_slugs", {
  slug: text("slug").primaryKey(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("owner"),
    createdAt: ts(),
  },
  (t) => [
    unique().on(t.organizationId, t.userId),
    index("org_members_user_idx").on(t.userId),
  ],
);

// --- catalog ----------------------------------------------------------------
export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts(),
});

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => serviceCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents").notNull().default(0),
    durationMin: integer("duration_min").notNull(),
    bufferMin: integer("buffer_min").notNull().default(0),
    depositType: depositType("deposit_type").notNull().default("none"),
    depositValue: doublePrecision("deposit_value").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts(),
  },
  (t) => [index("services_org_idx").on(t.organizationId, t.isActive)],
);

export const professionals = pgTable(
  "professionals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    photoUrl: text("photo_url"),
    specialties: text("specialties").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts(),
  },
  (t) => [index("professionals_org_idx").on(t.organizationId, t.isActive)],
);

export const professionalServices = pgTable(
  "professional_services",
  {
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.professionalId, t.serviceId] })],
);

export const professionalPay = pgTable("professional_pay", {
  professionalId: uuid("professional_id")
    .primaryKey()
    .references(() => professionals.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  commissionType: commissionType("commission_type").notNull().default("percentage"),
  commissionValue: doublePrecision("commission_value").notNull().default(0),
});

// --- scheduling -------------------------------------------------------------
export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    weekday: integer("weekday").notNull(), // 0=Sun..6=Sat
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [index("hours_lookup_idx").on(t.organizationId, t.professionalId, t.weekday)],
);

export const blockedTimes = pgTable(
  "blocked_times",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    startAt: timestamp("start_at", { withTimezone: true, mode: "string" }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true, mode: "string" }).notNull(),
    reason: text("reason"),
    createdAt: ts(),
  },
  (t) => [index("blocks_range_idx").on(t.organizationId, t.startAt, t.endAt)],
);

// --- clients ----------------------------------------------------------------
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    birthday: date("birthday"),
    preferredProfessionalId: uuid("preferred_professional_id").references(
      () => professionals.id,
      { onDelete: "set null" },
    ),
    // Referral program: each client has a shareable code; referredById points
    // to the client who referred them (self-reference).
    referralCode: text("referral_code"),
    referredById: uuid("referred_by_id").references((): AnyPgColumn => clients.id, {
      onDelete: "set null",
    }),
    createdAt: ts(),
  },
  (t) => [
    unique("clients_org_phone_unique").on(t.organizationId, t.phone),
    index("clients_org_refcode_idx").on(t.organizationId, t.referralCode),
  ],
);

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(),
});

export const clientPhotos = pgTable("client_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: ts(),
});

// --- appointments -----------------------------------------------------------
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    startAt: timestamp("start_at", { withTimezone: true, mode: "string" }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true, mode: "string" }).notNull(),
    status: appointmentStatus("status").notNull().default("reservado"),
    source: appointmentSource("source").notNull().default("manual"),
    bookingCode: text("booking_code").notNull().unique(),
    notes: text("notes"),
    createdAt: ts(),
  },
  (t) => [
    index("appointments_org_start_idx").on(t.organizationId, t.startAt),
    index("appointments_pro_start_idx").on(t.professionalId, t.startAt),
  ],
);

export const appointmentServices = pgTable(
  "appointment_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    durationMin: integer("duration_min").notNull(),
  },
  (t) => [index("appt_services_appt_idx").on(t.appointmentId)],
);

export const nailRecords = pgTable("nail_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  shape: text("shape"),
  length: text("length"),
  color: text("color"),
  design: text("design"),
  technique: text("technique"),
  product: text("product"),
  observations: text("observations"),
  photoBeforeUrl: text("photo_before_url"),
  photoAfterUrl: text("photo_after_url"),
  createdAt: ts(),
});

// --- money ------------------------------------------------------------------
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  kind: paymentKind("kind").notNull(),
  method: paymentMethod("method"),
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatus("status").notNull().default("paid"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  createdAt: ts(),
});

export const commissions = pgTable("commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionals.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  baseCents: integer("base_cents").notNull().default(0),
  rate: doublePrecision("rate"),
  amountCents: integer("amount_cents").notNull().default(0),
  createdAt: ts(),
});

// --- loyalty: gift cards & packs --------------------------------------------
export const giftCards = pgTable(
  "gift_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    initialCents: integer("initial_cents").notNull(),
    balanceCents: integer("balance_cents").notNull(),
    note: text("note"),
    status: text("status").notNull().default("active"), // active | redeemed | void
    createdAt: ts(),
  },
  (t) => [unique("gift_cards_org_code_unique").on(t.organizationId, t.code)],
);

/** Pack template (e.g. "Pack x4 Kapping"). */
export const servicePacks = pgTable("service_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: ts(),
});

/** A pack purchased by a client; remaining decrements on each use. */
export const clientPacks = pgTable(
  "client_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    totalQty: integer("total_qty").notNull(),
    remainingQty: integer("remaining_qty").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    createdAt: ts(),
  },
  (t) => [index("client_packs_org_client_idx").on(t.organizationId, t.clientId)],
);

// --- growth (schema-ready) --------------------------------------------------
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    discountType: text("discount_type").notNull().default("percentage"),
    discountValue: doublePrecision("discount_value").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }),
    createdAt: ts(),
  },
  (t) => [unique("promotions_org_code_unique").on(t.organizationId, t.code)],
);

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  professionalId: uuid("professional_id").references(() => professionals.id, {
    onDelete: "set null",
  }),
  desiredDate: date("desired_date"),
  timeFrom: time("time_from"),
  timeTo: time("time_to"),
  phone: text("phone"),
  notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "string" }),
  createdAt: ts(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  channel: text("channel").notNull().default("in_app"),
  payload: jsonb("payload").notNull().default({}),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
  createdAt: ts(),
});

export const settings = pgTable("settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
});

// --- inferred types ---------------------------------------------------------
export type Organization = typeof organizations.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Professional = typeof professionals.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type User = typeof users.$inferSelect;

export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number];
export type MemberRole = (typeof memberRole.enumValues)[number];
export type DepositType = (typeof depositType.enumValues)[number];
