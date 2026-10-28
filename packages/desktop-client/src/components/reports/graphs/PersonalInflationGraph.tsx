import { Trans } from 'react-i18next';

import type { CSSProperties } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useRechartsAnimation } from '#components/reports/chart-theme';
import { Container } from '#components/reports/Container';
import { formatRate } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import type { PersonalInflationTrendPoint } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import { useLanguage } from '#hooks/useLocale';

import { PersonalInflationTooltip } from './PersonalInflationTooltip';

type PersonalInflationGraphProps = {
  style?: CSSProperties;
  data: PersonalInflationTrendPoint[];
  compact?: boolean;
  showTooltip?: boolean;
};

export function PersonalInflationGraph({
  style,
  data,
  compact = false,
  showTooltip = true,
}: PersonalInflationGraphProps) {
  const animationProps = useRechartsAnimation();
  const language = useLanguage();
  const hasData = data.some(point => point.rate !== null);

  return (
    <Container
      style={{
        ...style,
        ...(compact && { height: 'auto' }),
      }}
    >
      {(width, height) =>
        hasData ? (
          <div>
            {!compact && <div style={{ marginTop: '15px' }} />}
            <LineChart
              width={width}
              height={height}
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: compact ? 0 : 10,
                bottom: 10,
              }}
            >
              {!compact && (
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
              )}
              {!compact && (
                <XAxis
                  dataKey="date"
                  tick={{
                    fill: theme.reportsLabel,
                    fontSize: 'var(--font-size-12)',
                  }}
                  tickLine={{ stroke: theme.reportsLabel }}
                />
              )}
              {!compact && (
                <YAxis
                  tickFormatter={value => formatRate(value, language)}
                  tick={{
                    fill: theme.reportsLabel,
                    fontSize: 'var(--font-size-12)',
                  }}
                  tickLine={{ stroke: theme.reportsLabel }}
                />
              )}
              {showTooltip && (
                <Tooltip
                  content={<PersonalInflationTooltip />}
                  isAnimationActive={false}
                />
              )}
              <ReferenceLine
                y={0}
                stroke={theme.reportsLabel}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke={theme.reportsChartFill}
                strokeWidth={2}
                dot={!compact}
                activeDot={{ r: 6, fill: theme.reportsChartFill }}
                {...animationProps}
              />
            </LineChart>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>Not enough spending history yet</Trans>
          </div>
        )
      }
    </Container>
  );
}
