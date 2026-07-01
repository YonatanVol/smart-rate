export type GuestType = "israeli" | "foreign_tourist";

/** Israeli VAT rate (raised to 18% in Jan 2025). */
export const VAT_RATE = 0.18;

export interface VatResult {
  gross: number;
  vat: number;
  netOfVat: number;
  rateApplied: number;
  /** true when the zero-rating is not yet legally confirmed (see plan open items) */
  verify: boolean;
}

/**
 * Split a VAT-inclusive gross price into VAT and net-of-VAT.
 *  - Israeli guests: 18% VAT.
 *  - Foreign tourists: zero-rated (0%).
 *
 * NOTE: zero-rating for *private* STR (vs. licensed hotels) is UNVERIFIED —
 * gov.il returned 403 during research. Foreign-tourist output is provisional
 * and flagged via `verify` so the UI can mark it.
 */
export function applyVat(gross: number, guest: GuestType): VatResult {
  const rateApplied = guest === "foreign_tourist" ? 0 : VAT_RATE;
  const netOfVat = gross / (1 + rateApplied);
  return {
    gross,
    vat: gross - netOfVat,
    netOfVat,
    rateApplied,
    verify: guest === "foreign_tourist",
  };
}
