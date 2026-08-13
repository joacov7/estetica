# Estética — SaaS de turnos para estudios de belleza

Sistema web multi-tenant para gestión de turnos, clientes y operaciones de
estudios de manicura, pestañas, cejas, peluquerías, barberías y centros de
estética. Reserva pública mobile-first + panel administrativo.

## Deploy en 1 clic

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjoacov7%2Festetica&env=DATABASE_URL,AUTH_SECRET,AUTH_URL,BOOKING_TOKEN_SECRET,NEXT_PUBLIC_SITE_URL&envDescription=Base%20Postgres%20(Neon)%20y%20secretos%20de%20la%20app&project-name=estetica&repository-name=estetica)

1. Antes, creá una base gratis en **[Neon](https://neon.tech)** y copiá su
   **pooled connection string**.
2. Tocá el botón. Vercel te pide las variables de entorno:
   - `DATABASE_URL` → la pooled string de Neon
   - `AUTH_SECRET` → una cadena aleatoria larga (`openssl rand -base64 32`)
   - `AUTH_URL` → la URL del deploy (podés poner un valor provisorio y corregirlo luego)
   - `BOOKING_TOKEN_SECRET` → otra cadena aleatoria larga
   - `NEXT_PUBLIC_SITE_URL` → la URL del deploy
3. Deploy. Las tablas se crean solas (migraciones on-build). Después, corregí
   `AUTH_URL` / `NEXT_PUBLIC_SITE_URL` con la URL final y hacé **Redeploy**.
4. (Opcional) Cargá datos de ejemplo pegando `drizzle/seed.sql` en el SQL Editor
   de Neon → login demo `demo@buenas-unas.test` / `password123`.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn-style UI ·
**Postgres (Neon) + Drizzle ORM** · **Auth.js (NextAuth)** · React Hook Form +
Zod · TanStack Query · Vitest · Vercel.

> Sin Supabase. La base es Postgres directo (Neon, free tier) con Drizzle, y la
> autenticación es Auth.js sobre la misma base. La **multi-tenancy se garantiza
> en la capa de queries** (todo scopeado por `organizationId` según la sesión),
> no con RLS.

## Estado actual (Fase 1)

**Funcional y probado**

- **Base de datos multi-tenant** (`src/db/schema.ts` + `drizzle/`): 23 tablas,
  índices, FKs y un **exclusion constraint de Postgres** (`btree_gist` +
  `tstzrange`) que hace **imposible el doble-booking a nivel base de datos**.
- **Autenticación** (Auth.js, credenciales): registro que crea usuario +
  negocio + membresía `owner` en una transacción, login, logout y protección de
  `/dashboard` por middleware.
- **Motor de disponibilidad** (`src/services/availability/`): lógica pura de
  intervalos (10 tests) + capa tz-aware (horarios, duración, buffer, turnos,
  bloqueos, lead time).
- **Reserva pública** (`/[slug]` y `/[slug]/reservar`): flujo mobile-first de 6
  pasos, sin registro obligatorio, revalidación en servidor, upsert de cliente
  por teléfono, rate-limiting y código de reserva.
- **Panel** (`/dashboard`): métricas reales del día + gestión de servicios
  (crear / activar / desactivar) con autorización por rol.
- **Abstracciones preparadas**: pagos (schema + estados de seña),
  notificaciones, tokens firmados para gestionar reservas sin cuenta.

**Próximos pasos**: agenda por profesional (crear/arrastrar/estados), clientes,
ficha técnica de uñas, y Fases 2–3 (caja, comisiones, notificaciones reales,
WhatsApp, analytics). El schema ya está preparado para todo esto.

## Puesta en marcha local

Requisitos: Node 20+ y una base Postgres (Neon gratis, o Postgres local).

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
#    DATABASE_URL   → connection string de Neon (pooled)
#    AUTH_SECRET    → openssl rand -base64 32
#    BOOKING_TOKEN_SECRET → openssl rand -base64 32

# 3. Base de datos: aplicar migraciones + seed
npm run db:migrate     # aplica drizzle/ (tablas + constraint anti-doble-reserva)
npm run db:seed        # datos de ejemplo "Buenas Uñas"

# 4. App
npm run dev            # http://localhost:3000
```

El seed crea un usuario demo para entrar al panel:
**`demo@buenas-unas.test` / `password123`**

Scripts:

```bash
npm run typecheck      # tsc --noEmit
npm run test           # vitest (motor de disponibilidad)
npm run build          # build de producción
npm run db:generate    # genera migraciones desde el schema de Drizzle
```

Rutas para probar:

- `/` — landing · `/login` · `/signup`
- `/buenas-unas` — página pública del negocio de ejemplo
- `/buenas-unas/reservar` — flujo de reserva
- `/dashboard` — panel (requiere login)

## Deploy en Vercel

1. **Creá una base en [Neon](https://neon.tech)** (free) y copiá la
   **pooled connection string** → `DATABASE_URL`.
2. **Aplicá el schema** a esa base:
   ```bash
   DATABASE_URL="...neon..." npm run db:migrate
   DATABASE_URL="...neon..." npm run db:seed   # opcional
   ```
3. **Conectá el repo a Vercel** (New Project → importá este repositorio).
   Framework: Next.js (autodetectado).
4. **Variables de entorno** en Vercel (Settings → Environment Variables):
   - `DATABASE_URL` — la pooled string de Neon
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_URL` — la URL pública del deploy (ej. `https://tu-app.vercel.app`)
   - `BOOKING_TOKEN_SECRET` — `openssl rand -base64 32`
   - `NEXT_PUBLIC_SITE_URL` — la URL pública del deploy
5. **Deploy.** Vercel construye y publica en cada push.

## Estructura

```
src/
  app/                  rutas: landing, /[slug] público, /dashboard, /login, /signup, /api
  auth.ts, auth.config.ts   configuración de Auth.js (server + edge-safe)
  components/ui/         design system (Button, Card, Input, Badge, StatCard, ...)
  db/                    schema Drizzle, cliente y seed
  features/             módulos por dominio (auth, booking, services, org)
  services/availability/ motor de disponibilidad (core puro + tz-aware)
  lib/                   money, tokens, rate-limit, validaciones Zod
drizzle/                migraciones SQL (tablas + exclusion constraint)
```
