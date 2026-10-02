import type { ReactNode } from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { InitialEntry } from 'react-router';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useEscapeToReportsOverview } from './useEscapeToReportsOverview';

function DrillDownReport({ children }: { children?: ReactNode }) {
  useEscapeToReportsOverview();
  return children;
}

function renderAt(initialEntries: InitialEntry[], reportChildren?: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/reports', element: <div>Overview</div> },
      { path: '/reports/:dashboardId', element: <div>Dashboard</div> },
      {
        path: '/reports/net-worth',
        element: <DrillDownReport>{reportChildren}</DrillDownReport>,
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );

  render(
    <HotkeysProvider initiallyActiveScopes={['app']}>
      <RouterProvider router={router} />
    </HotkeysProvider>,
  );

  return () => router.state.location.pathname;
}

describe('useEscapeToReportsOverview', () => {
  it('returns to the dashboard the report was opened from', async () => {
    const currentPath = renderAt([
      '/reports/my-dashboard',
      { pathname: '/reports/net-worth', state: { goBack: true } },
    ]);

    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports/my-dashboard');
  });

  it('goes to the reports overview when the report was opened directly', async () => {
    const currentPath = renderAt(['/reports/net-worth']);

    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports');
  });

  it('does nothing while a popover is open', async () => {
    const currentPath = renderAt(
      ['/reports/net-worth'],
      <div data-popover>Menu</div>,
    );

    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports/net-worth');
  });

  it('does nothing while a modal is open', async () => {
    const currentPath = renderAt(
      ['/reports/net-worth'],
      // Mirrors the markup react-aria's Dialog renders inside our Modal
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      <div role="dialog">Modal</div>,
    );

    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports/net-worth');
  });

  it('does nothing while an input is focused', async () => {
    const currentPath = renderAt(
      ['/reports/net-worth'],
      <input aria-label="Report name" />,
    );

    await userEvent.click(screen.getByLabelText('Report name'));
    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports/net-worth');
  });

  it('does nothing when another handler already consumed Escape', async () => {
    const currentPath = renderAt(
      ['/reports/net-worth'],
      <button
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
          }
        }}
      >
        Toggle
      </button>,
    );

    screen.getByRole('button', { name: 'Toggle' }).focus();
    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports/net-worth');
  });

  it('does nothing on the reports overview', async () => {
    const currentPath = renderAt(['/reports']);

    await userEvent.keyboard('{Escape}');

    expect(currentPath()).toBe('/reports');
  });
});
