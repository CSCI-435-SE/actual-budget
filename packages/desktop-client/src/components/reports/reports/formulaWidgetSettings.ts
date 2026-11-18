import * as monthUtils from '@actual-app/core/shared/months';
import type { FormulaWidget } from '@actual-app/core/types/models';

import { toComparableConditions } from '#components/reports/widgetModified';

type FormulaMeta = NonNullable<FormulaWidget['meta']>;
type FormulaQueries = NonNullable<FormulaMeta['queries']>;

export const DEFAULT_FORMULA = '=SUM(1, 2, 3)';
export const DEFAULT_STATIC_FONT_SIZE = 32;

/** The settings "Save widget" (and renaming) writes for a Formula widget. */
export type FormulaWidgetSettings = Required<
  Pick<
    FormulaMeta,
    | 'formula'
    | 'queries'
    | 'fontSizeMode'
    | 'staticFontSize'
    | 'showTitle'
    | 'colorFormula'
  >
>;

function toComparableQueries(queries: FormulaQueries | undefined) {
  // Mirrors the fallbacks the query editor uses when it opens a query, so a
  // query saved without some fields compares equal to what it shows.
  return Object.fromEntries(
    Object.entries(queries ?? {}).map(([name, query]) => [
      name,
      {
        ...toComparableConditions(query.conditions, query.conditionsOp),
        timeFrame: {
          start:
            query.timeFrame?.start ||
            monthUtils.dayFromDate(monthUtils.currentMonth()),
          end: query.timeFrame?.end || monthUtils.currentDay(),
          mode: query.timeFrame?.mode || 'sliding-window',
        },
      },
    ]),
  );
}

export function toComparableFormulaSettings(
  meta: Partial<FormulaMeta> | null | undefined,
) {
  // Same `||` fallbacks the report uses when it opens, so an empty formula
  // or a zero font size reads as the default on both sides.
  return {
    formula: meta?.formula || DEFAULT_FORMULA,
    queries: toComparableQueries(meta?.queries),
    fontSizeMode: meta?.fontSizeMode || 'dynamic',
    staticFontSize: meta?.staticFontSize || DEFAULT_STATIC_FONT_SIZE,
    showTitle: meta?.showTitle ?? true,
    colorFormula: meta?.colorFormula || '',
  };
}
