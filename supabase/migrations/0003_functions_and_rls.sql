-- ============================================================================
-- 0003 · Helper functions, booking-code generator, RLS policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so they read organization_members
-- without triggering RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.member_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role = any(roles)
  );
$$;

-- Short, human-friendly, unguessable-enough booking code (e.g. "BU-7QK2").
create or replace function public.generate_booking_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  code := '';
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.service_categories    enable row level security;
alter table public.services              enable row level security;
alter table public.professionals         enable row level security;
alter table public.professional_services enable row level security;
alter table public.professional_pay      enable row level security;
alter table public.business_hours        enable row level security;
alter table public.blocked_times         enable row level security;
alter table public.clients               enable row level security;
alter table public.client_notes          enable row level security;
alter table public.client_photos         enable row level security;
alter table public.appointments          enable row level security;
alter table public.appointment_services  enable row level security;
alter table public.nail_records          enable row level security;
alter table public.payments              enable row level security;
alter table public.commissions           enable row level security;
alter table public.promotions            enable row level security;
alter table public.waitlist              enable row level security;
alter table public.notifications         enable row level security;
alter table public.settings              enable row level security;

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------------------------
-- Public read: the booking page looks up an org by slug (anon).
create policy "orgs public read" on public.organizations
  for select to anon, authenticated using (true);

create policy "orgs insert by authed" on public.organizations
  for insert to authenticated with check (true);

create policy "orgs update by owner/admin" on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(id, array['owner','admin']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- ORGANIZATION_MEMBERS
-- ---------------------------------------------------------------------------
create policy "members read own memberships" on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));

-- A user may add themselves (self-serve org creation) or an owner/admin can add.
create policy "members insert" on public.organization_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  );

create policy "members manage by owner/admin" on public.organization_members
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "members delete by owner/admin" on public.organization_members
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- Reusable pattern helper: for org-scoped tables we create four policies.
-- (Written out explicitly per table for clarity/auditability.)
-- ---------------------------------------------------------------------------

-- SERVICE_CATEGORIES  (anon read; member write)
create policy "categories public read" on public.service_categories
  for select to anon, authenticated using (true);
create policy "categories member write" on public.service_categories
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- SERVICES  (anon reads active only; members read/write all)
create policy "services public read active" on public.services
  for select to anon using (is_active);
create policy "services member all" on public.services
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- PROFESSIONALS  (anon reads active only; members read/write all)
create policy "professionals public read active" on public.professionals
  for select to anon using (is_active);
create policy "professionals member all" on public.professionals
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- PROFESSIONAL_SERVICES  (anon read mapping; members write)
create policy "prof_services public read" on public.professional_services
  for select to anon, authenticated using (true);
create policy "prof_services member write" on public.professional_services
  for all to authenticated
  using (exists (
    select 1 from public.professionals p
    where p.id = professional_id and public.is_org_member(p.organization_id)))
  with check (exists (
    select 1 from public.professionals p
    where p.id = professional_id and public.is_org_member(p.organization_id)));

-- PROFESSIONAL_PAY  (sensitive: owner/admin only, never anon)
create policy "prof_pay owner/admin" on public.professional_pay
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- BUSINESS_HOURS  (anon read: public opening hours; members write)
create policy "hours public read" on public.business_hours
  for select to anon, authenticated using (true);
create policy "hours member write" on public.business_hours
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- BLOCKED_TIMES  (members only — availability is computed server-side)
create policy "blocks member all" on public.blocked_times
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- CLIENTS  (members only)
create policy "clients member all" on public.clients
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "client_notes member all" on public.client_notes
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "client_photos member all" on public.client_photos
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- APPOINTMENTS  (members only; public booking writes via service role)
create policy "appointments member all" on public.appointments
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "appointment_services member all" on public.appointment_services
  for all to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and public.is_org_member(a.organization_id)))
  with check (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and public.is_org_member(a.organization_id)));

-- NAIL_RECORDS  (members only)
create policy "nail_records member all" on public.nail_records
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- PAYMENTS / COMMISSIONS  (members only)
create policy "payments member all" on public.payments
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "commissions member all" on public.commissions
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- PROMOTIONS  (members only for now)
create policy "promotions member all" on public.promotions
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- WAITLIST  (members only; public join via service role)
create policy "waitlist member all" on public.waitlist
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- NOTIFICATIONS  (members only)
create policy "notifications member all" on public.notifications
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- SETTINGS  (owner/admin only)
create policy "settings owner/admin" on public.settings
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));
