import React from 'react';

import { Button } from '@actual-app/components/button';
import { SvgFilter } from '@actual-app/components/icons/v1';

export function CompactFiltersButton({ onPress }: { onPress: () => void }) {
  return (
    <Button variant="bare" onPress={onPress} style={{ minWidth: 20 }}>
      <SvgFilter
        style={{ width: 'var(--icon-size-15)', height: 'var(--icon-size-15)', flexShrink: 0 }}
      />
    </Button>
  );
}
