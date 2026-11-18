import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { app } from '#server/tags/app';
import { conditionsToAQL } from '#server/transactions/transaction-rules';
import { q } from '#shared/query';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

async function insertTransaction(
  notes: string,
  fields: { is_parent?: boolean; is_child?: boolean; parent_id?: string } = {},
) {
  return await db.insertTransaction({
    account: 'account-1',
    date: '2024-01-01',
    amount: -1000,
    notes,
    ...fields,
  });
}

async function insertTag(tag: string) {
  return await db.insertTag({ tag, color: null, description: null });
}

async function getNotes(id: string) {
  const transaction = await db.first<{ notes: string }>(
    'SELECT notes FROM transactions WHERE id = ?',
    [id],
  );
  return transaction?.notes;
}

describe('tags app', () => {
  describe('tags-rename', () => {
    beforeEach(async () => {
      await db.insertAccount({ id: 'account-1', name: 'Account 1' });
    });

    it('renames the tag and rewrites it in transaction notes', async () => {
      const id = await db.insertTag({
        tag: 'Reimbursable',
        color: null,
        description: null,
      });
      const matching = await insertTransaction('Lunch #Reimbursable');
      const partial = await insertTransaction('Dinner #ReimbursableLater');

      await app.handlers['tags-rename']({ id, tag: '  ToBeReimbursed  ' });

      expect(await db.getTags()).toEqual([
        expect.objectContaining({ id, tag: 'ToBeReimbursed' }),
      ]);
      expect(await getNotes(matching)).toBe('Lunch #ToBeReimbursed');
      expect(await getNotes(partial)).toBe('Dinner #ReimbursableLater');
    });

    it('rejects an invalid name', async () => {
      const id = await db.insertTag({
        tag: 'Food',
        color: null,
        description: null,
      });

      await expect(
        app.handlers['tags-rename']({ id, tag: 'two words' }),
      ).rejects.toThrow('Invalid tag name');
    });

    it('rejects renaming onto an existing tag', async () => {
      const id = await db.insertTag({
        tag: 'Food',
        color: null,
        description: null,
      });
      await db.insertTag({
        tag: 'Groceries',
        color: null,
        description: null,
      });

      await expect(
        app.handlers['tags-rename']({ id, tag: 'Groceries' }),
      ).rejects.toThrow('A tag with that name already exists');
    });

    it('rejects renaming onto a deleted tag', async () => {
      const id = await db.insertTag({
        tag: 'Food',
        color: null,
        description: null,
      });
      const deletedId = await db.insertTag({
        tag: 'Groceries',
        color: null,
        description: null,
      });
      await app.handlers['tags-delete']({ id: deletedId });

      await expect(
        app.handlers['tags-rename']({ id, tag: 'Groceries' }),
      ).rejects.toThrow('A tag with that name already exists');
    });

    it('rejects an unknown tag', async () => {
      await expect(
        app.handlers['tags-rename']({ id: 'missing', tag: 'Food' }),
      ).rejects.toThrow('Tag not found');
    });
  });

  describe('tags-get-counts', () => {
    beforeEach(async () => {
      await db.insertAccount({ id: 'account-1', name: 'Account 1' });
    });

    it('returns zero for a tag no transaction uses', async () => {
      await insertTag('test');
      await insertTransaction('no tags here');

      expect(await app.handlers['tags-get-counts']()).toEqual({ test: 0 });
    });

    it('counts every transaction that uses a tag', async () => {
      await insertTag('groceries');
      await insertTag('vacation');
      await insertTransaction('#groceries');
      await insertTransaction('Weekly shop #groceries #vacation');
      await insertTransaction('Market#groceries');

      expect(await app.handlers['tags-get-counts']()).toEqual({
        groceries: 3,
        vacation: 1,
      });
    });

    it('does not count a tag that is a prefix of another tag', async () => {
      await insertTag('food');
      await insertTag('foodie');
      await insertTransaction('#foodie');
      await insertTransaction('#food');

      expect(await app.handlers['tags-get-counts']()).toEqual({
        food: 1,
        foodie: 1,
      });
    });

    it('matches tags case sensitively and ignores escaped tags', async () => {
      await insertTag('Food');
      await insertTransaction('#food');
      await insertTransaction('##Food');

      expect(await app.handlers['tags-get-counts']()).toEqual({ Food: 0 });
    });

    it('does not count deleted transactions', async () => {
      await insertTag('trip');
      await insertTransaction('#trip');
      const deleted = await insertTransaction('#trip');
      await db.deleteTransaction({ id: deleted });

      expect(await app.handlers['tags-get-counts']()).toEqual({ trip: 1 });
    });

    it('counts a split transaction once, like the transaction list', async () => {
      await insertTag('reimbursable');
      await insertTag('work');
      const parent = await insertTransaction('Dinner #reimbursable', {
        is_parent: true,
      });
      await insertTransaction('#reimbursable #work', {
        is_child: true,
        parent_id: parent,
      });
      await insertTransaction('#work', { is_child: true, parent_id: parent });

      expect(await app.handlers['tags-get-counts']()).toEqual({
        reimbursable: 1,
        work: 1,
      });
    });

    it('does not count children of a deleted split parent', async () => {
      await insertTag('work');
      const parent = await insertTransaction('Split', { is_parent: true });
      await insertTransaction('#work', { is_child: true, parent_id: parent });
      await db.deleteTransaction({ id: parent });

      expect(await app.handlers['tags-get-counts']()).toEqual({ work: 0 });
    });

    it('does not count deleted tags', async () => {
      await insertTag('kept');
      const deletedId = await insertTag('gone');
      await app.handlers['tags-delete']({ id: deletedId });
      await insertTransaction('#gone #kept');

      expect(await app.handlers['tags-get-counts']()).toEqual({ kept: 1 });
    });

    it('matches the number of rows the "View Transactions" filter lists', async () => {
      const tags = ['food', 'foodie', 'Food', 'a', 'b', '$cash', 'work'];
      for (const tag of tags) {
        await insertTag(tag);
      }
      await insertTransaction('#food lunch');
      await insertTransaction('#foodie #Food');
      await insertTransaction('##food escaped');
      await insertTransaction('#a#b');
      await insertTransaction('paid#$cash');
      const deleted = await insertTransaction('#food');
      await db.deleteTransaction({ id: deleted });
      const parent = await insertTransaction('#food split', {
        is_parent: true,
      });
      await insertTransaction('#food #work', {
        is_child: true,
        parent_id: parent,
      });
      await insertTransaction('#a', { is_child: true, parent_id: parent });
      const deletedParent = await insertTransaction('', { is_parent: true });
      await insertTransaction('#work', {
        is_child: true,
        parent_id: deletedParent,
      });
      await db.deleteTransaction({ id: deletedParent });

      const counts = await app.handlers['tags-get-counts']();

      for (const tag of tags) {
        // The same query the account view runs for "View Transactions"
        const { filters } = conditionsToAQL([
          { field: 'notes', op: 'hasTags', value: `#${tag}`, type: 'string' },
        ]);
        const { data } = await aqlQuery(
          q('transactions')
            .filter({ $and: filters })
            .options({ splits: 'grouped' })
            .select('*'),
        );
        expect({ tag, count: counts[tag] }).toEqual({
          tag,
          count: data.length,
        });
      }
    });

    it('stores unusual tag names as ordinary keys', async () => {
      await insertTag('__proto__');
      await insertTransaction('#__proto__');

      const counts = await app.handlers['tags-get-counts']();
      expect(Object.entries(counts)).toEqual([['__proto__', 1]]);
    });
  });
});
