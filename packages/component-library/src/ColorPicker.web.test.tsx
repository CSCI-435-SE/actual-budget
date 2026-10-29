import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from './Button';
import { ColorPicker } from './ColorPicker';

function renderOpenPicker(defaultValue = '#690CB0') {
  const onChange = vi.fn();
  const onChangeEnd = vi.fn();
  render(
    <ColorPicker
      defaultValue={defaultValue}
      onChange={onChange}
      onChangeEnd={onChangeEnd}
    >
      <Button>Pick a color</Button>
    </ColorPicker>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }));

  return {
    onChange,
    onChangeEnd,
    input: screen.getByRole('textbox', { name: 'Hex color' }),
    preview: () => screen.getByTestId('color-preview'),
  };
}

function openCustomPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Pick a custom color' }));
}

function ControlledHexPicker({ initialColor }: { initialColor: string }) {
  const [color, setColor] = useState(initialColor);
  return (
    <ColorPicker value={color} onChange={c => setColor(c.toString('hex'))}>
      <Button>Pick a color</Button>
    </ColorPicker>
  );
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

  it('settles the change when a swatch or a complete hex value is picked', () => {
    const { input, onChangeEnd } = renderOpenPicker('#690CB0');

    fireEvent.change(input, { target: { value: 'FF0' } });
    expect(onChangeEnd).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'FF0000' } });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd.mock.calls[0][0].toString('hex')).toBe('#FF0000');

    const swatch = screen
      .getAllByRole('option')
      .find(option => option.dataset.key?.startsWith('#D32F2F'));
    if (!swatch) {
      throw new Error('Swatch #D32F2F not found');
    }
    fireEvent.click(swatch);

    expect(onChangeEnd).toHaveBeenCalledTimes(2);
    expect(onChangeEnd.mock.calls[1][0].toString('hex')).toBe('#D32F2F');
  });

  it('toggles the custom picker from the color preview', () => {
    renderOpenPicker();
    const toggle = screen.getByRole('button', { name: 'Pick a custom color' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeTruthy();

    fireEvent.click(toggle);

    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();
  });

  it('syncs the hex field with the custom picker', () => {
    const { input, onChange, onChangeEnd } = renderOpenPicker('#FF0000');
    openCustomPicker();
    const hue = screen.getByRole('slider', { name: 'Hue' });

    fireEvent.keyDown(hue, { key: 'PageUp' });
    fireEvent.keyUp(hue, { key: 'PageUp' });

    const picked = onChange.mock.lastCall?.[0].toString('hex');
    expect(picked).not.toBe('#FF0000');
    expect(input).toHaveProperty('value', picked.slice(1));
    expect(onChangeEnd.mock.lastCall?.[0].toString('hex')).toBe(picked);

    fireEvent.change(input, { target: { value: '0000FF' } });

    expect(hue).toHaveProperty('value', '240');
  });

  it('settles a held key once, when it is released', () => {
    const { onChange, onChangeEnd } = renderOpenPicker('#FF0000');
    openCustomPicker();
    const hue = screen.getByRole('slider', { name: 'Hue' });

    fireEvent.keyDown(hue, { key: 'PageUp' });
    fireEvent.keyDown(hue, { key: 'PageUp', repeat: true });
    fireEvent.keyDown(hue, { key: 'PageUp', repeat: true });

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChangeEnd).not.toHaveBeenCalled();

    fireEvent.keyUp(hue, { key: 'PageUp' });

    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd.mock.calls[0][0].toString('hex')).toBe(
      onChange.mock.lastCall?.[0].toString('hex'),
    );
  });

  it('speeds up a held arrow key and settles it once', () => {
    const { onChangeEnd } = renderOpenPicker('#FF0000');
    openCustomPicker();
    const hue = screen.getByRole('slider', { name: 'Hue' });
    if (!(hue instanceof HTMLInputElement)) {
      throw new Error('Hue slider is not an input');
    }

    fireEvent.keyDown(hue, { key: 'ArrowRight' });
    for (let i = 0; i < 9; i++) {
      fireEvent.keyDown(hue, { key: 'ArrowRight', repeat: true });
    }

    // Ten one-degree steps would only reach 10
    expect(Number(hue.value)).toBeGreaterThan(10);
    expect(onChangeEnd).not.toHaveBeenCalled();

    fireEvent.keyUp(hue, { key: 'ArrowRight' });

    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd.mock.calls[0][0].getChannelValue('hue')).toBe(
      Number(hue.value),
    );
  });

  it('keeps the hue of a controlled hex value when it turns gray', () => {
    render(<ControlledHexPicker initialColor="#0000FF" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick a color' }));
    openCustomPicker();

    const [saturation] = screen
      .getAllByRole('slider')
      .filter(slider => slider.getAttribute('aria-label') !== 'Hue');
    fireEvent.change(saturation, { target: { value: '0' } });

    expect(screen.getByRole('textbox', { name: 'Hex color' })).toHaveProperty(
      'value',
      'FFFFFF',
    );
    expect(screen.getByRole('slider', { name: 'Hue' })).toHaveProperty(
      'value',
      '240',
    );
  });
});
