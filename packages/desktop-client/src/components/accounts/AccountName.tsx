import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import type { AccountEntity } from '@actual-app/core/types/models';

import { getColorPillColors, isHexColor } from '#util/colorPill';

type AccountNameProps = {
  account: Pick<AccountEntity, 'name' | 'color'>;
  /** Removes the vertical padding, for dense rows (sidebar, menus, rules) */
  compact?: boolean;
  style?: CSSProperties;
};

/**
 * Display-only account name. Accounts without a color render as the bare
 * name, exactly as before. Colored accounts render as a non-interactive pill,
 * so clicks still reach the parent (e.g. a table cell that opens an editor).
 */
export function AccountName({
  account,
  compact = false,
  style,
}: AccountNameProps) {
  if (!isHexColor(account.color)) {
    return account.name;
  }

  const { textColor, backgroundColor } = getColorPillColors(account.color);

  return (
    <Text
      data-testid="account-color-pill"
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        boxSizing: 'border-box',
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: compact ? '0 7px' : '3px 7px',
        borderRadius: 16,
        backgroundColor,
        color: textColor,
        ...style,
      }}
    >
      {account.name}
    </Text>
  );
}
