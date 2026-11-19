import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestAppStore, TestProviders } from '#mocks';
import { addNotification } from '#notifications/notificationsSlice';

import { Modal } from './common/Modal';
import { Notifications } from './Notifications';

describe('Notifications', () => {
  it('can be pressed while a modal is open, without closing it', async () => {
    const user = userEvent.setup();
    const store = createTestAppStore();
    const onClose = vi.fn();
    const action = vi.fn();

    render(
      <TestProviders store={store}>
        <Modal name="test" onClose={onClose}>
          <button>Inside the modal</button>
        </Modal>
        <Notifications />
      </TestProviders>,
    );
    await screen.findByTestId('test-modal');

    act(() => {
      store.dispatch(
        addNotification({
          notification: {
            type: 'message',
            message: 'Removed "receipt.png".',
            button: { title: 'Undo', action },
          },
        }),
      );
    });

    // The modal makes everything outside it inert or aria-hidden, except
    // top-layer elements, so the button is still found by its role
    const notification = await screen.findByRole('alert');
    await user.click(
      within(notification).getByRole('button', { name: 'Undo' }),
    );

    expect(action).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('test-modal')).toBeInTheDocument();
  });
});
