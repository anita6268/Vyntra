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
  const digits = input.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
