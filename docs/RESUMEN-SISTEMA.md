# By Mery — Sistema de turnos y gestión para estética (resumen para análisis)

> Documento autoexplicativo para que un tercero (p. ej. ChatGPT) pueda analizar
> el sistema sin ver el código. Describe qué es, cómo está construido, qué
> capacidades tiene, qué integraciones usa, cómo se despliega y qué limitaciones
> y pendientes hay.

## 1. Qué es

SaaS de turnos online + gestión integral para estudios de estética (uñas,
pestañas, cejas, peluquería, barbería). Primer negocio real: **By Mery**
(Gualeguay, Entre Ríos; estudio chico de uñas, 2 profesionales). La app es
**multi-negocio (multi-tenant)**: cada negocio tiene su página pública en
`/<slug>` y su panel de administración.

Objetivo de diseño transversal: **todo configurable desde el panel de admin**
(nada hardcodeado) y que funcione **sin servicios pagos** cuando no están
configurados (degradación elegante).

## 2. Stack técnico y arquitectura

- **Next.js 15.5** (App Router, Server Actions, Route Handlers), **React 19**, **TypeScript** estricto.
- **Tailwind CSS** + componentes propios estilo shadcn.
- **Base de datos: PostgreSQL (Neon)**, ORM **Drizzle**, driver postgres.js (conexión pooled).
- **Auth: Auth.js v5 (NextAuth beta)** — provider Credentials (email + contraseña, bcrypt), sesiones JWT. Config partida (edge-safe + server con DB). Redirects relativos (no depende de AUTH_URL). Gating del dashboard en el layout del servidor.
- **Migraciones**: drizzle-kit, aplicadas en el build de producción (`vercel-build: drizzle-kit migrate && next build`).
- **Deploy**: Vercel (integración con GitHub, deploy automático en cada push a `main`).
- **Tests**: Vitest (motor de disponibilidad; 10 tests de lógica de intervalos).

### Multi-tenancy
Se enforcea en la **capa de queries**: toda lectura/escritura está scopeada por
`organizationId` tomado de la sesión (helper `getCurrentOrg`). **No** se usa RLS
de Postgres (la app conecta con un único rol de aplicación).

### Garantías de integridad
- **Anti doble-reserva**: constraint `EXCLUDE` de Postgres (btree_gist + tstzrange) que impide solapamiento de turnos por profesional (migración dedicada), además de re-chequear disponibilidad en el servidor.
- **Dinero en centavos** (enteros). Timestamps en timestamptz (ISO).
- **Motor de disponibilidad**: matemática de intervalos pura + orquestación con zona horaria (date-fns-tz); respeta horarios, duraciones, buffers, bloqueos, lead time y días de anticipación (configurables).

### Tokens sin estado (stateless, firmados HMAC)
- **booking-token**: deja a la clienta gestionar su turno (ver/cancelar/reprogramar) sin cuenta.
- **reset-token**: para recuperar contraseña (se auto-invalida al cambiar la clave).
- **unsubscribe-token**: baja de marketing.

## 3. Modelo de datos (tablas principales)

Autenticación/negocio: `users`, `organizations`, `reserved_slugs`,
`organization_members` (roles: owner, admin, professional, receptionist),
`settings` (JSONB, todas las preferencias del negocio).

Catálogo y agenda: `service_categories`, `services`, `professionals`,
`professional_services`, `professional_pay`, `business_hours`, `blocked_times`,
`appointments`, `appointment_services`.

Clientas: `clients` (incluye cumpleaños, código de referido, baja de marketing),
`client_notes`, `client_photos`, `nail_records` (ficha técnica de uñas).

Dinero: `payments`, `commissions`.

Fidelización/marketing/crecimiento: `gift_cards`, `service_packs`,
`client_packs`, `promotions`, `waitlist`, `notifications` (log de envíos),
`reviews`, `campaigns`, `loyalty_transactions` (ledger de puntos).

Total: ~29 tablas. Migraciones 0000→0008.

## 4. Capacidades del sistema

