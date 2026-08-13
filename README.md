# Estética — SaaS de turnos para estudios de belleza

Sistema web multi-tenant para gestión de turnos, clientes y operaciones de
estudios de manicura, pestañas, cejas, peluquerías, barberías y centros de
estética. Reserva pública mobile-first + panel administrativo.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn-style UI · Supabase
(PostgreSQL, Auth, Storage, RLS) · React Hook Form + Zod · TanStack Query ·
Vitest · Vercel.

## Estado actual (Fase 1 — en progreso)

**Funcional y probado**

- **Base de datos multi-tenant completa** — `supabase/migrations/`: schema,
  enums, índices, foreign keys, **RLS en todas las tablas** y un **exclusion
  constraint de Postgres** que hace imposible el doble-booking a nivel base de
  datos (no solo aplicación).
- **Motor de disponibilidad** (`src/services/availability/`) — lógica pura de
  intervalos (10 tests unitarios) + capa tz-aware que respeta horario del
  negocio, del profesional, duración, buffer de limpieza, turnos existentes,
  bloqueos y lead time.
- **Reserva pública** (`/[slug]` y `/[slug]/reservar`) — flujo de 6 pasos,
  mobile-first, sin registro obligatorio. Revalida la disponibilidad en el
  servidor, hace upsert del cliente por teléfono, aplica rate-limiting y crea el
  turno confiando en el constraint de la DB. Pantalla de confirmación con código
  de reserva.
- **Panel** (`/dashboard`) — layout con sidebar/bottom-nav, dashboard con
  métricas reales del día, y **gestión de servicios** funcional (crear /
  activar / desactivar).
- **Abstracciones preparadas** — `PaymentProvider` (schema de `payments` +
  estados de seña), `NotificationProvider`, tokens firmados para gestionar la
  reserva sin cuenta, y rate-limiter con interfaz intercambiable.

**Próximos pasos (no incluidos aún)**

- Autenticación (login/signup, crear organización + membresía). Hoy el panel usa
  un *fallback de desarrollo* que muestra la primera organización sin login —
  ver `src/features/org/current.ts`. Es el próximo módulo y deja el panel detrás
  de auth.
- Agenda por profesional (crear/editar/arrastrar/estados), clientes, ficha
  técnica de uñas, caja, comisiones, promociones, lista de espera, notificaciones
  reales, WhatsApp, analytics — el schema ya está preparado para todo esto.

## Puesta en marcha local

Requisitos: Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
#   Completá las claves (ver más abajo cómo obtenerlas).

# 3. Base de datos: aplica migrations + seed
supabase start          # levanta Supabase local (Docker)
supabase db reset       # corre migrations/ y seed.sql

# 4. App
npm run dev             # http://localhost:3000
```

Scripts útiles:

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest (motor de disponibilidad)
npm run build       # build de producción
```

Rutas para probar:

- `/` — landing
- `/buenas-unas` — página pública del negocio de ejemplo (seed)
- `/buenas-unas/reservar` — flujo de reserva
- `/dashboard` — panel

## Deploy en Vercel

1. **Creá un proyecto en Supabase** (supabase.com) y obtené, en *Project
   Settings → API*:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡solo server!)
2. **Aplicá el schema** a ese proyecto:
   ```bash
   supabase link --project-ref <tu-project-ref>
   supabase db push          # aplica supabase/migrations
   # (opcional) cargá el seed manualmente desde el SQL editor con supabase/seed.sql
   ```
3. **Conectá el repo a Vercel** (New Project → importá este repositorio de
   GitHub). Framework: Next.js (autodetectado).
4. **Cargá las variables de entorno** en Vercel (Settings → Environment
   Variables): las cuatro de arriba más:
   - `NEXT_PUBLIC_SITE_URL` = la URL pública del deploy
   - `BOOKING_TOKEN_SECRET` = `openssl rand -base64 32`
5. **Deploy.** Vercel construye y publica automáticamente en cada push.

> El `service_role` key nunca se expone al navegador: solo se usa en Server
> Actions / Route Handlers (`src/lib/supabase/admin.ts`, marcado `server-only`).

## Estructura

```
src/
  app/                 rutas (App Router): landing, /[slug] público, /dashboard, /api
  components/ui/        design system (Button, Card, Input, Badge, StatCard, ...)
  features/             módulos por dominio (booking, services, org)
  services/availability/ motor de disponibilidad (core puro + tz-aware)
  lib/                  supabase clients, money, tokens, rate-limit, validaciones Zod
  types/                tipos de la base de datos
supabase/
  migrations/           schema + RLS + constraints (SQL versionado)
  seed.sql              datos de ejemplo ("Buenas Uñas")
```
