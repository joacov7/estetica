import "server-only";

/**
 * PaymentProvider abstraction.
 *
 * The app records payments in its own `payments` table regardless of provider.
 * This interface is the seam for *external* charge collection (e.g. charging a
 * deposit online). V1 ships only the manual provider (money collected in
 * person / by transfer and recorded by staff). Mercado Pago plugs in later by
 * implementing this interface — no call sites change.
 */
export interface CreateChargeInput {
  organizationId: string;
  amountCents: number;
  description: string;
  /** Where to send the customer back after paying. */
  returnUrl?: string;
  /** Our appointment/booking reference, echoed back by webhooks. */
  externalRef: string;
}

export interface CreateChargeResult {
  /** URL to redirect the customer to pay, or null for manual (no online step). */
  checkoutUrl: string | null;
  /** Provider name recorded on the payment row. */
  provider: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Whether this provider collects money online (redirects the customer). */
  readonly online: boolean;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
}

/** Manual provider: no online collection. Staff records the payment by hand. */
export const manualProvider: PaymentProvider = {
  name: "manual",
  online: false,
  async createCharge() {
    return { checkoutUrl: null, provider: "manual" };
  },
};

/** Resolve the active provider for an organization. Mercado Pago will be
 *  selected here once configured; for now everything is manual. */
export function getPaymentProvider(): PaymentProvider {
  return manualProvider;
}
