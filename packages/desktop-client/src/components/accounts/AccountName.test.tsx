import { render, screen } from '@testing-library/react';

import { AccountName } from './AccountName';

describe('AccountName', () => {
  it('renders the bare name when the account has no color', () => {
    const { container } = render(
      <AccountName account={{ name: 'Checking', color: null }} />,
    );
    expect(container.innerHTML).toBe('Checking');
  });

  it('ignores invalid colors', () => {
    const { container } = render(
      <AccountName account={{ name: 'Checking', color: 'red' }} />,
    );
    expect(container.innerHTML).toBe('Checking');
  });

  it('renders a non-interactive pill when the account has a color', () => {
    render(<AccountName account={{ name: 'Checking', color: '#1E88E5' }} />);

    const pill = screen.getByTestId('account-color-pill');
    expect(pill.tagName).toBe('SPAN');
    expect(pill).toHaveTextContent('Checking');
    expect(pill).toHaveStyle({
      display: 'inline-block',
      maxWidth: '100%',
      boxSizing: 'border-box',
      verticalAlign: 'middle',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      padding: '3px 7px',
      borderRadius: '16px',
      backgroundColor: '#1E88E5',
      color: 'rgb(255, 255, 255)',
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('removes the vertical padding when compact', () => {
    render(
      <AccountName account={{ name: 'Checking', color: '#1E88E5' }} compact />,
    );

    expect(screen.getByTestId('account-color-pill')).toHaveStyle({
      padding: '0 7px',
    });
  });

  it('applies extra styles on top of the pill', () => {
    render(
      <AccountName
        account={{ name: 'Checking', color: '#1E88E5' }}
        style={{ textDecoration: 'line-through' }}
      />,
    );

    expect(screen.getByTestId('account-color-pill')).toHaveStyle({
      textDecoration: 'line-through',
      backgroundColor: '#1E88E5',
    });
  });
});
