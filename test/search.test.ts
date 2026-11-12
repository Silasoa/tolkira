import { describe, expect, it } from 'vitest';
import {
  evaluateTagExpression,
  isTagExpression,
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
