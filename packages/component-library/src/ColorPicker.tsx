import { useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ColorPicker as AriaColorPicker,
  ColorPickerStateContext,
  ColorSwatch as AriaColorSwatch,
  ColorSwatchPicker as AriaColorSwatchPicker,
  ColorSwatchPickerItem,
  Dialog,
  DialogTrigger,
  parseColor,
} from 'react-aria-components';
import type {
  ColorPickerProps as AriaColorPickerProps,
  ColorSwatchProps,
} from 'react-aria-components';

import { css } from '@emotion/css';

import { ColorPreview } from './ColorPreview';
import { Input } from './Input';
import { Popover } from './Popover';
import { theme } from './theme';
import { View } from './View';

function ColorSwatch(props: ColorSwatchProps) {
  return (
    <AriaColorSwatch
      {...props}
      style={({ color }) => ({
        background: color.toString('hex'),
        width: '32px',
        height: '32px',
        borderRadius: '4px',
        boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.1)',
      })}
    />
  );
}

const DEFAULT_COLOR_SET = [
  '#690CB0',
  '#D32F2F',
  '#C2185B',
  '#7B1FA2',
  '#512DA8',
  '#303F9F',
  '#1976D2',
  '#0288D1',
  '#0097A7',
  '#00796B',
  '#388E3C',
  '#689F38',
  '#AFB42B',
  '#FBC02D',
  '#FFA000',
  '#F57C00',
  '#E64A19',
  '#5D4037',
  '#616161',
  '#455A64',
  '#FF6666', //red
  '#FF99FF', //magenta
  '#C39DDF', //purple
  '#6666FF', //blue
  '#B2FFFF', //cyan
  '#99cb99', //green
  '#FFFF7F', //yellow
  '#FFAB66', //orange
  '#D4B89C', //brown
  '#BFBFBF', //gray
  '#FFAEAE', //colors repeat from above with a lighter tint
  '#FFCCFF',
  '#E4D4FF', //this is now purple125
  '#B0B0FF',
  '#D8FFFF',
  '#CFE5CF',
  '#FFFFB2',
  '#FFD5B3',
  '#E4D3C3',
  '#DADADA',
];

type ColorSwatchPickerProps = {
  columns?: number;
  colorset?: string[];
};

function ColorSwatchPicker({
  columns = 5,
  colorset = DEFAULT_COLOR_SET,
}: ColorSwatchPickerProps) {
  const pickers = [];

  for (let l = 0; l < colorset.length / columns; l++) {
    const pickerItems = [];

    for (let c = 0; c < columns; c++) {
      const color = colorset[columns * l + c];
      if (!color) {
        break;
      }

      pickerItems.push(
        <ColorSwatchPickerItem
          key={color}
          color={color}
          className={css({
            position: 'relative',
            outline: 'none',
            borderRadius: '4px',
            width: 'fit-content',
            forcedColorAdjust: 'none',
            cursor: 'pointer',

            '&[data-selected]::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              border: '2px solid black',
              outline: '2px solid white',
              outlineOffset: '-4px',
              borderRadius: 'inherit',
            },
          })}
        >
          <ColorSwatch />
        </ColorSwatchPickerItem>,
      );
    }

    pickers.push(
      <AriaColorSwatchPicker
        key={`colorset-${l}`}
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {pickerItems}
      </AriaColorSwatchPicker>,
    );
  }

  return pickers;
}
const isHexDigits = (value: string) => /^[0-9a-fA-F]{6}$/.test(value);

function HexColorField() {
  const state = useContext(ColorPickerStateContext);
  const currentDigits = state?.color.toString('hex').slice(1) ?? '';
  const [digits, setDigits] = useState(currentDigits);
  const [syncedDigits, setSyncedDigits] = useState(currentDigits);

  // Pick up changes made outside this field, e.g. clicking a swatch
  if (currentDigits !== syncedDigits) {
    setSyncedDigits(currentDigits);
    if (currentDigits.toLowerCase() !== digits.toLowerCase()) {
      setDigits(currentDigits);
    }
  }

  const onChangeValue = (value: string) => {
    const nextDigits = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setDigits(nextDigits);

    if (isHexDigits(nextDigits)) {
      const color = parseColor(`#${nextDigits}`);
      if (color) {
        state?.setColor(color);
      }
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.formInputTextPlaceholder,
            pointerEvents: 'none',
          }}
        >
          #
        </span>
        <Input
          aria-label="Hex color"
          placeholder="RRGGBB"
          value={digits}
          onChangeValue={onChangeValue}
          onBlur={() => setDigits(currentDigits)}
          style={{ width: 100, paddingLeft: 16 }}
        />
      </View>
      <ColorPreview color={isHexDigits(digits) ? `#${digits}` : null} />
    </View>
  );
}

type ColorPickerProps = {
  children?: ReactNode;
  columns?: number;
  colorset?: string[];
  /** Optional content at the bottom of the popover, e.g. a "Remove color" button */
  footer?: ReactNode;
} & AriaColorPickerProps;

export function ColorPicker({
  children,
  columns,
  colorset,
  footer,
  ...props
}: ColorPickerProps) {
  return (
    <AriaColorPicker defaultValue={props.defaultValue ?? '#690CB0'} {...props}>
      <DialogTrigger>
        {children}
        <Popover>
          <Dialog
            style={{
              outline: 'none',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '192px',
              maxHeight: 'inherit',
              boxSizing: 'border-box',
              overflow: 'auto',
            }}
          >
            <ColorSwatchPicker columns={columns} colorset={colorset} />
            <HexColorField />
          </Dialog>
        </Popover>
      </DialogTrigger>
    </AriaColorPicker>
  );
}
