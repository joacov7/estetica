-- ============================================================================
-- Seed opcional para cargar datos de ejemplo SIN terminal.
-- Pegá y ejecutá este archivo en el SQL Editor de Neon (o cualquier cliente
-- Postgres) DESPUÉS de que las migraciones ya crearon las tablas.
--
-- Crea el negocio "Buenas Uñas" con un usuario demo, profesionales, servicios
-- y horarios. Idempotente: si el negocio ya existe, no hace nada.
--
--   Login del panel:  demo@buenas-unas.test  /  password123
-- ============================================================================
do $$
declare
  v_user uuid;
  v_org  uuid;
  v_manos uuid;
  v_pesta uuid;
  v_cejas uuid;
  v_maria uuid;
  v_sofia uuid;
  wd int;
begin
  -- No duplicar si ya existe.
  if exists (select 1 from organizations where slug = 'buenas-unas') then
    raise notice 'Seed omitido: "buenas-unas" ya existe.';
    return;
  end if;

  -- Usuario demo (contraseña: password123)
  insert into users (email, name, password_hash)
  values ('demo@buenas-unas.test', 'Demo',
          '$2b$10$BWUcyu/HHwxFY6j3ee8gwupvIFbQ.fu07kogV4DIDv3Eb24XZOGt2')
  returning id into v_user;

  insert into organizations (slug, name, description, address, instagram, whatsapp)
  values ('buenas-unas', 'Buenas Uñas',
          'Estudio de manicura y estética. Diseños personalizados y atención premium.',
          'Av. Siempre Viva 123, Buenos Aires', '@buenas.unas', '5491100000000')
  returning id into v_org;

  insert into organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into settings (organization_id) values (v_org);

  insert into service_categories (organization_id, name, sort_order)
  values (v_org, 'Manos', 1) returning id into v_manos;
  insert into service_categories (organization_id, name, sort_order)
  values (v_org, 'Pestañas', 2) returning id into v_pesta;
  insert into service_categories (organization_id, name, sort_order)
  values (v_org, 'Cejas', 3) returning id into v_cejas;

  insert into professionals (organization_id, name, specialties, sort_order)
  values (v_org, 'María', array['Soft Gel','Nail Art'], 1) returning id into v_maria;
  insert into professionals (organization_id, name, specialties, sort_order)
  values (v_org, 'Sofía', array['Kapping','Semipermanente'], 2) returning id into v_sofia;

  insert into professional_pay (professional_id, organization_id, commission_type, commission_value)
  values (v_maria, v_org, 'percentage', 40), (v_sofia, v_org, 'percentage', 40);

  -- Precios en centavos (ARS). Editables desde el panel.
  insert into services (organization_id, category_id, name, description, price_cents, duration_min, buffer_min, deposit_type, deposit_value, sort_order) values
    (v_org, v_manos, 'Manicura',           'Manicura completa con esmaltado tradicional.', 1500000, 60,  10, 'none', 0, 1),
    (v_org, v_manos, 'Semipermanente',     'Esmaltado semipermanente de larga duración.',  2000000, 75,  10, 'percentage', 30, 2),
    (v_org, v_manos, 'Kapping',            'Refuerzo de la uña natural con gel.',           2500000, 90,  15, 'percentage', 30, 3),
    (v_org, v_manos, 'Soft Gel',           'Extensiones con tips de soft gel.',             3000000, 120, 15, 'percentage', 30, 4),
    (v_org, v_manos, 'Nail Art',           'Diseño artístico personalizado.',                800000, 45,  10, 'fixed', 500000, 5),
    (v_org, v_pesta, 'Lifting de pestañas','Lifting y tinte de pestañas naturales.',        2200000, 60,  10, 'percentage', 30, 6),
    (v_org, v_cejas, 'Laminado de cejas',  'Laminado y perfilado de cejas.',                2000000, 50,  10, 'percentage', 30, 7);

  -- Horarios: Mar–Sáb 10:00–19:00 (weekday 2..6).
  for wd in 2..6 loop
    insert into business_hours (organization_id, professional_id, weekday, start_time, end_time)
    values (v_org, null, wd, '10:00', '19:00');
  end loop;

  raise notice 'Seed OK: negocio "Buenas Uñas" creado.';
end $$;
