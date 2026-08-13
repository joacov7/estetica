/**
 * Development seed: "Buenas Uñas" with a demo owner, professionals, services
 * and opening hours. Run with `npm run db:seed` (requires DATABASE_URL).
 *
 * Uses its own DB client (not src/db/index.ts) so it can run under tsx without
 * the `server-only` guard.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const DEMO_EMAIL = "demo@buenas-unas.test";
const DEMO_PASSWORD = "password123";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  const existing = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, "buenas-unas"))
    .limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped: 'buenas-unas' already exists.");
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({
        email: DEMO_EMAIL,
        name: "Demo",
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      })
      .returning({ id: schema.users.id });

    const [org] = await tx
      .insert(schema.organizations)
      .values({
        slug: "buenas-unas",
        name: "Buenas Uñas",
        description: "Estudio de manicura y estética. Diseños personalizados y atención premium.",
        address: "Av. Siempre Viva 123, Buenos Aires",
        instagram: "@buenas.unas",
        whatsapp: "5491100000000",
      })
      .returning({ id: schema.organizations.id });

    await tx.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: "owner",
    });
    await tx.insert(schema.settings).values({ organizationId: org.id });

    const [manos, pesta, cejas] = await tx
      .insert(schema.serviceCategories)
      .values([
        { organizationId: org.id, name: "Manos", sortOrder: 1 },
        { organizationId: org.id, name: "Pestañas", sortOrder: 2 },
        { organizationId: org.id, name: "Cejas", sortOrder: 3 },
      ])
      .returning({ id: schema.serviceCategories.id });

    const [maria, sofia] = await tx
      .insert(schema.professionals)
      .values([
        { organizationId: org.id, name: "María", specialties: ["Soft Gel", "Nail Art"], sortOrder: 1 },
        { organizationId: org.id, name: "Sofía", specialties: ["Kapping", "Semipermanente"], sortOrder: 2 },
      ])
      .returning({ id: schema.professionals.id });

    await tx.insert(schema.professionalPay).values([
      { professionalId: maria.id, organizationId: org.id, commissionType: "percentage", commissionValue: 40 },
      { professionalId: sofia.id, organizationId: org.id, commissionType: "percentage", commissionValue: 40 },
    ]);

    // Prices in cents (ARS). Editable from the admin panel.
    await tx.insert(schema.services).values([
      { organizationId: org.id, categoryId: manos.id, name: "Manicura", description: "Manicura completa con esmaltado tradicional.", priceCents: 1500000, durationMin: 60, bufferMin: 10, sortOrder: 1 },
      { organizationId: org.id, categoryId: manos.id, name: "Semipermanente", description: "Esmaltado semipermanente de larga duración.", priceCents: 2000000, durationMin: 75, bufferMin: 10, depositType: "percentage", depositValue: 30, sortOrder: 2 },
      { organizationId: org.id, categoryId: manos.id, name: "Kapping", description: "Refuerzo de la uña natural con gel.", priceCents: 2500000, durationMin: 90, bufferMin: 15, depositType: "percentage", depositValue: 30, sortOrder: 3 },
      { organizationId: org.id, categoryId: manos.id, name: "Soft Gel", description: "Extensiones con tips de soft gel.", priceCents: 3000000, durationMin: 120, bufferMin: 15, depositType: "percentage", depositValue: 30, sortOrder: 4 },
      { organizationId: org.id, categoryId: manos.id, name: "Nail Art", description: "Diseño artístico personalizado.", priceCents: 800000, durationMin: 45, bufferMin: 10, depositType: "fixed", depositValue: 500000, sortOrder: 5 },
      { organizationId: org.id, categoryId: pesta.id, name: "Lifting de pestañas", description: "Lifting y tinte de pestañas naturales.", priceCents: 2200000, durationMin: 60, bufferMin: 10, depositType: "percentage", depositValue: 30, sortOrder: 6 },
      { organizationId: org.id, categoryId: cejas.id, name: "Laminado de cejas", description: "Laminado y perfilado de cejas.", priceCents: 2000000, durationMin: 50, bufferMin: 10, depositType: "percentage", depositValue: 30, sortOrder: 7 },
    ]);

    // Opening hours: Tue–Sat 10:00–19:00.
    await tx.insert(schema.businessHours).values(
      [2, 3, 4, 5, 6].map((weekday) => ({
        organizationId: org.id,
        professionalId: null,
        weekday,
        startTime: "10:00",
        endTime: "19:00",
      })),
    );
  });

  console.log(`Seed OK. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
