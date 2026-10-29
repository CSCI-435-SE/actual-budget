import { useContext, useId, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button as AriaButton,
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
  Color,
  ColorSwatchProps,
} from 'react-aria-components';

import { css } from '@emotion/css';

import { ColorPreview } from './ColorPreview';
import { CustomColorPicker } from './CustomColorPicker';
import { SvgCheveronDown } from './icons/v1';
import { Input } from './Input';
import { Popover } from './Popover';
import { theme } from './theme';
import { Tooltip } from './Tooltip';
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
  onChange?: (color: Color) => void;
};

function ColorSwatchPicker({
  columns = 5,
  colorset = DEFAULT_COLOR_SET,
  onChange,
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
        onChange={onChange}
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

const CUSTOM_COLOR_LABEL = 'Pick a custom color';

// Sized and bordered like the hex input beside it, so the preview reads as a
// control that opens something rather than a static swatch
const previewButtonClassName = css({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 3,
  paddingRight: 5,
  border: `1px solid ${theme.formInputBorder}`,
  borderRadius: 4,
  backgroundColor: theme.tableBackground,
  color: theme.formInputText,
  cursor: 'pointer',
  outline: 'none',
  '&[data-hovered]': {
    backgroundColor: theme.buttonBareBackgroundHover,
  },
  '&[aria-expanded="true"]': {
    borderColor: theme.formInputBorderSelected,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${theme.formInputBorderSelected}`,
    outlineOffset: 2,
  },
  '& svg': {
    transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  '&[aria-expanded="true"] svg': {
    transform: 'rotate(180deg)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& svg': { transition: 'none' },
  },
});

type HexColorFieldProps = {
  isCustomPickerOpen: boolean;
  customPickerId: string;
  onToggleCustomPicker: () => void;
  onCommit?: (color: Color) => void;
};

function HexColorField({
  isCustomPickerOpen,
  customPickerId,
  onToggleCustomPicker,
  onCommit,
}: HexColorFieldProps) {
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
        onCommit?.(color);
      }
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 4,
      }}
    >
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
      <Tooltip content={CUSTOM_COLOR_LABEL} placement="bottom">
        <AriaButton
          aria-label={CUSTOM_COLOR_LABEL}
          aria-expanded={isCustomPickerOpen}
          aria-controls={isCustomPickerOpen ? customPickerId : undefined}
          className={previewButtonClassName}
          onPress={onToggleCustomPicker}
        >
          <ColorPreview
            color={isHexDigits(digits) ? `#${digits}` : null}
            style={{ width: 20, height: 20, borderRadius: 2 }}
          />
          <SvgCheveronDown aria-hidden="true" width={10} height={10} />
        </AriaButton>
      </Tooltip>
    </View>
  );
}

type ColorPickerContentProps = {
  columns?: number;
  colorset?: string[];
  onChangeEnd?: (color: Color) => void;
};

function ColorPickerContent({
  columns,
  colorset,
  onChangeEnd,
}: ColorPickerContentProps) {
  const customPickerId = useId();
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  return (
    <>
      <ColorSwatchPicker
        columns={columns}
        colorset={colorset}
        onChange={onChangeEnd}
      />
      <HexColorField
        isCustomPickerOpen={isCustomPickerOpen}
        customPickerId={customPickerId}
        onToggleCustomPicker={() => setIsCustomPickerOpen(open => !open)}
        onCommit={onChangeEnd}
      />
      {isCustomPickerOpen && (
        <CustomColorPicker id={customPickerId} onChangeEnd={onChangeEnd} />
      )}
    </>
  );
}

type ColorPickerProps = {
  children?: ReactNode;
  columns?: number;
  colorset?: string[];
  // Fires once a change is settled (a swatch or complete hex value is picked,
  // or a drag or held key on the custom picker ends), while onChange also
  // fires mid-drag
  onChangeEnd?: (color: Color) => void;
} & AriaColorPickerProps;

export function ColorPicker({
  children,
  columns,
  colorset,
  onChangeEnd,
  ...props
}: ColorPickerProps) {
  // A controlled value is usually stored as hex, which drops hue and
  // saturation for grays, so keep using the last emitted color while it
  // still matches that hex to stop the custom picker's thumbs jumping
  const [lastColor, setLastColor] = useState<Color | null>(null);
  const value =
    lastColor &&
    typeof props.value === 'string' &&
    props.value.toUpperCase() === lastColor.toString('hex')
      ? lastColor
      : props.value;

  return (
    <AriaColorPicker
      defaultValue={props.defaultValue ?? '#690CB0'}
      {...props}
      value={value}
      onChange={color => {
        setLastColor(color);
        props.onChange?.(color);
      }}
    >
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
            <ColorPickerContent
              columns={columns}
              colorset={colorset}
              onChangeEnd={onChangeEnd}
            />
          </Dialog>
        </Popover>
      </DialogTrigger>
    </AriaColorPicker>
  );
}
