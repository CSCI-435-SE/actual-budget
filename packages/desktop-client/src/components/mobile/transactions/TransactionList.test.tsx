import { createRef } from 'react';
import { MemoryRouter } from 'react-router';

import { generateAccount } from '@actual-app/core/mocks';
import { initServer } from '@actual-app/core/platform/client/connection';
import type { TransactionAttachmentCount } from '@actual-app/core/shared/attachments';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { render, screen, waitFor } from '@testing-library/react';

import { SchedulesProvider } from '#hooks/useCachedSchedules';
import { DisplayPayeeProvider } from '#hooks/useDisplayPayee';
import { ScrollProvider } from '#hooks/useScrollListener';
import { SelectedProviderWithItems } from '#hooks/useSelected';
import { SpreadsheetProvider } from '#hooks/useSpreadsheet';
import { createTestQueryClient, TestProviders } from '#mocks';

import { TransactionList } from './TransactionList';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: vi.fn().mockReturnValue([undefined, vi.fn()]),
}));
vi.mock('#hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => false),
}));

const account = generateAccount('Checking');

let attachmentCounts: TransactionAttachmentCount[];

function makeTransaction(
  fields: Partial<TransactionEntity> & Pick<TransactionEntity, 'id'>,
): TransactionEntity {
  return {
    account: account.id,
    amount: -1000,
    date: '2026-11-13',
    payee: null,
    category: null,
    cleared: false,
    reconciled: false,
    sort_order: 0,
    ...fields,
  } as TransactionEntity;
}

const transactions: TransactionEntity[] = [
  makeTransaction({ id: 'plain', notes: 'Plain' }),
  makeTransaction({ id: 'none', notes: 'Nothing attached' }),
  makeTransaction({ id: 'parent', notes: 'Dinner out', is_parent: true }),
  makeTransaction({
    id: 'child',
    notes: 'My share',
    is_child: true,
    parent_id: 'parent',
  }),
  makeTransaction({ id: 'preview/plain', notes: 'Upcoming' }),
];

function renderList() {
  return render(
    <MemoryRouter>
      <TestProviders queryClient={createTestQueryClient()}>
        <SpreadsheetProvider>
          <SchedulesProvider>
            <SelectedProviderWithItems
              name="transactions"
              items={transactions}
              fetchAllIds={async () => transactions.map(t => t.id)}
            >
              <DisplayPayeeProvider transactions={transactions}>
                <ScrollProvider scrollableRef={createRef<HTMLDivElement>()}>
                  <TransactionList
                    isLoading={false}
                    transactions={transactions}
                    isLoadingMore={false}
                    onLoadMore={vi.fn()}
                  />
                </ScrollProvider>
              </DisplayPayeeProvider>
            </SelectedProviderWithItems>
          </SchedulesProvider>
        </SpreadsheetProvider>
      </TestProviders>
    </MemoryRouter>,
  );
}

// The row (a button) that shows the given note
function row(note: string) {
  const button = screen.getByText(note).closest('[role="button"], button');
  if (!button) {
    throw new Error(`no row for ${note}`);
  }
  return button as HTMLElement;
}

function hasPaperclip(note: string) {
  return row(note).querySelector('[data-testid="attachment-icon"]') != null;
}

beforeEach(() => {
  attachmentCounts = [];
  initServer({
    query: async (query: { table: string }) => {
      switch (query.table) {
        case 'transaction_attachments':
          return { data: attachmentCounts, dependencies: [] };
        case 'schedules':
        case 'transactions':
        case 'payees':
        case 'categories':
        case 'category_groups':
          return { data: [], dependencies: [] };
        case 'accounts':
          return { data: [account], dependencies: [] };
        default:
          throw new Error(`queried unknown table: ${query.table}`);
      }
    },
    'get-categories': async () => ({ grouped: [], list: [] }),
  });
});

describe('TransactionList', () => {
  it('shows a paperclip on transactions with attachments', async () => {
    attachmentCounts = [
      { transaction_id: 'plain', count: 1 },
      { transaction_id: 'parent', count: 2 },
    ];
    renderList();

    await waitFor(() =>
      expect(screen.getAllByTestId('attachment-icon')).toHaveLength(2),
    );
    expect(hasPaperclip('Plain')).toBe(true);
    expect(hasPaperclip('Dinner out')).toBe(true);
    expect(hasPaperclip('Nothing attached')).toBe(false);
    expect(
      screen.getAllByTestId('attachment-icon').map(icon => icon.ariaLabel),
    ).toEqual(['1 attachment', '2 attachments']);
  });

  it("doesn't show one on split children or previews", async () => {
    // As if the counts listed them; the list must still leave them out
    attachmentCounts = [
      { transaction_id: 'parent', count: 1 },
      { transaction_id: 'child', count: 1 },
      { transaction_id: 'preview/plain', count: 1 },
    ];
    renderList();

    await waitFor(() => expect(hasPaperclip('Dinner out')).toBe(true));
    expect(hasPaperclip('My share')).toBe(false);
    expect(hasPaperclip('Upcoming')).toBe(false);
  });

  it('adds no text to the row', async () => {
    attachmentCounts = [{ transaction_id: 'plain', count: 1 }];
    renderList();

    await screen.findByTestId('attachment-icon');
    expect(row('Plain').textContent).not.toMatch(/attachment/i);
  });
});
