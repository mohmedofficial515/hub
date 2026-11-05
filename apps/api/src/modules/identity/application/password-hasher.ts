/**
 * @file argon2id (D09). An unknown email still costs a hash, so timing does not reveal who has an account.
 * @description Parameters are argon2's defaults, the same as F:/Goteav/backend/src/infra/crypto/password-hasher.ts.
 */
import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';

@Injectable()
export class PasswordHasher {
  private dummy: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id });
  }

  async verify(stored: string, password: string): Promise<boolean> {
    try {
      return await verify(stored, password);
    } catch {
      return false; // A stored value that is not a hash matches nothing.
    }
  }

  /** Spends the same time as a real check, and always answers false. */
  async verifyNothing(password: string): Promise<false> {
    this.dummy ??= this.hash('no account has this password');
    await this.verify(await this.dummy, password);
    return false;
  }
}