### 4.1 Panel de administración (`/dashboard`)
- **Inicio**: KPIs del día (facturación, turnos, servicios, clientas), checklist de alta (servicios/profesionales/horarios) y **"Oportunidades de la semana"**: reseñas por aprobar, cumpleaños de los próximos 7 días e inactivas a reenganchar, cada una con botón de WhatsApp listo.
- **Agenda**: turnos, alta manual, cambio de estado (reservado/confirmado/atendido/cancelado/no vino).
- **Estadísticas (Analytics)**: estado de resultados (ingresos de turnos atendidos, comisiones reales, % de insumos, costos fijos prorrateados).
- **Marketing**: reseñas publicadas y promedio, reseñas por mes, campañas enviadas, automatizaciones por email (reenganches/cumpleaños/pedidos de reseña/campañas), referidas convertidas, turnos con promo y descuento total, puntos activos y canjeados.
- **Clientes**: listado y ficha individual con historial, gasto, notas, referidos, **packs**, **puntos de fidelidad** y **ficha técnica de uñas** (con fotos antes/después).
- **Servicios / Profesionales**: ABM, precios, duración, buffer, seña, imágenes; asignación de servicios por profesional; comisiones.
- **Caja**: registro de pagos (efectivo, transferencia, Mercado Pago, tarjeta).
- **Comisiones**: por profesional.
- **Promociones**: códigos de descuento (porcentaje o monto fijo), con vigencia.
- **Gift cards**: emisión y canje (en salón).
- **Packs**: plantillas (ej. "Pack x4 Kapping") y packs comprados por clienta (descuento por uso).
- **Reseñas**: moderación (publicar/ocultar/destacar/borrar), promedio y pendientes.
- **Campañas**: envío por **email** (segmentos: todas / inactivas / cumpleañeras del mes) y por **WhatsApp** (lista click-to-chat personalizada). Respeta bajas.
- **Recordatorios**: estado de recordatorios automáticos.
- **Referidos**: cada clienta tiene link propio; ranking de quién trajo más.
- **Lista de espera**: registro de interesadas.
- **Galería**: fotos.
- **Códigos QR**: carteles imprimibles (reservar y dejar opinión) generados offline.
- **Configuración**: datos del negocio, link público, **imágenes** (logo/portada), horarios, reglas de reserva (anticipación, lead time, ventana de cancelación), recordatorios, **reseñas y fidelización** (pedido de reseña, cumpleaños, reenganche), **puntos de fidelidad**, **WhatsApp y Google**, costos.

### 4.2 Sitio público (por negocio, en `/<slug>`)
- **Landing premium**: hero con portada/logo, servicios (con deep-link a reservar), profesionales, **tarjeta de reseñas de Google**, **opiniones destacadas**, info (mapa, WhatsApp, Instagram), CTA fijo en mobile.
- **Reserva online** (`/<slug>/reservar`): wizard de 6 pasos, multi-servicio, "cualquier profesional" o elegir, elección de día/horario (disponibilidad en tiempo real), datos de contacto, código de referido, **código de promo** (aplica descuento), **consulta de saldo de gift card**, captcha opcional, confirmación con código y link de gestión.
- **Gestión del turno** (`/gestionar/<token>`): ver, cancelar o reprogramar sin cuenta; muestra los **puntos acumulados** de la clienta.
- **Opiniones** (`/<slug>/opiniones`): dejar reseña (estrellas + comentario), ver publicadas; tras 4-5★ invita a reseñar en **Google**.
- **Baja de marketing** (`/no-recibir/<token>`).
- **Auth clientas del negocio**: login, signup, olvidé contraseña, restablecer.

## 5. Automatizaciones

Dos cron de Vercel (protegidos por `CRON_SECRET`):
- **`/api/cron/reminders`** (horario): recordatorio de turno por email (configurable: activar, horas de anticipación). Idempotente.
- **`/api/cron/daily`** (diario): saludo de **cumpleaños**, **reenganche** de inactivas (win-back) y **pedido de reseña** post-visita. Todo con on/off y textos editables desde el admin; idempotente vía tabla `notifications`.

**Puntos de fidelidad**: se otorgan automáticamente al marcar un turno como
**atendido** (según total neto gastado), de forma idempotente (índice único por
turno). Canje y ajuste manual desde la ficha de la clienta.

## 6. Seguridad ("antihackeo")

