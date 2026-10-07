import React, { Fragment, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { q } from '@actual-app/core/shared/query';
import type { Query } from '@actual-app/core/shared/query';
import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
  RuleConditionEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { format as formatDate, parseISO } from 'date-fns';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { getSummaryDateBounds } from '#components/reports/spreadsheets/summary-spreadsheet';
import { goalTagCondition } from '#components/reports/useGoalTotal';
import { Cell, Row, Table } from '#components/table';
import { useAccounts } from '#hooks/useAccounts';
import { useCategoriesById } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { usePayeesById } from '#hooks/usePayees';
import { useTagCSS } from '#hooks/useTagCSS';
import { useTransactions } from '#hooks/useTransactions';
import { parseNotes } from '#notes/linkParser';

type GoalTransactionsProps = {
  start: string;
  end: string;
  conditions?: RuleConditionEntity[];
  conditionsOp?: 'and' | 'or';
  linkedTag: string;
};

/**
 * Read-only list of the transactions that count toward a goal: the same tag,
 * conditions and dates that `useGoalTotal` sums. It only displays them; none
 * of the cells can be edited. The list refreshes as transactions change.
 */
export function GoalTransactions({
  start,
  end,
  conditions,
  conditionsOp,
  linkedTag,
}: GoalTransactionsProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const { data: accounts = [] } = useAccounts();
  const { data: payeesById = {} } = usePayeesById();
  const { data: categories } = useCategoriesById();

  const [query, setQuery] = useState<Query | undefined>(undefined);

  useEffect(() => {
    let isCancelled = false;
    makeGoalTransactionsQuery({
      start,
      end,
      conditions,
      conditionsOp,
      linkedTag,
    })
      .then(newQuery => {
        if (!isCancelled) {
          setQuery(newQuery);
        }
      })
      .catch((error: unknown) => {
        console.error('Error generating filters:', error);
      });
    return () => {
      isCancelled = true;
    };
  }, [start, end, conditions, conditionsOp, linkedTag]);

  const { transactions, fetchNextPage, hasNextPage, isLoading } =
    useTransactions({ query });

  const accountsById = new Map(accounts.map(account => [account.id, account]));

  return (
    <Table
      items={transactions as TransactionEntity[]}
      loading={isLoading || !query}
      loadMore={hasNextPage ? () => void fetchNextPage() : undefined}
      style={{ minHeight: 200 }}
      headers={
        <>
          <Cell value={t('Date')} width={110} />
          {!isNarrowWidth && <Cell value={t('Account')} width="flex" />}
          <Cell value={t('Payee')} width="flex" />
          <Cell value={t('Notes')} width="flex" />
          {!isNarrowWidth && <Cell value={t('Category')} width="flex" />}
          <Cell value={t('Amount')} width={110} textAlign="right" />
        </>
      }
      renderEmpty={() => (
        <View
          style={{
            color: theme.tableText,
            marginTop: 20,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          <Trans>No matching transactions</Trans>
        </View>
      )}
      renderItem={({ item }) => (
        <GoalTransactionRow
          transaction={item}
          isNarrowWidth={isNarrowWidth}
          dateFormat={dateFormat}
          formatAmount={amount => format(amount, 'financial')}
          account={accountsById.get(item.account)}
          payee={item.payee ? payeesById[item.payee] : undefined}
          transferAccount={getTransferAccount(
            item.payee ? payeesById[item.payee] : undefined,
            accountsById,
          )}
          category={item.category ? categories?.list[item.category] : undefined}
        />
      )}
    />
  );
}

type GoalTransactionRowProps = {
  transaction: TransactionEntity;
  isNarrowWidth: boolean;
  dateFormat: string;
  formatAmount: (amount: number) => string;
  account?: AccountEntity;
  payee?: PayeeEntity;
  transferAccount?: AccountEntity;
  category?: CategoryEntity;
};

function GoalTransactionRow({
  transaction,
  isNarrowWidth,
  dateFormat,
  formatAmount,
  account,
  payee,
  transferAccount,
  category,
}: GoalTransactionRowProps) {
  return (
    <Row style={{ color: theme.tableText }}>
      <Cell
        name="date"
        width={110}
        value={formatDate(parseISO(transaction.date), dateFormat)}
      />
      {!isNarrowWidth && (
        <Cell name="account" width="flex" value={account?.name ?? ''} />
      )}
      <Cell
        name="payee"
        width="flex"
        value={transferAccount?.name ?? payee?.name ?? ''}
      />
      <Cell name="notes" width="flex" plain>
        <View
          style={{
            ...styles.smallText,
            display: 'block',
            padding: '0 5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <ReadOnlyNotes notes={transaction.notes ?? ''} />
        </View>
      </Cell>
      {!isNarrowWidth && (
        <Cell name="category" width="flex" value={category?.name ?? ''} />
      )}
      <Cell name="amount" width={110} textAlign="right" plain>
        <View style={{ ...styles.smallText, padding: '0 5px' }}>
          <PrivacyFilter>
            <FinancialText>{formatAmount(transaction.amount)}</FinancialText>
          </PrivacyFilter>
        </View>
      </Cell>
    </Row>
  );
}

/**
 * Shows notes with tags as coloured labels. Unlike the account table's notes,
 * nothing here is a button, since the goal list is display only.
 */
function ReadOnlyNotes({ notes }: { notes: string }) {
  const getTagCSS = useTagCSS();

  return (
    <>
      {parseNotes(notes).map((segment, index) => {
        switch (segment.type) {
          case 'tag':
            return (
              <Fragment key={index}>
                <span className={getTagCSS(segment.tag)}>
                  {segment.content}
                </span>{' '}
              </Fragment>
            );
          case 'link':
            return <Fragment key={index}>{segment.displayText}</Fragment>;
          default:
            return <Fragment key={index}>{segment.content}</Fragment>;
        }
      })}
    </>
  );
}

function getTransferAccount(
  payee: PayeeEntity | undefined,
  accountsById: Map<AccountEntity['id'], AccountEntity>,
) {
  return payee?.transfer_acct
    ? accountsById.get(payee.transfer_acct)
    : undefined;
}

/**
 * Builds the transactions query for a goal. It mirrors `summarySpreadsheet`:
 * the tag is always required, the goal's conditions are joined with
 * `conditionsOp`, the dates come from `getSummaryDateBounds`, and split
 * transactions are listed as their individual lines, so the list holds
 * exactly the rows the goal total adds up.
 */
export async function makeGoalTransactionsQuery({
  start,
  end,
  conditions = [],
  conditionsOp = 'and',
  linkedTag,
}: GoalTransactionsProps) {
  const [{ filters }, { filters: tagFilters }] = await Promise.all([
    send('make-filters-from-conditions', {
      conditions: conditions.filter(cond => !cond.customName),
    }),
    send('make-filters-from-conditions', {
      conditions: [goalTagCondition(linkedTag)],
    }),
  ]);
  const conditionsOpKey = conditionsOp === 'or' ? '$or' : '$and';
  const { startDate, endDate } = getSummaryDateBounds(start, end);

  return q('transactions')
    .filter({ $and: tagFilters })
    .filter({ [conditionsOpKey]: filters })
    .filter({
      $and: [{ date: { $gte: startDate } }, { date: { $lte: endDate } }],
    })
    .select('*')
    .orderBy({ date: 'desc' })
    .options({ splits: 'inline' });
}
