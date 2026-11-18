import * as nativeFs from 'fs';
import * as path from 'path';

import type { Database } from '@jlongster/sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as sqlite from '#platform/server/sqlite';
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { q } from '#shared/query';

import { applyMigration, getMigrationId, getMigrationList } from './migrations';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const INIT_SQL = path.resolve(__dirname, '../sql/init.sql');
const MIGRATION_ID = 1794608098000;
const MIGRATION_NAME = `${MIGRATION_ID}_add_transaction_attachments.sql`;

type TableInfoRow = {
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: string | null;
  pk: 0 | 1;
};

function tableNames(database: Database): string[] {
  return sqlite
    .runQuery<{ name: string }>(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
      true,
    )
    .map(row => row.name);
}

// Every row of every table, sorted so the comparison doesn't depend on the
// order SQLite happens to return rows in
function dumpTables(
  database: Database,
  tables: string[],
): Record<string, string[]> {
  const dump: Record<string, string[]> = {};
  for (const table of tables) {
    dump[table] = sqlite
      .runQuery<Record<string, unknown>>(
        database,
        `SELECT * FROM "${table}"`,
        [],
        true,
      )
      .map(row => JSON.stringify(row))
      .sort();
  }
  return dump;
}

function seedBudgetData(database: Database) {
  sqlite.execQuery(
    database,
    `
      INSERT INTO accounts (id, name, offbudget, closed, sort_order)
        VALUES ('acct1', 'Checking', 0, 0, 1);
      INSERT INTO category_groups (id, name, is_income, sort_order)
        VALUES ('group1', 'Bills', 0, 1);
      INSERT INTO categories (id, name, is_income, cat_group, sort_order)
        VALUES ('cat1', 'Rent', 0, 'group1', 1);
      INSERT INTO transactions (id, isParent, isChild, acct, category, amount, date, sort_order)
        VALUES ('parent1', 1, 0, 'acct1', NULL, -12000, 20261113, 1);
      INSERT INTO transactions (id, isParent, isChild, acct, category, amount, date, parent_id, sort_order)
        VALUES ('child1', 0, 1, 'acct1', 'cat1', -7000, 20261113, 'parent1', 2),
               ('child2', 0, 1, 'acct1', 'cat1', -5000, 20261113, 'parent1', 3);
    `,
  );
}

