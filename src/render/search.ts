import { parse } from '@cucumber/tag-expressions';

export const SEARCH_OPEN_CAP = 20;

function isSpace(character: string): boolean {
  return /\s/.test(character);
}

// One linear pass. The previous single regex nested a repeated group, so a long
// repeated tag sequence made it backtrack exponentially. Every branch here
// consumes input, so validation stays O(n).
function isTagShaped(text: string): boolean {
  let index = 0;
  while (index < text.length) {
    const character = text[index] as string;
    if (isSpace(character)) {
      index += 1;
      continue;
    }
    if (character === '(' || character === ')') {
      index += 1;
      continue;
    }
    if (character === '@') {
      index += 1;
      const start = index;
      while (index < text.length) {
        const next = text[index] as string;
        if (next === '\\') {
          index += 2;
          continue;
        }
        if (isSpace(next) || next === '(' || next === ')') break;
        index += 1;
      }
      if (index > text.length || index === start) return false;
      continue;
    }
    const start = index;
    while (index < text.length) {
      const next = text[index] as string;
      if (isSpace(next) || next === '(' || next === ')') break;
      index += 1;
    }
    const word = text.slice(start, index);
    if (word !== 'and' && word !== 'or' && word !== 'not') return false;
  }
  return true;
}

export function isTagExpression(query: string): boolean {
  const text = query.trim();
  if (!text.includes('@') || !isTagShaped(text)) return false;
  // An expression starts with a tag, a group, or `not`; a leading `and`/`or`
  // is operator noise that must stay substring text.
  if (text.startsWith('@') || text.startsWith('(')) return true;
  return text.startsWith('not') && /^(?:\s|\(|$)/.test(text.slice(3));
}

export type TagExpressionEvaluator = (tags: string[]) => boolean;

export function compileTagExpression(
  query: string,
): TagExpressionEvaluator | undefined {
  if (!isTagExpression(query)) return undefined;
  try {
    const expression = parse(query.trim());
    return (tags) => expression.evaluate(tags);
  } catch {
    return undefined;
  }
}

export function evaluateTagExpression(
  query: string,
  tags: string[],
): boolean | undefined {
  return compileTagExpression(query)?.(tags);
}

export interface UrlState {
  query: string;
  hidden: string[];
  tag: string;
}

export function parseUrlState(
  search: string,
  knownStatuses: readonly string[],
  knownTags: readonly string[],
): UrlState {
  const params = new URLSearchParams(search);
  const statuses = new Set(knownStatuses);
  const tags = new Set(knownTags);
  const hidden = [...new Set(params.getAll('hide'))].filter((status) =>
    statuses.has(status),
  );
  const tag = params.get('tag') ?? '';
  return {
    query: params.get('query') ?? '',
    hidden,
    tag: tags.has(tag) ? tag : '',
  };
}

// Serialises only the search state and keeps unrelated parameters and the hash.
export function serializeUrlState(current: string, state: UrlState): string {
  const url = new URL(current);
  if (state.query) url.searchParams.set('query', state.query);
  else url.searchParams.delete('query');
  url.searchParams.delete('hide');
  for (const status of state.hidden) url.searchParams.append('hide', status);
  if (state.tag) url.searchParams.set('tag', state.tag);
  else url.searchParams.delete('tag');
  return url.href;
}

export interface OpenRow {
  visible: boolean;
  open: boolean;
}

export function rowsToOpen(
  rows: readonly OpenRow[],
  cap = SEARCH_OPEN_CAP,
): number[] {
  if (cap <= 0) return [];
  const indexes: number[] = [];
  for (let index = 0; index < rows.length && indexes.length < cap; index += 1) {
    const row = rows[index];
    if (row?.visible && !row.open) indexes.push(index);
  }
  return indexes;
}

// A row hidden by the search remembers whether it was open, unless the search
// opened it; those rows collapse again when the query is cleared.
export function rememberHiddenOpen(
  open: boolean,
  openedBySearch: boolean,
): boolean {
  return open && !openedBySearch;
}
