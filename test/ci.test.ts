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
  formatAzureAnnotations,
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

function scenario(overrides: Partial<SummaryScenario> = {}): SummaryScenario {
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

function azureOutput(summary: ReportSummary): string {
  return formatCiOutput(summary, 'azure');
}

const RUN_FAILED =
  '##vso[task.logissue type=error]Run failed: The report summary is failed ' +
  'but no scenario-level error was emitted.';

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
  const escaped = label.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        (fence[1] ?? '').length >= fenceLength &&
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
    expect(errors.map((line) => line.slice(0, line.indexOf('::', 2)))).toEqual([
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
    expect(lines.some((line) => line.startsWith('::error title=x'))).toBe(
      false,
    );
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
    expect(lines).toContain(
      '::notice title=Tolkira::5 more annotations omitted',
    );
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
    expect(lines).toContain(
      '::notice title=Tolkira::5 more annotations omitted',
    );
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

    const [line = ''] = annotationLines(formatGitHubAnnotations(summary));

    expect(annotationMessage(line)).toBe(
      `${'a'.repeat(3991)}${'%25'.repeat(9)}[truncated]`,
    );
  });

  it('truncates a notice identity before escaping', () => {
    const name = `${'a'.repeat(3995)}${'%'.repeat(10)}`;
    const summary = makeSummary([
      scenario({ feature: '', name, status: 'skipped' }),
    ]);

    const [line = ''] = annotationLines(formatGitHubAnnotations(summary));

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

    const [line = ''] = annotationLines(formatGitHubAnnotations(summary));

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

  it('dispatches all formats and forwards options', () => {
    const summary = makeSummary([scenario({ name: 'Passes' })]);

    expect(formatCiOutput(summary, 'github')).toBe(
      formatGitHubAnnotations(summary),
    );
    expect(formatCiOutput(summary, 'azure')).toBe(
      formatAzureAnnotations(summary),
    );
    expect(formatCiOutput(summary, 'markdown', { title: 'CI title' })).toBe(
      formatMarkdownSummary(summary, { title: 'CI title' }),
    );
  });
});

describe('CI identity cap', () => {
  function githubTitle(line: string): string {
    const match = /^::error title=(.*?)::/.exec(line);
    if (!match) throw new Error(`missing GitHub title in ${line}`);
    return match[1] ?? '';
  }

  it('caps a long GitHub error title at 200 code points with the marker', () => {
    const feature = 'f'.repeat(100);
    const name = 'n'.repeat(101);
    const summary = makeSummary([
      scenario({
        feature,
        name,
        status: 'failed',
        steps: [step({ status: 'failed', message: 'boom' })],
      }),
    ]);

    const [line = ''] = annotationLines(formatGitHubAnnotations(summary));
    const title = githubTitle(line);

    expect(title).toBe(`${'f'.repeat(100)}%3A ${'n'.repeat(98)}[truncated]`);
    expect(line).toContain('::boom');
  });

  it('keeps exactly 200 code points unchanged and cuts 201', () => {
    const exact = makeSummary([
      scenario({
        feature: 'f'.repeat(100),
        name: 'n'.repeat(98),
        status: 'failed',
      }),
    ]);
    const over = makeSummary([
      scenario({
        feature: 'f'.repeat(100),
        name: 'n'.repeat(99),
        status: 'failed',
      }),
    ]);

    expect(
      githubTitle(annotationLines(formatGitHubAnnotations(exact))[0] ?? ''),
    ).toBe(`${'f'.repeat(100)}%3A ${'n'.repeat(98)}`);
    expect(
      githubTitle(annotationLines(formatGitHubAnnotations(over))[0] ?? ''),
    ).toBe(`${'f'.repeat(100)}%3A ${'n'.repeat(98)}[truncated]`);
    const under = makeSummary([
      scenario({
        feature: 'f'.repeat(99),
        name: 'n'.repeat(98),
        status: 'failed',
      }),
    ]);
    expect(
      githubTitle(annotationLines(formatGitHubAnnotations(under))[0] ?? ''),
    ).toBe(`${'f'.repeat(99)}%3A ${'n'.repeat(98)}`);
    expect(formatMarkdownSummary(over, { title: 'x'.repeat(200) })).toContain(
      `## ${'x'.repeat(200)}\n`,
    );
    expect(formatMarkdownSummary(over, { title: 'x'.repeat(201) })).toContain(
      `## ${'x'.repeat(200)}[truncated]\n`,
    );
  });

  it('caps the Markdown feature, name and URI before code-span wrapping', () => {
    const feature = 'F'.repeat(201);
    const name = 'N'.repeat(201);
    const uri = 'u'.repeat(201);
    const summary = makeSummary([
      scenario({
        feature,
        name,
        uri,
        status: 'failed',
        steps: [step({ status: 'failed', message: 'boom' })],
      }),
    ]);

    const markdown = formatMarkdownSummary(summary);

    expect(markdown).toContain(
      `#### \`${'F'.repeat(200)}[truncated]\` - \`${'N'.repeat(200)}[truncated]\``,
    );
    expect(markdown).toContain(`URI: \`${'u'.repeat(200)}[truncated]\``);
  });

  it('caps a long skipped identity with the marker', () => {
    const name = 's'.repeat(201);
    const summary = makeSummary([
      scenario({ feature: '', name, status: 'skipped' }),
    ]);

    const markdown = formatMarkdownSummary(summary);

    expect(markdown).toContain(`- \`${'s'.repeat(200)}[truncated]\``);
  });

  it('never splits a surrogate pair at the 200-code-point boundary', () => {
    const name = `${'a'.repeat(199)}\u{1F600}b`;
    const summary = makeSummary([
      scenario({
        feature: '',
        name,
        status: 'failed',
        steps: [step({ status: 'failed', message: 'boom' })],
      }),
    ]);

    const title = githubTitle(
      annotationLines(formatGitHubAnnotations(summary))[0] ?? '',
    );
    const markdown = formatMarkdownSummary(summary);

    expect(title).toBe(`${'a'.repeat(199)}\u{1F600}[truncated]`);
    expect(markdown).toContain(`\`${'a'.repeat(199)}\u{1F600}[truncated]\``);
  });

  it('keeps the 50/20 list limits and the complete counts', () => {
    const failed = Array.from({ length: 55 }, (_, index) =>
      scenario({
        name: `${'F'.repeat(190)}${String(index).padStart(2, '0')}`,
        status: 'failed',
      }),
    );
    const skipped = Array.from({ length: 25 }, (_, index) =>
      scenario({
        name: `${'S'.repeat(190)}${String(index).padStart(2, '0')}`,
        status: 'skipped',
      }),
    );
    const summary = makeSummary([...failed, ...skipped]);

    const lines = annotationLines(formatGitHubAnnotations(summary));
    expect(lines.filter((line) => line.startsWith('::error '))).toHaveLength(
      50,
    );
    expect(lines).toContain(
      '::notice title=Tolkira::10 more annotations omitted',
    );
    expect(lines.join('\n')).toContain('80 scenarios');
    expect(lines.join('\n')).toContain('55 failed');
    expect(lines.join('\n')).toContain('25 skipped');
  });

  it('leaves the Azure 4000-code-point identity and message cap unchanged', () => {
    const name = 'a'.repeat(250);
    const summary = makeSummary([
      scenario({ feature: '', name, status: 'failed' }),
    ]);

    const [line] = annotationLines(formatAzureAnnotations(summary));

    expect(line).toContain(`${name} — Scenario failed`);
    expect(line).not.toContain('[truncated]');

    const long = makeSummary([
      scenario({ feature: '', name: 'b'.repeat(4100), status: 'failed' }),
    ]);
    const [longLine] = annotationLines(formatAzureAnnotations(long));
    expect(longLine).toBe(
      `##vso[task.logissue type=error]${'b'.repeat(4000)}[truncated]`,
    );
  });
});

describe('Azure DevOps annotations', () => {
  it('annotates a failed scenario with its identity and failure message', () => {
    const summary = makeSummary([
      scenario({
        feature: 'Checkout',
        name: 'Pays with card',
        status: 'failed',
        steps: [
          step({ status: 'passed', message: 'ignore this message' }),
          step({ status: 'failed', message: 'Expected 1 to equal 2' }),
        ],
      }),
      scenario({ feature: 'Checkout', name: 'Passes' }),
    ]);

    expect(annotationLines(azureOutput(summary))).toEqual([
      '##vso[task.logissue type=error]Checkout: Pays with card — ' +
        'Expected 1 to equal 2',
      '##[section]Tolkira: 2 scenarios: 1 passed, 1 failed; 0 unexecuted',
    ]);
  });

  it('maps every status, ignores unexecuted and states the exact counts', () => {
    const summary = makeSummary([
      scenario({ name: 'Passes' }),
      scenario({ name: 'Fails', status: 'failed' }),
      scenario({ name: 'Skipped', status: 'skipped' }),
      scenario({ name: 'Pending', status: 'pending' }),
      scenario({ name: 'Undefined', status: 'undefined' }),
      scenario({ name: 'Ambiguous', status: 'ambiguous' }),
      scenario({ name: 'Unknown', status: 'unknown' }),
      scenario({ name: 'Not run failed', status: 'failed', executed: false }),
      scenario({ name: 'Not run unknown', status: 'unknown', executed: false }),
    ]);

    expect(annotationLines(azureOutput(summary))).toEqual([
      '##vso[task.logissue type=error]CI feature: Fails — Scenario failed',
      '##vso[task.logissue type=error]CI feature: Undefined — Scenario failed',
      '##vso[task.logissue type=error]CI feature: Ambiguous — Scenario failed',
      '##vso[task.logissue type=warning]CI feature: Skipped was skipped',
      '##vso[task.logissue type=warning]CI feature: Pending was pending',
      '##vso[task.logissue type=warning]CI feature: Unknown was unknown',
      '##[section]Tolkira: 7 scenarios: 1 passed, 1 failed, 1 skipped, ' +
        '1 pending, 1 undefined, 1 ambiguous, 1 unknown; 2 unexecuted',
    ]);
    expect(azureOutput(summary)).not.toContain('Not run');
  });

  it('counts an all-unexecuted run without scenario annotations', () => {
    const summary = makeSummary([
      scenario({ name: 'One', status: 'failed', executed: false }),
      scenario({ name: 'Two', status: 'unknown', executed: false }),
    ]);

    expect(annotationLines(azureOutput(summary))).toEqual([
      '##[section]Tolkira: 0 executed scenarios; 2 unexecuted',
    ]);
  });

  it('states an empty run', () => {
    const summary = makeSummary([]);

    expect(azureOutput(summary)).toBe('##[section]Tolkira: No scenarios\n');
  });

  it('emits one run error and marks the section for a failed run', () => {
    const summary = makeSummary([
      scenario({ name: 'Passes' }),
      scenario({ name: 'Also passes' }),
    ]);
    summary.status = 'failed';

    expect(annotationLines(azureOutput(summary))).toEqual([
      RUN_FAILED,
      '##[section]Tolkira: 2 scenarios: 2 passed; 0 unexecuted; run failed',
    ]);
  });

  it('emits the run error and the no-scenarios section for a failed empty run', () => {
    const summary = makeSummary([]);
    summary.status = 'failed';

    expect(annotationLines(azureOutput(summary))).toEqual([
      RUN_FAILED,
      '##[section]Tolkira: No scenarios; run failed',
    ]);
  });

  it('does not repeat the run error when a scenario error exists', () => {
    const summary = makeSummary([
      scenario({ name: 'Fails', status: 'failed' }),
    ]);
    summary.status = 'failed';
    const output = azureOutput(summary);

    expect(output.match(/Run failed:/g)).toBeNull();
    expect(output).not.toContain('; run failed');
  });

  it('caps 50 errors and 20 warnings, then states the total omitted once', () => {
    const scenarios = [
      ...Array.from({ length: 55 }, (_, index) =>
        scenario({
          name: `Fail ${String(index).padStart(2, '0')}`,
          status: 'failed',
        }),
      ),
      ...Array.from({ length: 25 }, (_, index) =>
        scenario({
          name: `Skip ${String(index).padStart(2, '0')}`,
          status: 'skipped',
        }),
      ),
    ];
    const output = azureOutput(makeSummary(scenarios));
    const lines = annotationLines(output);
    const errors = lines.filter((line) =>
      line.startsWith('##vso[task.logissue type=error]'),
    );
    const warnings = lines.filter(
      (line) =>
        line.startsWith('##vso[task.logissue type=warning]') &&
        !line.includes('annotations omitted'),
    );

    expect(errors).toHaveLength(50);
    expect(warnings).toHaveLength(20);
    expect(errors[0]).toContain('Fail 00');
    expect(errors[49]).toContain('Fail 49');
    expect(output).not.toContain('Fail 50');
    expect(output).not.toContain('Fail 54');
    expect(warnings[0]).toContain('Skip 00');
    expect(warnings[19]).toContain('Skip 19');
    expect(output).not.toContain('Skip 20');
    expect(output).not.toContain('Skip 24');
    expect(lines.at(-2)).toBe(
      '##vso[task.logissue type=warning]Tolkira: 10 more annotations omitted',
    );
    expect(lines.at(-1)).toBe(
      '##[section]Tolkira: 80 scenarios: 55 failed, 25 skipped; 0 unexecuted',
    );
  });

  it('does not add an omitted line at exactly 50 errors and 20 warnings', () => {
    const scenarios = [
      ...Array.from({ length: 50 }, (_, index) =>
        scenario({ name: `Fail ${String(index)}`, status: 'failed' }),
      ),
      ...Array.from({ length: 20 }, (_, index) =>
        scenario({ name: `Skip ${String(index)}`, status: 'skipped' }),
      ),
    ];
    const output = azureOutput(makeSummary(scenarios));

    expect(annotationLines(output)).toHaveLength(71);
    expect(output).not.toContain('annotations omitted');
  });

  it('truncates the complete message before escaping', () => {
    const raw = `${'a'.repeat(3990)}${'%'.repeat(20)}`;
    const summary = makeSummary([
      scenario({
        name: 'Long',
        status: 'failed',
        steps: [step({ status: 'failed', message: raw })],
      }),
    ]);
    const [line] = annotationLines(azureOutput(summary));

    expect(line).toBe(
      '##vso[task.logissue type=error]CI feature: Long — ' +
        `${'a'.repeat(3981)}[truncated]`,
    );
    expect(line).not.toContain('%AZP25');
  });

  it('truncates a long identity on the error and warning paths', () => {
    const errorSummary = makeSummary([
      scenario({ feature: '', name: 'b'.repeat(4100), status: 'failed' }),
    ]);
    const [errorLine] = annotationLines(azureOutput(errorSummary));
    expect(errorLine).toBe(
      `##vso[task.logissue type=error]${'b'.repeat(4000)}[truncated]`,
    );

    const warningSummary = makeSummary([
      scenario({ feature: '', name: 'c'.repeat(4100), status: 'skipped' }),
    ]);
    const [warningLine] = annotationLines(azureOutput(warningSummary));
    expect(warningLine).toBe(
      `##vso[task.logissue type=warning]${'c'.repeat(4000)}[truncated]`,
    );
  });

  it('escapes percent, bracket and line breaks into one inert command', () => {
    const summary = makeSummary([
      scenario({
        feature: 'Rate 50%, [v1]',
        name: 'line1\nline2',
        status: 'failed',
        steps: [step({ status: 'failed', message: '100% ] %AZP25\r\nnext' })],
      }),
    ]);
    const output = azureOutput(summary);

    expect(annotationLines(output)).toHaveLength(2);
    expect(annotationLines(output)[0]).toBe(
      '##vso[task.logissue type=error]Rate 50%AZP25, ' +
        '[v1%5D: line1%0Aline2 — 100%AZP25 %5D %AZP25AZP25%0D%0Anext',
    );
    expect(output).not.toContain('%25');
    expect(output).not.toContain('\r');
  });

  it('keeps an injected logging command inert', () => {
    const summary = makeSummary([
      scenario({
        name: 'evil\n##vso[task.logissue type=error]injected',
        status: 'failed',
      }),
    ]);
    const lines = annotationLines(azureOutput(summary));

    expect(lines).toHaveLength(2);
    expect(
      lines.filter((line) =>
        line.startsWith('##vso[task.logissue type=error]'),
      ),
    ).toHaveLength(1);
    expect(lines[0]).toBe(
      '##vso[task.logissue type=error]CI feature: evil%0A' +
        '##vso[task.logissue type=error%5Dinjected — Scenario failed',
    );
  });

  it('never sets the task result or a source path', () => {
    const output = azureOutput(makeSummary([scenario({ status: 'failed' })]));

    expect(output).not.toContain('##vso[task.complete');
    expect(output).not.toContain('sourcepath');
  });

  it('truncates before escaping so percent data survives the limit', () => {
    const raw = `${'%'.repeat(3900)}${'a'.repeat(200)}${'tail'.repeat(100)}`;
    const summary = makeSummary([
      scenario({
        feature: '',
        name: '',
        status: 'failed',
        steps: [step({ status: 'failed', message: raw })],
      }),
    ]);
    const [line = ''] = annotationLines(azureOutput(summary));

    // Three prefix code points (" — ") leave 3997 of the 4000 for the raw
    // message: 3900 percent signs and 97 of the "a" run.
    expect(line.match(/%AZP25/g)).toHaveLength(3900);
    expect(line).toBe(
      '##vso[task.logissue type=error] — ' +
        `${'%AZP25'.repeat(3900)}${'a'.repeat(97)}[truncated]`,
    );
    // Escaping first would cut the escaped run at 4000, leaving about 800
    // groups; the 3900 groups prove the raw text was cut first.
    expect(line).not.toContain('tail');
  });

  it('escapes a warning identity with percent, bracket and newline', () => {
    const summary = makeSummary([
      scenario({
        feature: '',
        name: 'rate 50%]line1\nline2',
        status: 'skipped',
      }),
    ]);
    const [line] = annotationLines(azureOutput(summary));

    expect(line).toBe(
      '##vso[task.logissue type=warning]rate 50%AZP25%5Dline1%0Aline2 ' +
        'was skipped',
    );
  });

  it('strips ANSI before wrapping an annotation', () => {
    const summary = makeSummary([
      scenario({
        name: '\u001b[31mevil\u001b[0m\n##vso[task.logissue type=error]x',
        status: 'failed',
      }),
    ]);
    const [line] = annotationLines(azureOutput(summary));

    expect(line).toBe(
      '##vso[task.logissue type=error]CI feature: evil%0A' +
        '##vso[task.logissue type=error%5Dx — Scenario failed',
    );
    expect(line).not.toContain('\u001b');
  });

  it('escapes Unicode line separators to %0A', () => {
    const summary = makeSummary([
      scenario({
        name: 'line1\u2028line2\u2029line3',
        status: 'skipped',
      }),
    ]);
    const [line] = annotationLines(azureOutput(summary));

    expect(line).toBe(
      '##vso[task.logissue type=warning]CI feature: ' +
        'line1%0Aline2%0Aline3 was skipped',
    );
    expect(line).not.toMatch(/[\u2028\u2029]/);
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
    expect(formatMarkdownSummary(summary)).toBe(formatMarkdownSummary(summary));
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
