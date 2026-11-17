import type {
  RuleConditionEntity,
  SummaryContent,
  SummaryWidget,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type SummaryMeta = NonNullable<SummaryWidget['meta']>;

export type SummaryWidgetSettings = Required<
  Pick<SummaryMeta, 'conditions' | 'conditionsOp' | 'timeFrame' | 'content'>
>;

const DEFAULT_SUMMARY_CONTENT: SummaryContent = {
  type: 'sum',
  divisorAllTimeDateRange: false,
  divisorConditions: [],
  divisorConditionsOp: 'and',
} as SummaryContent;

/** Reads the saved "Show as" settings, falling back to a plain sum. */
export function parseSummaryContent(content?: string): SummaryContent {
  if (!content) {
    return DEFAULT_SUMMARY_CONTENT;
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse widget meta content:', error);
    return DEFAULT_SUMMARY_CONTENT;
  }
}

/** The settings "Save widget" writes for a Summary widget. */
export function buildSummaryWidgetSettings({
  conditions,
  conditionsOp,
  start,
  end,
  mode,
  content,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  start: string;
  end: string;
  mode: TimeFrame['mode'];
  content: SummaryContent;
}): SummaryWidgetSettings {
  return {
    conditions,
    conditionsOp,
    timeFrame: { start, end, mode },
    content: JSON.stringify(content),
  };
}

function toComparableSummaryContent(content?: string) {
  const parsed = parseSummaryContent(content);
  if (parsed.type !== 'percentage') {
    // The divisor settings only apply to percentages, and the report resets
    // the divisor filters when it opens with any other type.
    return { type: parsed.type ?? 'sum', fontSize: parsed.fontSize };
  }
  const divisor = toComparableConditions(
    parsed.divisorConditions,
    parsed.divisorConditionsOp,
  );
  return {
    type: parsed.type,
    fontSize: parsed.fontSize,
    divisorConditions: divisor.conditions,
    divisorConditionsOp: divisor.conditionsOp,
    divisorAllTimeDateRange: parsed.divisorAllTimeDateRange ?? false,
  };
}

export function toComparableSummarySettings(
  meta: Partial<SummaryMeta> | null | undefined,
) {
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    // Without a saved time frame the report shows all time.
    timeFrame: toComparableTimeFrame(meta?.timeFrame, { mode: 'full' }),
    content: toComparableSummaryContent(meta?.content),
  };
}
