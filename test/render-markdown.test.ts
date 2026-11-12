import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { renderHtml } from '../src/render/html.js';

const messagesFixture = fileURLToPath(
  new URL('./fixtures/messages/markdown-descriptions.ndjson', import.meta.url),
);
const legacyFixture = fileURLToPath(
  new URL('./fixtures/legacy/markdown-description.json', import.meta.url),
);
const junitFixture = fileURLToPath(
  new URL('./fixtures/junit/markdown-description.xml', import.meta.url),
);

function syntheticJson(
  featureDescription: string,
  scenarioDescription = '',
): string {
  return JSON.stringify([
    {
      uri: 'features/synthetic-markdown.feature',
      name: 'Synthetic markdown',
      description: featureDescription,
      elements: [
        {
          keyword: 'Scenario',
          type: 'scenario',
          name: 'Synthetic scenario',
          description: scenarioDescription,
          steps: [
            {
              keyword: 'Given ',
              name: 'a passing step',
              result: { status: 'passed', duration: 1 },
            },
          ],
        },
      ],
    },
  ]);
}

async function renderSynthetic(
  featureDescription: string,
  scenarioDescription = '',
): Promise<string> {
  return renderHtml(
    parseLegacyJson(
      syntheticJson(featureDescription, scenarioDescription),
      'synthetic-markdown.json',
    ),
    { title: 'Synthetic markdown' },
  );
}

function descriptionAfter(
  html: string,
  marker: string,
  endMarkers: string[],
): string {
  const markerIndex = html.indexOf(marker);
  expect(markerIndex, `marker ${marker}`).toBeGreaterThan(-1);
  const start = html.indexOf('<div class="description">', markerIndex);
  expect(start, `description after ${marker}`).toBeGreaterThan(-1);
  const ends = endMarkers
    .map((end) => html.indexOf(end, start))
    .filter((index) => index > start);
  const end = ends.length ? Math.min(...ends) : html.length;
  return html.slice(start, end);
}

function featureDescription(html: string): string {
  return descriptionAfter(html, '<details class="feature', [
    '<section class="background"',
    '<div class="rows">',
    '</details>',
  ]);
}

function scenarioDescription(html: string, name: string): string {
  return descriptionAfter(html, `data-scenario-name="${name}"`, [
    '<div class="stepsHead">',
  ]);
}

