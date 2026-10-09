import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { Setting } from './UI';

export function IconSizeSettings() {
  const { t } = useTranslation();
  const [iconSize, setIconSize] = useGlobalPref('iconSize');

  const iconSizeOptions: SelectOption[] = [
    ['0.75', t('Small')],
    ['1', t('Medium (Default)')],
    ['1.25', t('Large')],
    ['1.5', t('Extra Large')],
  ];

  return (
    <Setting
      primaryAction={
        <Select
          aria-label={t('Select icon size')}
          options={iconSizeOptions}
          value={iconSize ?? '1'}
          defaultLabel={t('Medium (Default)')}
          onChange={value => setIconSize(value)}
        />
      }
    >
      <Text>
        <Trans>
          <strong>Icon size</strong> controls the size of icons throughout
          the app. The default size is medium.
        </Trans>
      </Text>
    </Setting>
  );
}