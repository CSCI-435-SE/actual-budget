import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useUpdateAccountMutation } from '#accounts';
import { CharacterCounter } from '#components/common/CharacterCounter';
import { ACCOUNT_DESCRIPTION_MAX_LENGTH } from '#components/util/accountValidation';

type AccountDescriptionInputProps = {
  account: AccountEntity;
  onDone: () => void;
};

export function AccountDescriptionInput({
  account,
  onDone,
}: AccountDescriptionInputProps) {
  const { t } = useTranslation();
  const { mutate: updateAccount } = useUpdateAccountMutation();
  const initialValue = account.description ?? '';
  const [liveValue, setLiveValue] = useState(initialValue);
  // Enter/Escape unmount the input, which can also fire a blur (onUpdate).
  // This makes sure we only finish once.
  const isDone = useRef(false);

  const finish = (value: string | null) => {
    if (isDone.current) {
      return;
    }
    isDone.current = true;

    if (value !== null && value.trim() !== initialValue) {
      updateAccount({
        account: { id: account.id, description: value.trim() || null },
      });
    }
    onDone();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: -6,
      }}
    >
      <InitialFocus>
        <Input
          aria-label={t('Account description')}
          placeholder={t('Add a short description')}
          defaultValue={initialValue}
          maxLength={ACCOUNT_DESCRIPTION_MAX_LENGTH}
          onChangeValue={setLiveValue}
          onEnter={value => finish(value)}
          onUpdate={value => finish(value)}
          onEscape={() => finish(null)}
          style={{ ...styles.smallText, width: '50ch', marginLeft: -6 }}
        />
      </InitialFocus>
      <CharacterCounter
        length={liveValue.length}
        maxLength={ACCOUNT_DESCRIPTION_MAX_LENGTH}
      />
    </View>
  );
}
