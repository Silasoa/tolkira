import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { formatCiOutput } from '../src/ci.js';
import { runCli } from '../src/cli.js';
import { renderEmail } from '../src/email.js';
import { generateReport, renderReport, summarizeReport } from '../src/index.js';
import { loadInputs } from '../src/input/load.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel, type ReportAttachment } from '../src/report/model.js';
import { renderAttachment } from '../src/render/attachments.js';
import { applyReportSize, REPORT_BYTES_MARKER } from '../src/render/details.js';
import { escapeHtml } from '../src/render/escape.js';
import { exactSizeLabel, sizeLabel } from '../src/render/format.js';
import { renderHtml } from '../src/render/html.js';
import { createTranslator } from '../src/render/i18n.js';

const messages = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/messages/${name}`, import.meta.url));
const legacy = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/legacy/${name}`, import.meta.url));

const MIB = 1024 * 1024;
const PLURAL_BYTES = '{count, plural, one {# Byte} other {# Bytes}}';
const MEGABYTES_MESSAGE = '{count} MB';
const t = createTranslator('en');

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-size-'));
  tempDirs.push(dir);
  return dir;
}

function analysisView(html: string): string {
  const start = html.indexOf('id="analysis-view"');
  const end = html.indexOf('</main>', start);
  return start < 0 ? '' : html.slice(start, end < 0 ? html.length : end);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The dd of the first matching dt label, or undefined when no row exists. */
function rowValue(view: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = new RegExp(
      `<dt>${escapeRegExp(label)}</dt><dd>([\\s\\S]*?)</dd>`,
    ).exec(view);
    if (match) return match[1];
  }
  return undefined;
}

// Old-path oracle: keep the pre-formatted string; do not align with production.
function bytesLabel(bytes: number): string {
  return t.t('format.bytes', { count: t.number(bytes) });
}

function megabytes(bytes: number): string {
  return (bytes / MIB).toFixed(1);
}

function oneDecimal(value: number): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

interface AttachmentInput {
  body: string;
  fileName?: string;
  mediaType: string;
  contentEncoding?: 'BASE64' | 'IDENTITY';
}

