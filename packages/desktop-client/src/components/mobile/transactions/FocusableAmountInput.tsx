import React, { memo, useEffect, useRef, useState } from 'react';
import type {
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  HTMLProps,
  Ref,
} from 'react';

import { Button } from '@actual-app/components/button';
import type { CSSProperties as EmotionCSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import {
  getNumberFormat,
  reapplyThousandSeparators,
} from '@actual-app/core/shared/util';
import { css } from '@emotion/css';

import { makeAmountFullStyle } from '#components/budget/util';
import { useFormat } from '#hooks/useFormat';
import { useMergedRefs } from '#hooks/useMergedRefs';

type AmountInputProps = {
  value: number;
  focused?: boolean;
  style?: CSSProperties;
  textStyle?: CSSProperties;
  inputRef?: Ref<HTMLInputElement>;
  onFocus?: HTMLProps<HTMLInputElement>['onFocus'];
  onBlur?: HTMLProps<HTMLInputElement>['onBlur'];
  onEnter?: HTMLProps<HTMLInputElement>['onKeyUp'];
  onChangeValue?: (value: string) => void;
  onUpdate?: (value: string) => void;
  onUpdateAmount?: (value: number) => void;
};

const AmountInput = memo(function AmountInput({
  focused,
  style,
  textStyle,
  ...props
}: AmountInputProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [value, setValue] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const format = useFormat();

  const mergedInputRef = useMergedRefs<HTMLInputElement>(
    props.inputRef,
    inputRef,
  );

  const initialValue = Math.abs(props.value);

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus();
    }
  }, [focused]);

  useEffect(() => {
    setEditing(false);
    setText('');
    setValue(initialValue);
  }, [initialValue]);

  const onKeyUp: HTMLProps<HTMLInputElement>['onKeyUp'] = e => {
    if (e.key === 'Backspace' && text === '') {
      setEditing(true);
    } else if (e.key === 'Enter') {
      props.onEnter?.(e);
      if (!e.defaultPrevented) {
        onUpdate(e.currentTarget.value);
      }
    }
  };

  // Read from the DOM, not React state: onChange state updates flush
  // asynchronously, so an onBlur/onKeyUp fired by the user's next action
  // can see stale `text=''` and save 0 instead of the typed amount.
  const applyText = (rawInput?: string) => {
    const domText = rawInput ?? inputRef.current?.value ?? text;
    // `value` and `props.value` are decimal `Amount`s, so parse to an
    // `IntegerAmount` and scale back down — this also quantizes the input to
    // the active currency's precision.
    const parsed = format.toAmount(format.fromEdit(domText) ?? 0);
    const hasPendingInput = domText !== '' || editing;
    const newValue = hasPendingInput ? parsed : value;

    setValue(Math.abs(newValue));
    setEditing(false);
    setText('');

    return newValue;
  };

  const onFocus: HTMLProps<HTMLInputElement>['onFocus'] = e => {
    props.onFocus?.(e);
  };

  const onUpdate = (value: string) => {
    const originalAmount = Math.abs(props.value);
    const amount = applyText(value);
    if (amount !== originalAmount) {
      props.onUpdate?.(value);
      props.onUpdateAmount?.(amount);
    }
  };

  const onBlur: HTMLProps<HTMLInputElement>['onBlur'] = e => {
    props.onBlur?.(e);
    if (!e.defaultPrevented) {
      onUpdate(e.target.value);
    }
  };

  // Keypad semantics: digits shift in from the right, so at two decimal places
  // "1" becomes 0.01 and "123" becomes 1.23. `appendDecimals` hardcodes two
  // decimals, so the shift is done here against the active currency instead.
  const appendCurrencyDecimals = (amountText: string) => {
    const { decimalSeparator } = getNumberFormat();
    const decimalPlaces = format.hideFraction
      ? 0
      : format.currency.decimalPlaces;

    let result = amountText;
    if (result.slice(-1) === decimalSeparator) {
      result = result.slice(0, -1);
    }

    if (decimalPlaces > 0) {
      result = result.replaceAll(/[,.]/g, '');
      result = result.replace(/^0+(?!$)/, '');
      result = result.padStart(decimalPlaces + 1, '0');
      result =
        result.slice(0, -decimalPlaces) +
        decimalSeparator +
        result.slice(-decimalPlaces);
    }

    return format.forEdit(format.fromEdit(result) ?? 0);
  };

  const onChangeText = (text: string) => {
    text = reapplyThousandSeparators(text);
    text = appendCurrencyDecimals(text);
    setEditing(true);
    setText(text);
    props.onChangeValue?.(text);
  };

  const input = (
    <input
      type="text"
      ref={mergedInputRef}
      value={text}
      inputMode="decimal"
      autoCapitalize="none"
      onChange={e => onChangeText(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyUp={onKeyUp}
      data-testid="amount-input"
      style={{ flex: 1, textAlign: 'center', position: 'absolute' }}
    />
  );

  return (
    <View
      style={{
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.pillBorderSelected,
        borderRadius: 4,
        padding: 5,
        backgroundColor: theme.tableBackground,
        maxWidth: 'calc(100% - 40px)',
        ...style,
      }}
    >
      <View style={{ overflowY: 'auto', overflowX: 'hidden' }}>{input}</View>
      <Text
        style={{
          pointerEvents: 'none',
          ...textStyle,
        }}
        data-testid="amount-input-text"
      >
        {editing
          ? text || format(0, 'financial')
          : format(format.fromAmount(value), 'financial')}
      </Text>
    </View>
  );
});

