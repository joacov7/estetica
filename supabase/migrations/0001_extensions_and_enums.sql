-- ============================================================================
-- 0001 · Extensions & enums
-- ============================================================================

-- gist over scalar types (uuid equality) — required for the appointment
-- overlap exclusion constraint that prevents double-booking.
create extension if not exists btree_gist;

-- Membership roles inside an organization.
create type public.member_role as enum (
  'owner',
  'admin',
  'professional',
  'receptionist'
);

-- Appointment lifecycle. 'cancelado' and 'no_show' free the time slot;
-- everything else occupies it (see the exclusion constraint in 0002).
create type public.appointment_status as enum (
  'reservado',
  'confirmado',
  'atendido',
  'cancelado',
  'no_show'
);

-- Where the appointment came from.
create type public.appointment_source as enum (
  'online',   -- public booking page
  'manual'    -- created from the admin panel
);

-- Deposit ("seña") configuration mode for a service.
create type public.deposit_type as enum (
  'none',
  'fixed',
  'percentage'
);

-- Lifecycle of a deposit/payment record.
create type public.payment_status as enum (
  'pending',
  'paid',
  'refunded',
  'forfeited'
);

-- Kind of money movement.
create type public.payment_kind as enum (
  'deposit',
  'payment',
  'refund',
  'tip'
);

-- How money was collected.
create type public.payment_method as enum (
  'cash',
  'transfer',
  'mercadopago',
  'card'
);

-- Commission model for a professional.
create type public.commission_type as enum (
  'percentage',
  'fixed'
);
