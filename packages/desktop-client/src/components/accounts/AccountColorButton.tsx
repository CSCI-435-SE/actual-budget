import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { ColorPicker } from '@actual-app/components/color-picker';
import { SvgColorPalette } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useUpdateAccountMutation } from '#accounts';
import { isHexColor } from '#util/colorPill';

type AccountColorButtonProps = {
  account: AccountEntity;
};

export function AccountColorButton({ account }: AccountColorButtonProps) {
  const { t } = useTranslation();
  const { mutate: updateAccount } = useUpdateAccountMutation();
  const color = isHexColor(account.color) ? account.color : null;

  const saveColor = (newColor: string | null) => {
    if (newColor === account.color) {
      return;
    }
    updateAccount({ account: { id: account.id, color: newColor } });
  };

  return (
    <ColorPicker
      value={color ?? undefined}
      onChange={newColor => saveColor(newColor.toString('hex'))}
      footer={
        color && (
          <Button variant="bare" slot="close" onPress={() => saveColor(null)}>
            <Trans>Remove color</Trans>
          </Button>
        )
      }
    >
      <Button
        variant="bare"
        aria-label={t('Change account color')}
        className={color ? undefined : 'hover-visible'}
      >
        {color ? (
          <View
            data-testid="account-color-swatch"
            style={{
              width: 11,
              height: 11,
              borderRadius: 11,
              backgroundColor: color,
              boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.15)',
            }}
          />
        ) : (
          <SvgColorPalette
            style={{ width: 11, height: 11, color: theme.pageTextSubdued }}
          />
        )}
      </Button>
    </ColorPicker>
  );
}
