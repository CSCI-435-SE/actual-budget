import * as monthUtils from '@actual-app/core/shared/months';
import type {
  RuleConditionEntity,
  SankeyWidget,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { GraphLayers } from '#components/reports/spreadsheets/sankey-spreadsheet';
import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildSankeyWidgetSettings,
  getInitialLayerRange,
  toComparableSankeySettings,
} from './sankeyWidgetSettings';
import type { SankeyWidgetSettings } from './sankeyWidgetSettings';

type Meta = NonNullable<SankeyWidget['meta']>;

const CONDITION = {
  field: 'category',
  op: 'is',
  value: 'cat-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'Where my money goes',
  conditions: [CONDITION],
  conditionsOp: 'or',
  mode: 'budgeted',
  topNcategories: 8,
  categorySort: 'global',
  showPercentages: true,
  showTransfers: true,
  groupAccounts: true,
  layerFrom: GraphLayers.Account,
  layerTo: GraphLayers.CategoryGroup,
  timeFrame: { start: '2024-01', end: '2024-06', mode: 'static' },
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildSankeyWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  graphMode: 'budgeted',
  topNcategories: 8,
  categorySort: 'global',
  showPercentages: true,
  showTransfers: true,
  groupAccounts: true,
  layerFrom: GraphLayers.Account,
  layerTo: GraphLayers.CategoryGroup,
  start: '2024-01',
  end: '2024-06',
  timeFrameMode: 'static',
});

// One different value for every setting "Save widget" writes.
const CHANGES: SankeyWidgetSettings = {
  conditions: [],
  conditionsOp: 'and',
  mode: 'spent',
  topNcategories: 15,
  categorySort: 'per-group',
  showPercentages: false,
  showTransfers: false,
  groupAccounts: false,
  layerFrom: GraphLayers.IncomeCategory,
  layerTo: GraphLayers.Category,
  timeFrame: { start: '2024-01', end: '2024-07', mode: 'static' },
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableSankeySettings(saved),
    current: toComparableSankeySettings(current),
  });
}

describe('Sankey widget settings', () => {
  it('is not modified when the settings match the saved widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each(Object.keys(CHANGES) as Array<keyof SankeyWidgetSettings>)(
    'is modified when %s changes',
    key => {
      expect(
        isModified(SAVED_META, { ...UNCHANGED, [key]: CHANGES[key] }),
      ).toBe(true);
    },
  );

  it('treats a widget without saved settings as the defaults the report opens with', () => {
    const layers = getInitialLayerRange('spent', undefined, undefined);
    const [start, end, mode] = [
      monthUtils.subMonths(monthUtils.currentMonth(), 5),
      monthUtils.currentMonth(),
      'sliding-window' as const,
    ];
    const defaults = buildSankeyWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      graphMode: 'spent',
      topNcategories: 15,
      categorySort: 'per-group',
      showPercentages: false,
      showTransfers: false,
      groupAccounts: false,
      layerFrom: layers.from,
      layerTo: layers.to,
      start,
      end,
      timeFrameMode: mode,
    });
    expect(isModified(null, defaults)).toBe(false);
    expect(isModified({ name: 'Sankey' }, defaults)).toBe(false);
  });

  it('reads saved layers that do not fit the mode the way the report does', () => {
    // The payee layer is not available in budgeted mode.
    const saved: Meta = {
      ...SAVED_META,
      layerFrom: GraphLayers.IncomePayee,
      layerTo: 'not-a-layer',
    };
    // The report opens both on the budgeted mode's default layers.
    expect(
      getInitialLayerRange('budgeted', GraphLayers.IncomePayee, 'not-a-layer'),
    ).toEqual({ from: GraphLayers.IncomeCategory, to: GraphLayers.Category });
    expect(
      isModified(saved, {
        ...UNCHANGED,
        layerFrom: GraphLayers.IncomeCategory,
        layerTo: GraphLayers.Category,
      }),
    ).toBe(false);
  });

  it('does not flag a sliding window just because time has passed', () => {
    const saved: Meta = {
      ...SAVED_META,
      timeFrame: { start: '2020-01', end: '2020-06', mode: 'sliding-window' },
    };
    const current = {
      ...UNCHANGED,
      timeFrame: {
        start: '2024-01',
        end: '2024-06',
        mode: 'sliding-window' as const,
      },
    };
    expect(isModified(saved, current)).toBe(false);
  });

  it('keeps the label after a rename that does not save the settings', () => {
    const current = { ...UNCHANGED, topNcategories: 20 };
    // Renaming writes only the name over the saved widget.
    const afterRename: Meta = { ...SAVED_META, name: 'Renamed' };
    expect(isModified(afterRename, current)).toBe(true);

    const afterSave: Meta = { ...afterRename, ...current };
    expect(isModified(afterSave, current)).toBe(false);
  });
});
