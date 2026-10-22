export function formatMoney(cents: number, currency: string, locale = currency === "INR" ? "en-IN" : "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function discountPercent(priceCents: number, originalCents?: number | null) {
  if (!originalCents || originalCents <= 0 || priceCents >= originalCents) return 0;
  return Math.round((1 - priceCents / originalCents) * 100);
}
