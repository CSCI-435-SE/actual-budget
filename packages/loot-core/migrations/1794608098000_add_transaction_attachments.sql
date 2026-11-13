BEGIN TRANSACTION;

-- Files attached to transactions (#154). Rows are local to this device and
-- are not synced; the files themselves live in <budgetDir>/attachments/<id>.
CREATE TABLE IF NOT EXISTS transaction_attachments
  (id TEXT PRIMARY KEY,
   transaction_id TEXT,
   file_name TEXT,
   mime_type TEXT,
   size INTEGER,
   storage TEXT DEFAULT 'local',
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX IF NOT EXISTS idx_transaction_attachments_txn
  ON transaction_attachments (transaction_id, tombstone);

COMMIT;
