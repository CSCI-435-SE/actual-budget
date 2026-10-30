import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgPencil1 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { AccountDescriptionInput } from './AccountDescriptionInput';

type AccountDescriptionFieldProps = {
  account: AccountEntity;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
};

export function AccountDescriptionField({
  account,
  isEditing,
  onStartEditing,
  onStopEditing,
}: AccountDescriptionFieldProps) {
  const { t } = useTranslation();

  if (isEditing) {
    return <AccountDescriptionInput account={account} onDone={onStopEditing} />;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        maxWidth: '100%',
        // tighten the gap between the account name and the description
        marginTop: -6,
        '& .hover-visible': {
          opacity: 0,
          transition: 'opacity .25s',
        },
        '&:hover .hover-visible': {
          opacity: 1,
        },
      }}
    >
      <Text
        data-testid="account-description"
        title={account.description ?? undefined}
        style={{
          ...styles.smallText,
          ...styles.ellipsisText,
          color: theme.pageTextSubdued,
          maxWidth: '80ch',
        }}
      >
        {account.description}
      </Text>
      <Button
        variant="bare"
        aria-label={t('Edit account description')}
        className="hover-visible"
        onPress={onStartEditing}
      >
        <SvgPencil1
          style={{ width: 10, height: 10, color: theme.pageTextSubdued }}
        />
      </Button>
    </View>
  );
}
