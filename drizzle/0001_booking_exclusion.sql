-- Postgres-specific guarantees that Drizzle's schema DSL can't express.

-- gist over scalar types (uuid equality) — required for the overlap constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Hard guarantee against double-booking: no two ACTIVE appointments for the
-- same professional may overlap in time. Cancelled / no-show free the slot.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("start_at", "end_at") WITH &&
  )
  WHERE (status IN ('reservado', 'confirmado', 'atendido'));

-- Guard rails also enforced at the DB level.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_order" CHECK ("end_at" > "start_at");
ALTER TABLE "blocked_times" ADD CONSTRAINT "blocked_times_time_order" CHECK ("end_at" > "start_at");
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_time_order" CHECK ("end_time" > "start_time");
ALTER TABLE "services" ADD CONSTRAINT "services_duration_positive" CHECK ("duration_min" > 0);

-- Seed the reserved slugs that collide with app routes.
INSERT INTO "reserved_slugs" ("slug") VALUES
  ('dashboard'), ('api'), ('login'), ('signup'), ('auth'),
  ('admin'), ('app'), ('book'), ('reservar'), ('settings')
ON CONFLICT DO NOTHING;
