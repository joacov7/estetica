const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short, human-friendly referral code (unambiguous alphabet). */
export function generateReferralCode(len = 6): string {
  let code = "";
  for (let i = 0; i < len; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}
