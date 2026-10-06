import { randomBytes } from "node:crypto";
import type { PaymentMethod } from "./enums";

export type ChargeResult = { ok: true; reference: string } | { ok: false; error: string };

/**
 * Payment gateway boundary.
 *
 * This build ships a *simulated* gateway so the whole flow works without merchant
 * credentials. To go live, implement `charge` against Chapa / Telebirr / CBE Birr
 * (keep the same signature) and keep card entry on the provider's hosted page.
 *
 * Simulation rules (useful for demos and tests):
 *  - Mobile-money numbers ending in 0000 -> the prompt "times out" (payment failed state).
 *  - Everything else succeeds.
 */
export async function charge(input: {
  method: PaymentMethod;
  amount: number;
  phone?: string;
  orderCode: string;
}): Promise<ChargeResult> {
  await new Promise((r) => setTimeout(r, 600));
  if (input.method !== "CARD" && input.phone?.endsWith("0000")) {
    const label = input.method === "TELEBIRR" ? "Telebirr" : "CBE Birr";
    return { ok: false, error: `The ${label} prompt timed out` };
  }
  const prefix = input.method === "TELEBIRR" ? "TB" : input.method === "CBE_BIRR" ? "CB" : "CD";
  return { ok: true, reference: `${prefix}${randomBytes(5).toString("hex").toUpperCase()}` };
}
