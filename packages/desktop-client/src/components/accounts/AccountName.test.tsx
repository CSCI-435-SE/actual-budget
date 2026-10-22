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
    expect(pill).toHaveStyle({ backgroundColor: '#1E88E5' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
