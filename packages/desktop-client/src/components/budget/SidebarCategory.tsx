// @ts-strict-ignore
import React, { useRef, useState } from 'react';
import type { CSSProperties, Ref } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheveronDown } from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { InputCell } from '#components/table';
import { useContextMenu } from '#hooks/useContextMenu';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { SidebarCategoryButtons } from './SidebarCategoryButtons';

const SUBCATEGORY_INDENT = 16;

type SidebarCategoryProps = {
  innerRef: Ref<HTMLDivElement>;
  category: CategoryEntity;
  categoryGroup?: CategoryGroupEntity;
  dragPreview?: boolean;
  dragging?: boolean;
  goalsShown?: boolean;
  style?: CSSProperties;
  borderColor?: string;
  isLast?: boolean;
  /** Indents the row under its parent. */
  isSubcategory?: boolean;
  /** Categories this one can be moved under (see getValidParentCategories). */
  validParents?: CategoryEntity[];
  onEditName: (id: CategoryEntity['id']) => void;
  onSave: (category: CategoryEntity) => void;
  onHideNewCategory?: () => void;
  onShowNewSubcategory?: (parent: CategoryEntity) => void;
} & (
  | {
      editing: true;
      onDelete?: never;
    }
  | {
      editing: boolean;
      onDelete: (id: CategoryEntity['id']) => void;
    }
);

export function SidebarCategory({
  innerRef,
  category,
  categoryGroup,
  dragPreview,
  dragging,
  editing,
  goalsShown = false,
  style,
  isLast,
  isSubcategory = false,
  validParents = [],
  onEditName,
  onSave,
  onDelete,
  onHideNewCategory,
  onShowNewSubcategory,
}: SidebarCategoryProps) {
  const { t } = useTranslation();
  const [categoryExpandedStatePref] = useGlobalPref('categoryExpandedState');
  const categoryExpandedState = categoryExpandedStatePref ?? 0;
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  const temporary = category.id === 'new';
  const canHaveSubcategories = !category.is_income && !category.parent_id;
  const triggerRef = useRef(null);
  const { handleContextMenu } = useContextMenu({
    triggerRef,
    items: [
      {
        name: 'rename',
        text: t('Rename'),
        onClick: () => onEditName(category.id),
      },
      !categoryGroup?.hidden && {
        name: 'toggle-visibility',
        text: category.hidden ? t('Show') : t('Hide'),
        onClick: () => onSave({ ...category, hidden: !category.hidden }),
      },
      {
        name: 'delete',
        text: t('Delete'),
        onClick: () => onDelete(category.id),
      },
      (canHaveSubcategories || category.parent_id) && Menu.line,
      canHaveSubcategories &&
        onShowNewSubcategory && {
          name: 'add-subcategory',
          text: t('Add subcategory'),
          onClick: () => onShowNewSubcategory(category),
        },
      canHaveSubcategories &&
        validParents.length > 0 && {
          name: 'make-subcategory',
          text: t('Make subcategory of…'),
          onClick: () => setParentPickerOpen(true),
        },
      category.parent_id && {
        name: 'remove-from-parent',
        text: t('Remove from parent'),
        // The money stays where it is, so the old parent's total shrinks
        onClick: () => onSave({ ...category, parent_id: null }),
      },
    ],
  });

  const displayed = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: category.hidden || categoryGroup?.hidden ? 0.33 : undefined,
        backgroundColor: 'transparent',
        height: 20,
      }}
      ref={triggerRef}
    >
      <TextOneLine data-testid="category-name">{category.name}</TextOneLine>
      <View style={{ flexShrink: 0, marginLeft: 5 }}>
        <Button
          variant="bare"
          className="hover-visible"
          style={{ color: 'currentColor', padding: 3 }}
          onPress={handleContextMenu}
        >
          <SvgCheveronDown
            style={{ width: 'var(--icon-size-14)', height: 'var(--icon-size-14)', color: 'currentColor' }}
          />
        </Button>
      </View>
      <SidebarCategoryButtons
        category={category}
        dragging={dragging}
        goalsShown={goalsShown}
      />
      <Popover
        triggerRef={triggerRef}
        placement="bottom start"
        isOpen={parentPickerOpen}
        onOpenChange={() => setParentPickerOpen(false)}
        style={{ width: 200 }}
      >
        <Menu
          header={
            <Text style={{ padding: '5px 10px', color: theme.pageTextLight }}>
              <Trans>Move under</Trans>
            </Text>
          }
          items={validParents.map(parent => ({
            name: parent.id,
            text: parent.name,
          }))}
          onMenuSelect={parentId => {
            setParentPickerOpen(false);
            onSave({ ...category, parent_id: String(parentId) });
          }}
        />
      </Popover>
    </View>
  );

  return (
    <View
      innerRef={innerRef}
      style={{
        width: 200 + 100 * categoryExpandedState,
        overflow: 'hidden',
        '& .hover-visible': {
          display: 'none',
        },
        ...(!dragging &&
          !dragPreview && {
            '&:hover .hover-visible': {
              display: 'flex',
            },
          }),
        ...(dragging && { color: theme.pageTextSubdued }), //always visible color
        // The zIndex here forces the the view on top of a row below
        // it that may be "collapsed" and show a border on top
        ...(dragPreview && {
          backgroundColor: theme.budgetCurrentMonth,
          zIndex: 10000,
          borderRadius: 6,
          overflow: 'hidden',
        }),
        ...style,
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          onEditName(null);
          e.stopPropagation();
        }
      }}
    >
      <InputCell
        value={category.name}
        formatter={() => displayed}
        width="flex"
        exposed={editing || temporary}
        onUpdate={value => {
          if (temporary) {
            if (value === '') {
              onHideNewCategory();
            } else if (value !== '') {
              onSave({ ...category, name: value });
            }
          } else {
            if (value !== category.name) {
              onSave({ ...category, name: value });
            }
          }
        }}
        onBlur={() => onEditName(null)}
        style={{
          paddingLeft: isSubcategory ? 13 + SUBCATEGORY_INDENT : 13,
          ...(isLast && { borderBottomWidth: 0 }),
        }}
        inputProps={{
          placeholder: !temporary
            ? ''
            : isSubcategory
              ? t('New subcategory name')
              : t('New category name'),
        }}
      />
    </View>
  );
}
