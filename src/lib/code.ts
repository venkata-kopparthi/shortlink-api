import { randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a random short code. Look-alike characters (l, I, O) are left out
 * so codes are easy to read aloud or type from a printed page.
 */
export function generateCode(length = 7): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
