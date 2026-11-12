import { describe, expect, it } from 'vitest';
import {
  evaluateTagExpression,
  isTagExpression,
  parseUrlState,
  rememberHiddenOpen,
  rowsToOpen,
  serializeUrlState,
} from '../src/render/search.js';

describe('tag-shaped detection', () => {
  it.each([
    '@a',
    '@a and not @b',
    '(@a or @b) and @c',
    'not @a',
    '@x\\(y\\)',
    '  @a\tand\n@b  ',
  ])('accepts the tag expression %j', (query) => {
    expect(isTagExpression(query)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'alpha',
    'alpha @a',
    '@a alpha',
    '@a AND @b',
    'and @a',
  ])('rejects the mixed or text query %j', (query) => {
    expect(isTagExpression(query)).toBe(false);
  });

  it('treats escaped whitespace as part of a tag and rejects a dangling escape', () => {
    expect(evaluateTagExpression('@a\\ b', ['@a b'])).toBe(true);
    expect(isTagExpression('@a\\')).toBe(false);
    expect(isTagExpression('android')).toBe(false);
  });

  it('rejects a repeated-group payload without superlinear backtracking', () => {
    const payload = `${'@a '.repeat(2000)}!`;

    expect(isTagExpression(payload)).toBe(false);
    expect(evaluateTagExpression(payload, ['@a'])).toBeUndefined();
  });
});

describe('tag expression evaluation', () => {
  it('evaluates and, not, and tags with no match', () => {
    expect(evaluateTagExpression('@a and not @b', ['@a'])).toBe(true);
    expect(evaluateTagExpression('@a and not @b', ['@a', '@b'])).toBe(false);
    expect(evaluateTagExpression('@a and not @b', ['@b'])).toBe(false);
    expect(evaluateTagExpression('@a and not @b', [])).toBe(false);
    expect(evaluateTagExpression('@unknown', ['@a'])).toBe(false);
  });

  it('applies not before and before or', () => {
    expect(evaluateTagExpression('@a or @b and @c', ['@a'])).toBe(true);
    expect(evaluateTagExpression('@a or @b and @c', ['@b'])).toBe(false);
    expect(evaluateTagExpression('@a or @b and @c', ['@b', '@c'])).toBe(true);
    expect(evaluateTagExpression('not @a and @b', ['@a', '@b'])).toBe(false);
    expect(evaluateTagExpression('not @a and @b', ['@b'])).toBe(true);
  });

  it('honours parentheses and nested groups', () => {
    expect(evaluateTagExpression('not (@a or @b)', [])).toBe(true);
    expect(evaluateTagExpression('not (@a or @b)', ['@a'])).toBe(false);
    expect(evaluateTagExpression('(@a or @b) and not @b', ['@a'])).toBe(true);
    expect(evaluateTagExpression('(@a or @b) and not @b', ['@b'])).toBe(false);
  });

  it('matches escaped tag characters', () => {
    expect(evaluateTagExpression('@x\\(y\\)', ['@x(y)'])).toBe(true);
    expect(evaluateTagExpression('@x\\(y\\)', ['@x'])).toBe(false);
  });

  it('is case-sensitive for tags', () => {
    expect(evaluateTagExpression('@A', ['@a'])).toBe(false);
    expect(evaluateTagExpression('@a', ['@a'])).toBe(true);
  });

  it.each([
    '@a and',
    '@a or',
    'not',
    '()',
    '(@a',
    '@a and ()',
  ])('returns undefined for the invalid expression %j', (query) => {
    expect(evaluateTagExpression(query, ['@a'])).toBeUndefined();
  });

  it.each(['alpha @a', '@a alpha', '@a AND @b', '', '   '])(
    'returns undefined for the non-tag query %j',
    (query) => {
      expect(evaluateTagExpression(query, ['@a'])).toBeUndefined();
    },
  );
});

describe('URL state', () => {
  const statuses = ['passed', 'failed'];
  const tags = ['@a', '@b'];

  it('parses query, repeated hide and tag values', () => {
    expect(
      parseUrlState(
        '?query=alpha+one&hide=passed&hide=failed&tag=%40b',
        statuses,
        tags,
      ),
    ).toEqual({ query: 'alpha one', hidden: ['passed', 'failed'], tag: '@b' });
  });

  it('ignores empty, unknown and uppercase values and dedupes hide', () => {
    expect(
      parseUrlState(
        '?query=&hide=&hide=passed&hide=passed&hide=unknown&HIDE=failed&tag=%40missing',
        statuses,
        tags,
      ),
    ).toEqual({ query: '', hidden: ['passed'], tag: '' });
  });

  it('serialises state and preserves unrelated parameters and the hash', () => {
    expect(
      serializeUrlState(
        'file:///C:/reports/report.html?utm=mail#scenario-1-1',
        { query: 'alpha one', hidden: ['passed', 'failed'], tag: '@a' },
      ),
    ).toBe(
      'file:///C:/reports/report.html?utm=mail&query=alpha+one&hide=passed&hide=failed&tag=%40a#scenario-1-1',
    );
  });

  it('clears previous values when the state is empty', () => {
    expect(
      serializeUrlState(
        'https://example.test/report.html?query=x&hide=passed&tag=%40a#top',
        { query: '', hidden: [], tag: '' },
      ),
    ).toBe('https://example.test/report.html#top');
  });

  it('round-trips serialised state', () => {
    const state = {
      query: 'gamma three',
      hidden: ['skipped', 'pending'],
      tag: '@a',
    };
    const next = serializeUrlState('https://example.test/report.html', state);

    expect(
      parseUrlState(
        new URL(next).search,
        ['passed', 'failed', 'skipped', 'pending'],
        tags,
      ),
    ).toEqual(state);
  });
});

describe('search open state', () => {
  it('opens only visible closed rows and stops at the cap', () => {
    const rows = [
      { visible: true, open: true },
      { visible: false, open: false },
      { visible: true, open: false },
      { visible: true, open: false },
      { visible: false, open: true },
    ];

    expect(rowsToOpen(rows, 2)).toEqual([2, 3]);
  });

  it('does not count already open rows against the cap', () => {
    const rows = Array.from({ length: 30 }, () => ({
      visible: true,
      open: false,
    }));
    for (let index = 0; index < 10; index += 1) {
      rows[index]!.open = true;
    }

    const indexes = rowsToOpen(rows);

    expect(indexes).toHaveLength(20);
    expect(indexes[0]).toBe(10);
    expect(indexes[19]).toBe(29);
  });

  it('returns nothing for a zero or negative cap', () => {
    const rows = [{ visible: true, open: false }];

    expect(rowsToOpen(rows, 0)).toEqual([]);
    expect(rowsToOpen(rows, -1)).toEqual([]);
  });

  it('remembers hidden open state unless the search opened the row', () => {
    expect(rememberHiddenOpen(true, false)).toBe(true);
    expect(rememberHiddenOpen(true, true)).toBe(false);
    expect(rememberHiddenOpen(false, false)).toBe(false);
  });
});
