import { currentDay } from '@actual-app/core/shared/months';
import type {
  CurrencyAmount,
  IntegerAmount,
} from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  CategoryEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { isValid as isDateValid, parseISO } from 'date-fns';

import type { UseFormatResult } from '#hooks/useFormat';

export type SerializedTransaction = Omit<TransactionEntity, 'date'> & {
  date: string;
  debit: CurrencyAmount;
  credit: CurrencyAmount;
};

export type TransactionEditFunction = (
  id: TransactionEntity['id'],
  name: string,
) => void;

export type TransactionUpdateFunction = <T extends keyof SerializedTransaction>(
  name: T,
  value: SerializedTransaction[T],
) => void;

// Keep the currency's decimals when the value actually has a fractional part,
// so that hiding fractions in the read-only display doesn't truncate the
// amount when the cell round-trips back through `deserializeTransaction`.
function serializeAmount(
  integerAmount: IntegerAmount,
  format: UseFormatResult,
): CurrencyAmount {
  const scale = Math.pow(10, format.currency.decimalPlaces);
  return format.forEdit(integerAmount, {
    keepFraction: integerAmount % scale !== 0,
  });
}

export function serializeTransaction(
  transaction: TransactionEntity,
  format: UseFormatResult,
  showZeroInDeposit?: boolean,
): SerializedTransaction {
  const { amount, date: originalDate } = transaction;

  let debit = amount < 0 ? -amount : null;
  let credit = amount > 0 ? amount : null;

  if (amount === 0) {
    if (showZeroInDeposit) {
      credit = 0;
    } else {
      debit = 0;
    }
  }

  let date = originalDate;
  // Validate the date format
  if (!isDateValid(parseISO(date))) {
    // Be a little forgiving if the date isn't valid. This at least
    // stops the UI from crashing, but this is a serious problem with
    // the data. This allows the user to go through and see empty
    // dates and manually fix them.
    console.error(`Date '${date}' is not valid.`);
    // TODO: the fact that the date type is not nullable but we are setting it to null needs to be changed
    date = null as unknown as string;
  }

  // Convert with decimals here so the value doesn't lose decimals and formatter will show or hide them.
  return {
    ...transaction,
    date,
    debit: debit != null ? serializeAmount(debit, format) : '',
    credit: credit != null ? serializeAmount(credit, format) : '',
  };
}

export function deserializeTransaction(
  transaction: SerializedTransaction,
  originalTransaction: TransactionEntity,
  format: UseFormatResult,
) {
  const { debit, credit, date: originalDate, ...realTransaction } = transaction;

  let amount: IntegerAmount | null;
  if (debit !== '') {
    const parsed = format.fromEdit(debit);
    amount = parsed != null ? -parsed : null;
  } else {
    amount = format.fromEdit(credit);
  }

  amount = amount != null ? amount : originalTransaction.amount;
  let date = originalDate;
  if (date == null) {
    date = originalTransaction.date || currentDay();
  }

  return { ...realTransaction, date, amount };
}

export function isLastChild(
  transactions: readonly TransactionEntity[],
  index: number,
) {
  const trans = transactions[index];
  return (
    trans &&
    trans.is_child &&
    (transactions[index + 1] == null ||
      transactions[index + 1].parent_id !== trans.parent_id)
  );
}

export function selectAscDesc(
  field: string,
  ascDesc: 'asc' | 'desc',
  clicked: string,
  defaultAscDesc: 'asc' | 'desc' = 'asc',
) {
  return field === clicked
    ? ascDesc === 'asc'
      ? 'desc'
      : 'asc'
    : defaultAscDesc;
}

// Decides whether a rule result should be applied to a field while the user is
// entering a new transaction. By default rules only fill fields the user left
// empty, so their manual input isn't overwritten. The exception is the notes
// field: append/prepend notes rules intentionally preserve the existing note and
// add text before or after it, so we allow those through. The check stays
// idempotent — rules are re-run on every keystroke during entry, so we must not
// re-add text that the previous run already applied.
export function shouldApplyRuleChange(
  field: string,
  currentValue: unknown,
  nextValue: unknown,
) {
  if (
    currentValue == null ||
    currentValue === '' ||
    currentValue === 0 ||
    currentValue === false
  ) {
    return true;
  }

  if (
    field !== 'notes' ||
    typeof currentValue !== 'string' ||
    typeof nextValue !== 'string' ||
    nextValue === currentValue
  ) {
    return false;
  }

  // The rule preserved the user's note only if the result still contains it
  // verbatim. Otherwise treat it as an overwrite and keep the manual note.
  const index = nextValue.indexOf(currentValue);
  if (index === -1) {
    return false;
  }

  const prepended = nextValue.slice(0, index);
  const appended = nextValue.slice(index + currentValue.length);

  // If the note already starts/ends with these exact additions, a previous rule
  // run already applied them — applying again would duplicate the text.
  const alreadyApplied =
    (prepended === '' || currentValue.startsWith(prepended)) &&
    (appended === '' || currentValue.endsWith(appended));

  return !alreadyApplied;
}

export function makeTemporaryTransactions(
  currentAccountId: AccountEntity['id'] | null | undefined,
  currentCategoryId: CategoryEntity['id'] | null | undefined,
  lastDate?: string | null,
): TransactionEntity[] {
  return [
    {
      id: 'temp',
      date: lastDate || currentDay(),
      // TODO: consider making this default to an empty string
      account: (currentAccountId || null) as string,
      category: currentCategoryId || undefined,
      cleared: false,
      // TODO: either make this nullable or find a way to make this not null
      amount: null as unknown as number,
    },
  ];
}
