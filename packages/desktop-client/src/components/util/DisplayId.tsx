// @ts-strict-ignore
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';

import { AccountName } from '#components/accounts/AccountName';
import { useAccount } from '#hooks/useAccount';
import { usePayee } from '#hooks/usePayee';
import { isHexColor } from '#util/colorPill';

type DisplayIdProps = {
  type: 'accounts' | 'payees';
  id: string;
  noneColor?: string;
};

export function DisplayId({
  type,
  id,
  noneColor = theme.pageTextSubdued,
}: DisplayIdProps) {
  return type === 'accounts' ? (
    <AccountDisplayId id={id} noneColor={noneColor} />
  ) : (
    <PayeeDisplayId id={id} noneColor={noneColor} />
  );
}

function AccountDisplayId({ id, noneColor }) {
  const { t } = useTranslation();
  const account = useAccount(id);
  return (
    <Text
      style={account == null ? { color: noneColor } : null}
      title={account ? account.name : t('None')}
    >
      {account ? <AccountName account={account} compact /> : t('None')}
    </Text>
  );
}

function PayeeDisplayId({ id, noneColor }) {
  const { t } = useTranslation();
  const { data: payee } = usePayee(id);
  // Transfer payees are named after their account, so show its color too
  const transferAccount = useAccount(payee?.transfer_acct ?? '');
  return (
    <TextOneLine
      style={payee == null ? { color: noneColor } : null}
      title={payee ? payee.name : t('None')}
    >
      {payee == null ? (
        t('None')
      ) : transferAccount && isHexColor(transferAccount.color) ? (
        <AccountName account={transferAccount} compact />
      ) : (
        payee.name
      )}
    </TextOneLine>
  );
}
