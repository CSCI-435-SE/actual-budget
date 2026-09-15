import { render, screen } from '@testing-library/react';

import { CharacterCounter } from './CharacterCounter';

describe('CharacterCounter', () => {
  it('renders the current length and max length', () => {
    render(<CharacterCounter length={12} maxLength={50} />);
    expect(screen.getByText('12/50')).toBeInTheDocument();
  });

  it('is not warning-colored while far from the limit', () => {
    render(<CharacterCounter length={10} maxLength={50} />);
    const counter = screen.getByText('10/50');
    expect(counter).toHaveStyle({ color: 'var(--color-pageTextLight)' });
  });

  it('switches to a warning color near the limit', () => {
    render(<CharacterCounter length={45} maxLength={50} />);
    const counter = screen.getByText('45/50');
    expect(counter).toHaveStyle({ color: 'var(--color-warningText)' });
  });

  it('treats being exactly at the limit as near the limit', () => {
    render(<CharacterCounter length={50} maxLength={50} />);
    const counter = screen.getByText('50/50');
    expect(counter).toHaveStyle({ color: 'var(--color-warningText)' });
  });
});
