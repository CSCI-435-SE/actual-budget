import type { RuleEntity } from '@actual-app/core/types/models';

import { duplicateRule } from '#util/rule';

const rule: RuleEntity = {
  id: 'rule-1',
  stage: 'pre',
  conditionsOp: 'or',
  conditions: [{ field: 'payee', op: 'is', value: 'payee-1', type: 'id' }],
  actions: [{ op: 'set', field: 'category', value: 'cat-1', type: 'id' }],
};

describe('duplicateRule', () => {
  it('copies the rule options without its id', () => {
    const copy = duplicateRule(rule);

    expect(copy).not.toHaveProperty('id');
    expect(copy).toEqual({
      stage: 'pre',
      conditionsOp: 'or',
      conditions: rule.conditions,
      actions: rule.actions,
    });
  });

  it('does not share conditions or actions with the original', () => {
    const copy = duplicateRule(rule);

    expect(copy.conditions).not.toBe(rule.conditions);
    expect(copy.conditions[0]).not.toBe(rule.conditions[0]);
    expect(copy.actions).not.toBe(rule.actions);
    expect(copy.actions[0]).not.toBe(rule.actions[0]);
  });

  it('drops the schedule link but keeps the other actions', () => {
    const copy = duplicateRule({
      ...rule,
      actions: [
        { op: 'link-schedule', value: 'schedule-1' },
        { op: 'set', field: 'notes', value: 'rent', type: 'string' },
      ],
    });

    expect(copy.conditions).toEqual(rule.conditions);
    expect(copy.actions).toEqual([
      { op: 'set', field: 'notes', value: 'rent', type: 'string' },
    ]);
  });

  it('adds a blank category action when the schedule link was the only action', () => {
    const copy = duplicateRule({
      ...rule,
      actions: [{ op: 'link-schedule', value: 'schedule-1' }],
    });

    expect(copy.actions).toEqual([
      { op: 'set', field: 'category', value: null, type: 'id' },
    ]);
  });
});
