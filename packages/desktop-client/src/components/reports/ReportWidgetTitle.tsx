import React from 'react';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';

import { ModifiedLabel } from './ModifiedLabel';

type ReportWidgetTitleProps = {
  title: string;
  /** Shows the inline name editor when provided. */
  onSave?: (newName: string) => void;
  isModified: boolean;
};

/**
 * The page title of a report opened from a dashboard widget, followed by a
 * "(modified)" label while the report has unsaved settings.
 */
export function ReportWidgetTitle({
  title,
  onSave,
  isModified,
}: ReportWidgetTitleProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {onSave ? (
        <EditablePageHeaderTitle title={title} onSave={onSave} />
      ) : (
        title
      )}
      {isModified && (
        <ModifiedLabel
          style={{ fontWeight: 400, color: theme.pageTextSubdued }}
        />
      )}
    </View>
  );
}
