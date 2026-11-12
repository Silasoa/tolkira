import { parse } from '@cucumber/tag-expressions';

// A query is tag-shaped when every token is a tag literal or part of the
// lowercase boolean grammar. Mixed text/tag input stays substring search.
const TAG_EXPRESSION =
  /^(?:\s*(?:@(?:\\.|[^\s()])+|\(|\)|and|or|not)\s*)+$/;

export function isTagExpression(query: string): boolean {
  const text = query.trim();
  if (!text.includes('@') || !TAG_EXPRESSION.test(text)) return false;
  // An expression starts with a tag, a group, or `not`; a leading `and`/`or`
  // is operator noise that must stay substring text.
  return /^(?:@|\(|not(?=\s|\(|$))/.test(text);
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