/** Writes temporary Messages with step attachments; never committed. */
async function writeSizeMessages(
  scenarioName: string,
  attachments: AttachmentInput[],
): Promise<string> {
  const dir = await tempDir();
  const file = path.join(dir, 'size.ndjson');
  const lines = [
    {
      source: {
        data: `Feature: Size diagnostics\n\n  Scenario: ${scenarioName}\n    Given attachments\n`,
        uri: 'features/size.feature',
        mediaType: 'text/x.cucumber.gherkin+plain',
      },
    },
    {
      gherkinDocument: {
        uri: 'features/size.feature',
        comments: [],
        feature: {
          tags: [],
          location: { line: 1, column: 1 },
          language: 'en',
          keyword: 'Feature',
          name: 'Size diagnostics',
          description: '',
          children: [
            {
              scenario: {
                id: 'size-scenario',
                tags: [],
                location: { line: 3, column: 3 },
                keyword: 'Scenario',
                name: scenarioName,
                description: '',
                steps: [
                  {
                    id: 'size-step',
                    location: { line: 4, column: 5 },
                    keyword: 'Given ',
                    keywordType: 'Context',
                    text: 'attachments',
                  },
                ],
                examples: [],
              },
            },
          ],
        },
      },
    },
    {
      pickle: {
        id: 'size-pickle',
        uri: 'features/size.feature',
        astNodeIds: ['size-scenario'],
        tags: [],
        name: scenarioName,
        language: 'en',
        steps: [
          {
            id: 'size-pickle-step',
            text: 'attachments',
            type: 'Context',
            astNodeIds: ['size-step'],
          },
        ],
      },
    },
    {
      testRunStarted: { id: 'size-run', timestamp: { seconds: 1, nanos: 0 } },
    },
    {
      testCase: {
        id: 'size-test-case',
        pickleId: 'size-pickle',
        testRunStartedId: 'size-run',
        testSteps: [
          { id: 'size-test-step', pickleStepId: 'size-pickle-step' },
        ],
      },
    },
    {
      testCaseStarted: {
        id: 'size-started',
        testCaseId: 'size-test-case',
        attempt: 0,
        timestamp: { seconds: 1, nanos: 1_000_000 },
      },
    },
    ...attachments.map((attachment, index) => ({
      attachment: {
        ...attachment,
        testCaseStartedId: 'size-started',
        testStepId: 'size-test-step',
        timestamp: { seconds: 1, nanos: 2_000_000 + index },
      },
    })),
    {
      testStepFinished: {
        testCaseStartedId: 'size-started',
        testStepId: 'size-test-step',
        testStepResult: {
          status: 'PASSED',
          duration: { seconds: 0, nanos: 1_000_000 },
        },
        timestamp: { seconds: 1, nanos: 3_000_000 },
      },
    },
    {
      testCaseFinished: {
        testCaseStartedId: 'size-started',
        timestamp: { seconds: 1, nanos: 4_000_000 },
        willBeRetried: false,
      },
    },
    {
      testRunFinished: {
        testRunStartedId: 'size-run',
        timestamp: { seconds: 1, nanos: 5_000_000 },
        success: true,
      },
    },
  ];
  await writeFile(file, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
  return file;
}

describe('input size diagnostics', () => {
  it('exposes per-file bytes on loader groups', async () => {
    const files = [messages('screenshot.ndjson'), legacy('happy.json')];
    const groups = await loadInputs(files);
    const sizes = await Promise.all(
      groups.map(async (group) => (await stat(group.file)).size),
    );

    expect(groups.map((group) => group.bytes)).toEqual(sizes);
    expect(groups.reduce((sum, group) => sum + group.bytes, 0)).toBeGreaterThan(
      0,
    );
  });

  it('returns additive input files and bytes on GeneratedReport', async () => {
    const file = messages('screenshot.ndjson');
    const generated = await generateReport(file);

    expect(generated.inputFiles).toBe(1);
    expect(generated.inputBytes).toBe((await stat(file)).size);
    expect(generated.inputBytes).toBeGreaterThan(0);
  });

  it('skips duplicate content without counting it twice', async () => {
    const source = messages('screenshot.ndjson');
    const dir = await tempDir();
    const copy = path.join(dir, 'copy.ndjson');
    await copyFile(source, copy);
    const size = (await stat(source)).size;

    const groups = await loadInputs([source, copy]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.bytes).toBe(size);

    const generated = await generateReport([source, copy]);
    expect(generated.inputFiles).toBe(1);
    expect(generated.inputBytes).toBe(size);
  });
});

describe('Run panel size contributors', () => {
  it('shows input, attachment and exact report rows with the note', async () => {
    const file = messages('screenshot.ndjson');
    const generated = await generateReport(file, { title: 'Size panel' });
    const view = analysisView(generated.html);
    const inputRow = rowValue(view, [t.t('details.inputData')]);

    expect(inputRow, 'input row').toBeDefined();
    expect(inputRow).toBe(
      `${t.t('details.inputFiles', { count: generated.inputFiles })} · ${bytesLabel(generated.inputBytes)}`,
    );
    expect(inputRow).not.toContain(`${t.t('details.inputData')}:`);
    expect(rowValue(view, [t.t('details.attachments')])).toBe(
      t.number(generated.summary.attachments.total),
    );
    expect(rowValue(view, [t.t('details.attachmentSize')])).toBe(
      bytesLabel(generated.summary.attachments.bytes),
    );
    expect(view).toContain(t.t('details.sizeNote'));
    expect(rowValue(view, [t.t('details.reportHtml')])).toBe(
      bytesLabel(Buffer.byteLength(generated.html, 'utf8')),
    );

    const rendered = await renderReport(file, { title: 'Size panel' });
    expect(
      rowValue(analysisView(rendered), [t.t('details.inputData')]),
    ).toContain(bytesLabel(generated.inputBytes));
  });

  it('lists the three largest attachments in descending byte order once', async () => {
    const files = [
      messages('attachments-large.ndjson'),
      messages('global-hooks-attachments.ndjson'),
    ];
    const generated = await generateReport(files, { title: 'Largest' });
    const view = analysisView(generated.html);
    const label = t.t('details.largestAttachments');
    const start = view.indexOf(label);
    expect(start, 'largest attachments row').toBeGreaterThan(-1);
    const end = view.indexOf('</dl>', start);
    const list = view.slice(start, end < 0 ? view.length : end);

    const groups = await loadInputs(files);
    const model = buildReportModel(
      groups.flatMap((group) => group.envelopes),
    );
    const all = [
      ...model.scenarios.flatMap((scenario) => scenario.attachments),
      ...model.runHooks.flatMap((hook) => hook.attachments),
      ...model.runAttachments,
    ];
    expect(all).toHaveLength(generated.summary.attachments.total);
    const ranked = [...all].sort((a, b) => b.bytes - a.bytes);
    const top = ranked.slice(0, 3);

    for (const [index, attachment] of top.entries()) {
      expect(
        list.split(attachment.fileName).length - 1,
        attachment.fileName,
      ).toBe(1);
      if (index > 0) {
        expect(list.indexOf(attachment.fileName)).toBeGreaterThan(
          list.indexOf((top[index - 1] as { fileName: string }).fileName),
        );
      }
    }
    for (const attachment of ranked.slice(3)) {
      expect(list).not.toContain(attachment.fileName);
    }
  });

  it('omits the input row for direct renderHtml but keeps the report rows', async () => {
    const file = messages('screenshot.ndjson');
    const envelopes = parseMessages(await readFile(file, 'utf8'), file);
    const summary = await summarizeReport(file);
    const html = await renderHtml(envelopes, { title: 'Direct' });
    const view = analysisView(html);

    expect(view).not.toContain(`<dt>${t.t('details.inputData')}</dt>`);
    expect(rowValue(view, [t.t('details.attachmentSize')])).toBe(
      bytesLabel(summary.attachments.bytes),
    );
    expect(rowValue(view, [t.t('details.reportHtml')])).toBe(
      bytesLabel(Buffer.byteLength(html, 'utf8')),
    );
  });

  it('omits the largest row when the run has no attachments', async () => {
    const generated = await generateReport(legacy('minimal.json'), {
      title: 'No attachments',
    });
    const view = analysisView(generated.html);

    expect(generated.summary.attachments.total).toBe(0);
    expect(rowValue(view, [t.t('details.attachments')])).toBe('0');
    expect(view).not.toContain(`<dt>${t.t('details.largestAttachments')}</dt>`);
  });
});

describe('exact report HTML size', () => {
  it('uses the exact UTF-8 byte length for the report row', async () => {
    const generated = await generateReport(messages('screenshot.ndjson'));
    const bytes = Buffer.byteLength(generated.html, 'utf8');
    const displayed = rowValue(analysisView(generated.html), [
      t.t('details.reportHtml'),
    ]);

    expect(bytes).toBeLessThan(MIB);
    expect(displayed).toBe(bytesLabel(bytes));
    expect(displayed).not.toContain('MB');
    expect(displayed).not.toContain('(');
  });

  it('leads with exact bytes and adds one-decimal MB above 1 MiB', async () => {
    const file = await writeSizeMessages('Large report', [
      {
        body: 'x'.repeat(1_100_000),
        fileName: 'large.txt',
        mediaType: 'text/plain',
      },
    ]);
    const generated = await generateReport(file);
    const bytes = Buffer.byteLength(generated.html, 'utf8');
    const displayed = rowValue(analysisView(generated.html), [
      t.t('details.reportHtml'),
    ]);

    expect(bytes).toBeGreaterThan(MIB);
    expect(displayed).toBe(
      `${bytesLabel(bytes)} (${megabytes(bytes)}\u00a0MB)`,
    );
  });

  it('groups the German byte count and MB value above 1 MiB', async () => {
    const file = await writeSizeMessages('Large report', [
      {
        body: 'x'.repeat(1_100_000),
        fileName: 'large.txt',
        mediaType: 'text/plain',
      },
    ]);
    const de = createTranslator('de');
    const generated = await generateReport(file, { locale: 'de' });
    const bytes = Buffer.byteLength(generated.html, 'utf8');
    const displayed = rowValue(analysisView(generated.html), [
      de.t('details.reportHtml'),
    ]);
    const grouped = new Intl.NumberFormat('de').format(bytes);
    const mb = new Intl.NumberFormat('de', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(bytes / MIB);

    expect(bytes).toBeGreaterThan(MIB);
    expect(displayed).toBe(`${grouped} Byte (${mb}\u00a0MB)`);
  });

  it('replaces the marker once and leaves escaped content unchanged', async () => {
    const file = await writeSizeMessages(`Scenario ${REPORT_BYTES_MARKER}`, [
      {
        body: `body ${REPORT_BYTES_MARKER}`,
        fileName: `marker-${REPORT_BYTES_MARKER}.txt`,
        mediaType: 'text/plain',
      },
    ]);
    const generated = await generateReport(file);
    const html = generated.html;

    expect(html).not.toContain(REPORT_BYTES_MARKER);
    expect(html).toContain(escapeHtml(REPORT_BYTES_MARKER));
    expect(rowValue(analysisView(html), [t.t('details.reportHtml')])).toBe(
      bytesLabel(Buffer.byteLength(html, 'utf8')),
    );
  });

  it('keeps the leading count exact across the 1 MiB boundary', () => {
    let below = 0;
    let above = 0;

    for (let base = MIB - 40; base <= MIB; base += 1) {
      const html = `${'x'.repeat(base)}${REPORT_BYTES_MARKER}`;
      const result = applyReportSize(html, t);
      const label = /<dd>([^<]*)<\/dd>/.exec(result)?.[1] ?? '';
      const leading = Number(/^\d+/.exec(label)?.[0]);
      const bytes = Buffer.byteLength(result, 'utf8');

      expect(leading, `${base} bytes`).toBe(bytes);
      if (bytes >= MIB) {
        above += 1;
        expect(label, `${base} bytes MB`).toMatch(/\(\d+\.\d\u00a0MB\)$/);
      } else {
        below += 1;
        expect(label, `${base} bytes no MB`).not.toContain('MB');
      }
    }

    expect(below, 'sweep below 1 MiB').toBeGreaterThan(0);
    expect(above, 'sweep at or above 1 MiB').toBeGreaterThan(0);
  });

  it('escapes HTML in attachment names in the size list', async () => {
    const name = '<img src=x onerror="alert(1)">.png';
    const file = await writeSizeMessages('XSS attachment name', [
      { body: 'x', fileName: name, mediaType: 'text/plain' },
    ]);
    const generated = await generateReport(file);
    const view = analysisView(generated.html);

    expect(view).toContain(escapeHtml(name));
    expect(view).not.toContain(name);
    expect(view).not.toContain('<img src=x');
  });
});

describe('sizeLabel', () => {
  it('switches from bytes to megabytes at 1 MiB', () => {
    const mb = t.t('format.megabytes', { count: oneDecimal(1) });
    expect(sizeLabel(MIB - 1, t)).toBe(bytesLabel(MIB - 1));
    expect(sizeLabel(MIB, t)).toBe(mb.replaceAll(' ', '\u00a0'));
    expect(sizeLabel(MIB, t)).not.toContain('bytes');
  });

  it('formats 1 MiB as 1,0 MB in German', () => {
    const de = createTranslator('de');

    expect(sizeLabel(MIB, de)).toBe('1,0\u00a0MB');
  });

  it('keeps the default German byte text unchanged', () => {
    const de = createTranslator('de');

    expect(sizeLabel(1_000_000, de)).toBe('1.000.000 Byte');
    expect(sizeLabel(0, de)).toBe('0 Byte');
  });
});

describe('exactSizeLabel', () => {
  it('keeps the exact bytes alone below 1 MiB', () => {
    expect(exactSizeLabel(MIB - 1, t)).toBe(bytesLabel(MIB - 1));
    expect(exactSizeLabel(MIB - 1, t)).not.toContain('(');
    expect(exactSizeLabel(MIB - 1, t)).not.toContain('MB');
  });

  it('adds one-decimal MB at 1 MiB', () => {
    expect(exactSizeLabel(MIB, t)).toBe('1048576 bytes (1.0\u00a0MB)');
  });

  it('formats 1 MiB as 1.048.576 Byte (1,0 MB) in German', () => {
    expect(exactSizeLabel(MIB, createTranslator('de'))).toBe(
      '1.048.576 Byte (1,0\u00a0MB)',
    );
  });
});

describe('format.bytes catalog seam', () => {
  const deSeam = createTranslator('de', {
    catalog: {
      'format.bytes': PLURAL_BYTES,
      'format.megabytes': MEGABYTES_MESSAGE,
    },
  });
  const enSeam = createTranslator('en', {
    catalog: {
      'format.bytes': PLURAL_BYTES,
      'format.megabytes': MEGABYTES_MESSAGE,
    },
  });

  it('formats German exact and byte labels from the numeric count', () => {
    expect(exactSizeLabel(MIB, deSeam)).toBe(
      '1.048.576 Bytes (1,0\u00a0MB)',
    );
    expect(sizeLabel(MIB - 1, deSeam)).toBe('1.048.575 Bytes');
  });

  it('selects the German plural category from the count', () => {
    expect(sizeLabel(1, deSeam)).toBe('1 Byte');
    expect(sizeLabel(2, deSeam)).toBe('2 Bytes');
    expect(sizeLabel(0, deSeam)).toBe('0 Bytes');
  });

  it('formats the English seam from the numeric count', () => {
    expect(exactSizeLabel(MIB, enSeam)).toBe('1048576 Bytes (1.0\u00a0MB)');
    expect(sizeLabel(1, enSeam)).toBe('1 Byte');
    expect(sizeLabel(2, enSeam)).toBe('2 Bytes');
    expect(sizeLabel(0, enSeam)).toBe('0 Bytes');
  });
});

describe('attachment size row', () => {
  const deSeam = createTranslator('de', {
    catalog: { 'format.bytes': PLURAL_BYTES },
  });
  const attachment = (bytes: number): ReportAttachment => ({
    fileName: 'evidence.bin',
    mediaType: 'application/octet-stream',
    kind: 'binary',
    textFormat: 'plain',
    bytes,
  });

  it('formats the attachment label from the numeric count', () => {
    expect(renderAttachment(attachment(1), undefined, deSeam)).toContain(
      ', 1 Byte)',
    );
    expect(renderAttachment(attachment(2), undefined, deSeam)).toContain(
      ', 2 Bytes)',
    );
  });

  it('groups a binary attachment at 1 MiB without parsing the string', () => {
    expect(renderAttachment(attachment(MIB), undefined, deSeam)).toContain(
      ', 1.048.576 Bytes)',
    );
  });
});

describe('CLI size warning', () => {
  it('names the report, input and decoded attachment sizes', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const file = messages('attachments-large.ndjson');
    let stderr = '';
    const code = await runCli([file, '--out', output, '--max-size', '0.001'], {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });

    expect(code).toBe(0);
    const html = await readFile(output, 'utf8');
    const generated = await generateReport(file);
    expect(stderr).toContain(
      `report HTML is ${megabytes(Buffer.byteLength(html, 'utf8'))} MB`,
    );
    expect(stderr).toContain(
      `input ${megabytes(generated.inputBytes)} MB`,
    );
    expect(stderr).toContain(
      `attachments ${megabytes(generated.summary.attachments.bytes)} MB decoded`,
    );
    expect(stderr).toContain('above the 0.001 MB threshold');
  });

  it('prints no size warning below the threshold', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    let stderr = '';
    const code = await runCli(
      [messages('screenshot.ndjson'), '--out', output],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(code).toBe(0);
    expect(stderr).not.toContain('warning: report HTML');
  });
});

describe('size fields stay out of other outputs', () => {
  it('matches panel attachment bytes with the summary', async () => {
    const generated = await generateReport(messages('attachments-large.ndjson'));
    const view = analysisView(generated.html);

    expect(rowValue(view, [t.t('details.attachments')])).toBe(
      t.number(generated.summary.attachments.total),
    );
    expect(rowValue(view, [t.t('details.attachmentSize')])).toBe(
      bytesLabel(generated.summary.attachments.bytes),
    );
  });

  it('adds no size fields to the summary, CI or email', async () => {
    const generated = await generateReport(messages('attachments-large.ndjson'));
    const sizeFields = /inputFiles|inputBytes|reportBytes|inputSize/;

    expect(generated.summary.schemaVersion).toBe(2);
    expect(JSON.stringify(generated.summary)).not.toMatch(sizeFields);
    expect(formatCiOutput(generated.summary, 'markdown')).not.toMatch(
      sizeFields,
    );
    expect(
      renderEmail(generated.summary, { now: new Date(0) }),
    ).not.toMatch(sizeFields);
  });
});

describe('size diagnostics catalogs', () => {
  const keys = [
    'details.inputData',
    'details.inputFiles',
    'details.reportHtml',
    'details.largestAttachments',
    'details.sizeNote',
    'format.megabytes',
  ];

  it('has the new English and German keys', async () => {
    const en = JSON.parse(
      await readFile(
        new URL('../src/i18n/locales/en.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, { message: string; description: string }>;
    const de = JSON.parse(
      await readFile(
        new URL('../src/i18n/locales/de.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, string>;

    for (const key of keys) {
      expect(en[key]?.message ?? '', key).not.toBe('');
      expect(en[key]?.description ?? '', key).not.toBe('');
      expect(de[key] ?? '', key).not.toBe('');
    }
    expect(en['details.sizeNote']?.message ?? '').toMatch(/report file sizes/i);
    expect(en['details.sizeNote']?.message ?? '').toMatch(/decoded/i);
    expect(en['details.sizeNote']?.message ?? '').not.toMatch(/inlined media/i);
    expect(de['details.sizeNote'] ?? '').toMatch(/Berichtsdateien/);
    expect(t.t('details.inputFiles', { count: 1 })).toBe('1 file');
    expect(t.t('details.inputFiles', { count: 2 })).toBe('2 files');
    const deT = createTranslator('de');
    expect(deT.t('details.inputFiles', { count: 1 })).toBe('1 Datei');
    expect(deT.t('details.inputFiles', { count: 2 })).toBe('2 Dateien');
    expect(Object.keys(en)).toEqual(Object.keys(en).sort());
    expect(Object.keys(de)).toEqual(Object.keys(de).sort());
  });
});
