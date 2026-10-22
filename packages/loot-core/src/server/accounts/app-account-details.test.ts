import { app as accountsApp } from '#server/accounts/app';
import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

async function getAccount(id: string) {
  const accounts = await accountsApp.handlers['accounts-get']();
  return accounts.find(account => account.id === id);
}

describe('account color and description', () => {
  it('defaults both to null', async () => {
    await db.insertAccount({ id: 'acct1', name: 'Checking' });

    expect(await getAccount('acct1')).toMatchObject({
      color: null,
      description: null,
    });
  });

  it('persists, survives a rename, and clears with null', async () => {
    await db.insertAccount({ id: 'acct1', name: 'Checking' });

    await accountsApp.handlers['account-update']({
      id: 'acct1',
      color: '#1E88E5',
      description: 'Joint account',
    });
    expect(await getAccount('acct1')).toMatchObject({
      color: '#1E88E5',
      description: 'Joint account',
    });

    await accountsApp.handlers['account-update']({ id: 'acct1', name: 'Main' });
    expect(await getAccount('acct1')).toMatchObject({
      name: 'Main',
      color: '#1E88E5',
      description: 'Joint account',
    });

    await accountsApp.handlers['account-update']({
      id: 'acct1',
      color: null,
      description: null,
    });
    expect(await getAccount('acct1')).toMatchObject({
      name: 'Main',
      color: null,
      description: null,
    });
  });

  it('trims descriptions and stores blank values as null', async () => {
    await db.insertAccount({ id: 'acct1', name: 'Checking' });

    await accountsApp.handlers['account-update']({
      id: 'acct1',
      color: '',
      description: '  Bills  ',
    });
    expect(await getAccount('acct1')).toMatchObject({
      color: null,
      description: 'Bills',
    });

    await accountsApp.handlers['account-update']({
      id: 'acct1',
      description: '   ',
    });
    expect((await getAccount('acct1'))?.description).toBeNull();
  });
});
