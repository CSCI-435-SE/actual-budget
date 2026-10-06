import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { Setting } from './UI';

const fontSizeOptions: SelectOption[] = [
  ['0.85', 'Small'],
  ['1', 'Medium (Default)'],
  ['1.15', 'Large'],
  ['1.3', 'Extra Large']
];

export function FontSizeSettings() {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useGlobalPref('fontSize');

  return (
    <Setting
      primaryAction={
        <Select
          aria-label={t('Select font size')}
          options={fontSizeOptions}
          value={fontSize ?? '16'}
          defaultLabel={t('Default (16px)')}
          onChange={value => {
            setFontSize(value);
            document.documentElement.style.setProperty(
              '--base-font-size',
              `${value}px`,
            );
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