describe('safe GFM descriptions', () => {
  it('renders headings, lists, tables, blockquotes, emphasis, code and links in a block container', async () => {
    const html = await renderReport(messagesFixture, { title: 'Markdown' });
    const feature = featureDescription(html);

    expect(html).toContain('<div class="description">');
    expect(html).not.toContain('<p class="description">');
    expect(html).not.toMatch(
      /\.description\s*\{[^}]*white-space:\s*pre-line/,
    );

    expect(feature).toContain('<h3>Feature guide</h3>');
    expect(feature).toContain('<h4>Formats</h4>');
    expect(feature).toContain('<ul>');
    expect(feature).toContain('<ol>');
    expect(feature).toContain('nested item');
    expect(feature).toContain('<blockquote>');
    expect(feature).toContain('quoted line');
    expect(feature).toContain('<table>');
    expect(feature).toContain('<th>Name</th>');
    expect(feature).toContain('<td>alpha</td>');
    expect(feature).toContain('<strong>bold</strong>');
    expect(feature).toContain('<em>italic</em>');
    expect(feature).toContain('<code>inline code</code>');
    expect(feature).toContain('href="https://example.com/docs"');
    expect(feature).toContain('href="http://example.com/plain"');
    expect(feature).toContain('href="mailto:qa@example.com"');
    expect(feature).toContain('rel="noopener noreferrer nofollow"');
  });

  it('wraps description tables in a focusable scroll region', async () => {
    const html = await renderReport(messagesFixture, { title: 'Tables' });
    const feature = featureDescription(html);

    expect(feature).toMatch(/<div class="tableWrap"[^>]*role="region"/);
    expect(feature).toMatch(/<div class="tableWrap"[^>]*tabindex="0"/);
    expect(feature).toMatch(
      /<div class="tableWrap"[^>]*>[\s\S]*<table>/,
    );
  });

  it('caps description headings at h4 and starts them at h3', async () => {
    const html = await renderSynthetic(
      '# Top\n\n## Sub\n\n###### Deep',
    );
    const feature = featureDescription(html);

    expect(feature).toContain('<h3>Top</h3>');
    expect(feature).toContain('<h4>Sub</h4>');
    expect(feature).toContain('<h4>Deep</h4>');
    expect(feature).not.toMatch(/<h[1256]\b/);
  });

  it('renders every description field through the same safe renderer', async () => {
    const html = await renderReport(messagesFixture, { title: 'Fields' });

    const background = descriptionAfter(html, 'data-background', [
      '</section>',
    ]);
    expect(background).toContain('<strong>Background</strong>');
    expect(background).toContain('<code>code</code>');

    const rule = descriptionAfter(html, '<section class="rule"', [
      '<div class="ruleRows">',
    ]);
    expect(rule).toContain('<blockquote>');
    expect(rule).toContain('<strong>bold</strong>');
    expect(rule).toContain('href="https://example.com/rule"');
    expect(rule).toContain('rel="noopener noreferrer nofollow"');

    const plain = scenarioDescription(html, 'Plain and nested emphasis');
    expect(plain).toContain('Plain text without formatting.');
    expect(plain).toContain('<strong>');
    expect(plain).toContain('<em>');
    expect(plain).toContain('bold italic');

    const outline = descriptionAfter(html, '<section class="outline"', [
      '<section class="examples"',
    ]);
    expect(outline).toContain('<h4>Outline description</h4>');
    expect(outline).toContain('<li>item one</li>');

    const examples = descriptionAfter(html, '<section class="examples"', [
      '<div class="exampleRows">',
    ]);
    expect(examples).toContain('<table>');
    expect(examples).toContain('<td>1</td>');
  });

  it('renders only http(s) and mailto links with rel', async () => {
    const html = await renderSynthetic(
      'Feature text.',
      '[safe https](https://example.com/a)\n[safe http](http://example.com/b)\n[safe mail](mailto:qa@example.com)\n[relative](./docs/readme.md)\n[javascript](javascript:alert(1))\n[data](data:text/html,<b>x</b>)\n[file](file:///etc/passwd)',
    );
    const description = scenarioDescription(html, 'Synthetic scenario');

    expect(description.match(/<a\b/g) ?? []).toHaveLength(3);
    expect(description.match(/rel="noopener noreferrer nofollow"/g) ?? []).toHaveLength(
      3,
    );
    expect(description).toContain('href="https://example.com/a"');
    expect(description).toContain('href="http://example.com/b"');
    expect(description).toContain('href="mailto:qa@example.com"');
    expect(description).not.toMatch(
      /href="(?:javascript|data|file|vbscript):/i,
    );
    expect(description).not.toContain('href="./docs/readme.md"');
    expect(description).toContain('relative');
    expect(description).toContain('javascript');
  });

  it('escapes raw HTML and does not activate markup', async () => {
    const html = await renderSynthetic(
      `<script>alert('feature')</script>\n\n<img src=x onerror=alert(2)>\n\n<b>bold</b>`,
    );
    const feature = featureDescription(html);

    expect(feature).toContain(
      "&lt;script&gt;alert('feature')&lt;/script&gt;",
    );
    expect(feature).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(feature).not.toContain("<script>alert('feature')</script>");
    expect(feature).not.toContain('<img src=x');
    expect(feature).not.toContain('<b>bold</b>');
  });

  it('renders inline, reference and linked images as alt text only', async () => {
    const html = await renderSynthetic(
      'Feature text.',
      `![inline remote](https://example.com/inline.png)
![inline local](./shots/local.png)
![data image](data:image/png;base64,iVBORw0KGgo=)
![reference image][ref-image]
[![linked image](https://example.com/linked.png)](https://example.com/target)
![angle image](<https://example.com/angle.png>)

[ref-image]: https://example.com/reference.png`,
    );
    const description = scenarioDescription(html, 'Synthetic scenario');

    expect(description).not.toContain('<img');
    expect(description).not.toContain('<a');
    expect(description).not.toContain('![');
    expect(description).not.toContain('](');
    expect(description).not.toContain('example.com');
    for (const alt of [
      'inline remote',
      'inline local',
      'data image',
      'reference image',
      'linked image',
      'angle image',
    ]) {
      expect(description, alt).toContain(alt);
    }
  });

  it('escapes a hostile link target', async () => {
    const html = await renderSynthetic(
      `[hostile](https://example.com/"onmouseover="alert(1))\n\n[uppercase](JaVaScRiPt:alert(1))`,
    );
    const feature = featureDescription(html);

    expect(feature).not.toContain('onmouseover="');
    expect(feature).not.toMatch(/href="javascript:/i);
  });

  it('renders plain text and nested emphasis', async () => {
    const plain = await renderSynthetic(
      'Plain text without formatting.',
    );
    expect(featureDescription(plain)).toContain(
      '<p>Plain text without formatting.</p>',
    );

    const nested = await renderSynthetic(
      '***bold italic*** and **bold *nested*** and *italic **nested***.',
    );
    const feature = featureDescription(nested);
    expect(feature).toContain('<strong>');
    expect(feature).toContain('<em>');
    expect(feature).toContain('bold italic');
    expect(feature).toMatch(/<strong>bold <em>nested<\/em><\/strong>/);
    expect(feature).toMatch(/<em>italic <strong>nested<\/strong><\/em>/);
  });

  it('survives malformed Markdown without throwing', async () => {
    const html = await renderSynthetic(
      '**unclosed bold and [unclosed link( and `unclosed code',
    );
    const feature = featureDescription(html);

    expect(feature).toContain('unclosed bold');
    expect(feature).toContain('unclosed link');
    expect(feature).toContain('unclosed code');
  });

  it('omits an empty description container', async () => {
    const html = await renderSynthetic('', '');

    expect(html.match(/class="description"/g) ?? []).toHaveLength(0);
  });

  it('applies the safe renderer to legacy descriptions', async () => {
    const html = await renderReport(legacyFixture, { title: 'Legacy' });
    const feature = featureDescription(html);

    expect(feature).toContain('<h3>Legacy heading</h3>');
    expect(feature).toContain('<strong>bold</strong>');
    expect(feature).toContain('href="https://example.com/legacy"');
    expect(feature).toContain('rel="noopener noreferrer nofollow"');
    expect(feature).not.toContain('<img');

    const scenario = scenarioDescription(html, 'Legacy scenario');
    expect(scenario).toContain('<h4>Scenario markdown</h4>');
    expect(scenario).toContain('<li>one</li>');
    expect(scenario).toContain('<li>two</li>');
  });

  it('applies the safe renderer to JUnit descriptions', async () => {
    const html = await renderReport(junitFixture, { title: 'JUnit' });
    const feature = featureDescription(html);

    expect(feature).toContain('<h3>JUnit heading</h3>');
    expect(feature).toContain('<strong>bold</strong>');
    expect(feature).toContain('href="https://example.com/junit"');
    expect(feature).not.toContain('<img');

    const scenario = scenarioDescription(html, 'markdown test case');
    expect(scenario).toContain('<h3>JUnit scenario</h3>');
    expect(scenario).toContain('<li>one</li>');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('src="https://example.com/junit.png"');
  });
});
