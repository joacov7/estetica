# Auditoría de seguridad, arquitectura y calidad — By Mery

> Inspección de solo lectura del repositorio real. Notación:
> **[CONFIRMADO]** visto en código · **[HIPOTÉTICO]** depende de condiciones ·
> **[NO VERIFICABLE]** fuera del repo.

## Veredicto general
La base multi-tenant es sólida y consistente: no se encontró fuga cross-tenant
ni bypass de autenticación. El `organizationId` siempre se deriva de la sesión
(`getCurrentOrg`) y casi todas las escrituras filtran por `organizationId` en el
`WHERE`. Los problemas son de autorización por rol, integridad de dinero bajo
concurrencia, enforcement de políticas del lado servidor y madurez operativa
(tests/observabilidad/backups).

## CRÍTICO
Ninguna vulnerabilidad crítica confirmada (sin fuga cross-tenant, sin bypass de
auth, sin SQLi/RCE).

## ALTO
- **A1. Gift card: doble gasto por carrera (lost update)** [CONFIRMADO] —
  `redeemGiftCard` hace read-then-write del saldo. Fix: UPDATE condicional
  atómico `balance_cents >= cents` con RETURNING. → **RESUELTO**.
- **A2. Autorización por rol incompleta** [CONFIRMADO] — `recordPayment`, gift
  cards, packs, `updateAppointmentStatus`, `createManualAppointment` sólo
  verificaban pertenencia, no rol. Fix: gating owner/admin. → **RESUELTO**.
- **A3. Reglas de reserva sólo en el cliente** [CONFIRMADO] — cancelar/
  reprogramar por token no validaba `cancellationWindowHours` en el servidor.
  Fix: validación server-side. → **RESUELTO**.

## MEDIO
- **M1. Canje de puntos concurrente → saldo negativo** [CONFIRMADO] —
  `redeemPoints`/`adjustPoints` read-then-insert sin transacción.
- **M2. Pagos de caja sin rol, sin vínculo a turno/clienta, refund sin signo**
  [CONFIRMADO] — doble fuente de verdad con Analytics.
- **M3. Reset no invalida sesiones + JWT 30 días default** [CONFIRMADO/HIPOTÉTICO].
- **M4. Sin Content-Security-Policy** [CONFIRMADO] — único `dangerouslySetInnerHTML`
  es el SVG del QR (librería `qrcode`, entrada no controlada → bajo riesgo).
- **M5. Observabilidad/manejo de errores pobre** [CONFIRMADO] — `catch {}` que
  descarta errores; sin logging/alertas.
- **M6. Cobertura de tests mínima** [CONFIRMADO] — sólo unit de disponibilidad;
  sin tenancy/dinero/E2E.
- **M7. Posible duplicación de envíos en cron ante fallo parcial** [HIPOTÉTICO].

## BAJO
- **B1. Enumeración de emails en signup** [CONFIRMADO].
- **B2. Sobrescritura de datos de clienta vía reserva pública (upsert por teléfono)** [CONFIRMADO].
- **B3. Comparación de `CRON_SECRET` no constante (`!==`)** [CONFIRMADO].
- **B4. `booking-token` sin expiración** [CONFIRMADO].
- **B5. `.gitignore` no cubre `.env.production`** [CONFIRMADO] (no hay secretos commiteados).
- **B6. Sin rate-limit en `resetPassword`/sin lockout de cuenta** [CONFIRMADO].

## No verificable (requiere revisar infra)
- Backups/restore de Neon (PITR): confirmar retención y **probar restauración**.
- SSL de la DB: `db/index.ts` no fuerza `ssl`; confirmar `sslmode=require` en `DATABASE_URL`.
- Variables en producción (`AUTH_SECRET`, `BOOKING_TOKEN_SECRET`, `CRON_SECRET`).
- Migrate-on-build: validar migraciones en staging antes de `main`.

## Plan de remediación priorizado
**Bloqueantes (pre-lanzamiento):** A1, A2, A3 (resueltos en código) + infra (SSL,
secrets, probar restore).
**Primeras 2 semanas:** M1, M3, M5, M2.
**Endurecimiento:** M6 (tests tenancy/dinero/E2E), M4 (CSP), M7, lote de BAJOS.
