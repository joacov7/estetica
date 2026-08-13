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
  price_cents: number;
  deposit_type: "none" | "fixed" | "percentage";
  deposit_value: number;
}): number {
  switch (service.deposit_type) {
    case "fixed":
      return Math.round(service.deposit_value);
    case "percentage":
      return Math.round((service.price_cents * service.deposit_value) / 100);
    default:
      return 0;
  }
}
