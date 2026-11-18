import React from 'react';

import { theme } from '@actual-app/components/theme';
import type { TagEntity } from '@actual-app/core/types/models';

import { Table } from '#components/table';
import type { TableNavigator } from '#components/table';

import { TagRow } from './TagRow';

type TagsListProps = {
  navigator: TableNavigator<TagEntity>;
  tags: TagEntity[];
  // Transaction counts keyed by tag name; undefined while loading
  counts?: Map<TagEntity['tag'], number>;
  hoveredTag?: string;
  onHover: (id?: string) => void;
  saveScrollWidth?: (parent: number, child: number) => void;
};

export function TagsList({
  navigator,
  tags,
  counts,
  hoveredTag,
  onHover,
  saveScrollWidth,
}: TagsListProps) {
  return (
    <Table
      navigator={navigator}
      items={tags}
      backgroundColor={theme.tableBackground}
      saveScrollWidth={saveScrollWidth}
      renderItem={({ item: tag, focusedField, onEdit }) => {
        const hovered = hoveredTag === tag.id;

        return (
          <TagRow
            key={tag.id}
            tag={tag}
            count={counts?.get(tag.tag)}
            hovered={hovered}
            onHover={onHover}
            focusedField={focusedField}
            onEdit={onEdit}
          />
        );
      }}
    />
  );
}
