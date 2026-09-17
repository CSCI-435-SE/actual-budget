# Explain a concept in simple terms

**Created:** 9/3/2026 18:10:12  
**Updated:** 9/9/2026 22:15:29  
**Exported:** 9/13/2026 15:07:52  
**Link:** [https://claude.ai/chat/a708ef92-c5b9-438e-b64b-411f2b928dd1](https://claude.ai/chat/a708ef92-c5b9-438e-b64b-411f2b928dd1)

## User:

> 9/4/2026 0:19:41

Please help me solve this error when trying to install yarn: yarn install
yarn : File C:\Users\icsab\AppData\Roaming\npm\yarn.ps1 cannot be loaded because running scripts is disabled on this
system. For more information, see about_Execution_Policies at https:/go.microsoft.com/fwlink/?LinkID=135170.
At line:1 char:1

- yarn install
- ```
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
  ```

## Assistant:

> 9/4/2026 0:19:51

This is a classic Windows PowerShell security restriction — easy fix!

> Used tool
>
> - Fix PowerShell script execution policy to allow yarn on Windows.
> - **Done**

**Why does this happen?** Windows PowerShell blocks scripts by default as a security measure. Yarn gets installed as a `.ps1` script, which PowerShell refuses to run until you explicitly allow it.

The `RemoteSigned` policy is the recommended setting — it's safe because it only allows scripts that are either local or digitally signed by a trusted source.

Let me know if you hit any snag along the way!

## User:

> 9/4/2026 0:27:20

> File:

please help me install yarn:

## Assistant:

> 9/4/2026 0:27:31

The main blocker is `better-sqlite3` failing to build — it needs native compilation tools. Here's how to fix it:

> Used tool
>
> - Fix better-sqlite3 native build failure during yarn install on Windows.
> - **Done**

**Quick note on the other warnings** — the `YN0060` and `YN0002` peer dependency warnings are mostly harmless for the Actual Budget project and won't stop it from running. The `better-sqlite3` build failure (exit code 1) is the only real error.

If you paste the contents of that `build.log` file here, I can give you a more targeted fix!

## User:

> 9/9/2026 18:58:16

> File:

please help me figure out why a test is failing:

## Assistant:

> 9/9/2026 18:58:32

Good news — only 2 tests failed and the root cause is clear. It's a **Windows file locking issue**, not a code bug.

Here's what's happening:

The two failing tests in `src/server/main.test.ts` both try to create/delete a SQLite file at:
`packages/loot-core/src/mocks/files/budgets/test-budget/db.sqlite`

- **Test 1** fails because the file is **locked** (`EBUSY`) — Windows holds a lock on SQLite files even after the DB connection closes, unlike Linux/Mac.
- **Test 2** fails because **the folder still exists** (`EEXIST`) from Test 1 not cleaning up properly.

It's a cascade — fix the first, and the second likely goes away too.

> Used tool
>
> - Fix Windows file locking errors causing two test failures in main.test.ts.
> - **Done**

**Also worth noting:** the `stderr` warnings you see (formula errors, async cell promises, corrupt JSON) are all **intentional** — they're tests _verifying_ that error handling works correctly. Those are fine to ignore.

If you can paste the contents of `main.test.ts` (specifically the `afterEach`/`afterAll` block), I can tell you exactly what needs to change to make it Windows-compatible.

## User:

> 9/9/2026 22:12:00

> File:

I deleted the leftover test file, and it still does not pass. here is main.test.ts:

## Assistant:

> 9/9/2026 22:12:10

Looking at the test code, I can see the exact problem. Here's what's happening:

In the `'budget is successfully loaded'` test, it does this:

```js
await db.openDatabase('test-budget'); // ← opens DB connection
// ... then ...
await runHandler(handlers['load-budget'], { id: 'test-budget' });
```

It opens the database directly **and then** also loads the budget (which opens it again). When the `afterEach` tries to delete the folder, **both connections are still holding the file lock** on Windows — so `EBUSY` fires, the folder isn't cleaned up, and the next test hits `EEXIST`.

The fix is to **close the manually-opened DB connection before calling `load-budget`**. Find this block in the first test:

```js
await db.openDatabase('test-budget');
const row =
  (await db.first) < db.DbClockMessage > 'SELECT * FROM messages_clock';

const { error } = await runHandler(handlers['load-budget'], {
  id: 'test-budget',
});
```

And change it to:

```js
await db.openDatabase('test-budget');
const row =
  (await db.first) < db.DbClockMessage > 'SELECT * FROM messages_clock';
await db.closeDatabase(); // ← add this line

const { error } = await runHandler(handlers['load-budget'], {
  id: 'test-budget',
});
```

Do the same for the second test — it opens the DB to insert a migration row, but never closes it before calling `load-budget`:

```js
await db.openDatabase('test-budget');
db.runQuery('INSERT INTO __migrations__ (id) VALUES (1000)');
await db.closeDatabase(); // ← add this line

const { error } = await runHandler(handlers['load-budget'], {
  id: 'test-budget',
});
```

**Why does this work on Linux/Mac but not Windows?** On Unix systems, you can delete a file that's still open — the file handle stays valid until it's released. Windows locks the file at the OS level and won't allow deletion while any handle is open, even from the same process.

Once you make those two changes, re-run `yarn test:debug` and both tests should pass. Let me know what you see!

## User:

> 9/9/2026 22:15:17

I can't change this code; all of the tests should pass, so the issue is something on my end that has to be changed

## Assistant:

> 9/9/2026 22:15:29

You're right, sorry about that! Since the tests pass on Linux/Mac, the issue is your Windows environment. The real fix is to make Windows release SQLite file locks faster.

The most likely culprit is **Windows Defender (antivirus)** — it scans SQLite files as they're written/closed, keeping a lock on them just long enough for the next test to fail.

**Fix: Exclude your project folder from Windows Defender scanning**

> Used tool
>
> - Exclude project folder from Windows Defender to fix SQLite file locking during tests.
> - **Done**

If that doesn't fully solve it, the second thing to try is **adding the `mocks` folder to your antivirus exclusions as a process** (specifically `node.exe`), or checking if any **other process like an IDE file watcher** (VS Code, for example) is watching that directory and holding the lock.

Would you like help checking which process is holding the lock if the Defender exclusion doesn't work?

Powered by Claude Exporter (https://www.ai-chat-exporter.net)
