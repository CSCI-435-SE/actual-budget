import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { app } from '#server/payees/app';
import { createSchedule, updateSchedule } from '#server/schedules/app';
import {
  insertRule,
  loadRules,
  resetState,
} from '#server/transactions/transaction-rules';

beforeEach(async () => {
  await global.emptyDatabase()();
  resetState();
  await loadMappings();
  await loadRules();
});

describe('payees app', () => {
  describe('payees-get-rule-counts', () => {
    it('counts payee rules but excludes rules linked to completed schedules', async () => {
      const activePayeeId = await db.insertPayee({ name: 'Active Payee' });
      const completedPayeeId = await db.insertPayee({
        name: 'Completed Payee',
      });

      await insertRule({
        stage: 'pre',
        conditionsOp: 'and',
        conditions: [{ op: 'is', field: 'payee', value: activePayeeId }],
        actions: [{ op: 'set', field: 'category', value: null }],
      });

      const scheduleId = await createSchedule({
        conditions: [
          { op: 'is', field: 'payee', value: completedPayeeId },
          { op: 'is', field: 'date', value: '2020-12-20' },
        ],
      });
      await updateSchedule({
        schedule: { id: scheduleId, completed: true },
      });

      const counts = await app.handlers['payees-get-rule-counts']();

      expect(counts[activePayeeId]).toBe(1);
      expect(counts[completedPayeeId]).toBeUndefined();
    });
  });

  describe('payees-get-usage-stats', () => {
    let accountId: string;

    beforeEach(async () => {
      accountId = await db.insertAccount({ name: 'Checking' });
    });

    function insertTransaction(
      fields: { payee: string; date: string } & Record<string, unknown>,
    ) {
      return db.insertTransaction({
        account: accountId,
        amount: 100,
        ...fields,
      });
    }

    function getUsageStats() {
      return app.handlers['payees-get-usage-stats']();
    }

    it('returns no entry for a payee with no transactions', async () => {
      const payeeId = await db.insertPayee({ name: 'Unused' });

      const stats = await getUsageStats();

      expect(stats[payeeId]).toBeUndefined();
    });

    it('counts transactions and returns the latest date', async () => {
      const payeeId = await db.insertPayee({ name: 'Grocer' });
      await insertTransaction({ payee: payeeId, date: '2024-01-14' });
      await insertTransaction({ payee: payeeId, date: '2026-10-30' });
      await insertTransaction({ payee: payeeId, date: '2025-03-02' });

      const stats = await getUsageStats();

      expect(stats[payeeId]).toEqual({ count: 3, lastUsed: '2026-10-30' });
    });

    it('keeps each payee separate', async () => {
      const firstId = await db.insertPayee({ name: 'First' });
      const secondId = await db.insertPayee({ name: 'Second' });
      await insertTransaction({ payee: firstId, date: '2026-01-01' });
      await insertTransaction({ payee: secondId, date: '2026-02-01' });
      await insertTransaction({ payee: secondId, date: '2026-03-01' });

      const stats = await getUsageStats();

      expect(stats[firstId]).toEqual({ count: 1, lastUsed: '2026-01-01' });
      expect(stats[secondId]).toEqual({ count: 2, lastUsed: '2026-03-01' });
    });

    it('shows a future date when that is the latest transaction', async () => {
      const payeeId = await db.insertPayee({ name: 'Landlord' });
      await insertTransaction({ payee: payeeId, date: '2026-01-01' });
      await insertTransaction({ payee: payeeId, date: '2099-12-31' });

      const stats = await getUsageStats();

      expect(stats[payeeId]).toEqual({ count: 2, lastUsed: '2099-12-31' });
    });

    it('does not count deleted transactions or their dates', async () => {
      const payeeId = await db.insertPayee({ name: 'Cafe' });
      await insertTransaction({ payee: payeeId, date: '2026-01-01' });
      const deletedId = await insertTransaction({
        payee: payeeId,
        date: '2026-06-01',
      });
      await db.deleteTransaction({ id: deletedId });

      const stats = await getUsageStats();

      expect(stats[payeeId]).toEqual({ count: 1, lastUsed: '2026-01-01' });
    });

    it("returns no entry when all of a payee's transactions are deleted", async () => {
      const payeeId = await db.insertPayee({ name: 'Gone' });
      const id = await insertTransaction({
        payee: payeeId,
        date: '2026-01-01',
      });
      await db.deleteTransaction({ id });

      const stats = await getUsageStats();

      expect(stats[payeeId]).toBeUndefined();
    });

    it("counts a merged payee's transactions toward the target", async () => {
      const targetId = await db.insertPayee({ name: 'Amazon' });
      const mergedId = await db.insertPayee({ name: 'AMAZON.COM' });
      await insertTransaction({ payee: targetId, date: '2026-01-01' });
      await insertTransaction({ payee: mergedId, date: '2026-05-01' });
      await insertTransaction({ payee: mergedId, date: '2025-01-01' });

      await app.handlers['payees-merge']({
        targetId,
        mergeIds: [mergedId],
      });
      const stats = await getUsageStats();

      expect(stats[targetId]).toEqual({ count: 3, lastUsed: '2026-05-01' });
      expect(stats[mergedId]).toBeUndefined();
    });

    it('counts a split once for a payee on both the parent and its children', async () => {
      const payeeId = await db.insertPayee({ name: 'Store' });
      const parentId = await insertTransaction({
        payee: payeeId,
        date: '2026-02-01',
        is_parent: true,
      });
      for (let i = 0; i < 2; i++) {
        await insertTransaction({
          payee: payeeId,
          date: '2026-02-01',
          is_child: true,
          parent_id: parentId,
        });
      }

      const stats = await getUsageStats();

      expect(stats[payeeId]).toEqual({ count: 1, lastUsed: '2026-02-01' });
    });

    it('counts a split once for each different payee on its children', async () => {
      const parentPayeeId = await db.insertPayee({ name: 'Mall' });
      const childPayeeId = await db.insertPayee({ name: 'Shoe Shop' });
      const otherChildPayeeId = await db.insertPayee({ name: 'Food Court' });
      const parentId = await insertTransaction({
        payee: parentPayeeId,
        date: '2026-02-01',
        is_parent: true,
      });
      for (const payee of [childPayeeId, childPayeeId, otherChildPayeeId]) {
        await insertTransaction({
          payee,
          date: '2026-02-01',
          is_child: true,
          parent_id: parentId,
        });
      }

      const stats = await getUsageStats();

      expect(stats[parentPayeeId]).toEqual({
        count: 1,
        lastUsed: '2026-02-01',
      });
      expect(stats[childPayeeId]).toEqual({
        count: 1,
        lastUsed: '2026-02-01',
      });
      expect(stats[otherChildPayeeId]).toEqual({
        count: 1,
        lastUsed: '2026-02-01',
      });
    });

    it('does not count the children of a deleted split', async () => {
      const parentPayeeId = await db.insertPayee({ name: 'Mall' });
      const childPayeeId = await db.insertPayee({ name: 'Shoe Shop' });
      const parentId = await insertTransaction({
        payee: parentPayeeId,
        date: '2026-02-01',
        is_parent: true,
      });
      await insertTransaction({
        payee: childPayeeId,
        date: '2026-02-01',
        is_child: true,
        parent_id: parentId,
      });
      await db.deleteTransaction({ id: parentId });

      const stats = await getUsageStats();

      expect(stats[parentPayeeId]).toBeUndefined();
      expect(stats[childPayeeId]).toBeUndefined();
    });

    it('counts transactions for transfer payees', async () => {
      const savingsId = await db.insertAccount({ name: 'Savings' });
      const transferPayeeId = await db.insertPayee({
        name: '',
        transfer_acct: savingsId,
      });
      await insertTransaction({ payee: transferPayeeId, date: '2026-03-15' });

      const stats = await getUsageStats();

      expect(stats[transferPayeeId]).toEqual({
        count: 1,
        lastUsed: '2026-03-15',
      });
    });

    it('has no entry for any payee in the unused payees list', async () => {
      const usedId = await db.insertPayee({ name: 'Used' });
      const unusedId = await db.insertPayee({ name: 'Unused' });
      const onlyDeletedId = await db.insertPayee({ name: 'Only deleted' });
      await insertTransaction({ payee: usedId, date: '2026-01-01' });
      const deletedId = await insertTransaction({
        payee: onlyDeletedId,
        date: '2026-01-01',
      });
      await db.deleteTransaction({ id: deletedId });

      const stats = await getUsageStats();
      const orphanedIds = (await app.handlers['payees-get-orphaned']()).map(
        payee => payee.id,
      );

      expect(orphanedIds).toEqual(
        expect.arrayContaining([unusedId, onlyDeletedId]),
      );
      expect(orphanedIds).not.toContain(usedId);
      for (const id of orphanedIds) {
        expect(stats[id]).toBeUndefined();
      }
    });
  });
});
