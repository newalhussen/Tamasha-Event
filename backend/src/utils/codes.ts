import { randomInt } from "node:crypto";

// No 0/O/1/I/L so codes can be read aloud or typed at the gate without mistakes.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function chunk(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** TMS-7K4Q-92XD (~40 bits of entropy). The QR code encodes exactly this string. */
export const newTicketCode = () => `TMS-${chunk(4)}-${chunk(4)}`;

/** TM-48213 */
export const newOrderCode = () => `TM-${randomInt(10000, 99999)}`;

export function normalizeTicketCode(input: string): string {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  // Accept codes typed without dashes: TMS7K4Q92XD
  const m = raw.match(/^TMS-?([A-Z0-9]{4})-?([A-Z0-9]{4})$/);
  return m ? `TMS-${m[1]}-${m[2]}` : raw;
}