- Multi-tenancy verificado en todas las server actions (scope por org).
- **Rate limiting** con degradación: Upstash Redis si está configurado, si no, en memoria (login, signup, reserva, disponibilidad, reseñas).
- **Captcha** Cloudflare Turnstile opcional (reserva y reseñas).
- **Anti doble-booking** por constraint de base.
- Hash de contraseñas con bcrypt; sesiones JWT; headers de seguridad.
- Tokens firmados HMAC para acciones públicas sin login.
- Secretos nunca expuestos al navegador (sin secretos en `NEXT_PUBLIC_*`).
- Moderación de reseñas anónimas (quedan pendientes hasta aprobación).

## 7. Integraciones externas (todas opcionales, con degradación elegante)

Si la variable no está, la función se desactiva sola sin romper nada.
- **Resend** (`RESEND_API_KEY`): envío de emails (recordatorios, campañas, cumpleaños, reseñas, reset). Requiere dominio verificado para enviar a cualquiera.
- **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`): subida de imágenes (logo, portada, servicios, profesionales, fotos de ficha de uñas).
- **Upstash Redis** (`UPSTASH_REDIS_REST_URL/TOKEN`): rate limiting distribuido.
- **Cloudflare Turnstile** (`TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`): captcha.
- **WhatsApp**: links click-to-chat (wa.me) gratis, sin API — el envío es manual (un toque por clienta).
- **Google Reseñas**: rating/cantidad/links cargados a mano por el admin (sin API paga).

Variables base requeridas: `DATABASE_URL`, `AUTH_SECRET`, `BOOKING_TOKEN_SECRET`,
`NEXT_PUBLIC_SITE_URL`. Opcionales: las de arriba + `CRON_SECRET`.

## 8. Deploy / infraestructura

- **Vercel** + **Neon Postgres** (ambos con plan gratuito al inicio).
- Deploy automático al pushear a `main`; migraciones corren en el build.
- Dominio propio pendiente de conectar (bymery.*).
- Operación 100% online (sin terminal local).

## 9. Estado, limitaciones y decisiones conscientes

- **No hay pago online**: la reserva no cobra. Por eso gift cards y packs se
  descuentan **en el salón** (online solo se consulta saldo / se informa). Decisión
  deliberada para no tocar saldos antes de que la clienta venga (no-shows).
- **WhatsApp es manual** (no hay envío masivo automático gratis). Para automático
  haría falta la API de WhatsApp Business (plantillas aprobadas, costo).
- **Rating de Google es manual** (sincronizar automático requiere Google Places API, con costo).
- **Multi-tenancy por capa de queries**, no por RLS de Postgres (riesgo mitigado
  con disciplina de scope; auditable pero no forzado por la base).
- **Migrate-on-build**: una migración rota podría frenar el deploy.
- Pensado para **escala chica** (un estudio): envíos de campañas secuenciales con
  tope, cron simples. Escalaría con colas/batch si crece mucho.
- Vulnerabilidades de `npm audit`: evaluadas como dev-tooling o no explotables en
  producción (no se forzó un major breaking).

## 10. Pendientes / ideas sobre la mesa

- Mostrar en la **agenda** packs/gift cards/puntos de la clienta para aplicarlos de un clic al cobrar.
- **Canje de puntos directo en caja** (descontar puntos y registrar el movimiento en una sola operación).
- **Exportar** clientes/turnos a CSV; **cierre de caja** mensual.
- Conectar **dominio propio**.
- Activar las integraciones (Resend, Blob, Upstash, Turnstile) en producción.
- Prueba end-to-end real en producción.

## 11. Preguntas para la segunda opinión (sugeridas)

1. ¿La arquitectura multi-tenant por capa de queries (sin RLS) es razonable para este tamaño, o conviene migrar a RLS?
2. ¿Qué riesgos de seguridad o de datos ves que no estén cubiertos?
3. ¿Falta alguna capacidad clave para un estudio de estética que debería priorizarse?
4. ¿El enfoque de "gift cards/packs en salón, no online" es correcto o conviene habilitar pago online (Mercado Pago)?
5. ¿El modelo de puntos (ganar por $ gastado, canje como descuento) es el adecuado, o conviene otro esquema?
6. ¿Qué simplificarías o qué ves sobre-ingenierizado para un negocio de 2 personas?
7. Prioridades: ¿qué construirías primero de los pendientes?
