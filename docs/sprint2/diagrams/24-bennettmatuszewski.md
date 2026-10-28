# D6: UML Diagrams for Issue #24, Account Color and Description

**Author:** bennettmatuszewski
**Issue:** #24, account color customization
**Branch:** `feat/issue-24-account-color-description`

Both diagrams cover the code read during concept location and impact analysis
and the code added or changed to resolve the issue.

**Legend** (used in both diagrams)

| Marker | Color | Meaning |
| --- | --- | --- |
| `«new»` | green | Added in this PR |
| `«modified»` | amber | Existing code changed in this PR |
| `«existing»` | grey | Unchanged code studied during impact analysis |
| `[new]` after a member | | Attribute or method added in this PR |
| Note | yellow box | Annotation explaining a design decision |

## Mapping TypeScript and React to UML

Actual Budget is written in TypeScript with React function components and has
almost no classes. The diagrams map its constructs to UML like this:

| Code construct | UML notation |
| --- | --- |
| React function component (e.g. `AccountName`) | Class. Props are attributes, internal handlers are private (`-`) methods |
| Module of functions (e.g. `util/colorPill.ts`, `server/accounts/app.ts`) | Class whose methods are the exported functions |
| `type` with fields (e.g. `AccountEntity`) | Class with attributes only |
| A component that renders a child it controls | Composition |
| A prop passed in from a parent, not owned (e.g. `account`) | Aggregation |
| A component that calls a hook or helper function | Dependency |
| A component that keeps and reads a value of a type | Association |
| An intersection type `{...} & Base` | Generalization |
| A React hook (e.g. `useUpdateAccountMutation`) | Class |

## Class Diagram

![Class diagram for account color and description](24-bennettmatuszewski-class.png)

## Sequence Diagram

Scenario: on an account page, the user picks a color for the account. The
color is saved, the All Accounts table redraws with the account as a pill, and
clicking the pill still opens the account dropdown. Green boxes mark
interactions that are new in this PR.

![Sequence diagram for setting an account color](24-bennettmatuszewski-sequence.png)

The description is saved the same way, starting in `AccountDescriptionInput`.
It calls `useUpdateAccountMutation` with `{ id, description }`, and the rest of
the save path is the same as steps 9 to 18 above. It isn't shown in tables.

## Q&A

### Class Diagram

#### 1. Which 1–2 classes are most central to understanding the codebase and solving the issue?

- **`server/accounts/app.ts`, specifically `updateAccount` and `getAccounts` (modified).** This is the only way account data moves between the database and the UI.
  - `updateAccount` is what the `account-update` message runs, and it saves only the fields it names. Anything else the UI sends is silently dropped.
  - `getAccounts` builds every account the UI receives, field by field.
  - Understanding this class showed me that adding columns to the table wasn't enough. Until `color` and `description` were added to both functions, nothing in the UI could save or see them. It also shows why sync and undo needed no new code: `updateAccount` is registered as `mutator(undoable(...))` and writes through the generic `db.update`.
- **`AccountName` (new).** This is the one component that turns an account into what the user sees.
  - If the account has a valid color, it renders a colored pill. Otherwise it returns the plain name, exactly as before.
  - Six places that show account names use it: the transactions table, schedules, rules, both sidebars and the account dropdown. So "show the color wherever the account name appears in a table" was solved in one place rather than six.

#### 2. What is the most significant relationship in the diagram?

The dependency **`TransactionsTable ..> AccountName` ("formatter returns")**, read together with the composition **`CustomCell *-- AccountAutocomplete` ("editor on expose")**.

- The Account column's cell formatter now returns an `AccountName` element instead of a plain string. `CustomCell` draws whatever the formatter returns, and when clicked it opens `AccountAutocomplete`.
- This relationship carries two acceptance criteria at once. The color must show in the table, and clicking an account on the All Accounts page must still open the dropdown "same as before".
- Both work because `AccountName` renders a plain `<span>` with no click handler, so the click reaches `CustomCell`. Had I copied the tag pattern, where the pill is a `Button`, this relationship would have broken the existing dropdown.

