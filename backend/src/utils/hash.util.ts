import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env';

// Abstraction + polymorphism seam: auth.service.ts depends on this contract rather than
// bcryptjs directly, so the hashing algorithm could be swapped (e.g. for argon2) behind
// the same interface without touching callers.
export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements IPasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const passwordHasher: IPasswordHasher = new BcryptPasswordHasher();

// Shims: keep every existing `import { hashPassword } from '../utils/hash.util'` working
// unchanged until callers are migrated to constructor-injected IPasswordHasher.
export async function hashPassword(password: string): Promise<string> {
  return passwordHasher.hash(password);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return passwordHasher.compare(password, hash);
}

// For refresh/reset tokens and one-time codes (already high-entropy, not human-chosen
// passwords): a fast unsalted SHA-256 digest is enough, and keeps lookups a simple
// indexed equality match instead of an O(n) bcrypt.compare scan.
export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
