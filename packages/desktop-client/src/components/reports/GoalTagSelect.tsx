import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';

import { useTags } from '#hooks/useTags';

const NO_TAG = '';

type GoalTagSelectProps = {
  id?: string;
  value?: string;
  onChange: (tag: string | undefined) => void;
  style?: CSSProperties;
};

export function GoalTagSelect({
  id,
  value,
  onChange,
  style,
}: GoalTagSelectProps) {
  const { t } = useTranslation();
  const { data: tags = [] } = useTags();

  const tagNames = tags.map(tag => tag.tag);
  // Keep showing a linked tag even if it was since hidden or deleted.
  if (value && !tagNames.includes(value)) {
    tagNames.push(value);
  }

  return (
    <Select
      id={id}
      value={value ?? NO_TAG}
      options={[
        [NO_TAG, t('No tag')],
        ...tagNames.map(tag => [tag, `#${tag}`] as const),
      ]}
      onChange={newValue =>
        onChange(newValue === NO_TAG ? undefined : newValue)
      }
      style={style}
    />
  );
}
