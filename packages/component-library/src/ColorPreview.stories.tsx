import type { Meta, StoryObj } from '@storybook/react-vite';

import { ColorPreview } from './ColorPreview';

const meta = {
  title: 'Components/ColorPreview',
  component: ColorPreview,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ColorPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    color: '#1976D2',
  },
};

export const Empty: Story = {
  args: {
    color: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shown when there is no valid color to preview.',
      },
    },
  },
};
