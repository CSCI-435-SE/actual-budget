import type {
  FormulaWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  DEFAULT_FORMULA,
  DEFAULT_STATIC_FONT_SIZE,
  toComparableFormulaSettings,
} from './formulaWidgetSettings';
import type { FormulaWidgetSettings } from './formulaWidgetSettings';

type Meta = NonNullable<FormulaWidget['meta']>;

const CONDITION = {
  field: 'account',
  op: 'is',
  value: 'acct-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'Groceries this month',
  formula: '=QUERY("groceries")',
  queries: {
    groceries: {
      conditions: [CONDITION],
      conditionsOp: 'or',
      timeFrame: { start: '2024-01-01', end: '2024-01-31', mode: 'static' },
    },
  },
  fontSizeMode: 'static',
  staticFontSize: 48,
  showTitle: false,
  colorFormula: '=IF(RESULT < 0, "red", "green")',
};

// What the report holds after opening SAVED_META.
const UNCHANGED: FormulaWidgetSettings = {
  formula: '=QUERY("groceries")',
  queries: {
    groceries: {
      conditions: [CONDITION],
      conditionsOp: 'or',
      timeFrame: { start: '2024-01-01', end: '2024-01-31', mode: 'static' },
    },
  },
  fontSizeMode: 'static',
  staticFontSize: 48,
  showTitle: false,
  colorFormula: '=IF(RESULT < 0, "red", "green")',
};

// One different value for every setting "Save widget" writes.
const CHANGES: FormulaWidgetSettings = {
  formula: '=QUERY("groceries") * 2',
  queries: {},
  fontSizeMode: 'dynamic',
  staticFontSize: 24,
  showTitle: true,
  colorFormula: '',
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableFormulaSettings(saved),
    current: toComparableFormulaSettings(current),
  });
}

describe('Formula widget settings', () => {
  it('is not modified when the settings match the saved widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each(Object.keys(CHANGES) as Array<keyof FormulaWidgetSettings>)(
    'is modified when %s changes',
    key => {
      expect(
        isModified(SAVED_META, { ...UNCHANGED, [key]: CHANGES[key] }),
      ).toBe(true);
    },
  );

  it('is modified while the formula text is being edited', () => {
    expect(
      isModified(SAVED_META, { ...UNCHANGED, formula: '=QUERY("groceries' }),
    ).toBe(true);
  });

  it('is modified when a query changes', () => {
    expect(
      isModified(SAVED_META, {
        ...UNCHANGED,
        queries: {
          groceries: { ...UNCHANGED.queries.groceries, conditionsOp: 'and' },
        },
      }),
    ).toBe(true);
    expect(
      isModified(SAVED_META, {
        ...UNCHANGED,
        queries: {
          ...UNCHANGED.queries,
          rent: { conditions: [], conditionsOp: 'and' },
        },
      }),
    ).toBe(true);
  });

  it('is not modified after changing a setting back', () => {
    const edited = { ...UNCHANGED, formula: CHANGES.formula };
    expect(isModified(SAVED_META, edited)).toBe(true);
    expect(
      isModified(SAVED_META, { ...edited, formula: UNCHANGED.formula }),
    ).toBe(false);
  });

  it('treats a widget without saved settings as the defaults the report opens with', () => {
    const defaults: FormulaWidgetSettings = {
      formula: DEFAULT_FORMULA,
      queries: {},
      fontSizeMode: 'dynamic',
      staticFontSize: DEFAULT_STATIC_FONT_SIZE,
      showTitle: true,
      colorFormula: '',
    };
    expect(isModified(null, defaults)).toBe(false);
    expect(isModified({ name: 'New formula' }, defaults)).toBe(false);
    // The report opens an empty formula or a zero font size as the default.
    expect(isModified({ formula: '', staticFontSize: 0 }, defaults)).toBe(
      false,
    );
  });

  it('fills in query fields the query editor would show', () => {
    const saved: Meta = {
      ...SAVED_META,
      queries: { groceries: { conditions: [CONDITION] } },
    };
    const current = {
      ...UNCHANGED,
      queries: { groceries: { conditions: [CONDITION], conditionsOp: 'and' } },
    } satisfies Partial<Meta>;
    expect(isModified(saved, current)).toBe(false);
  });

  it('follows the saved widget after renaming, which also saves the settings', () => {
    const current = { ...UNCHANGED, formula: CHANGES.formula };
    expect(isModified(SAVED_META, current)).toBe(true);

    // Renaming a Formula widget writes the name and the current settings.
    const afterRename: Meta = { ...SAVED_META, name: 'Renamed', ...current };
    expect(isModified(afterRename, current)).toBe(false);
  });

  it('ignores the widget name', () => {
    expect(isModified({ ...SAVED_META, name: 'Other name' }, UNCHANGED)).toBe(
      false,
    );
  });
});
