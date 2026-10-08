import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { Setting } from './UI';

export function FontSizeSettings() {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useGlobalPref('fontSize');

const fontSizeOptions: SelectOption[] = [
  ['0.85', t('Small')],
  ['1', t('Medium (Default)')],
  ['1.15', t('Large')],
  ['1.3', t('Extra Large')]
];

  return (
    <Setting
      primaryAction={
        <Select
          aria-label={t('Select font size')}
          options={fontSizeOptions}
          value={fontSize ?? '1'}
          defaultLabel={t('Medium (Default)')}
          onChange={value => {
            setFontSize(value);
          }}
        />
      }
    >
      <Text>
        <Trans>
          <strong>Font size</strong> controls the size of text throughout the
          app. The default size is 16px.
        </Trans>
      </Text>
    </Setting>
  );
}