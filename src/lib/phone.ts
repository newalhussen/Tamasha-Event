// Ethiopian mobile numbers: 09XXXXXXXX (Ethio telecom) or 07XXXXXXXX (Safaricom Ethiopia).
// Accepts +251 / 251 / 0 prefixes and spaces or dashes.

export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("251")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[79]\d{8}$/.test(digits)) return null;
  return `0${digits}`;
}

/** 0912345678 -> 0912 345 678 */
export function formatPhone(canonical: string | null | undefined): string {
  if (!canonical) return "";
  const p = normalizePhone(canonical);
  if (!p) return canonical;
  return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input);
}
