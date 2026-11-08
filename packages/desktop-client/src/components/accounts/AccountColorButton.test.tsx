import type { AccountEntity } from '@actual-app/core/types/models';
import { fireEvent, render, screen } from '@testing-library/react';

import { accountQueries } from '#accounts';
import { useAccount } from '#hooks/useAccount';
import { createTestQueryClient, TestProviders } from '#mocks';

import { AccountColorButton } from './AccountColorButton';

const updateAccount = vi.hoisted(() => vi.fn());

// Only the save is stubbed; the live preview still goes through the real
// accounts query cache
vi.mock('#accounts', async importOriginal => ({
  ...(await importOriginal<object>()),
  useUpdateAccountMutation: () => ({ mutate: updateAccount }),
}));

beforeEach(() => {
  updateAccount.mockClear();
});

const ACCOUNT_ID = 'account1';

// Reads the account from the query cache like the account header does, so a
// previewed color flows back into the button
function CachedAccountColorButton() {
  const account = useAccount(ACCOUNT_ID);
  return account ? <AccountColorButton account={account} /> : null;
}

function setup(color: string | null) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(accountQueries.list().queryKey, [
    { id: ACCOUNT_ID, name: 'Checking', color } as AccountEntity,
  ]);
  render(
    <TestProviders queryClient={queryClient}>
      <CachedAccountColorButton />
    </TestProviders>,
  );

  const cachedColor = () =>
    queryClient
      .getQueryData(accountQueries.list().queryKey)
      ?.find(a => a.id === ACCOUNT_ID)?.color;

  return { cachedColor };
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Change account color' }));
}

describe('AccountColorButton', () => {
  it('previews a held key on the custom picker and saves it once', () => {
    const { cachedColor } = setup('#FF0000');
    openPicker();
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick a custom color' }),
    );
    const hue = screen.getByRole('slider', { name: 'Hue' });

    fireEvent.keyDown(hue, { key: 'PageUp' });
    fireEvent.keyDown(hue, { key: 'PageUp', repeat: true });
    fireEvent.keyDown(hue, { key: 'PageUp', repeat: true });

    const previewed = cachedColor();
    expect(previewed).not.toBe('#FF0000');
    expect(updateAccount).not.toHaveBeenCalled();

    fireEvent.keyUp(hue, { key: 'PageUp' });

    expect(updateAccount).toHaveBeenCalledTimes(1);
    expect(updateAccount).toHaveBeenCalledWith({
      account: { id: ACCOUNT_ID, color: previewed },
    });
  });

  it('saves a picked swatch', () => {
    setup(null);
    openPicker();

    const swatch = screen
      .getAllByRole('option')
      .find(option => option.dataset.key?.startsWith('#D32F2F'));
    if (!swatch) {
      throw new Error('Swatch #D32F2F not found');
    }
    fireEvent.click(swatch);

    expect(updateAccount).toHaveBeenCalledTimes(1);
    expect(updateAccount).toHaveBeenCalledWith({
      account: { id: ACCOUNT_ID, color: '#D32F2F' },
    });
  });

  it('removes the color from the picker footer', () => {
    setup('#1E88E5');
    openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Remove color' }));

    expect(updateAccount).toHaveBeenCalledTimes(1);
    expect(updateAccount).toHaveBeenCalledWith({
      account: { id: ACCOUNT_ID, color: null },
    });
  });

  it('hides "Remove color" when the account has no color', () => {
    setup(null);
    openPicker();

    expect(screen.getByRole('textbox', { name: 'Hex color' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove color' })).toBeNull();
  });
});
