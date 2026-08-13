import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { getAvailableSlots } from "@/services/availability";
import { availabilityQuerySchema } from "@/lib/validations/booking";
import { availabilityLimiter, clientIp } from "@/lib/rate-limit";

/** POST /api/availability → free slots for a professional/service/date. */
export async function POST(req: Request) {
  const limited = await availabilityLimiter.check(`avail:${clientIp(req.headers)}`);
  if (!limited.ok) {
    return NextResponse.json({ error: "Demasiadas consultas. Probá en unos minutos." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = availabilityQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  const { organizationId, professionalId, serviceIds, date } = parsed.data;

  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  try {
    const slots = await getAvailableSlots({
      organizationId,
      professionalId,
      serviceIds,
      date,
      timezone: org.timezone,
    });
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json({ error: "No se pudo calcular la disponibilidad" }, { status: 500 });
  }
}
