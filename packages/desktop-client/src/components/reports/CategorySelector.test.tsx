import React from 'react';
import type { ComponentProps } from 'react';

import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CategorySelector } from './CategorySelector';

function makeCategory({
  id,
  name,
  hidden = false,
  group = '',
}: {
  id: string;
  name: string;
  hidden?: boolean;
  group?: string;
}): CategoryEntity {
  return { id, name, hidden, group } satisfies CategoryEntity;
}

function makeCategoryGroup({
  id,
  name,
  categories,
}: {
  id: string;
  name: string;
  categories: CategoryEntity[];
}): CategoryGroupEntity {
  return { id, name, categories } satisfies CategoryGroupEntity;
}

const cat1 = makeCategory({ id: 'cat1', name: 'Category 1' });
const cat2 = makeCategory({ id: 'cat2', name: 'Category 2' });
const cat3 = makeCategory({ id: 'cat3', name: 'Category 3', hidden: true });
const group1 = makeCategoryGroup({
  id: 'group1',
  name: 'Group 1',
  categories: [cat1, cat2, cat3],
});
const cat4 = makeCategory({ id: 'cat4', name: 'Category 4' });
const group2 = makeCategoryGroup({
  id: 'group2',
  name: 'Group 2',
  categories: [cat4],
});
const categoryGroups = [group1, group2];

const defaultProps = {
  categoryGroups,
  selectedCategories: [],
  setSelectedCategories: vi.fn(),
  showHiddenCategories: true,
};

describe('CategorySelector', () => {
  it('renders category group and category checkboxes', () => {
    render(<CategorySelector {...defaultProps} />);
    expect(screen.getByLabelText('Group 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Category 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Category 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Category 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Group 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Category 4')).toBeInTheDocument();
  });

  it('calls setSelectedCategories when a category is selected', async () => {
    const setSelectedCategories = vi.fn();
    render(
      <CategorySelector
        {...defaultProps}
        setSelectedCategories={setSelectedCategories}
      />,
    );
    await userEvent.click(screen.getByLabelText('Category 1'));
    expect(setSelectedCategories).toHaveBeenCalled();
  });

  it('calls setSelectedCategories when a group is selected', async () => {
    const setSelectedCategories = vi.fn();
    render(
      <CategorySelector
        {...defaultProps}
        setSelectedCategories={setSelectedCategories}
      />,
    );
    await userEvent.click(screen.getByLabelText('Group 1'));
    expect(setSelectedCategories).toHaveBeenCalled();
  });

  it('selects all categories when Select All is clicked', async () => {
    const setSelectedCategories = vi.fn();
    render(
      <CategorySelector
        {...defaultProps}
        setSelectedCategories={setSelectedCategories}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(setSelectedCategories).toHaveBeenCalledWith([
      cat1,
      cat2,
      cat3,
      cat4,
    ]);
  });

  it('unselects all categories when Unselect All is clicked', async () => {
    const setSelectedCategories = vi.fn();
    render(
      <CategorySelector
        {...defaultProps}
        selectedCategories={[cat1, cat2, cat3, cat4]}
        setSelectedCategories={setSelectedCategories}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Unselect All' }));
    expect(setSelectedCategories).toHaveBeenCalledWith([]);
  });
});

describe('CategorySelector with subcategories', () => {
  const food = makeCategory({ id: 'food', name: 'Food', group: 'g' });
  const rent = makeCategory({ id: 'rent', name: 'Rent', group: 'g' });
  const dining = {
    ...makeCategory({ id: 'dining', name: 'Dining Out', group: 'g' }),
    parent_id: 'food',
  };
  const snacks = {
    ...makeCategory({ id: 'snacks', name: 'Snacks', group: 'g' }),
    parent_id: 'food',
  };
  // Stored with a subcategory after an unrelated category, to check the
  // picker lists it under its parent anyway.
  const group = makeCategoryGroup({
    id: 'g',
    name: 'Everyday',
    categories: [food, rent, dining, snacks],
  });

  function renderSelector(
    props: Partial<ComponentProps<typeof CategorySelector>> = {},
  ) {
    const setSelectedCategories = vi.fn();
    render(
      <CategorySelector
        {...defaultProps}
        categoryGroups={[group]}
        setSelectedCategories={setSelectedCategories}
        {...props}
      />,
    );
    return setSelectedCategories;
  }

  function selectedIds(setSelectedCategories: ReturnType<typeof vi.fn>) {
    const [selected] = setSelectedCategories.mock.calls[0];
    return selected.map((cat: CategoryEntity) => cat.id).sort();
  }

  it('lists subcategories indented under their parent', () => {
    renderSelector();

    const names = screen
      .getAllByRole('checkbox')
      .map(box => box.closest('li')?.textContent);
    expect(names).toEqual(['Everyday', 'Food', 'Dining Out', 'Snacks', 'Rent']);

    const indent = (name: string) =>
      screen.getByLabelText(name).closest('li')?.style.paddingLeft;
    expect(indent('Food')).toBe('0px');
    expect(indent('Dining Out')).toBe('16px');
  });

  it('ticks a parent together with its subcategories', async () => {
    const setSelectedCategories = renderSelector({
      selectedCategories: [rent],
    });
    await userEvent.click(screen.getByLabelText('Food'));

    expect(selectedIds(setSelectedCategories)).toEqual([
      'dining',
      'food',
      'rent',
      'snacks',
    ]);
  });

  it('unticks a parent together with its subcategories', async () => {
    const setSelectedCategories = renderSelector({
      selectedCategories: [food, dining, snacks, rent],
    });
    await userEvent.click(screen.getByLabelText('Food'));

    expect(selectedIds(setSelectedCategories)).toEqual(['rent']);
  });

  it('still lets a subcategory be ticked on its own', async () => {
    const setSelectedCategories = renderSelector();
    await userEvent.click(screen.getByLabelText('Dining Out'));

    expect(selectedIds(setSelectedCategories)).toEqual(['dining']);
  });

  it('hides the subcategories of a hidden parent', () => {
    renderSelector({
      showHiddenCategories: false,
      categoryGroups: [
        { ...group, categories: [{ ...food, hidden: true }, rent, dining] },
      ],
    });

    expect(screen.queryByLabelText('Food')).toBeNull();
    expect(screen.queryByLabelText('Dining Out')).toBeNull();
    expect(screen.getByLabelText('Rent')).toBeInTheDocument();
  });
});
