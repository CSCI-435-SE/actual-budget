import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDownloadThickBottom } from '@actual-app/components/icons/v2';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';

import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useLocale } from '#hooks/useLocale';
import { useLocalPref } from '#hooks/useLocalPref';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { useBudgetMonthCount } from './BudgetMonthCountContext';
import {
  buildBudgetMonthCsv,
  fetchBudgetMonthCells,
  getBudgetMonthExportFilename,
} from './export/budgetMonthCsv';
import { buildBudgetMonthPdfBytes } from './export/budgetMonthPdf';
import { buildBudgetMonthPdfRows } from './export/budgetMonthPdfRows';
import { getVisibleMonths } from './MonthsContext';
import type { MonthBounds } from './MonthsContext';

type ExportFormat = 'csv' | 'pdf';

type ExportAction = {
  format: ExportFormat;
  month: string;
};

type ExportMenuItem =
  | { type: typeof Menu.label; name: string; text: '' }
  | { name: string; text: string };

type ExportMenuLabels = {
  exportAsCsv: string;
  exportAsPdf: string;
  csvSection: string;
  pdfSection: string;
};

// Pulled out of the component so the single-month/multi-month item layout
// (AC1: a CSV section and a PDF section, each listing the visible months)
// can be unit tested without rendering the component or mocking i18next.
export function buildExportMenuItems(
  months: string[],
  labels: ExportMenuLabels,
  formatMonth: (month: string) => string,
): ExportMenuItem[] {
  if (months.length === 1) {
    return [
      { name: `csv:${months[0]}`, text: labels.exportAsCsv },
      { name: `pdf:${months[0]}`, text: labels.exportAsPdf },
    ];
  }

  return [
    { type: Menu.label, name: labels.csvSection, text: '' },
    ...months.map(month => ({
      name: `csv:${month}`,
      text: formatMonth(month),
    })),
    { type: Menu.label, name: labels.pdfSection, text: '' },
    ...months.map(month => ({
      name: `pdf:${month}`,
      text: formatMonth(month),
    })),
  ];
}

export function BudgetExportMenu() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const locale = useLocale();
  const format = useFormat();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [monthBounds, setMonthBounds] = useState<MonthBounds | null>(null);

  const [startMonthPref] = useLocalPref('budget.startMonth');
  const [maxMonthsPref] = useGlobalPref('maxMonths');
  const [showHiddenCategories = false] = useLocalPref(
    'budget.showHiddenCategories',
  );
  const [budgetName] = useMetadataPref('budgetName');
  const { displayMax } = useBudgetMonthCount();
  const { data: { grouped: categoryGroups } = { grouped: [] } } =
    useCategories();

  // Mirrors how the budget page picks the months it displays.
  const startMonth = startMonthPref || monthUtils.currentMonth();
  const numMonths = Math.min(displayMax, maxMonthsPref || 1);
  const months = monthBounds
    ? getVisibleMonths(startMonth, numMonths, monthBounds)
    : [];

  const actions = new Map<string, ExportAction>(
    (['csv', 'pdf'] as const).flatMap(exportFormat =>
      months.map((month): [string, ExportAction] => [
        `${exportFormat}:${month}`,
        { format: exportFormat, month },
      ]),
    ),
  );

  const exporters: Record<ExportFormat, (month: string) => Promise<void>> = {
    csv: async month => {
      const cells = await fetchBudgetMonthCells(month);
      const csv = buildBudgetMonthCsv({
        month,
        categoryGroups,
        cells,
        showHiddenCategories,
        decimalPlaces: format.currency.decimalPlaces,
      });
      await window.Actual.saveFile(
        csv,
        getBudgetMonthExportFilename(budgetName, month, 'csv'),
        t('Export budget month'),
      );
    },
    pdf: async month => {
      const cells = await fetchBudgetMonthCells(month);
      const rows = buildBudgetMonthPdfRows({
        month,
        categoryGroups,
        cells,
        showHiddenCategories,
        formatAmount: value => format(value, 'financial'),
      });
      const title = t('{{budgetName}} — {{month}}', {
        budgetName: budgetName || t('Budget'),
        month: monthUtils.format(month, 'MMMM yyyy', locale),
      });
      const bytes = await buildBudgetMonthPdfBytes({ title, rows });
      await window.Actual.saveFile(
        bytes as unknown as Buffer,
        getBudgetMonthExportFilename(budgetName, month, 'pdf'),
        t('Export budget month'),
      );
    },
  };

  async function onOpen() {
    setMonthBounds(await send('get-budget-bounds'));
    setIsOpen(true);
  }

  async function onMenuSelect(name: string) {
    setIsOpen(false);

    const action = actions.get(name);
    if (!action) {
      return;
    }

    try {
      await exporters[action.format](action.month);
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to export the budget month.'),
          },
        }),
      );
    }
  }

  const menuItems = buildExportMenuItems(
    months,
    {
      exportAsCsv: t('Export as CSV'),
      exportAsPdf: t('Export as PDF'),
      csvSection: t('CSV'),
      pdfSection: t('PDF'),
    },
    month => monthUtils.format(month, 'MMMM yyyy', locale),
  );

  return (
    <>
      <Button
        ref={triggerRef}
        variant="bare"
        aria-label={t('Export budget month')}
        onPress={() => void onOpen()}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <SvgDownloadThickBottom width={13} height={13} />
        <Trans>Export</Trans>
      </Button>

      <Popover
        placement="bottom start"
        triggerRef={triggerRef}
        isOpen={isOpen}
        onOpenChange={() => setIsOpen(false)}
      >
        <Menu
          onMenuSelect={name => void onMenuSelect(name)}
          items={menuItems}
        />
      </Popover>
    </>
  );
}
