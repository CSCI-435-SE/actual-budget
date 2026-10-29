import { MemoryRouter } from 'react-router';

import type { GlobalPrefs } from '@actual-app/core/types/prefs';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FiltersButton } from '#components/filters/FiltersButton';
import { createTestAppStore, TestProviders } from '#mocks';
import { mergeGlobalPrefs } from '#prefs/prefsSlice';
import { IconSizeStyle } from '#style';

import { IconSizeSettings } from './IconSizeSettings';

const { mockSaveGlobalPref } = vi.hoisted(() => ({
  mockSaveGlobalPref: vi.fn(),
}));

// The real hook saves through a backend thunk that the test setup binds
// before this file's mocks apply. Replace only that save step: values are
// still read from and written to the real test Redux store, so
// IconSizeStyle and the icons react exactly as they do in the app.
vi.mock('#hooks/useGlobalPref', async () => {
  const { useDispatch, useSelector } = await import('#redux');
  const prefsSlice = await import('#prefs/prefsSlice');
  return {
    useGlobalPref: <K extends keyof GlobalPrefs>(prefName: K) => {
      const dispatch = useDispatch();
      const value = useSelector(state => state.prefs.global?.[prefName]);
      const setValue = (newValue: GlobalPrefs[K]) => {
        mockSaveGlobalPref({ [prefName]: newValue });
        dispatch(prefsSlice.mergeGlobalPrefs({ [prefName]: newValue }));
      };
      return [value, setValue];
    },
  };
});

function renderSettingsWithIcon(iconSize?: string) {
  const store = createTestAppStore();
  if (iconSize !== undefined) {
    store.dispatch(mergeGlobalPrefs({ iconSize }));
  }
  render(
    <TestProviders store={store}>
      <MemoryRouter>
        <IconSizeStyle />
        <IconSizeSettings />
        <FiltersButton onPress={vi.fn()} />
      </MemoryRouter>
    </TestProviders>,
  );
  return store;
}

function readIconScale() {
  const css = document.getElementById('icon-size-scale')?.textContent ?? '';
  return Number(css.match(/--icon-scale:\s*([\d.]+);/)?.[1]);
}

// The filter icon's 12px base size, resolved against the current
// --icon-scale the way a browser would (jsdom does not evaluate calc()).
function filterIconPx() {
  const icon = screen
    .getByRole('button', { name: 'Filter' })
    .querySelector('svg');
  const style = icon?.getAttribute('style') ?? '';
  const base = Number(
    style.match(/width:\s*calc\((\d+(?:\.\d+)?)px \* var\(--icon-scale/)?.[1],
  );
  return base * readIconScale();
}

// Select does not forward aria-label, so find its button by the label of
// the option it currently shows.
function iconSizeSelect(currentLabel: string) {
  return screen.getByRole('button', { name: currentLabel });
}

async function chooseIconSize(currentLabel: string, label: string) {
  const user = userEvent.setup();
  await user.click(iconSizeSelect(currentLabel));
  const menu = await screen.findByRole('menu');
  await user.click(within(menu).getByText(label));
}

describe('IconSizeSettings', () => {
  beforeEach(() => {
    mockSaveGlobalPref.mockReset();
  });

  it('shows Medium (Default) when no icon size has been chosen', () => {
    renderSettingsWithIcon();

    expect(iconSizeSelect('Medium (Default)')).toBeInTheDocument();
  });

  it('shows the saved icon size as the current choice', () => {
    renderSettingsWithIcon('1.5');

    expect(iconSizeSelect('Extra Large')).toBeInTheDocument();
  });

  it.each([
    ['Small', '0.75'],
    ['Large', '1.25'],
    ['Extra Large', '1.5'],
  ])('saves %s as an icon size of %s', async (label, iconSize) => {
    const store = renderSettingsWithIcon();

    await chooseIconSize('Medium (Default)', label);

    expect(mockSaveGlobalPref).toHaveBeenCalledWith({ iconSize });
    expect(store.getState().prefs.global.iconSize).toBe(iconSize);
  });

  it('renders icons at their default size before a choice is made', () => {
    renderSettingsWithIcon();

    expect(filterIconPx()).toBe(12);
  });

  it.each([
    ['Small', 9],
    ['Large', 15],
    ['Extra Large', 18],
  ])('resizes icons in the UI when %s is chosen', async (label, px) => {
    renderSettingsWithIcon();

    await chooseIconSize('Medium (Default)', label);

    await waitFor(() => expect(filterIconPx()).toBe(px));
  });

  it('returns icons to their default size when Medium is chosen again', async () => {
    renderSettingsWithIcon('1.5');
    expect(filterIconPx()).toBe(18);

    await chooseIconSize('Extra Large', 'Medium (Default)');

    await waitFor(() => expect(filterIconPx()).toBe(12));
  });
});