describe('add_transaction_attachments migration', () => {
  let database: Database;

  beforeEach(async () => {
    await sqlite.init();
    database = await sqlite.openDatabase(':memory:');
    sqlite.execQuery(database, nativeFs.readFileSync(INIT_SQL, 'utf8'));

    // Bring the database to the state just before this migration
    for (const name of await getMigrationList(MIGRATIONS_DIR)) {
      if (getMigrationId(name) < MIGRATION_ID) {
        await applyMigration(database, name, MIGRATIONS_DIR);
      }
    }
  });

  afterEach(() => {
    sqlite.closeDatabase(database);
  });

  it('adds the table without changing existing data', async () => {
    seedBudgetData(database);
    const existingTables = tableNames(database);
    expect(existingTables).not.toContain('transaction_attachments');
    const before = dumpTables(
      database,
      existingTables.filter(table => table !== '__migrations__'),
    );

    await applyMigration(database, MIGRATION_NAME, MIGRATIONS_DIR);

    expect(tableNames(database)).toContain('transaction_attachments');
    expect(
      dumpTables(
        database,
        existingTables.filter(table => table !== '__migrations__'),
      ),
    ).toEqual(before);

    const columns = sqlite.runQuery<TableInfoRow>(
      database,
      'PRAGMA table_info(transaction_attachments)',
      [],
      true,
    );
    expect(
      columns.map(({ name, type, notnull, dflt_value, pk }) => ({
        name,
        type,
        notnull,
        dflt_value,
        pk,
      })),
    ).toEqual([
      { name: 'id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 1 },
      {
        name: 'transaction_id',
        type: 'TEXT',
        notnull: 0,
        dflt_value: null,
        pk: 0,
      },
      { name: 'file_name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'mime_type', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'size', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
      {
        name: 'storage',
        type: 'TEXT',
        notnull: 0,
        dflt_value: "'local'",
        pk: 0,
      },
      {
        name: 'created_at',
        type: 'INTEGER',
        notnull: 0,
        dflt_value: null,
        pk: 0,
      },
      {
        name: 'tombstone',
        type: 'INTEGER',
        notnull: 0,
        dflt_value: '0',
        pk: 0,
      },
    ]);
  });

  it('fills in storage and tombstone defaults', async () => {
    await applyMigration(database, MIGRATION_NAME, MIGRATIONS_DIR);

    sqlite.runQuery(
      database,
      `INSERT INTO transaction_attachments
         (id, transaction_id, file_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ['att1', 'parent1', 'receipt.pdf', 'application/pdf', 1024, 1000],
    );

    const [row] = sqlite.runQuery<{ storage: string; tombstone: number }>(
      database,
      'SELECT storage, tombstone FROM transaction_attachments WHERE id = ?',
      ['att1'],
      true,
    );
    expect(row).toEqual({ storage: 'local', tombstone: 0 });
  });

  it('can run again without changing anything', async () => {
    await applyMigration(database, MIGRATION_NAME, MIGRATIONS_DIR);
    sqlite.runQuery(
      database,
      `INSERT INTO transaction_attachments
         (id, transaction_id, file_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ['att1', 'parent1', 'receipt.png', 'image/png', 2048, 1000],
    );
    const tables = tableNames(database);
    const before = dumpTables(database, tables);

    // The SQL is idempotent (IF NOT EXISTS), e.g. if its id is renumbered
    sqlite.execQuery(
      database,
      nativeFs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_NAME), 'utf8'),
    );

    expect(dumpTables(database, tables)).toEqual(before);
  });
});

describe('transaction_attachments schema', () => {
  beforeEach(async () => {
    await global.emptyDatabase()();
  });

  it('is queryable through AQL, oldest first', async () => {
    const empty = await aqlQuery(q('transaction_attachments').select('*'));
    expect(empty.data).toEqual([]);

    db.runQuery(
      "INSERT INTO accounts (id, name, offbudget, closed, sort_order) VALUES ('acct1', 'Checking', 0, 0, 1)",
    );
    db.runQuery(
      "INSERT INTO transactions (id, acct, amount, date, sort_order) VALUES ('trans1', 'acct1', -1000, 20261113, 1)",
    );
    db.runQuery(
      `INSERT INTO transaction_attachments
         (id, transaction_id, file_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
      [
        'att-new',
        'trans1',
        'later.jpg',
        'image/jpeg',
        300,
        2000,
        'att-old',
        'trans1',
        'first.pdf',
        'application/pdf',
        100,
        1000,
      ],
    );

    const { data } = await aqlQuery(
      q('transaction_attachments')
        .filter({ transaction_id: 'trans1' })
        .select(['id', 'file_name', 'storage', 'tombstone']),
    );
    expect(data).toEqual([
      {
        id: 'att-old',
        file_name: 'first.pdf',
        storage: 'local',
        tombstone: false,
      },
      {
        id: 'att-new',
        file_name: 'later.jpg',
        storage: 'local',
        tombstone: false,
      },
    ]);
  });

  it('stops matching a deleted transaction through its ref', async () => {
    // `transaction_id` is a ref, so AQL resolves it through the alive
    // transactions view: a deleted transaction's attachments read as null
    db.runQuery(
      "INSERT INTO accounts (id, name, offbudget, closed, sort_order) VALUES ('acct1', 'Checking', 0, 0, 1)",
    );
    db.runQuery(
      "INSERT INTO transactions (id, acct, amount, date, sort_order, tombstone) VALUES ('trans1', 'acct1', -1000, 20261113, 1, 1)",
    );
    db.runQuery(
      `INSERT INTO transaction_attachments
         (id, transaction_id, file_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ['att1', 'trans1', 'receipt.pdf', 'application/pdf', 100, 1000],
    );

    const { data } = await aqlQuery(
      q('transaction_attachments')
        .filter({ transaction_id: 'trans1' })
        .select('id'),
    );
    expect(data).toEqual([]);
  });
});
