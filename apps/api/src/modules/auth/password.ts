import { hash, verify } from '@node-rs/argon2';

/** Argon2id hash (contract §15: hashed secrets). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** False for a missing hash (deleted accounts, or Google-only accounts later). */
export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (!passwordHash) return false;
  return verify(passwordHash, password).catch(() => false);
}
