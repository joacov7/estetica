/**
 * Money helpers. Amounts are stored as integer cents everywhere.
 * Formatting is driven by the organization's currency + locale (never hard-coded).
 */
export function formatMoney(
  cents: number,
  opts: { currency: string; locale: string },
): string {
  return new Intl.NumberFormat(opts.locale, {
    style: "currency",
    currency: opts.currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Compute the required deposit (in cents) for a service. */
export function depositCents(service: {
  priceCents: number;
  depositType: "none" | "fixed" | "percentage";
  depositValue: number;
}): number {
  switch (service.depositType) {
    case "fixed":
      return Math.round(service.depositValue);
    case "percentage":
      return Math.round((service.priceCents * service.depositValue) / 100);
    default:
      return 0;
  }
}
