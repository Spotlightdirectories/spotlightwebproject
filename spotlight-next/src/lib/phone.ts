// Nigerian telephone check shared by signup and the profile editor.
// Mobile: 10 digits starting 7, 8 or 9 (after the 0 or +234).
// Landline: 7 to 9 digits starting 1 to 6.
// Returns the number as +234XXXXXXXXXX, or null if it does not look valid.
export function normalizeNigerianTelephone(input: string): string | null {
  let d = (input || "").replace(/\D/g, "").replace(/^234/, "").replace(/^0/, "");
  if (/^[789][0-9]{9}$/.test(d) || /^[1-6][0-9]{6,8}$/.test(d)) return "+234" + d;
  return null;
}
