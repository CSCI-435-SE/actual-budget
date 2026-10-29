import type { CSSProperties } from 'react';

import { View } from './View';

const EMPTY_PATTERN =
  'repeating-conic-gradient(#d9d9d9 0% 25%, #ffffff 0% 50%) 50% / 8px 8px';

type ColorPreviewProps = {
  color: string | null;
  style?: CSSProperties;
};

export function ColorPreview({ color, style }: ColorPreviewProps) {
  return (
    <View
      role="img"
      aria-label={color ? `Color preview: ${color}` : 'No color preview'}
      data-testid="color-preview"
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 4,
        boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.1)',
        background: color ?? EMPTY_PATTERN,
        ...style,
      }}
    />
  );
}
