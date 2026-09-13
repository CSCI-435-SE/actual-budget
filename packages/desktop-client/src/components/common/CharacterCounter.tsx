import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';

const WARNING_THRESHOLD = 10;

type CharacterCounterProps = {
  length: number;
  maxLength: number;
};

export function CharacterCounter({ length, maxLength }: CharacterCounterProps) {
  const remaining = maxLength - length;
  const isNearLimit = remaining <= WARNING_THRESHOLD;

  return (
    <Text
      style={{
        fontSize: '0.75em',
        color: isNearLimit ? theme.warningText : theme.pageTextLight,
      }}
    >
      {length}/{maxLength}
    </Text>
  );
}
