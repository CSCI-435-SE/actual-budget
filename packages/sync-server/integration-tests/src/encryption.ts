import {
  createCipheriv,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
} from 'node:crypto';

import { create, MessageSchema, toBinary } from '@actual-app/crdt';

// End-to-end encryption the way loot-core does it, so a test server can
// hold an encrypted budget that real devices download. Mirrors:
// - key derivation: `createKeyBuffer` in loot-core
//   src/server/encryption/encryption-internals.electron.ts (PBKDF2, SHA-512,
//   10,000 iterations, 32-byte key; the salt is 32 random bytes in base64,
//   as `key-make` in src/server/encryption/app.ts creates it)
// - encryption: `encrypt` in the same file (AES-256-GCM, random 12-byte IV)
// - the key test: `key-make` stores an encrypted test message on the server
//   (`makeTestMessage` in src/server/sync/make-test-message.ts), and
//   `key-test` decrypts it to check a password before downloading.
// If loot-core changes any of these, update this file to match.

const ALGORITHM = 'aes-256-gcm';

export type EncryptionKey = {
  id: string;
  salt: string;
  raw: Buffer;
};

/** What loot-core stores next to encrypted data (`X-ACTUAL-ENCRYPT-META`). */
export type EncryptMeta = {
  keyId: string;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
};

export function createKeyFromPassword(password: string): EncryptionKey {
  const salt = randomBytes(32).toString('base64');
  return {
    id: randomUUID(),
    salt,
    raw: pbkdf2Sync(password, salt, 10000, 32, 'sha512'),
  };
}

export function encrypt(
  key: EncryptionKey,
  value: Uint8Array,
): { value: Buffer; meta: EncryptMeta } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key.raw, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return {
    value: encrypted,
    meta: {
      keyId: key.id,
      algorithm: ALGORITHM,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    },
  };
}

/**
 * The `testContent` loot-core registers with `/user-create-key`: an
 * encrypted dummy sync message, serialized the way `key-make` does it.
 */
export function makeKeyTestContent(key: EncryptionKey): string {
  const message = toBinary(
    MessageSchema,
    create(MessageSchema, {
      dataset: 'key-test',
      row: randomUUID(),
      column: 'key-test',
      value: `S:${randomUUID()}`,
    }),
  );
  const { value, meta } = encrypt(key, message);
  return JSON.stringify({ value: value.toString('base64'), meta });
}
