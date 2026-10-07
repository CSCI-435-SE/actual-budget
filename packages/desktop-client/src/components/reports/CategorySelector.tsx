// @ts-strict-ignore
import React, { Fragment, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheckAll,
  SvgUncheckAll,
  SvgViewHide,
  SvgViewShow,
} from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { getCategoryRows } from '#components/budget/util';
import { Checkbox } from '#components/forms';

import { GraphButton } from './GraphButton';

// Matches the subcategory indent on the budget page.
const SUBCATEGORY_INDENT = 16;

type CategorySelectorProps = {
  categoryGroups: Array<CategoryGroupEntity>;
  selectedCategories: CategoryEntity[];
  setSelectedCategories: (selectedCategories: CategoryEntity[]) => void;
  showHiddenCategories?: boolean;
};

export function CategorySelector({
  categoryGroups,
  selectedCategories,
  setSelectedCategories,
  showHiddenCategories = true,
}: CategorySelectorProps) {
  const { t } = useTranslation();
  const [uncheckedHidden, setUncheckedHidden] = useState(false);
  // Listed like the budget page: each subcategory under its parent, and a
  // hidden parent hides its subcategories too.
  const categoryRows = (categoryGroup: CategoryGroupEntity) =>
    getCategoryRows(categoryGroup.categories, showHiddenCategories);
  const filteredGroup = (categoryGroup: CategoryGroupEntity) =>
    categoryRows(categoryGroup).map(row => row.category);

  const selectAll: CategoryEntity[] = [];
  categoryGroups.map(categoryGroup =>
    filteredGroup(categoryGroup).map(category => selectAll.push(category)),
  );

  if (selectedCategories === undefined) {
    selectedCategories = categoryGroups.flatMap(cg => cg.categories);
  }

  const selectedCategoryMap = useMemo(
    () => selectedCategories.map(selected => selected.id),
    [selectedCategories],
  );

  const allCategoriesSelected = selectAll.every(category =>
    selectedCategoryMap.includes(category.id),
  );

  const allCategoriesUnselected = !selectAll.some(category =>
    selectedCategoryMap.includes(category.id),
  );

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 5,
          flexShrink: 0,
        }}
      >
        <Button
          variant="bare"
          onPress={() => setUncheckedHidden(state => !state)}
          style={{ padding: 8 }}
        >
          <View>
            {uncheckedHidden ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SvgViewShow
                  width={15}
                  height={15}
                  style={{ marginRight: 5 }}
                />
                <Text>
                  <Trans>Show unchecked</Trans>
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <SvgViewHide
                  width={15}
                  height={15}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={{
                    maxWidth: 100,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <Trans>Hide unchecked</Trans>
                </Text>
              </View>
            )}
          </View>
        </Button>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GraphButton
            selected={allCategoriesSelected}
            title={t('Select All')}
            onSelect={() => {
              setSelectedCategories(selectAll);
            }}
            style={{ marginRight: 5, padding: 8 }}
          >
            <SvgCheckAll width={15} height={15} />
          </GraphButton>
          <GraphButton
            selected={allCategoriesUnselected}
            title={t('Unselect All')}
            onSelect={() => {
              setSelectedCategories([]);
            }}
            style={{ padding: 8 }}
          >
            <SvgUncheckAll width={15} height={15} />
          </GraphButton>
        </View>
      </View>

      <ul
        style={{
          listStyle: 'none',
          marginLeft: 0,
          paddingLeft: 0,
          paddingRight: 10,
          flexGrow: 1,
          overflowY: 'auto',
        }}
      >
        {categoryGroups &&
          categoryGroups.map(categoryGroup => {
            const allCategoriesInGroupSelected = filteredGroup(
              categoryGroup,
            ).every(category =>
              selectedCategories.some(
                selectedCategory => selectedCategory.id === category.id,
              ),
            );
            const noCategorySelected = filteredGroup(categoryGroup).every(
              category =>
                !selectedCategories.some(
                  selectedCategory => selectedCategory.id === category.id,
                ),
            );
            return (
              <Fragment key={categoryGroup.id}>
                <li
                  style={{
                    display:
                      noCategorySelected && uncheckedHidden ? 'none' : 'flex',
                    marginBottom: 8,
                    flexDirection: 'row',
                  }}
                >
                  <Checkbox
                    id={`form_${categoryGroup.id}`}
                    checked={allCategoriesInGroupSelected}
                    onChange={() => {
                      const selectedCategoriesExcludingGroupCategories =
                        selectedCategories.filter(
                          selectedCategory =>
                            !filteredGroup(categoryGroup).some(
                              groupCategory =>
                                groupCategory.id === selectedCategory.id,
                            ),
                        );
                      if (allCategoriesInGroupSelected) {
                        setSelectedCategories(
                          selectedCategoriesExcludingGroupCategories,
                        );
                      } else {
                        setSelectedCategories(
                          selectedCategoriesExcludingGroupCategories.concat(
                            filteredGroup(categoryGroup),
                          ),
                        );
                      }
                    }}
                  />
                  <label
                    htmlFor={`form_${categoryGroup.id}`}
                    style={{ userSelect: 'none', fontWeight: 'bold' }}
                  >
                    {categoryGroup.name}
                  </label>
                </li>
                <li>
                  <ul
                    style={{
                      listStyle: 'none',
                      marginLeft: 0,
                      marginBottom: 10,
                      paddingLeft: 10,
                    }}
                  >
                    {categoryRows(categoryGroup).map(
                      ({ category, isSubcategory }, _, rows) => {
                        const isChecked = selectedCategories.some(
                          selectedCategory =>
                            selectedCategory.id === category.id,
                        );
                        // Ticking a parent ticks its subcategories too
                        const family = [
                          category,
                          ...rows
                            .filter(
                              row =>
                                row.isSubcategory &&
                                row.category.parent_id === category.id,
                            )
                            .map(row => row.category),
                        ];
                        const familyIds = new Set(family.map(cat => cat.id));
                        return (
                          <li
                            key={category.id}
                            style={{
                              display:
                                !isChecked && uncheckedHidden ? 'none' : 'flex',
                              flexDirection: 'row',
                              marginBottom: 4,
                              paddingLeft: isSubcategory
                                ? SUBCATEGORY_INDENT
                                : 0,
                            }}
                          >
                            <Checkbox
                              id={`form_${category.id}`}
                              checked={isChecked}
                              onChange={() => {
                                const others = selectedCategories.filter(
                                  selectedCategory =>
                                    !familyIds.has(selectedCategory.id),
                                );
                                setSelectedCategories(
                                  isChecked ? others : [...others, ...family],
                                );
                              }}
                            />
                            <label
                              htmlFor={`form_${category.id}`}
                              style={{ userSelect: 'none' }}
                            >
                              {category.name}
                            </label>
                          </li>
                        );
                      },
                    )}
                  </ul>
                </li>
              </Fragment>
            );
          })}
      </ul>
    </View>
  );
}
