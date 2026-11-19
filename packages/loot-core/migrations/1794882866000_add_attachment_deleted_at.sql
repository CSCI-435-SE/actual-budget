BEGIN TRANSACTION;

-- When an attachment was removed (#155). Null while it is live. Cleanup
-- removes the row and its file once this is older than the grace period,
-- which leaves time to undo the removal.
ALTER TABLE transaction_attachments ADD COLUMN deleted_at INTEGER;

COMMIT;
