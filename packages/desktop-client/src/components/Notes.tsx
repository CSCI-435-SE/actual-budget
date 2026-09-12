import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';
import rehypeExternalLinks from 'rehype-external-links';
import remarkGfm from 'remark-gfm';

import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import {
  markdownBaseStyles,
  remarkBreaks,
  sequentialNewlinesPlugin,
} from '#util/markdown';

const remarkPlugins = [sequentialNewlinesPlugin, remarkGfm, remarkBreaks];

export const MAX_NOTES_LENGTH = 1800;
const NOTES_LENGTH_WARNING_THRESHOLD = 1700;

const NOTES_LENGTH_LEVELS = ['none', 'near', 'limit'] as const;
type NotesLengthLevel = (typeof NOTES_LENGTH_LEVELS)[number];

function getNotesLengthLevel(length: number): NotesLengthLevel {
  if (length >= MAX_NOTES_LENGTH) {
    return 'limit';
  }
  if (length >= NOTES_LENGTH_WARNING_THRESHOLD) {
    return 'near';
  }
  return 'none';
}

const markdownStyles = css(markdownBaseStyles, {
  display: 'block',
  maxWidth: 350,
  padding: 8,
});

type NotesProps = {
  notes: string;
  editable?: boolean;
  focused?: boolean;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  getStyle?: (editable: boolean) => CSSProperties;
};

export function Notes({
  notes,
  editable,
  focused,
  onChange,
  onBlur,
  getStyle,
}: NotesProps) {
  const { isNarrowWidth } = useResponsive();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const notifiedLevelRef = useRef<NotesLengthLevel>('none');

  useEffect(() => {
    if (focused && editable) {
      textAreaRef.current?.focus();
    }
  }, [focused, editable]);

  function handleChange(value: string) {
    const level = getNotesLengthLevel(value.length);
    const previousLevel = notifiedLevelRef.current;
    notifiedLevelRef.current = level;

    // Only notify when crossing upwards, so deleting text never re-warns.
    if (
      NOTES_LENGTH_LEVELS.indexOf(level) >
      NOTES_LENGTH_LEVELS.indexOf(previousLevel)
    ) {
      dispatch(
        addNotification({
          notification: {
            id: `notes-length-${level}`,
            type: 'warning',
            message:
              level === 'limit'
                ? t(
                    'You have reached the {{max}} character limit for notes. No more text can be added.',
                    { max: MAX_NOTES_LENGTH },
                  )
                : t('You are nearing the {{max}} character limit for notes.', {
                    max: MAX_NOTES_LENGTH,
                  }),
          },
        }),
      );
    }

    onChange?.(value);
  }

  return editable ? (
    <textarea
      ref={textAreaRef}
      className={css({
        border: '1px solid ' + theme.buttonNormalBorder,
        padding: 7,
        ...(!isNarrowWidth && { minWidth: 350, minHeight: 120 }),
        outline: 'none',
        backgroundColor: theme.tableBackground,
        color: theme.tableText,
        ...getStyle?.(editable),
      })}
      value={notes || ''}
      maxLength={MAX_NOTES_LENGTH}
      onChange={e => handleChange(e.target.value)}
      onBlur={e => onBlur?.(e.target.value)}
      placeholder={t('Notes (markdown supported)')}
    />
  ) : (
    <Text className={css([markdownStyles, getStyle?.(false)])}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[
          [
            rehypeExternalLinks,
            { target: '_blank', rel: ['noopener', 'noreferrer'] },
          ],
        ]}
      >
        {notes}
      </ReactMarkdown>
    </Text>
  );
}
