import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  summarizeReport,
  type ReportSummary,
  type StatusCounts,
  type SummaryScenario,
  type SummaryStep,
} from '../src/index.js';
import {
  formatCiOutput,
  formatGitHubAnnotations,
  formatMarkdownSummary,
} from '../src/ci.js';

async function fixtureSummary(relativePath: string): Promise<ReportSummary> {
  return summarizeReport(
    fileURLToPath(new URL(`./fixtures/${relativePath}`, import.meta.url)),
  );
}

function emptyStatusCounts(): StatusCounts {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
  };
}

function scenario(
  overrides: Partial<SummaryScenario> = {},
): SummaryScenario {
  return {
    name: 'Scenario',
    uri: 'features/ci.feature',
    feature: 'CI feature',
    status: 'passed',
    executed: true,
    durationMs: 1,
    attempt: 0,
    tags: [],
    attachments: 0,
    steps: [],
    ...overrides,
  };
}

function step(overrides: Partial<SummaryStep> = {}): SummaryStep {
  return {
    keyword: 'Then',
    text: 'a step',
    status: 'passed',
    durationMs: 1,
    ...overrides,
  };
}

function makeSummary(scenarios: SummaryScenario[]): ReportSummary {
  const scenarioCounts = emptyStatusCounts();
  const stepCounts = emptyStatusCounts();
  for (const item of scenarios) {
    if (item.executed) {
      scenarioCounts.total += 1;
      scenarioCounts[item.status] += 1;
    }
    for (const itemStep of item.steps) {
      stepCounts.total += 1;
      stepCounts[itemStep.status] += 1;
    }
  }
  return {
    schemaVersion: 2,
    status: 'unknown',
    durationMs: 0,
    counts: {
      features: new Set(scenarios.map((item) => item.feature)).size,
      scenarios: scenarioCounts,
      steps: stepCounts,
    },
    attachments: { total: 0, bytes: 0 },
    scenarios,
  };
}

function annotationLines(text: string): string[] {
  return text.trimEnd().split('\n');
}

function annotationMessage(line: string): string {
  const separator = line.indexOf('::', 2);
  expect(separator, line).toBeGreaterThan(-1);
  return line.slice(separator + 2);
}

function unexecutedCount(summary: ReportSummary): number {
  return summary.scenarios.filter((item) => !item.executed).length;
}

function expectTableCount(
  markdown: string,
  label: string,
  value: number | string,
): void {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(markdown, `${label} row`).toMatch(
    new RegExp(`\\|[ \\t]*${escaped}[ \\t]*\\|[ \\t]*${value}[ \\t]*\\|`),
  );
}

function stripInlineCode(line: string): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    if (line[index] !== '`') {
      result += line[index];
      index += 1;
      continue;
    }
    let run = 0;
    while (line[index + run] === '`') run += 1;
    let cursor = index + run;
    let close = -1;
    while (cursor < line.length) {
      if (line[cursor] !== '`') {
        cursor += 1;
        continue;
      }
      let candidate = 0;
      while (line[cursor + candidate] === '`') candidate += 1;
      if (candidate === run) {
        close = cursor;
        break;
      }
      cursor += candidate;
    }
    if (close < 0) {
      result += line.slice(index);
      break;
    }
    index = close + run;
  }
  return result;
}

/** Removes fenced blocks and code spans so only active Markdown remains. */
function stripCode(markdown: string): string {
  const output: string[] = [];
  let fenceLength = 0;
  for (const line of markdown.split('\n')) {
    const fence = /^\s*(`{3,})(.*)$/.exec(line);
    if (fenceLength > 0) {
      if (
        fence &&
        fence[1].length >= fenceLength &&
        (fence[2] ?? '').trim() === ''
      ) {
        fenceLength = 0;
      }
      continue;
    }
    if (fence) {
      fenceLength = (fence[1] ?? '').length;
      continue;
    }
    output.push(stripInlineCode(line));
  }
  return output.join('\n');
}

function longestFence(markdown: string): number {
  let longest = 0;
  for (const match of markdown.matchAll(/^\s*(`{3,})\s*$/gm)) {
    longest = Math.max(longest, (match[1] ?? '').length);
  }
  return longest;
}

