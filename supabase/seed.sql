-- ============================================================================
-- Seed data for local development.
-- Creates the "Buenas Uñas" organization with professionals, service
-- categories, services and weekly opening hours. Prices are examples and are
-- fully editable from the admin panel (never hard-coded in app logic).
--
-- Note: organization_members are NOT seeded here because they must reference a
-- real auth.users row. After signing up, link your user to this org from the
-- app (or insert a row into organization_members manually with your user id).
-- ============================================================================

-- Deterministic UUIDs so the seed is idempotent and easy to reference.
do $$
declare
  org_id  uuid := '00000000-0000-0000-0000-000000000001';
  cat_manos uuid := '00000000-0000-0000-0000-0000000000a1';
  cat_pesta uuid := '00000000-0000-0000-0000-0000000000a2';
  cat_cejas uuid := '00000000-0000-0000-0000-0000000000a3';
  maria_id uuid := '00000000-0000-0000-0000-0000000000b1';
  sofia_id uuid := '00000000-0000-0000-0000-0000000000b2';
  wd int;
begin
  -- Organization
  insert into public.organizations (id, slug, name, description, address, instagram, whatsapp, timezone, currency, locale)
  values (org_id, 'buenas-unas', 'Buenas Uñas',
          'Estudio de manicura y estética. Diseños personalizados y atención premium.',
          'Av. Siempre Viva 123, Buenos Aires', '@buenas.unas', '5491100000000',
          'America/Argentina/Buenos_Aires', 'ARS', 'es-AR')
  on conflict (id) do nothing;

  insert into public.settings (organization_id, data)
  values (org_id, jsonb_build_object('deposit_policy', 'per_service'))
  on conflict (organization_id) do nothing;

  -- Categories
  insert into public.service_categories (id, organization_id, name, sort_order) values
    (cat_manos, org_id, 'Manos', 1),
    (cat_pesta, org_id, 'Pestañas', 2),
    (cat_cejas, org_id, 'Cejas', 3)
  on conflict (id) do nothing;

  -- Professionals
  insert into public.professionals (id, organization_id, name, specialties, sort_order) values
    (maria_id, org_id, 'María', array['Soft Gel','Nail Art'], 1),
    (sofia_id, org_id, 'Sofía', array['Kapping','Semipermanente'], 2)
  on conflict (id) do nothing;

  insert into public.professional_pay (professional_id, organization_id, commission_type, commission_value) values
    (maria_id, org_id, 'percentage', 40),
    (sofia_id, org_id, 'percentage', 40)
  on conflict (professional_id) do nothing;

  -- Services (price in cents, ARS). Editable from admin.
  insert into public.services (organization_id, category_id, name, description, price_cents, duration_min, buffer_min, deposit_type, deposit_value, sort_order) values
    (org_id, cat_manos, 'Manicura',        'Manicura completa con esmaltado tradicional.',  1500000, 60,  10, 'none', 0, 1),
    (org_id, cat_manos, 'Semipermanente',  'Esmaltado semipermanente de larga duración.',   2000000, 75,  10, 'percentage', 30, 2),
    (org_id, cat_manos, 'Kapping',         'Refuerzo de la uña natural con gel.',            2500000, 90,  15, 'percentage', 30, 3),
    (org_id, cat_manos, 'Soft Gel',        'Extensiones con tips de soft gel.',              3000000, 120, 15, 'percentage', 30, 4),
    (org_id, cat_manos, 'Nail Art',        'Diseño artístico personalizado.',                 800000, 45,  10, 'fixed', 500000, 5),
    (org_id, cat_pesta, 'Lifting de pestañas', 'Lifting y tinte de pestañas naturales.',     2200000, 60,  10, 'percentage', 30, 6),
    (org_id, cat_cejas, 'Laminado de cejas',   'Laminado y perfilado de cejas.',             2000000, 50,  10, 'percentage', 30, 7)
  on conflict do nothing;

  -- Weekly opening hours (org default): Tue–Sat 10:00–19:00 (weekday 2..6).
  for wd in 2..6 loop
    insert into public.business_hours (organization_id, professional_id, weekday, start_time, end_time)
    values (org_id, null, wd, '10:00', '19:00');
  end loop;
end $$;
