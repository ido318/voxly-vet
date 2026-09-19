// Turning a price-list row into the `price` segment of a booking SMS.
//
// `price` in the SMS templates is a whole string, not a number — that is what
// lets a visit with no quotable price say so in the same slot instead of
// naming one (packages/shared/src/sms-templates.ts). Keep it that way.
//
// Before this, two hardcoded maps did the job: VISIT_PRICE in
// agent/src/lib/notifications.ts and VISIT_PRICES in
// app/lib/services/dashboard-notifications.service.ts. They disagreed —
// `urgent` was 200 ₪ from the agent and fell through to a `?? "150 ₪"`
// fallback from the dashboard, so the same appointment type was quoted
// differently depending on which side enqueued the SMS. That fallback is the
// worst part: it invents a price nobody configured and texts it to a client.

/** The clinic's editable price for one visit type. */
export type PriceListEntry = {
  defaultPrice: number;
  /**
   * False when the agent must not name this price before the visit.
   *
   * Neutering is the case this exists for: 350 ₪ is a real number and Dana
   * bills by it, but the price depends on species, weight, age and medical
   * state, so she quotes it herself. "No price" and "a price nobody may read
   * out" are different things, and only the second one is true here.
   */
  agentQuotable: boolean;
};

/** Frozen wording. Do not change without Dana's approval. */
export const NO_QUOTABLE_PRICE_TEXT = 'המחיר יימסר על ידי ד"ר דנה';

export function formatPriceSegment(price: number): string {
  // Whole shekels unless the clinic entered agorot.
  const rounded = Math.round(price * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} ₪`;
}

/**
 * The `price` segment for a booking SMS, from the clinic's price list.
 *
 * `undefined` means the visit type has no row — the clinic never configured
 * a price for it. Says so rather than inventing one: a number in this slot is
 * a commitment to the client, and the old `?? "150 ₪"` made that commitment
 * on nobody's authority.
 */
export function resolvePriceSegment(entry: PriceListEntry | undefined): string {
  if (!entry || !entry.agentQuotable) return NO_QUOTABLE_PRICE_TEXT;
  return formatPriceSegment(entry.defaultPrice);
}