#### 3. Is there anything in the design you would change?

Yes, two things:

- **Validate colors on the server.** Right now `updateAccount` stores any string as a color, and only the UI checks the format with `isHexColor`. That works because a bad value just shows as plain text, but the database can still hold invalid data written through the public API.
  - I'd add a small check in `updateAccount`.
  - I'd also make the account page's rename send only `{ id, name }`. Today it sends the whole account, which can overwrite a color set on another device at the same moment.
- **Support transfer pills in split transactions.** I put the transfer-payee pill in `PayeeCell` using the transfer-account lookup that component already had, which was the smallest change. As a result, parent rows of split transactions don't show it. If I did this again, I'd change the shared `useDisplayPayee` hook to return the transfer account along with the display text, so every screen that shows payees could draw the pill consistently.

### Sequence Diagram

#### 1. What starts the sequence, and what is the expected outcome?

It starts when the user, on an individual account page, hovers over the account name, clicks the palette button and picks a color (steps 1–4). If it succeeds:

- The color is saved in the account's database row, synced to other devices, and can be undone with Ctrl+Z.
- The account list is refetched.
- The All Accounts transactions table redraws with that account's name as a colored pill.
- Clicking the pill still opens the account dropdown, and the dropdown's list items show colored pills too (steps 26–29).

#### 2. The 2–3 most important steps

- **Steps 9–11: saving the color (mostly existing code, one modified function).** `AccountColorButton` (new) calls the existing `useUpdateAccountMutation` with only `{ id, color }`. That sends `account-update` to the backend, where `updateAccount` (modified) passes the field to the existing `db.update`. `db.update` writes the row and sends one CRDT sync message per changed column. Sending a single field is a deliberate choice: it can't overwrite a rename made on another device at the same time.
- **Steps 14–17: reloading the accounts (existing caching, modified mapping).** When the save succeeds, the existing React Query cache marks the account list stale and requests `accounts-get` again. `getAccounts` (modified) copies `color` and `description` into each `AccountEntity`. Without that change, the color would be saved in the database but never reach the screen.
- **Steps 19–24: drawing the pill (new code).** The table cell's formatter returns `AccountName(acct)`. `AccountName` checks the color with `isHexColor` and gets black or white text from `getColorPillColors`, both in the new `util/colorPill.ts`, then renders a `<span>` pill. If the color is missing or invalid, it returns the plain name (step 25), so accounts without a color look exactly as before.

#### 3. Which error cases and alternative paths are left out, and why?

- **The save failing.** If `account-update` fails, `useUpdateAccountMutation` runs its existing `onError` handler, which shows the notification "There was an error updating the account". The color isn't saved and the table doesn't change. I left this out because it's existing, generic error handling that this PR didn't change.
- **An invalid typed color.** `ColorPicker` ignores typed text until it matches `#RRGGBB`, so `onChange` never fires with a bad value. That filtering happens inside an existing component.
- **Undo, sync to other devices, and older clients.** Ctrl+Z runs the existing undo system. Other devices apply the existing CRDT messages. Older clients that don't have the new columns yet hold those messages in `messages_pending` until they upgrade. All of this is built into `db.update` and `undoable()`, and none of it is new code.
- **Editing the description.** It goes through the same save path (steps 9–18), starting in `AccountDescriptionInput` with `{ id, description }`. I mention it under the diagram instead of drawing it, to avoid repeating the same steps.

I left these out to keep the diagram focused on the one complete success scenario that exercises the new and modified code. Drawing every path would have roughly doubled its size without showing any additional code from this PR.

**Cross-cutting:**

4. If you used AI to create or check any part of the diagrams, describe what it produced, what you verified against the actual code, and what you had to correct or add. If AI was not used, write "N/A."

I used AI to generate the UML diagrams and help me understand how they worked. I verified the accuracy by lining up the changes myself with the files changes in the PR.