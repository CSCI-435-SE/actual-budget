import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCalendar } from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import type { InflationComparison } from '@actual-app/core/shared/personal-inflation';

type PersonalInflationComparisonSelectorProps = {
  comparison: InflationComparison;
  onChange: (comparison: InflationComparison) => void;
};

export function PersonalInflationComparisonSelector({
  comparison,
  onChange,
}: PersonalInflationComparisonSelectorProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const options: Array<{ name: InflationComparison; text: string }> = [
    { name: 'previous-year', text: t('Compare to same months last year') },
    { name: 'previous-period', text: t('Compare to previous period') },
  ];

  return (
    <>
      <Button
        ref={triggerRef}
        variant="bare"
        onPress={() => setIsOpen(true)}
        aria-label={t('Change comparison period')}
      >
        <SvgCalendar style={{ width: 12, height: 12 }} />
        <span style={{ marginLeft: 5 }}>
          {options.find(option => option.name === comparison)?.text}
        </span>
      </Button>

      <Popover
        triggerRef={triggerRef}
        placement="bottom start"
        isOpen={isOpen}
        onOpenChange={() => setIsOpen(false)}
      >
        <Menu
          onMenuSelect={item => {
            onChange(item);
            setIsOpen(false);
          }}
          items={options}
        />
      </Popover>
    </>
  );
}
