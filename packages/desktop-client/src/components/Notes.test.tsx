import React, { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestAppStore, TestProviders } from '#mocks';
import { removeNotification } from '#notifications/notificationsSlice';

import { MAX_NOTES_LENGTH, Notes } from './Notes';

const WARNING_THRESHOLD = 1700;

// Notification ids are scoped to each Notes instance, so tests match on the
// message instead. These prefixes avoid depending on how {{max}} interpolates.
const NEAR_WARNING = 'You are nearing the';
const LIMIT_WARNING = 'You have reached the';

type ControlledNotesProps = {
  initialNotes?: string;
  onChange?: (value: string) => void;
};

function ControlledNotes({
  initialNotes = '',
  onChange,
}: ControlledNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  return (
    <Notes
      notes={notes}
      editable
      onChange={value => {
        onChange?.(value);
        setNotes(value);
      }}
    />
  );
}

function setup({ initialNotes = '' } = {}) {
  const store = createTestAppStore();
  const onChange = vi.fn();

  render(
    <TestProviders store={store}>
      <ControlledNotes initialNotes={initialNotes} onChange={onChange} />
    </TestProviders>,
  );

  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

  return {
    store,
    onChange,
    textarea,
    notifications: () => store.getState().notifications.notifications,
    setNotes: (value: string) =>
      fireEvent.change(textarea, { target: { value } }),
  };
}

function setupTwoFields() {
  const store = createTestAppStore();

  render(
    <TestProviders store={store}>
      <ControlledNotes />
      <ControlledNotes />
    </TestProviders>,
  );

  const [firstField, secondField] = screen.getAllByRole('textbox');

  return {
    store,
    firstField,
    secondField,
    notifications: () => store.getState().notifications.notifications,
    setNotes: (field: HTMLElement, value: string) =>
      fireEvent.change(field, { target: { value } }),
  };
}

describe('Notes length enforcement', () => {
  test('sets maxLength on the textarea', () => {
    const { textarea } = setup();

    expect(textarea).toHaveAttribute('maxlength', String(MAX_NOTES_LENGTH));
  });

  test('stops accepting typed input at the maximum length', async () => {
    const { textarea, onChange } = setup({
      initialNotes: 'a'.repeat(MAX_NOTES_LENGTH - 1),
    });

    await userEvent.type(textarea, 'bbb');

    expect(textarea.value).toHaveLength(MAX_NOTES_LENGTH);
    expect(
      onChange.mock.calls.every(([value]) => value.length <= MAX_NOTES_LENGTH),
    ).toBe(true);
  });

  test('does not truncate notes that already exceed the limit', () => {
    const { textarea } = setup({ initialNotes: 'a'.repeat(2000) });

    expect(textarea.value).toHaveLength(2000);
  });
});

describe('Notes length notifications', () => {
  test('does not notify below the warning threshold', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(WARNING_THRESHOLD - 1));

    expect(notifications()).toHaveLength(0);
  });

  test('notifies when reaching the warning threshold', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(WARNING_THRESHOLD));

    expect(notifications()).toHaveLength(1);
    expect(notifications()[0]).toMatchObject({ type: 'warning' });
    expect(notifications()[0].message).toContain(NEAR_WARNING);
  });

  test('does not repeat the warning while staying below the limit', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(WARNING_THRESHOLD));
    setNotes('a'.repeat(WARNING_THRESHOLD + 50));
    setNotes('a'.repeat(MAX_NOTES_LENGTH - 1));

    expect(notifications()).toHaveLength(1);
  });

  test('escalates to a second notification once the limit is reached', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(WARNING_THRESHOLD));
    setNotes('a'.repeat(MAX_NOTES_LENGTH));

    expect(notifications()).toHaveLength(2);
    expect(notifications()[0].message).toContain(NEAR_WARNING);
    expect(notifications()[1].message).toContain(LIMIT_WARNING);
  });

  test('notifies at the limit when pasting straight past the threshold', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(MAX_NOTES_LENGTH));

    expect(notifications()).toHaveLength(1);
    expect(notifications()[0].message).toContain(LIMIT_WARNING);
  });

  test('does not warn again while deleting text back down', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(MAX_NOTES_LENGTH));
    setNotes('a'.repeat(WARNING_THRESHOLD + 10));
    setNotes('a'.repeat(WARNING_THRESHOLD));

    expect(notifications()).toHaveLength(1);
    expect(notifications()[0].message).toContain(LIMIT_WARNING);
  });

  test('does not stack a duplicate warning that is still showing', () => {
    const { setNotes, notifications } = setup();

    setNotes('a'.repeat(WARNING_THRESHOLD));
    setNotes('short');
    setNotes('a'.repeat(WARNING_THRESHOLD));

    expect(notifications()).toHaveLength(1);
  });

  test('warns again after the previous warning is dismissed', () => {
    const { setNotes, notifications, store } = setup();

    setNotes('a'.repeat(WARNING_THRESHOLD));
    store.dispatch(removeNotification({ id: notifications()[0].id }));
    expect(notifications()).toHaveLength(0);

    setNotes('short');
    setNotes('a'.repeat(WARNING_THRESHOLD));

    expect(notifications()).toHaveLength(1);
    expect(notifications()[0].message).toContain(NEAR_WARNING);
  });

  test('warns for a second note field while the first warning is showing', () => {
    const { setNotes, notifications, firstField, secondField } =
      setupTwoFields();

    setNotes(firstField, 'a'.repeat(WARNING_THRESHOLD));
    setNotes(secondField, 'a'.repeat(WARNING_THRESHOLD));

    const [firstWarning, secondWarning] = notifications();
    expect(notifications()).toHaveLength(2);
    expect(firstWarning.id).not.toBe(secondWarning.id);
    expect(secondWarning.message).toContain(NEAR_WARNING);
  });
});
