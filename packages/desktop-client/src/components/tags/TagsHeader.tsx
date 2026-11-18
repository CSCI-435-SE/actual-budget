import React from 'react';
import { useTranslation } from 'react-i18next';

import { Cell, SelectCell, TableHeader } from '#components/table';
import { useSelectedDispatch, useSelectedItems } from '#hooks/useSelected';

import { TagViewTransactionsButton } from './TagViewTransactionsButton';

export const TAG_COUNT_COLUMN_WIDTH = 110;

type TagsHeaderProps = {
  // Width of the list's vertical scrollbar, which the header doesn't have
  scrollWidth?: number;
};

export function TagsHeader({ scrollWidth = 0 }: TagsHeaderProps) {
  const { t } = useTranslation();
  const selectedItems = useSelectedItems();
  const dispatchSelected = useSelectedDispatch();

  return (
    <TableHeader style={{ paddingRight: scrollWidth }}>
      <SelectCell
        exposed
        focused={false}
        selected={selectedItems.size > 0}
        onSelect={e =>
          dispatchSelected({ type: 'select-all', isRangeSelect: e.shiftKey })
        }
      />
      <Cell value={t('Tag')} width={250} />
      <Cell value={t('Description')} width="flex" />
      <Cell
        value={t('Transactions')}
        width={TAG_COUNT_COLUMN_WIDTH}
        textAlign="right"
      />
      {/* An invisible copy of the rows' button keeps the columns aligned */}
      <Cell
        width="auto"
        plain
        aria-hidden
        style={{ padding: '0 10px', visibility: 'hidden' }}
      >
        <TagViewTransactionsButton />
      </Cell>
    </TableHeader>
  );
}
