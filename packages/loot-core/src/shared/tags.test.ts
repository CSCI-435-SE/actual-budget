import { renameTagInNotes, tagMatchPattern } from './tags';

describe('tagMatchPattern', () => {
  function hasTag(notes: string, tag: string) {
    return new RegExp(tagMatchPattern(tag)).test(notes);
  }

  test('matches a whole tag anywhere in the notes', () => {
    expect(hasTag('#food', 'food')).toBe(true);
    expect(hasTag('lunch #food', 'food')).toBe(true);
    expect(hasTag('#food lunch', 'food')).toBe(true);
    expect(hasTag('lunch#food', 'food')).toBe(true);
  });

  test('does not match a tag that is a prefix of another tag', () => {
    expect(hasTag('#foodie', 'food')).toBe(false);
    expect(hasTag('#food-court', 'food')).toBe(false);
  });

  test('treats whitespace and "#" as tag delimiters', () => {
    expect(hasTag('#food#work', 'food')).toBe(true);
    expect(hasTag('#food#work', 'work')).toBe(true);
    expect(hasTag('#food\twork', 'food')).toBe(true);
    expect(hasTag('#food\nwork', 'food')).toBe(true);
  });

  test('does not match an escaped tag', () => {
    expect(hasTag('##food', 'food')).toBe(false);
    expect(hasTag('##food #food', 'food')).toBe(true);
  });

  test('is case sensitive', () => {
    expect(hasTag('#Food', 'food')).toBe(false);
    expect(hasTag('#food', 'Food')).toBe(false);
  });

  test('treats regex characters in the tag literally', () => {
    expect(hasTag('#a.b', 'a.b')).toBe(true);
    expect(hasTag('#axb', 'a.b')).toBe(false);
    expect(hasTag('#a+b', 'a+b')).toBe(true);
    expect(hasTag('#aab', 'a+b')).toBe(false);
  });

  test('matches tags containing "$"', () => {
    expect(hasTag('#$Bug_Test', '$Bug_Test')).toBe(true);
    expect(hasTag('#a$ more', 'a$')).toBe(true);
    expect(hasTag('#a$b', 'a$')).toBe(false);
  });
});

describe('renameTagInNotes', () => {
  test('renames only whole, unescaped, case-sensitive tags', () => {
    expect(
      renameTagInNotes(
        '##Food #FoodCourt #food #Food#Work #Work#Food',
        'Food',
        'Groceries',
      ),
    ).toBe('##Food #FoodCourt #food #Groceries#Work #Work#Groceries');
  });

  test('treats regex and replacement characters literally', () => {
    expect(renameTagInNotes('#a.b #axb', 'a.b', '$&')).toBe('#$& #axb');
  });
});
