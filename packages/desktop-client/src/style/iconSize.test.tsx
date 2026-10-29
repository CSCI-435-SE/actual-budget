import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createTestAppStore, TestProviders } from '#mocks';
import { mergeGlobalPrefs } from '#prefs/prefsSlice';

import { IconSizeStyle, scaledIconSize } from './iconSize';

// jsdom does not evaluate calc() or var(), so resolve the expression that
// scaledIconSize produces the same way a browser would.
function resolveIconSizePx(cssLength: string, iconScale: number) {
  const match = cssLength.match(
    /^calc\((\d+(?:\.\d+)?)px \* var\(--icon-scale, 1\)\)$/,
  );
  if (!match) {
    throw new Error(`Unexpected icon size expression: ${cssLength}`);
  }
  return Number(match[1]) * iconScale;
}

function readIconScale() {
  const css = document.getElementById('icon-size-scale')?.textContent ?? '';
  const match = css.match(/--icon-scale:\s*([\d.]+);/);
  if (!match) {
    throw new Error(`--icon-scale not found in: ${css}`);
  }
  return Number(match[1]);
}

function renderIconSizeStyle(iconSize?: string) {
  const store = createTestAppStore();
  if (iconSize !== undefined) {
    store.dispatch(mergeGlobalPrefs({ iconSize }));
  }
  render(
    <TestProviders store={store}>
      <IconSizeStyle />
    </TestProviders>,
  );
  return store;
}

describe('scaledIconSize', () => {
  it('builds a calc() expression from the base size and --icon-scale', () => {
    expect(scaledIconSize(15)).toBe('calc(15px * var(--icon-scale, 1))');
  });

  it('defaults to a scale of 1 when --icon-scale is not set', () => {
    expect(scaledIconSize(13)).toContain('var(--icon-scale, 1)');
  });
});

describe('IconSizeStyle', () => {
  it.each([
    ['0.75', 0.75],
    ['1', 1],
    ['1.25', 1.25],
    ['1.5', 1.5],
  ])('sets --icon-scale to %s for that preference', (iconSize, expected) => {
    renderIconSizeStyle(iconSize);

    expect(readIconScale()).toBe(expected);
  });

  it('falls back to a scale of 1 when the preference is not set', () => {
    renderIconSizeStyle();

    expect(readIconScale()).toBe(1);
  });

  it('falls back to a scale of 1 when the preference is not a number', () => {
    renderIconSizeStyle('not-a-number');

    expect(readIconScale()).toBe(1);
  });

  it('updates --icon-scale when the preference changes', async () => {
    const store = renderIconSizeStyle('1');

    store.dispatch(mergeGlobalPrefs({ iconSize: '1.5' }));

    await expect.poll(readIconScale).toBe(1.5);
  });
});

describe('icon pixel sizes', () => {
  // Expected sizes for each settings option, for a range of base sizes used
  // across the app (e.g. 8px clear button, 13px search, 15px sidebar).
  it.each([
    { iconSize: '0.75', base: 8, px: 6 },
    { iconSize: '0.75', base: 13, px: 9.75 },
    { iconSize: '0.75', base: 15, px: 11.25 },
    { iconSize: '1', base: 8, px: 8 },
    { iconSize: '1', base: 13, px: 13 },
    { iconSize: '1', base: 15, px: 15 },
    { iconSize: '1.25', base: 8, px: 10 },
    { iconSize: '1.25', base: 13, px: 16.25 },
    { iconSize: '1.25', base: 15, px: 18.75 },
    { iconSize: '1.5', base: 8, px: 12 },
    { iconSize: '1.5', base: 13, px: 19.5 },
    { iconSize: '1.5', base: 15, px: 22.5 },
  ])(
    'renders a $base px icon at $px px when icon size is $iconSize',
    ({ iconSize, base, px }) => {
      renderIconSizeStyle(iconSize);

      expect(resolveIconSizePx(scaledIconSize(base), readIconScale())).toBe(px);
    },
  );
});
