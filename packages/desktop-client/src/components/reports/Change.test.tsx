import React from 'react';

import { theme } from '@actual-app/components/theme';
import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { Change } from './Change';

describe('Change', () => {
  it('renders a positive amount with a plus sign and positive color', () => {
    render(
      <TestProviders>
        <Change amount={12345} />
      </TestProviders>,
    );
    const el = screen.getByText('+123.45');
    expect(el).toBeInTheDocument();
    expect(getComputedStyle(el).color).toBe(theme.reportsNumberPositive);
  });

  it('renders zero with a plus sign and neutral color', () => {
    render(
      <TestProviders>
        <Change amount={0} />
      </TestProviders>,
    );
    const el = screen.getByText('+0.00');
    expect(el).toBeInTheDocument();
    expect(getComputedStyle(el).color).toBe(theme.reportsNumberNeutral);
  });

  it('renders a negative amount with a minus sign and negative color', () => {
    render(
      <TestProviders>
        <Change amount={-9876} />
      </TestProviders>,
    );
    const el = screen.getByText('-98.76');
    expect(el).toBeInTheDocument();
    expect(getComputedStyle(el).color).toBe(theme.reportsNumberNegative);
  });

  it('renders a positive percentage with a plus sign', () => {
    render(
      <TestProviders>
        <Change amount={12345} percent={12.5} />
      </TestProviders>,
    );
    const el = screen.getByText('+123.45 (+12.5%)');
    expect(getComputedStyle(el).color).toBe(theme.reportsNumberPositive);
  });

  it('renders a negative percentage with a minus sign', () => {
    render(
      <TestProviders>
        <Change amount={-9876} percent={-7.3} />
      </TestProviders>,
    );
    const el = screen.getByText('-98.76 (-7.3%)');
    expect(getComputedStyle(el).color).toBe(theme.reportsNumberNegative);
  });

  it('rounds the percentage to one decimal place', () => {
    render(
      <TestProviders>
        <Change amount={1000} percent={100 / 3} />
      </TestProviders>,
    );
    expect(screen.getByText('+10.00 (+33.3%)')).toBeInTheDocument();
  });

  it('renders a zero percentage without a sign', () => {
    render(
      <TestProviders>
        <Change amount={0} percent={0} />
      </TestProviders>,
    );
    expect(screen.getByText('+0.00 (0.0%)')).toBeInTheDocument();
  });

  it('renders a placeholder when the percentage is null', () => {
    render(
      <TestProviders>
        <Change amount={1000} percent={null} />
      </TestProviders>,
    );
    expect(screen.getByText('+10.00 (--)')).toBeInTheDocument();
  });

  it('merges custom style prop', () => {
    render(
      <TestProviders>
        <Change amount={1000} style={{ fontWeight: 'bold' }} />
      </TestProviders>,
    );
    const el = screen.getByText('+10.00');
    const computed = getComputedStyle(el);
    expect(computed.color).toBe(theme.reportsNumberPositive);
    expect(computed.fontWeight).toBe('bold');
  });
});
