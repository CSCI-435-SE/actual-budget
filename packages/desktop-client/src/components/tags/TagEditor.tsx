import type { RefObject } from 'react';

import { Button } from '@actual-app/components/button';
import { ColorPicker } from '@actual-app/components/color-picker';
import type { TagEntity } from '@actual-app/core/types/models';
import { useQueryClient } from '@tanstack/react-query';

import { useTagCSS } from '#hooks/useTagCSS';
import { tagQueries, useUpdateTagMutation } from '#tags';

type TagEditorProps = {
  tag: TagEntity;
  ref: RefObject<HTMLButtonElement | null>;
};

export const TagEditor = ({ tag, ref }: TagEditorProps) => {
  const getTagCSS = useTagCSS({ ellipsis: true });
  const queryClient = useQueryClient();
  const { mutate: updateTag } = useUpdateTagMutation();

  const formattedTag = <>#{tag.tag}</>;

  return (
    <ColorPicker
      value={tag.color ?? undefined}
      onChange={color => {
        // Preview the color on every visible tag without saving it, since
        // dragging the custom picker fires this many times per second
        const { queryKey } = tagQueries.list();
        void queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData(queryKey, tags =>
          tags?.map(t =>
            t.id === tag.id ? { ...t, color: color.toString('hex') } : t,
          ),
        );
      }}
      onChangeEnd={color => {
        updateTag({ tag: { ...tag, color: color.toString('hex') } });
      }}
    >
      <Button variant="bare" className={getTagCSS(tag.tag)} ref={ref}>
        {formattedTag}
      </Button>
    </ColorPicker>
  );
};
