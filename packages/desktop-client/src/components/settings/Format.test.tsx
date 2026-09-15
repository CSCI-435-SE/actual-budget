import React from 'react';

import type { SyncedPrefs } from '@actual-app/core/types/prefs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SidebarProvider } from '#components/sidebar/SidebarProvider';
import { createTestAppStore, TestProviders } from '#mocks';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';

import { FormatSettings } from './Format';

function renderFormatSettings(prefs: SyncedPrefs = {}) {
  const store = createTestAppStore();
  store.dispatch(mergeSyncedPrefs({ numberFormat: 'comma-dot', ...prefs }));

  return render(
    <TestProviders store={store}>
      <SidebarProvider>
        <FormatSettings />
      </SidebarProvider>
    </TestProviders>,
  );
}

describe('FormatSettings', () => {
  it('shows the currency controls alongside the other formatting controls', () => {
    renderFormatSettings();

    expect(screen.getByText('Currency')).toBeInTheDocument();
    expect(screen.getByText('Symbol position')).toBeInTheDocument();
    expect(screen.getByText('Numbers')).toBeInTheDocument();
    expect(screen.getByText('Dates')).toBeInTheDocument();
    expect(screen.getByText('First day of the week')).toBeInTheDocument();
  });

  it('hides the symbol spacing option until a currency is chosen', () => {
    renderFormatSettings({ defaultCurrencyCode: '' });

    expect(
      screen.queryByLabelText('Add space between amount and symbol'),
    ).not.toBeInTheDocument();
  });

  it('offers the symbol spacing option once a currency is chosen', () => {
    renderFormatSettings({ defaultCurrencyCode: 'EUR' });

    expect(
      screen.getByLabelText('Add space between amount and symbol'),
    ).toBeInTheDocument();
  });
});
