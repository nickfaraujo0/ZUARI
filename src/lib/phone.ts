/** Last 10 digits of a phone number: how a WhatsApp sender is matched to a ZUARI user. */
export function phoneKey(phone?: string | null): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}
/** E.164-style digits for the WhatsApp API (assumes India for 10-digit numbers). */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}
