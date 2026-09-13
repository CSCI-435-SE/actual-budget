import type { AccountEntity } from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_NAME_MAX_LENGTH,
  validateAccountName,
} from './accountValidation';

const existingAccounts: AccountEntity[] = [
  { id: 'a1', name: 'Checking' } as AccountEntity,
  { id: 'a2', name: 'Savings' } as AccountEntity,
];

describe('validateAccountName', () => {
  it('returns an error for a blank name', () => {
    expect(validateAccountName('', 'a1', existingAccounts)).not.toBe('');
    expect(validateAccountName('   ', 'a1', existingAccounts)).not.toBe('');
  });

  it('returns an error for a duplicate name on a different account', () => {
    expect(validateAccountName('Savings', 'a1', existingAccounts)).not.toBe('');
  });

  it("allows keeping an account's own current name", () => {
    expect(validateAccountName('Checking', 'a1', existingAccounts)).toBe('');
  });

  it('allows a name at exactly the max length', () => {
    const name = 'a'.repeat(ACCOUNT_NAME_MAX_LENGTH);
    expect(validateAccountName(name, 'a1', existingAccounts)).toBe('');
  });

  it('returns an error for a name longer than the max length', () => {
    const name = 'a'.repeat(ACCOUNT_NAME_MAX_LENGTH + 1);
    expect(validateAccountName(name, 'a1', existingAccounts)).not.toBe('');
  });

  it('returns a valid, non-duplicate, non-blank name unchanged', () => {
    expect(validateAccountName('New Account', 'a1', existingAccounts)).toBe('');
  });
});
