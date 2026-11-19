import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { buildReportModel } from '../src/report/model.js';
import { summarizeEnvelopes } from '../src/summary.js';
import { legacyFixture, messagesFixture } from './fixtures.js';
import { scenarioOpeningTag } from './render-helpers.js';

const undefinedFixture = messagesFixture('undefined.ndjson');
const ambiguousFixture = messagesFixture('ambiguous.ndjson');
const legacyAmbiguousFixture = legacyFixture('ambiguous.json');
const allStatusesFixture = messagesFixture('all-statuses.ndjson');

describe('parity diagnostics rendering', () => {
  it('renders an undefined-step snippet', async () => {
    const html = await renderReport(undefinedFixture, { title: 'Undefined' });

    expect(html).toContain('data-diagnostic="undefined"');
    expect(html).toContain(
      'No step definition found. Implement with the snippet(s) below:',
    );
    expect(html).toContain('class="snippet"');
    expect(html).toContain(
      'Given(&quot;a step that is yet to be defined&quot;, () =&gt; {',
    );
  });

  it('renders every suggestion with its language label', async () => {
    const html = await renderReport(undefinedFixture, { title: 'Snippets' });

    expect(html).toContain('a list of {int} things');
    expect(html).toContain('a list of {float} things');
    expect(html).toContain('class="snippetLang">typescript');
  });

  it('renders the undefined lead without snippet data', async () => {
    const envelopes = parseMessages(
      await readFile(undefinedFixture, 'utf8'),
      undefinedFixture,
    ).filter((envelope) => !envelope.suggestion);
    const html = await renderHtml(envelopes, { title: 'No snippets' });

    expect(html).toContain('No step definition found.');
    expect(html).not.toContain('Implement with the snippet(s) below:');
    expect(html).not.toContain('class="snippet"');
  });

  it('renders ambiguous patterns with relative source references', async () => {
    const html = await renderReport(ambiguousFixture, { title: 'Ambiguous' });

    expect(html).toContain('data-diagnostic="ambiguous"');
    expect(html).toContain('Multiple matching step definitions found:');
    expect(html).toContain('^a (.*?) with (.*?)$');
    expect(html).toContain('^a step with (.*?)$');
    expect(html).toContain('samples/ambiguous/ambiguous.ts:3');
    expect(html).toContain('samples/ambiguous/ambiguous.ts:7');
  });

  it('renders the ambiguous lead without definition data', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    ).filter((envelope) => !envelope.stepDefinition);
    const html = await renderHtml(envelopes, { title: 'No definitions' });

    expect(html).toContain('Multiple matching step definitions found:');
    expect(html).not.toContain('class="definitions"');
  });

  it('shows the ambiguous lead for legacy input without definitions', async () => {
    const html = await renderReport(legacyAmbiguousFixture, {
      title: 'Legacy ambiguous',
    });

    expect(scenarioOpeningTag(html, 'Ambiguous legacy step')).toContain(' open>');
    expect(html).toContain('data-diagnostic="ambiguous"');
    expect(html).toContain('Multiple matching step definitions found:');
    expect(html).not.toContain('class="definitions"');
    expect(html).not.toContain('<code class="definitionPattern">');
  });

  it('reduces absolute definition sources to the report-relative form', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = envelopes.find(
      (envelope) => envelope.stepDefinition,
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition) return;
    definition.sourceReference.uri =
      'C:\\Users\\name\\proj\\features\\ambiguous.ts';

    const html = await renderHtml(envelopes, { title: 'Absolute source' });

    expect(html).toContain('features/ambiguous.ts:3');
    expect(html).not.toContain('Users');
  });

  it('escapes snippets, patterns and source references', async () => {
    const undefinedEnvelopes = parseMessages(
      await readFile(undefinedFixture, 'utf8'),
      undefinedFixture,
    );
    const suggestion = undefinedEnvelopes.find(
      (envelope) => envelope.suggestion,
    )?.suggestion;
    expect(suggestion).toBeDefined();
    if (suggestion) {
      suggestion.snippets[0].code = '<script>alert(1)</script>';
    }
    const undefinedHtml = await renderHtml(undefinedEnvelopes, {
      title: 'Escaped snippets',
    });

    expect(undefinedHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(undefinedHtml).not.toContain('<script>alert(1)</script>');

    const ambiguousEnvelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = ambiguousEnvelopes.find(
      (envelope) => envelope.stepDefinition,
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition) return;
    definition.pattern.source = '<img src=x onerror=alert(2)>';
    definition.sourceReference.uri = '"><svg onload=alert(3)>';
    const ambiguousHtml = await renderHtml(ambiguousEnvelopes, {
      title: 'Escaped definitions',
    });

    expect(ambiguousHtml).toContain(
      '&lt;img src=x onerror=alert(2)&gt;',
    );
    expect(ambiguousHtml).not.toContain('<img src=x');
    expect(ambiguousHtml).toContain(
      '&quot;&gt;&lt;svg onload=alert(3)&gt;',
    );
    expect(ambiguousHtml).not.toContain('<svg onload');
  });

  it('does not render a diagnostic on a passed step with definitions', async () => {
    const html = await renderReport(undefinedFixture, { title: 'Passed step' });
    const marker = html.indexOf('an implemented step</span>');
    expect(marker).toBeGreaterThan(-1);
    const start = html.lastIndexOf('<li class="step"', marker);
    const end = html.indexOf('</li>', marker);
    const passedStep = html.slice(start, end);

    expect(passedStep).toContain('an implemented step');
    expect(passedStep).not.toContain('data-diagnostic');
    expect(html.match(/<div class="diagnostic"/g) ?? []).toHaveLength(4);
  });

  it('indexes diagnostic snippets and patterns for search', async () => {
    const undefinedHtml = await renderReport(undefinedFixture, {
      title: 'Search snippets',
    });
    const undefinedSearch =
      undefinedHtml.match(
        /data-scenario-name="Snippets reflect parameter types"[^>]*data-search="([^"]*)"/,
      )?.[1] ?? '';
    expect(undefinedSearch).toContain('No step definition found.');
    expect(undefinedSearch).toContain('a list of {int} things');
    expect(undefinedSearch).toContain('a list of {float} things');

    const ambiguousHtml = await renderReport(ambiguousFixture, {
      title: 'Search patterns',
    });
    const ambiguousSearch =
      ambiguousHtml.match(
        /data-scenario-name="Multiple step definitions for a step"[^>]*data-search="([^"]*)"/,
      )?.[1] ?? '';
    expect(ambiguousSearch).toContain('Multiple matching step definitions found:');
    expect(ambiguousSearch).toContain('^a (.*?) with (.*?)$');
    expect(ambiguousSearch).toContain('samples/ambiguous/ambiguous.ts:3');
  });

  it('keeps model and summary scenario counts in parity', async () => {
    const envelopes = parseMessages(
      await readFile(allStatusesFixture, 'utf8'),
      allStatusesFixture,
    );
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);

    expect(model.counts.scenarios).toEqual(summary.counts.scenarios);
  });

  it('caps diagnostic text in the search index', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = envelopes.find(
      (envelope) => envelope.stepDefinition,
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition) return;
    const long = 'x'.repeat(5000);
    definition.pattern.source = long;

    const html = await renderHtml(envelopes, { title: 'Long pattern' });
    const dataSearch = html.match(/data-search="([^"]*)"/)?.[1] ?? '';

    expect(dataSearch.length).toBeLessThan(4000);
    expect(html).toContain(long);
  });
});
