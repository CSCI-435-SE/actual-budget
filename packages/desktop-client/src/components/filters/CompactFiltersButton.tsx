import React from 'react';

import { Button } from '@actual-app/components/button';
import { SvgFilter } from '@actual-app/components/icons/v1';

import { scaledIconSize } from '#style';

export function CompactFiltersButton({ onPress }: { onPress: () => void }) {
  const iconSize = scaledIconSize(15);
  return (
    <Button variant="bare" onPress={onPress} style={{ minWidth: 20 }}>
      <SvgFilter style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />
    </Button>
  );
}
