import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: true,
});

const SAFE_LINK = /^(?:https?:\/\/|mailto:)/i;
// Images are alt-only, so their destination only needs to parse. Relative and
// data:image destinations never reach the HTML; anchors still use SAFE_LINK.
const SAFE_IMAGE = /^(?:https?:\/\/|mailto:|data:image\/|\.{0,2}\/)/i;

// markdown-it uses one validateLink hook for links and images. Keep only
// destinations that can render without a network request or a dangerous scheme.
markdown.validateLink = (url): boolean =>
  SAFE_LINK.test(url) || SAFE_IMAGE.test(url);

markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index]?.attrSet('rel', 'noopener noreferrer nofollow');
  return self.renderToken(tokens, index, options);
};

markdown.renderer.rules.image = (tokens, index) =>
  markdown.utils.escapeHtml(String(tokens[index]?.content ?? ''));

// markdown-it has no hook that sees a link's children, so drop anchors that
// wrap an image or point outside the link allowlist. Images become alt text.
markdown.core.ruler.push('tolkira_link_policy', (state) => {
  for (const token of state.tokens) {
    const children = token.children;
    if (!children) continue;
    const stack: Array<{ open: number; safe: boolean; image: boolean }> = [];
    const suppressed = new Set<number>();
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!child) continue;
      if (child.type === 'link_open') {
        const href = String(child.attrGet('href') ?? '');
        stack.push({ open: index, safe: SAFE_LINK.test(href), image: false });
      } else if (child.type === 'image' && stack.length > 0) {
        const link = stack[stack.length - 1];
        if (link) link.image = true;
      } else if (child.type === 'link_close') {
        const link = stack.pop();
        if (link && (!link.safe || link.image)) {
          suppressed.add(link.open);
          suppressed.add(index);
        }
      }
    }
    if (suppressed.size > 0) {
      token.children = children.filter((_, index) => !suppressed.has(index));
    }
  }
});

const HEADING_LEVELS: Record<string, string> = {
  h1: 'h3',
  h2: 'h4',
  h3: 'h4',
  h4: 'h4',
  h5: 'h4',
  h6: 'h4',
};

for (const type of ['heading_open', 'heading_close'] as const) {
  const defaultRule = markdown.renderer.rules[type];
  markdown.renderer.rules[type] = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token) {
      token.tag = HEADING_LEVELS[token.tag] ?? token.tag;
    }
    return defaultRule
      ? defaultRule(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);
  };
}

markdown.renderer.rules.table_open = () =>
  '<div class="tableWrap" tabindex="0" role="region" aria-label="Description table"><table>';
markdown.renderer.rules.table_close = () => '</table></div>';

export function renderDescription(description: string): string {
  if (!description || !description.trim()) return '';
  return `<div class="description">${markdown.render(description)}</div>`;
}
