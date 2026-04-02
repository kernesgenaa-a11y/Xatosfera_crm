export const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  UAH: 0.024,
};

export function convertToUsd(amount: unknown, currency: unknown): number | null {
  if (amount == null || amount === '') return null;

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return null;

  const normalizedCurrency = String(currency ?? 'USD').toUpperCase();
  const rate = USD_EXCHANGE_RATES[normalizedCurrency] ?? 1;

  return Number((numericAmount * rate).toFixed(2));
}