export type FocusableAmountInputProps = Omit<AmountInputProps, 'onFocus'> & {
  sign?: '+' | '-';
  zeroSign?: '+' | '-';
  focused?: boolean;
  disabled?: boolean;
  focusedStyle?: CSSProperties;
  buttonProps?: Omit<ComponentPropsWithRef<typeof Button>, 'style'> & {
    style?: EmotionCSSProperties;
  };
  onFocus?: (event?: FocusEvent<HTMLInputElement>) => void;
};

export const FocusableAmountInput = memo(function FocusableAmountInput({
  value,
  sign,
  zeroSign,
  focused,
  disabled,
  textStyle,
  style,
  focusedStyle,
  buttonProps,
  onFocus,
  onBlur,
  onChangeValue,
  ...props
}: FocusableAmountInputProps) {
  const format = useFormat();
  const [isNegative, setIsNegative] = useState(true);
  const [liveValue, setLiveValue] = useState(Math.abs(value));

  const maybeApplyNegative = (amount: number, negative: boolean) => {
    const absValue = Math.abs(amount);
    return negative ? -absValue : absValue;
  };

  const onUpdateAmount = (amount: number, negative: boolean) => {
    props.onUpdateAmount?.(maybeApplyNegative(amount, negative));
  };

  const handleChangeValue = (text: string) => {
    setLiveValue(format.toAmount(format.fromEdit(text) ?? 0));
    onChangeValue?.(text);
  };

  useEffect(() => {
    setLiveValue(Math.abs(value));
  }, [value]);

  useEffect(() => {
    if (sign) {
      setIsNegative(sign === '-');
    } else if (value > 0 || (zeroSign !== '-' && value === 0)) {
      setIsNegative(false);
    }
  }, [sign, value, zeroSign]);

  const toggleIsNegative = () => {
    if (disabled) {
      return;
    }

    onUpdateAmount(value, !isNegative);
    setIsNegative(!isNegative);
  };

  return (
    <View>
      <AmountInput
        {...props}
        value={value}
        onFocus={onFocus}
        onBlur={onBlur}
        onChangeValue={handleChangeValue}
        onUpdateAmount={amount => onUpdateAmount(amount, isNegative)}
        focused={focused && !disabled}
        style={{
          ...makeAmountFullStyle(maybeApplyNegative(liveValue, isNegative), {
            zeroColor: isNegative ? theme.numberNegative : theme.numberNeutral,
            positiveColor: theme.numberPositive,
            negativeColor: theme.numberNegative,
          }),
          width: 80,
          justifyContent: 'center',
          ...style,
          ...focusedStyle,
          ...(!focused && {
            display: 'none',
          }),
        }}
        textStyle={{ fontSize: 15, textAlign: 'right', ...textStyle }}
      />

      <View>
        {!focused && (
          <Button
            style={{
              position: 'absolute',
              right: 'calc(100% + 5px)',
              top: '8px',
            }}
            onPress={toggleIsNegative}
          >
            {isNegative ? '-' : '+'}
          </Button>
        )}
        <Button
          onPress={() => onFocus?.()}
          // Defines how far touch can start away from the button
          // hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          {...buttonProps}
          className={css({
            ...(buttonProps && buttonProps.style),
            ...(focused && { display: 'none' }),
            '&[data-pressed]': {
              backgroundColor: 'transparent',
            },
          })}
          variant="bare"
        >
          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: '#e0e0e0',
              borderTopColor: 'transparent',
              justifyContent: 'center',
              ...style,
            }}
          >
            <Text
              style={{
                ...makeAmountFullStyle(value, {
                  positiveColor: theme.numberPositive,
                  negativeColor: theme.numberNegative,
                  zeroColor: theme.numberNeutral,
                }),
                fontSize: 15,
                userSelect: 'none',
                ...textStyle,
              }}
            >
              {format(format.fromAmount(Math.abs(value)), 'financial')}
            </Text>
          </View>
        </Button>
      </View>
    </View>
  );
});
