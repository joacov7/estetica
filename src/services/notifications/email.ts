import "server-only";

/**
 * Email sending via Resend. Graceful: if RESEND_API_KEY is unset, sending is a
 * no-op (returns false) so the app runs without it. The abstraction keeps the
 * door open for other channels/providers (NotificationProvider seam).
 */
const API_KEY = process.env.RESEND_API_KEY;
// Requires a verified domain in Resend for real delivery.
const FROM = process.env.RESEND_FROM || "Turnos <onboarding@resend.dev>";

export const emailConfigured = Boolean(API_KEY);

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: params.to, subject: params.subject, html: params.html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Simple branded reminder email. */
export function reminderEmailHtml(opts: {
  orgName: string;
  clientName: string;
  services: string;
  whenText: string;
  manageUrl?: string;
}): string {
  const { orgName, clientName, services, whenText, manageUrl } = opts;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1f1f23">
    <h2 style="font-weight:600">Hola ${escapeHtml(clientName)} 💅</h2>
    <p>Te recordamos tu turno en <strong>${escapeHtml(orgName)}</strong>:</p>
    <div style="background:#faf6f2;border-radius:12px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>${escapeHtml(services)}</strong></p>
      <p style="margin:4px 0;color:#6b6b70">${escapeHtml(whenText)}</p>
    </div>
    ${manageUrl ? `<p><a href="${manageUrl}" style="color:#b06a80">Cancelar o reprogramar</a></p>` : ""}
    <p style="color:#9a9aa0;font-size:13px">Te esperamos ✨</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Turn a plain-text body (admin-written) into safe HTML paragraphs. */
function textToHtml(body: string): string {
  return escapeHtml(body.trim()).replace(/\n/g, "<br>");
}

/** Generic marketing/campaign email with a required unsubscribe footer. */
export function campaignEmailHtml(opts: {
  orgName: string;
  clientName: string;
  body: string;
  unsubscribeUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const { orgName, clientName, body, unsubscribeUrl, ctaText, ctaUrl } = opts;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f1f23">
    <h2 style="font-weight:600;color:#a24e6b">${escapeHtml(orgName)}</h2>
    <p style="margin:12px 0">Hola ${escapeHtml(clientName)},</p>
    <div style="font-size:15px;line-height:1.6;color:#33333a">${textToHtml(body)}</div>
    ${
      ctaText && ctaUrl
        ? `<p style="margin:22px 0"><a href="${ctaUrl}" style="background:#a24e6b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(ctaText)}</a></p>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#9a9aa0;font-size:12px">
      Recibís este correo porque sos clienta de ${escapeHtml(orgName)}.
      ${unsubscribeUrl ? `<br><a href="${unsubscribeUrl}" style="color:#9a9aa0">No quiero recibir más novedades</a>` : ""}
    </p>
  </div>`;
}

/** Review-request email sent after an appointment. */
export function reviewRequestEmailHtml(opts: {
  orgName: string;
  clientName: string;
  reviewUrl: string;
}): string {
  const { orgName, clientName, reviewUrl } = opts;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1f1f23">
    <h2 style="font-weight:600">¿Cómo la pasaste, ${escapeHtml(clientName)}? 💕</h2>
    <p>Gracias por venir a <strong>${escapeHtml(orgName)}</strong>. Nos encantaría saber tu opinión: te toma 20 segundos y nos ayuda un montón.</p>
    <p style="margin:22px 0">
      <a href="${reviewUrl}" style="background:#a24e6b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Dejar mi opinión</a>
    </p>
    <p style="color:#9a9aa0;font-size:13px">¡Gracias! ✨</p>
  </div>`;
}

/** Birthday greeting email. */
export function birthdayEmailHtml(opts: {
  orgName: string;
  clientName: string;
  body: string;
  ctaUrl?: string;
}): string {
  const { orgName, clientName, body, ctaUrl } = opts;
  const text = body.trim() || `¡Feliz cumple! 🎉 Todo el equipo de ${orgName} te desea un día hermoso. Te esperamos para festejarlo con las uñas divinas 💅`;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1f1f23">
    <h2 style="font-weight:600;color:#a24e6b">¡Feliz cumpleaños, ${escapeHtml(clientName)}! 🎂</h2>
    <div style="font-size:15px;line-height:1.6;color:#33333a">${textToHtml(text)}</div>
    ${
      ctaUrl
        ? `<p style="margin:22px 0"><a href="${ctaUrl}" style="background:#a24e6b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Reservar mi turno</a></p>`
        : ""
    }
  </div>`;
}

/** Password reset email. */
export function resetEmailHtml(opts: { name: string | null; url: string }): string {
  const { name, url } = opts;
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1f1f23">
    <h2 style="font-weight:600">Restablecer tu contraseña</h2>
    <p>Hola${name ? " " + escapeHtml(name) : ""}, recibimos un pedido para cambiar tu contraseña.</p>
    <p style="margin:20px 0">
      <a href="${url}" style="background:#a24e6b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Elegir una nueva contraseña</a>
    </p>
    <p style="color:#6b6b70;font-size:13px">El enlace vence en 1 hora. Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia hasta que uses el enlace.</p>
  </div>`;
}
