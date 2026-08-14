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
