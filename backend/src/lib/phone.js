export function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return "";
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10) return "91" + digits;
  return digits;
}

export function isPhoneLike(input) {
  if (!input || typeof input !== "string") return false;
  // Email addresses contain @ — they should never be treated as phone numbers.
  // Without this guard, emails like "qa.a.1786303871781@example.com" (13 digits)
  // match this check, causing the identifier lookup to call lookupContactByPhone
  // instead of lookupContact, yielding "No Vyntra account found".
  if (input.includes("@")) return false;
  const digits = input.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
