import type { AccountEntity } from '@actual-app/core/types/models';
import { t } from 'i18next';

export const ACCOUNT_NAME_MAX_LENGTH = 50;

export function validateAccountName(
  newAccountName: string,
  accountId: string,
  accounts: AccountEntity[],
): string {
  newAccountName = newAccountName.trim();
  if (!newAccountName.length) {
    return t('Name cannot be blank.');
  }
  if (newAccountName.length > ACCOUNT_NAME_MAX_LENGTH) {
    return t('Name must be {{ maxLength }} characters or fewer.', {
      maxLength: ACCOUNT_NAME_MAX_LENGTH,
    });
  }
  const duplicateNamedAccounts = accounts.filter(
    account => account.name === newAccountName && account.id !== accountId,
  );
  if (duplicateNamedAccounts.length) {
    return t('Name {{ newAccountName }} already exists.', { newAccountName });
  }
  return '';
}
