import type { CSSProperties, ReactNode } from 'react';

import { View } from './View';

type FormErrorProps = {
  style?: CSSProperties;
  children?: ReactNode;
};

export function FormError({ style, children }: FormErrorProps) {
  return (
    <View style={{ color: 'red', fontSize: 'var(--font-size-13)', ...style }}>{children}</View>
  );
}
