import React from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgFilter } from '@actual-app/components/icons/v1';

import { scaledIconSize } from '#style';

export function FiltersButton({ onPress }: { onPress: () => void }) {
  const iconSize = scaledIconSize(12);
  return (
    <Button variant="bare" onPress={onPress}>
      <SvgFilter
        style={{
          width: iconSize,
          height: iconSize,
          marginRight: 5,
          flexShrink: 0,
        }}
      />{' '}
      <Trans>Filter</Trans>
    </Button>
  );
}
