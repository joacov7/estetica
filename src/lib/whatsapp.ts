/**
 * WhatsApp click-to-chat helpers (free, no API): build wa.me links with a
 * pre-filled message. Pure functions so both server and client can use them.
 */

/** Normalize a stored phone into international digits for wa.me. */
export function normalizeWhatsappPhone(phone: string, countryCode: string): string | null {
  let d = (phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return null;
  const cc = (countryCode || "").replace(/\D/g, "");
  // If it already starts with the country code, assume it's complete.
  if (cc && !d.startsWith(cc)) d = cc + d;
  return d.length >= 8 ? d : null;
}

/** Build a wa.me link with a pre-filled message, or null if the phone is unusable. */
export function waLink(phone: string, text: string, countryCode: string): string | null {
  const d = normalizeWhatsappPhone(phone, countryCode);
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Replace {nombre} placeholders in a message template with the client's name. */
export function fillTemplate(template: string, name: string): string {
  const first = name.trim().split(/\s+/)[0] || name.trim();
  return template.replace(/\{nombre\}/gi, first).replace(/\{name\}/gi, first);
}