describe('GitHub annotations', () => {
  it('annotates a failed scenario with its identity and first failure message', () => {
    const summary = makeSummary([
      scenario({
        feature: 'Checkout',
        name: 'Pays with card',
        uri: 'features/checkout.feature',
        status: 'failed',
        steps: [
          step({ status: 'passed', message: 'ignore this message' }),
          step({ status: 'failed', message: 'Expected 1 to equal 2' }),
          step({ status: 'skipped', message: 'later message' }),
        ],
      }),
    ]);

    const lines = annotationLines(formatGitHubAnnotations(summary));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      '::error title=Checkout%3A Pays with card::Expected 1 to equal 2',
    );
    expect(lines[0]).not.toContain('file=');
    expect(lines[1]).toContain('::notice title=Tolkira::');
    expect(lines[1]).toContain('1 scenarios');
    expect(lines[1]).toContain('1 failed');
    expect(lines[1]).toContain('0 unexecuted');
  });

  it('covers errors, notices and unexecuted scenarios in separate buckets', () => {
    const summary = makeSummary([
      scenario({ name: 'Fails', status: 'failed' }),
      scenario({ name: 'Undefined', status: 'undefined' }),
      scenario({ name: 'Ambiguous', status: 'ambiguous' }),
      scenario({ name: 'Skipped', status: 'skipped' }),
      scenario({ name: 'Pending', status: 'pending' }),
      scenario({ name: 'Unknown', status: 'unknown' }),
      scenario({
        name: 'Not run one',
        status: 'unknown',
        executed: false,
      }),
      scenario({
        name: 'Not run two',
        status: 'unknown',
        executed: false,
      }),
    ]);

    const lines = annotationLines(formatGitHubAnnotations(summary));
    const errors = lines.filter((line) => line.startsWith('::error '));
    const notices = lines.filter((line) => line.startsWith('::notice '));

    expect(errors).toHaveLength(3);
    expect(errors.map((line) => annotationMessage(line))).toEqual([
      'Scenario failed',
      'Scenario failed',
      'Scenario failed',
    ]);
    expect(
      errors.map((line) => line.slice(0, line.indexOf('::', 2))),
    ).toEqual([
      '::error title=CI feature%3A Fails',
      '::error title=CI feature%3A Undefined',
      '::error title=CI feature%3A Ambiguous',
    ]);

    const noticeTitles = notices
      .filter((line) => !line.startsWith('::notice title=Tolkira::'))
      .map((line) => line.slice(0, line.indexOf('::', 2)));
    expect(noticeTitles).toEqual([
      '::notice title=Skipped',
      '::notice title=Pending',
      '::notice title=Unknown',
    ]);
    expect(notices).toContain(
      '::notice title=Skipped::CI feature: Skipped was skipped',
    );
    expect(notices).toContain(
      '::notice title=Pending::CI feature: Pending was pending',
    );
    expect(notices).toContain(
      '::notice title=Unknown::CI feature: Unknown was unknown',
    );
    expect(lines.join('\n')).not.toContain('Not run one');
    expect(lines.join('\n')).not.toContain('Not run two');

    const final = notices.find(
      (line) =>
        line.startsWith('::notice title=Tolkira::') &&
        !line.includes('annotations omitted'),
    );
    expect(final).toBeDefined();
    expect(final).toContain('6 scenarios');
    for (const bucket of [
      '1 failed',
      '1 skipped',
      '1 pending',
      '1 undefined',
      '1 ambiguous',
      '1 unknown',
      '2 unexecuted',
    ]) {
      expect(final, bucket).toContain(bucket);
    }
    expect(final).not.toContain('0 passed');
  });

  it('escapes properties and messages with their own rules', () => {
    const summary = makeSummary([
      scenario({
        feature: 'Rate 50%, tier: gold, v1',
        name: 'line1\nline2',
        status: 'failed',
        steps: [
          step({
            status: 'failed',
            message: '100%: a,b\r\nnext',
          }),
        ],
      }),
    ]);

    const [line] = annotationLines(formatGitHubAnnotations(summary));

    expect(line).toBe(
      '::error title=Rate 50%25%2C tier%3A gold%2C v1%3A line1%0Aline2::100%25: a,b%0D%0Anext',
    );
  });

  it('keeps workflow-command injection inside the original annotation', () => {
    const summary = makeSummary([
      scenario({
        name: 'evil\n::error title=x::',
        status: 'failed',
        steps: [
          step({
            status: 'failed',
            message: 'boom\n::error title=y::',
          }),
        ],
      }),
    ]);

    const lines = annotationLines(formatGitHubAnnotations(summary));

    expect(lines).toHaveLength(2);
    expect(lines.filter((line) => line.startsWith('::error '))).toHaveLength(1);
    expect(lines.some((line) => line.startsWith('::error title=x'))).toBe(false);
    expect(lines[0]).toBe(
      '::error title=CI feature%3A evil%0A%3A%3Aerror title=x%3A%3A::boom%0A::error title=y::',
    );
  });

  it('distinguishes an empty run from an all-unexecuted run', async () => {
    const empty = await fixtureSummary('messages/empty-none.ndjson');
    expect(empty.scenarios).toEqual([]);

    const emptyLines = annotationLines(formatGitHubAnnotations(empty));
    expect(emptyLines).toEqual(['::notice title=Tolkira::No scenarios']);

    const allUnexecuted = await fixtureSummary('messages/empty.ndjson');
    expect(allUnexecuted.scenarios).toHaveLength(1);
    expect(allUnexecuted.scenarios[0]?.executed).toBe(false);

    const unexecutedLines = annotationLines(
      formatGitHubAnnotations(allUnexecuted),
    );
    expect(unexecutedLines).toHaveLength(1);
    expect(unexecutedLines[0]).toContain('::notice title=Tolkira::');
    expect(unexecutedLines[0]).toContain('0 executed scenarios');
    expect(unexecutedLines[0]).toContain('1 unexecuted');
    expect(unexecutedLines[0]).not.toContain('No scenarios');
  });

  it('emits the run error and the empty notice for a failed empty run', () => {
    const summary = makeSummary([]);
    summary.status = 'failed';

    expect(annotationLines(formatGitHubAnnotations(summary))).toEqual([
      '::error title=Tolkira::Run failed: The report summary is failed ' +
        'but no scenario-level error was emitted.',
      '::notice title=Tolkira::No scenarios',
    ]);
  });

  it('emits a run error when the run failed without a scenario error', () => {
    const summary = makeSummary([scenario({ name: 'Passes' })]);
    summary.status = 'failed';

    const lines = annotationLines(formatGitHubAnnotations(summary));
    const errors = lines.filter((line) => line.startsWith('::error '));
    const notices = lines.filter((line) => line.startsWith('::notice '));

    expect(errors).toEqual([
      '::error title=Tolkira::Run failed: The report summary is failed ' +
        'but no scenario-level error was emitted.',
    ]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('run failed');
    expect(notices[0]).not.toMatch(
      /^::notice title=Tolkira::1 scenarios: 1 passed, 0 unexecuted$/,
    );
    expect(formatMarkdownSummary(summary)).toMatch(
      /\|[ \t]*Status[ \t]*\|[ \t]*failed[ \t]*\|/,
    );
  });

  it('caps error annotations at 50 and states the remainder', () => {
    const scenarios = Array.from({ length: 55 }, (_, index) =>
      scenario({
        name: `Fail ${String(index).padStart(2, '0')}`,
        status: 'failed',
      }),
    );
    const summary = makeSummary(scenarios);

    const lines = annotationLines(formatGitHubAnnotations(summary));
    const errors = lines.filter((line) => line.startsWith('::error '));

    expect(errors).toHaveLength(50);
    expect(errors[0]).toContain('Fail 00');
    expect(errors[49]).toContain('Fail 49');
    expect(lines.join('\n')).not.toContain('Fail 50');
    expect(lines.join('\n')).not.toContain('Fail 54');
    expect(lines).toContain('::notice title=Tolkira::5 more annotations omitted');
    const final = lines.find(
      (line) =>
        line.startsWith('::notice title=Tolkira::') &&
        !line.includes('annotations omitted'),
    );
    expect(final).toContain('55 scenarios');
    expect(final).toContain('55 failed');
    expect(formatGitHubAnnotations(summary)).toBe(
      formatGitHubAnnotations(summary),
    );
  });

  it('caps notice annotations at 20 and states the remainder', () => {
    const scenarios = Array.from({ length: 25 }, (_, index) =>
      scenario({
        name: `Skip ${String(index).padStart(2, '0')}`,
        status: 'skipped',
      }),
    );
    const summary = makeSummary(scenarios);

    const lines = annotationLines(formatGitHubAnnotations(summary));
    const notices = lines.filter((line) => line.startsWith('::notice '));
    const scenarioNotices = notices.filter(
      (line) => !line.startsWith('::notice title=Tolkira::'),
    );

    expect(scenarioNotices).toHaveLength(20);
    expect(lines.join('\n')).toContain('Skip 19');
    expect(lines.join('\n')).not.toContain('Skip 20');
    expect(lines.join('\n')).not.toContain('Skip 24');
    expect(lines).toContain('::notice title=Tolkira::5 more annotations omitted');
    const final = notices.find(
      (line) =>
        line.startsWith('::notice title=Tolkira::') &&
        !line.includes('annotations omitted'),
    );
    expect(final).toContain('25 skipped');
  });

  it('truncates raw failure text before escaping', () => {
    const raw = `${'a'.repeat(3991)}${'%'.repeat(10)}`;
    const summary = makeSummary([
      scenario({
        name: 'Long',
        status: 'failed',
        steps: [step({ status: 'failed', message: raw })],
      }),
    ]);

    const [line] = annotationLines(formatGitHubAnnotations(summary));

    expect(annotationMessage(line)).toBe(
      `${'a'.repeat(3991)}${'%25'.repeat(9)}[truncated]`,
    );
  });

  it('truncates a notice identity before escaping', () => {
    const name = `${'a'.repeat(3995)}${'%'.repeat(10)}`;
    const summary = makeSummary([
      scenario({ feature: '', name, status: 'skipped' }),
    ]);

    const [line] = annotationLines(formatGitHubAnnotations(summary));

    expect(line.startsWith('::notice title=Skipped::')).toBe(true);
    expect(annotationMessage(line)).toBe(
      `${'a'.repeat(3995)}${'%25'.repeat(5)}[truncated]`,
    );
  });

  it('never splits a surrogate pair when truncating', () => {
    const message = `${'a'.repeat(3999)}\u{1F600}tail`;
    const summary = makeSummary([
      scenario({
        status: 'failed',
        steps: [step({ status: 'failed', message })],
      }),
    ]);

    const [line] = annotationLines(formatGitHubAnnotations(summary));

    expect(annotationMessage(line)).toBe(
      `${'a'.repeat(3999)}\u{1F600}[truncated]`,
    );
  });

  it('never reports a skipped step message as the failure', () => {
    const summary = makeSummary([
      scenario({
        status: 'failed',
        steps: [
          step({ status: 'failed' }),
          step({ status: 'skipped', message: 'skipped out' }),
        ],
      }),
      scenario({
        name: 'Message wins',
        status: 'failed',
        steps: [
          step({ status: 'skipped', message: 'not it' }),
          step({ status: 'failed', message: 'the failure' }),
        ],
      }),
    ]);

    const messages = annotationLines(formatGitHubAnnotations(summary))
      .filter((line) => line.startsWith('::error '))
      .map((line) => annotationMessage(line));

    expect(messages).toEqual(['Scenario failed', 'the failure']);
  });

  it('dispatches both formats and forwards options', () => {
    const summary = makeSummary([scenario({ name: 'Passes' })]);

    expect(formatCiOutput(summary, 'github')).toBe(
      formatGitHubAnnotations(summary),
    );
    expect(formatCiOutput(summary, 'markdown', { title: 'CI title' })).toBe(
      formatMarkdownSummary(summary, { title: 'CI title' }),
    );
  });
});

