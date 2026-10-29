import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from './Button';
import { ColorPicker } from './ColorPicker';

function renderOpenPicker(defaultValue = '#690CB0') {
  const onChange = vi.fn();
  render(
    <ColorPicker defaultValue={defaultValue} onChange={onChange}>
      <Button>Pick a color</Button>
    </ColorPicker>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }));

  return {
    onChange,
    input: screen.getByRole('textbox', { name: 'Hex color' }),
    preview: () => screen.getByTestId('color-preview'),
  };
}

describe('ColorPicker', () => {
  it('shows the current color without "#" in the editable text', () => {
    const { input, preview } = renderOpenPicker('#690CB0');

    expect(input).toHaveProperty('value', '690CB0');
    expect(screen.getByText('#')).toBeTruthy();
    expect(preview().getAttribute('aria-label')).toBe('Color preview: #690CB0');
  });

  it('updates the color while typing, without needing "#"', () => {
    const { input, onChange, preview } = renderOpenPicker();

    fireEvent.change(input, { target: { value: 'FF0000' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].toString('hex')).toBe('#FF0000');
    expect(preview().getAttribute('aria-label')).toBe('Color preview: #FF0000');
  });

  it('keeps the "#" prefix when all text is deleted', () => {
    const { input, onChange, preview } = renderOpenPicker();

    fireEvent.change(input, { target: { value: '' } });

    expect(input).toHaveProperty('value', '');
    expect(screen.getByText('#')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(preview().getAttribute('aria-label')).toBe('No color preview');
  });

  it('strips "#" and invalid characters from pasted values', () => {
    const { input, onChange } = renderOpenPicker();

    fireEvent.change(input, { target: { value: '#00ff00zz' } });

    expect(input).toHaveProperty('value', '00ff00');
    expect(onChange.mock.calls[0][0].toString('hex')).toBe('#00FF00');
  });

  it('reverts an incomplete value on blur', () => {
    const { input, onChange, preview } = renderOpenPicker('#690CB0');

    fireEvent.change(input, { target: { value: 'FF0' } });
    expect(preview().getAttribute('aria-label')).toBe('No color preview');

    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveProperty('value', '690CB0');
  });

  it('syncs the text and preview when a swatch is picked', () => {
    const { input, preview } = renderOpenPicker('#690CB0');

    const swatch = screen
      .getAllByRole('option')
      .find(option => option.dataset.key?.startsWith('#D32F2F'));
    if (!swatch) {
      throw new Error('Swatch #D32F2F not found');
    }
    fireEvent.click(swatch);

    expect(input).toHaveProperty('value', 'D32F2F');
    expect(preview().getAttribute('aria-label')).toBe('Color preview: #D32F2F');
  });
});
