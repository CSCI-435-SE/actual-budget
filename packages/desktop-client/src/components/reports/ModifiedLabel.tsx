import React from 'react';
import type { CSSProperties } from 'react';
import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';

type ModifiedLabelProps = {
  style?: CSSProperties;
};

/** Marks a report whose current settings differ from the saved ones. */
export function ModifiedLabel({ style }: ModifiedLabelProps) {
  return (
    <Text style={style}>
      <Trans>(modified)</Trans>
    </Text>
  );
}