describe('Markdown CI summary', () => {
  it('reports complete counts and the failed scenarios', async () => {
    const summary = await fixtureSummary('messages/all-statuses.ndjson');
    const markdown = formatMarkdownSummary(summary);
    const unexecuted = unexecutedCount(summary);

    expect(markdown.startsWith('## Tolkira report')).toBe(true);
    expectTableCount(markdown, 'Status', summary.status);
    expectTableCount(markdown, 'Scenarios', summary.counts.scenarios.total);
    expectTableCount(markdown, 'Passed', summary.counts.scenarios.passed);
    expectTableCount(markdown, 'Failed', summary.counts.scenarios.failed);
    expectTableCount(markdown, 'Skipped', summary.counts.scenarios.skipped);
    expectTableCount(markdown, 'Pending', summary.counts.scenarios.pending);
    expectTableCount(markdown, 'Undefined', summary.counts.scenarios.undefined);
    expectTableCount(markdown, 'Ambiguous', summary.counts.scenarios.ambiguous);
    expectTableCount(markdown, 'Unknown', summary.counts.scenarios.unknown);
    expectTableCount(markdown, 'Unexecuted', unexecuted);
    expectTableCount(markdown, 'Steps failed', summary.counts.steps.failed);
    expectTableCount(markdown, 'Steps skipped', summary.counts.steps.skipped);
    expect(markdown).toMatch(/^\s*\|\s*Duration[^|]*\|/m);
    expectTableCount(markdown, 'Attachments', summary.attachments.total);
    expectTableCount(markdown, 'Attachment bytes', summary.attachments.bytes);

    expect(markdown).toContain('Failing');
    expect(markdown).toContain('All statuses');
    expect(markdown).toContain('samples/all-statuses/all-statuses.feature');
    expect(markdown).toContain('whoops');
  });

  it('uses --title as the heading', async () => {
    const summary = await fixtureSummary('legacy/failed.json');

    const markdown = formatMarkdownSummary(summary, {
      title: 'Checkout regression',
    });

    expect(markdown.startsWith('## Checkout regression\n')).toBe(true);
    expect(markdown).not.toContain('## Tolkira report');
  });

  it('escapes a hostile title into one inert heading line', () => {
    const title =
      'Evil\n# heading [link](https://e) ![img](https://e) ' +
      '<script>alert(1)</script> `tick` *star* _under_ |pipe| \\';
    const summary = makeSummary([scenario()]);

    const markdown = formatMarkdownSummary(summary, { title });

    expect(markdown.split('\n')[0]).toBe(
      '## Evil \\# heading \\[link\\](https://e) \\!\\[img\\](https://e) ' +
        '\\<script\\>alert(1)\\</script\\> \\`tick\\` \\*star\\* ' +
        '\\_under\\_ \\|pipe\\| \\\\',
    );
    const active = stripCode(markdown);
    expect(active).not.toMatch(/(?<!\\)]\(/);
    expect(active).not.toContain('![');
    expect(active).not.toMatch(/(?<!\\)<script/i);
  });

  it('collapses line breaks in names, URIs and features', () => {
    const summary = makeSummary([
      scenario({
        feature: 'Feature\n\n# injected heading',
        name: 'Name\r\n---\r\n[link](https://evil)',
        uri: 'features/evil.feature\u2028![img](https://evil/x.png)',
        status: 'failed',
        steps: [step({ status: 'failed', message: 'boom' })],
      }),
    ]);

    const markdown = formatMarkdownSummary(summary);

    expect(markdown).toContain('Feature # injected heading');
    expect(markdown).toContain('Name --- [link](https://evil)');
    expect(markdown).toContain(
      'features/evil.feature ![img](https://evil/x.png)',
    );
    expect(markdown).not.toMatch(/[\r\u2028\u2029]/);
    const active = stripCode(markdown);
    expect(active).not.toContain('injected heading');
    expect(active).not.toContain('](');
    expect(active).not.toContain('![');
  });

  it('falls back to Unknown feature for an empty feature name', () => {
    const summary = makeSummary([
      scenario({
        feature: '',
        name: 'Boom',
        status: 'failed',
        steps: [step({ status: 'failed', message: 'x' })],
      }),
    ]);

    expect(formatMarkdownSummary(summary)).toContain(
      '#### `Unknown feature` - `Boom`',
    );
  });

  it('pluralizes a single skipped scenario', () => {
    const summary = makeSummary([scenario({ status: 'skipped' })]);

    const markdown = formatMarkdownSummary(summary);

    expect(markdown).toContain('1 skipped scenario.');
    expect(markdown).not.toContain('1 skipped scenarios');
  });

  it('states an empty run with zero counts', async () => {
    const summary = await fixtureSummary('messages/empty-none.ndjson');

    const markdown = formatMarkdownSummary(summary);

    expect(markdown.startsWith('## Tolkira report')).toBe(true);
    expect(markdown).toContain('No scenarios in this report.');
    expectTableCount(markdown, 'Scenarios', 0);
    expectTableCount(markdown, 'Passed', 0);
    expectTableCount(markdown, 'Failed', 0);
    expectTableCount(markdown, 'Unexecuted', 0);
  });

  it('keeps an all-unexecuted run distinct from an empty run', async () => {
    const summary = await fixtureSummary(
      'messages/empty-all-unexecuted.ndjson',
    );

    const markdown = formatMarkdownSummary(summary);

    expect(summary.counts.scenarios.total).toBe(0);
    expect(unexecutedCount(summary)).toBe(2);
    expectTableCount(markdown, 'Scenarios', 0);
    expectTableCount(markdown, 'Unexecuted', 2);
    expect(markdown).not.toContain('No scenarios in this report.');
  });

  it('renders names, URIs and messages as inert code', () => {
    const name =
      'Name [link](https://evil.example) ![img](https://evil.example/x.png) ' +
      '<script>alert(1)</script> `tick`';
    const uri = 'features/<script>alert(3)</script>.feature';
    const message =
      'Message <script>alert(2)</script>\n```\nfake fence\n```\n' +
      '[link](https://evil.example)';
    const summary = makeSummary([
      scenario({
        feature: 'Feature <b>',
        name,
        uri,
        status: 'failed',
        steps: [step({ status: 'failed', message })],
      }),
    ]);

    const markdown = formatMarkdownSummary(summary);
    const active = stripCode(markdown);

    expect(markdown).toContain(name);
    expect(markdown).toContain(uri);
    expect(markdown).toContain(message);
    expect(active).not.toMatch(/<script/i);
    expect(active).not.toContain('](');
    expect(active).not.toContain('![');
    expect(longestFence(markdown)).toBeGreaterThanOrEqual(4);
  });

  it('caps the failed list at 50 while keeping the count complete', () => {
    const scenarios = Array.from({ length: 55 }, (_, index) =>
      scenario({
        name: `Fail ${String(index).padStart(2, '0')}`,
        status: 'failed',
        steps: [
          step({ status: 'failed', message: `message ${String(index)}` }),
        ],
      }),
    );
    const summary = makeSummary(scenarios);

    const markdown = formatMarkdownSummary(summary);

    expectTableCount(markdown, 'Failed', 55);
    expectTableCount(markdown, 'Scenarios', 55);
    expect(markdown).toContain('Fail 00');
    expect(markdown).toContain('Fail 49');
    expect(markdown).not.toContain('Fail 50');
    expect(markdown).not.toContain('Fail 54');
    expect(markdown).toMatch(
      /5\b[^\n]{0,40}(omitted|not shown|not listed|more)/i,
    );
    expect(formatMarkdownSummary(summary)).toBe(
      formatMarkdownSummary(summary),
    );
  });

  it('truncates the raw failure message at 500 characters', () => {
    const message = `${'a'.repeat(500)}SECRET_AFTER_LIMIT`;
    const summary = makeSummary([
      scenario({
        name: 'Long message',
        status: 'failed',
        steps: [step({ status: 'failed', message })],
      }),
    ]);

    const markdown = formatMarkdownSummary(summary);

    expect(markdown).toContain('a'.repeat(500));
    expect(markdown).not.toContain('SECRET_AFTER_LIMIT');
    expect(markdown).toMatch(/truncated|omitted/i);
  });

  it('caps the skipped names at 20 while keeping the count', () => {
    const scenarios = Array.from({ length: 25 }, (_, index) =>
      scenario({
        name: `Skip ${String(index).padStart(2, '0')}`,
        status: 'skipped',
      }),
    );
    const summary = makeSummary(scenarios);

    const markdown = formatMarkdownSummary(summary);

    expectTableCount(markdown, 'Skipped', 25);
    expect(markdown).toContain('Skip 00');
    expect(markdown).toContain('Skip 19');
    expect(markdown).not.toContain('Skip 20');
    expect(markdown).not.toContain('Skip 24');
    expect(markdown).toMatch(
      /5\b[^\n]{0,40}(omitted|not shown|not listed|more)/i,
    );
  });
});
