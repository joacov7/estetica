import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots } from "@/services/availability";
import { availabilityQuerySchema } from "@/lib/validations/booking";

/** POST /api/availability → free slots for a professional/service/date. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = availabilityQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  const { organizationId, professionalId, serviceIds, date } = parsed.data;

  const db = createAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();
  if (!org) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

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
