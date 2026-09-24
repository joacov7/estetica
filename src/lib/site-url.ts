/**
 * Public base URL for building shareable/absolute links (emails, QR codes,
 * unsubscribe links). Falls back to a relative path when unset so nothing
 * crashes; set NEXT_PUBLIC_SITE_URL in production for correct absolute links.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

/** Absolute URL for a path (e.g. "/by-mery/reservar"), or the path itself if no base is set. */
export function publicUrl(path: string): string {
  const base = siteUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
