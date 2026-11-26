import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRunManifest, serializeRunManifest } from '../src/artifacts.js';
import type { BaselineSummary } from '../src/baseline.js';
import { formatCiOutput } from '../src/ci.js';
import type { CliPlan } from '../src/cli/plan.js';
import type { HistoryRun } from '../src/history.js';
import type { ResolvedInputs } from '../src/input/load.js';
import type { GeneratedReport } from '../src/run.js';
import type {
  ReportSummary,
  StatusCounts,
  SummaryStatus,
} from '../src/summary.js';
import {
  ATTACHMENT_HINT,
  INPUT_WARN_BYTES,
  attachmentWarning,
  earlyInputWarning,
  formatMegabytes,
} from '../src/warnings.js';

const mocks = vi.hoisted(() => ({
  writeAtomic:
    vi.fn<(file: string, content: string | Uint8Array) => Promise<void>>(),
  renderPdf:
    vi.fn<
      (html: string, options?: { timeoutMs?: number }) => Promise<Uint8Array>
    >(),
  resolveInputFiles: vi.fn<(inputs: string[]) => Promise<ResolvedInputs>>(),
  scanInputBytes:
    vi.fn<(files: ResolvedInputs['files']) => Promise<{ bytes: number }>>(),
  generateReportFromResolved:
    vi.fn<
      (
        resolved: ResolvedInputs,
        options: Record<string, unknown>,
      ) => Promise<GeneratedReport>
    >(),
  summarizeRunFromResolved:
    vi.fn<
      (
        resolved: ResolvedInputs,
        baseline?: BaselineSummary,
      ) => Promise<{ summary: ReportSummary; skippedAttachments: number }>
    >(),
  readHistory: vi.fn<(file: string, limit?: number) => Promise<HistoryRun[]>>(),
  writeHistory:
    vi.fn<
      (file: string, history: HistoryRun[], limit?: number) => Promise<void>
    >(),
  readBaseline: vi.fn<(file: string) => Promise<BaselineSummary>>(),
  renderEmail: vi.fn<(summary: ReportSummary, options?: unknown) => string>(),
}));

vi.mock('../src/output.js', () => ({ writeAtomic: mocks.writeAtomic }));
vi.mock('../src/pdf.js', () => ({
  renderPdf: mocks.renderPdf,
  DEFAULT_TIMEOUT_MS: 300_000,
}));
vi.mock('../src/input/load.js', () => ({
  resolveInputFiles: mocks.resolveInputFiles,
  scanInputBytes: mocks.scanInputBytes,
}));
vi.mock('../src/run.js', () => ({
  generateReportFromResolved: mocks.generateReportFromResolved,
  summarizeRunFromResolved: mocks.summarizeRunFromResolved,
}));
vi.mock('../src/history.js', () => ({
  readHistory: mocks.readHistory,
  writeHistory: mocks.writeHistory,
}));
vi.mock('../src/baseline.js', () => ({
  readBaseline: mocks.readBaseline,
}));
vi.mock('../src/email.js', () => ({ renderEmail: mocks.renderEmail }));

import { executePlan } from '../src/cli/execute.js';

const FROZEN = new Date('2026-11-26T12:00:00.000Z');
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function counts(total: number, passed: number, failed: number): StatusCounts {
  return {
    total,
    passed,
    failed,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
  };
}

function summary(status: SummaryStatus = 'failed'): ReportSummary {
  return {
    schemaVersion: 2,
    status,
    durationMs: 12,
    counts: {
      features: 1,
      scenarios: counts(2, 1, 1),
      steps: counts(2, 1, 1),
    },
    attachments: { total: 1, bytes: 8509 },
    scenarios: [
      {
        name: 'Failing scenario',
        uri: 'features/screenshot.feature',
        feature: 'Screenshot attachment',
        status: 'failed',
        executed: true,
        durationMs: 10,
        attempt: 0,
        tags: ['@failing'],
        attachments: 0,
        steps: [],
      },
    ],
  };
}

const mainSummary = summary();

const resolved: ResolvedInputs = {
  files: [{ file: 'input.ndjson', explicit: true }],
};

const historyRuns: HistoryRun[] = [
  {
    id: 'a'.repeat(64),
    recordedAt: '2026-01-05T09:30:00.000Z',
    title: 'Previous',
    status: 'passed',
    counts: {
      features: 1,
      scenarios: counts(1, 1, 0),
      steps: counts(1, 1, 0),
    },
    durationMs: 5,
    attachments: { total: 0, bytes: 0 },
  },
];

const baseline: BaselineSummary = {
  schemaVersion: 2,
  status: 'passed',
  scenarios: [],
};

const generated: GeneratedReport = {
  html: '<html>generated</html>',
  summary: mainSummary,
  skippedAttachments: 0,
  inputFiles: 1,
  inputBytes: 1234,
};

function plan(overrides: Partial<CliPlan> = {}): CliPlan {
  return {
    mode: 'generate',
    inputs: ['input.ndjson'],
    metadata: {},
    json: false,
    static: false,
    maxSizeMb: 10,
    writes: ['report'],
    stdout: { machine: null, confirmations: ['report'] },
    exitCodes: { success: 0, failure: 1 },
    ...overrides,
  };
}

function makeIO(events: string[] = []) {
  let stdout = '';
  let stderr = '';
  return {
    port: {
      stdout: (text: string) => {
        stdout += text;
        events.push(`stdout:${text}`);
      },
      stderr: (text: string) => {
        stderr += text;
        events.push(`stderr:${text}`);
      },
    },
    read: () => ({ stdout, stderr }),
  };
}

function denied(): Error {
  return Object.assign(new Error('denied'), { code: 'EACCES' });
}

function failWriteOn(failAt: string): void {
  mocks.writeAtomic.mockImplementation(async (file) => {
    if (file === failAt) throw denied();
  });
}

let events: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  events = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);

  mocks.resolveInputFiles.mockResolvedValue(resolved);
  mocks.scanInputBytes.mockResolvedValue({ bytes: 0 });
  mocks.readHistory.mockResolvedValue([]);
  mocks.readBaseline.mockResolvedValue(baseline);
  mocks.generateReportFromResolved.mockImplementation(async () => {
    events.push('generate');
    return { ...generated };
  });
  mocks.summarizeRunFromResolved.mockImplementation(async () => {
    events.push('summarize');
    return { summary: mainSummary, skippedAttachments: 0 };
  });
  mocks.writeAtomic.mockImplementation(async (file) => {
    events.push(`write:${file}`);
  });
  mocks.writeHistory.mockImplementation(async (file) => {
    events.push(`history:${file}`);
  });
  mocks.renderEmail.mockReturnValue('<email>');
  mocks.renderPdf.mockImplementation(async () => {
    events.push('pdf-render');
    return PDF_BYTES;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('executePlan summary branch', () => {
  it('writes email, CI output and manifest, then prints confirmations', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      email: 'email.html',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['email', 'ci-markdown', 'manifest'],
      stdout: { machine: null, confirmations: ['email', 'manifest'] },
    });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read()).toEqual({
      stdout:
        'Email written to email.html\nManifest written to manifest.json\n',
      stderr: '',
    });
    expect(mocks.generateReportFromResolved).not.toHaveBeenCalled();
    expect(mocks.resolveInputFiles).toHaveBeenCalledTimes(1);
    expect(mocks.resolveInputFiles).toHaveBeenCalledWith(['input.ndjson']);
    expect(mocks.summarizeRunFromResolved.mock.calls[0]?.[0]).toBe(resolved);
    expect(mocks.scanInputBytes.mock.calls[0]?.[0]).toBe(resolved.files);
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'email.html',
      'ci.md',
      'manifest.json',
    ]);
    expect(mocks.renderEmail).toHaveBeenCalledWith(mainSummary, {
      now: FROZEN,
    });
  });

  it('lets --json own stdout and suppress every confirmation', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      json: true,
      email: 'email.html',
      manifest: 'manifest.json',
      writes: ['email', 'manifest'],
      stdout: { machine: 'json', confirmations: [] },
    });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read().stdout).toBe(`${JSON.stringify(mainSummary, null, 2)}\n`);
    expect(io.read().stdout).not.toContain('Email written');
    expect(io.read().stdout).not.toContain('Manifest written');
  });

  it('prints nothing for a CI file that owns no stdout', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      ci: 'markdown',
      ciOut: 'ci.md',
      writes: ['ci-markdown'],
      stdout: { machine: null, confirmations: [] },
    });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read().stdout).toBe('');
  });

  it('passes the baseline to the summary seam', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      json: true,
      baseline: 'baseline.json',
      stdout: { machine: 'json', confirmations: [] },
    });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(mocks.readBaseline).toHaveBeenCalledWith('baseline.json');
    expect(mocks.summarizeRunFromResolved.mock.calls[0]?.[1]).toBe(baseline);
  });
});

describe('executePlan generate branch', () => {
  it('writes report, PDF, email, history, CI and manifest in order', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
      stdout: {
        machine: null,
        confirmations: ['report', 'pdf', 'email', 'manifest'],
      },
    });
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      history: historyRuns,
    });
    mocks.readHistory.mockResolvedValue(historyRuns);

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read().stderr).toBe('');
    expect(io.read().stdout).toBe(
      'Report written to report.html\n' +
        'PDF written to run.pdf\n' +
        'Email written to email.html\n' +
        'Manifest written to manifest.json\n',
    );
    expect(events).toEqual([
      'generate',
      'write:report.html',
      'pdf-render',
      'write:run.pdf',
      'write:email.html',
      'history:history.json',
      'write:ci.md',
      'write:manifest.json',
      'stdout:Report written to report.html\n',
      'stdout:PDF written to run.pdf\n',
      'stdout:Email written to email.html\n',
      'stdout:Manifest written to manifest.json\n',
    ]);
    expect(mocks.writeHistory).toHaveBeenCalledWith(
      'history.json',
      historyRuns,
      undefined,
    );
  });

  it('keeps the conditional generate option object exact', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      baseline: 'baseline.json',
      title: 'Plan',
      locale: 'de-AT',
      metadata: { a: '1' },
      accent: '#123456',
      logoDataUri: 'data:image/png;base64,AAAA',
      static: true,
      historyLimit: 7,
      pdfTimeout: 1234,
      writes: ['report', 'pdf', 'email', 'history'],
      stdout: {
        machine: null,
        confirmations: ['report', 'pdf', 'email'],
      },
    });
    mocks.readHistory.mockResolvedValue(historyRuns);
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      history: historyRuns,
    });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(mocks.generateReportFromResolved).toHaveBeenCalledWith(resolved, {
      title: 'Plan',
      metadata: { a: '1' },
      logo: 'data:image/png;base64,AAAA',
      accent: '#123456',
      historyLimit: 7,
      static: true,
      locale: 'de-AT',
      history: historyRuns,
      baseline,
    });
    expect(mocks.renderPdf).toHaveBeenCalledWith(generated.html, {
      timeoutMs: 1234,
    });
  });

  it('passes only metadata when no optional value exists', async () => {
    const io = makeIO(events);
    const value = plan({ report: 'report.html' });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(mocks.generateReportFromResolved).toHaveBeenCalledWith(resolved, {
      metadata: {},
    });
    expect(mocks.renderPdf).not.toHaveBeenCalled();
  });

  it('names the report, or the PDF when there is no report, in the email', async () => {
    const withReport = makeIO(events);
    await executePlan(
      plan({
        report: 'report.html',
        email: 'email.html',
        writes: ['report', 'email'],
        stdout: {
          machine: null,
          confirmations: ['report', 'email'],
        },
      }),
      withReport.port,
    );
    expect(mocks.renderEmail).toHaveBeenLastCalledWith(mainSummary, {
      reportName: 'report.html',
      now: FROZEN,
    });

    const withPdf = makeIO(events);
    await executePlan(
      plan({
        pdf: 'run.pdf',
        email: 'email.html',
        writes: ['pdf', 'email'],
        stdout: { machine: null, confirmations: ['pdf', 'email'] },
      }),
      withPdf.port,
    );
    expect(mocks.renderEmail).toHaveBeenLastCalledWith(mainSummary, {
      reportName: path.basename('run.pdf'),
      now: FROZEN,
    });
  });

  it('keeps no reportName in the summary-only email', async () => {
    const io = makeIO(events);
    await executePlan(
      plan({
        mode: 'summary',
        email: 'email.html',
        writes: ['email'],
        stdout: { machine: null, confirmations: ['email'] },
      }),
      io.port,
    );

    expect(mocks.renderEmail).toHaveBeenCalledWith(mainSummary, {
      now: FROZEN,
    });
  });

  it('lets a standalone CI format own stdout', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      ci: 'github',
      writes: [],
      stdout: { machine: 'ci', confirmations: [] },
    });

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read().stdout).toBe(formatCiOutput(mainSummary, 'github'));
  });
});

describe('executePlan failure points', () => {
  it('keeps the summary generate failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      email: 'email.html',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['email', 'ci-markdown', 'manifest'],
      stdout: { machine: null, confirmations: ['email', 'manifest'] },
    });
    mocks.summarizeRunFromResolved.mockRejectedValue(
      new Error('summarize failed'),
    );

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: summarize failed\n',
    });
    expect(mocks.writeAtomic).not.toHaveBeenCalled();
    expect(mocks.renderEmail).not.toHaveBeenCalled();
  });

  it('keeps the summary email failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      email: 'email.html',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['email', 'ci-markdown', 'manifest'],
      stdout: { machine: null, confirmations: ['email', 'manifest'] },
    });
    failWriteOn('email.html');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write email to email.html (EACCES)\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'email.html',
    ]);
  });

  it('keeps the summary CI failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      email: 'email.html',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['email', 'ci-markdown', 'manifest'],
      stdout: { machine: null, confirmations: ['email', 'manifest'] },
    });
    failWriteOn('ci.md');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write CI output to ci.md (EACCES)\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'email.html',
      'ci.md',
    ]);
  });

  it('keeps the summary manifest failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      email: 'email.html',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['email', 'ci-markdown', 'manifest'],
      stdout: { machine: null, confirmations: ['email', 'manifest'] },
    });
    failWriteOn('manifest.json');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write manifest to manifest.json\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'email.html',
      'ci.md',
      'manifest.json',
    ]);
  });

  it('stops before every write when input resolution fails', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      email: 'email.html',
      writes: ['report', 'email'],
      stdout: { machine: null, confirmations: ['report', 'email'] },
    });
    mocks.resolveInputFiles.mockRejectedValue(new Error('resolve failed'));

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: resolve failed\n',
    });
    expect(mocks.writeAtomic).not.toHaveBeenCalled();
    expect(mocks.readHistory).not.toHaveBeenCalled();
    expect(mocks.readBaseline).not.toHaveBeenCalled();
    expect(mocks.generateReportFromResolved).not.toHaveBeenCalled();
  });

  it('stops before every write when the history read fails', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      history: 'history.json',
      baseline: 'baseline.json',
      writes: ['report', 'history'],
      stdout: { machine: null, confirmations: ['report'] },
    });
    mocks.readHistory.mockRejectedValue(new Error('history failed'));

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: history failed\n',
    });
    expect(mocks.readBaseline).not.toHaveBeenCalled();
    expect(mocks.writeAtomic).not.toHaveBeenCalled();
  });

  it('stops before every write when the baseline read fails', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      baseline: 'baseline.json',
      writes: ['report'],
      stdout: { machine: null, confirmations: ['report'] },
    });
    mocks.readBaseline.mockRejectedValue(new Error('baseline failed'));

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: baseline failed\n',
    });
    expect(mocks.generateReportFromResolved).not.toHaveBeenCalled();
    expect(mocks.writeAtomic).not.toHaveBeenCalled();
  });

  it('keeps the generate failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    mocks.generateReportFromResolved.mockRejectedValue(
      new Error('generate failed'),
    );

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: generate failed\n',
    });
    expect(mocks.writeAtomic).not.toHaveBeenCalled();
    expect(mocks.renderPdf).not.toHaveBeenCalled();
  });

  it('keeps the report failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    failWriteOn('report.html');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write report to report.html (EACCES)\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
    ]);
    expect(mocks.renderPdf).not.toHaveBeenCalled();
    expect(mocks.writeHistory).not.toHaveBeenCalled();
  });

  it('keeps the PDF render failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    mocks.renderPdf.mockRejectedValue(new Error('render failed'));

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot render PDF for run.pdf: render failed\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
    ]);
    expect(mocks.writeHistory).not.toHaveBeenCalled();
  });

  it('keeps the PDF write failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    failWriteOn('run.pdf');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write PDF to run.pdf (EACCES)\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
      'run.pdf',
    ]);
  });

  it('keeps the email failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    failWriteOn('email.html');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write email to email.html (EACCES)\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
      'run.pdf',
      'email.html',
    ]);
    expect(mocks.writeHistory).not.toHaveBeenCalled();
  });

  it('keeps the history failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      history: historyRuns,
    });
    mocks.writeHistory.mockRejectedValue(new Error('history failed'));

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: history failed\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
      'run.pdf',
      'email.html',
    ]);
    expect(mocks.writeHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps the CI failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      history: historyRuns,
    });
    failWriteOn('ci.md');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write CI output to ci.md (EACCES)\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
      'run.pdf',
      'email.html',
      'ci.md',
    ]);
    expect(mocks.writeHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps the manifest failure state', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      history: historyRuns,
    });
    failWriteOn('manifest.json');

    const code = await executePlan(value, io.port);

    expect(code).toBe(1);
    expect(io.read()).toEqual({
      stdout: '',
      stderr: 'tolkira: Cannot write manifest to manifest.json\n',
    });
    expect(mocks.writeAtomic.mock.calls.map(([file]) => file)).toEqual([
      'report.html',
      'run.pdf',
      'email.html',
      'ci.md',
      'manifest.json',
    ]);
  });
});

describe('executePlan warnings', () => {
  it('orders the early input, max-size and skipped-attachment warnings after writes', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      maxSizeMb: 0.0001,
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
      stdout: {
        machine: null,
        confirmations: ['report', 'pdf', 'email', 'manifest'],
      },
    });
    mocks.scanInputBytes.mockResolvedValue({ bytes: INPUT_WARN_BYTES });
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      html: 'x'.repeat(4096),
      skippedAttachments: 1,
      history: historyRuns,
    });

    const earlyWarning = `tolkira: warning: ${earlyInputWarning(INPUT_WARN_BYTES)}\n`;
    const sizeWarning =
      `tolkira: warning: report HTML is ${formatMegabytes(4096)} MB ` +
      `(input ${formatMegabytes(1234)} MB, ` +
      `attachments ${formatMegabytes(mainSummary.attachments.bytes)} MB decoded), ` +
      `above the 0.0001 MB threshold; large screenshots or videos ` +
      `inflate the HTML and the PDF.\n`;
    const attachment = `tolkira: warning: ${attachmentWarning(1)} ${ATTACHMENT_HINT}\n`;

    const code = await executePlan(value, io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read().stderr).toBe(earlyWarning + sizeWarning + attachment);
    expect(events).toEqual([
      `stderr:${earlyWarning}`,
      'generate',
      'write:report.html',
      'pdf-render',
      'write:run.pdf',
      'write:email.html',
      'history:history.json',
      `stderr:${sizeWarning}`,
      `stderr:${attachment}`,
      'write:ci.md',
      'write:manifest.json',
      'stdout:Report written to report.html\n',
      'stdout:PDF written to run.pdf\n',
      'stdout:Email written to email.html\n',
      'stdout:Manifest written to manifest.json\n',
    ]);
  });

  it('swallows an early input scan failure', async () => {
    const io = makeIO(events);
    mocks.scanInputBytes.mockRejectedValue(new Error('scan failed'));

    const code = await executePlan(plan({ report: 'report.html' }), io.port);

    expect(code, io.read().stderr).toBe(0);
    expect(io.read().stderr).toBe('');
    expect(io.read().stdout).toBe('Report written to report.html\n');
  });
});

describe('executePlan manifest ledger', () => {
  it('records generate artifacts in write order', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });
    mocks.generateReportFromResolved.mockResolvedValue({
      ...generated,
      skippedAttachments: 2,
      history: historyRuns,
    });

    await executePlan(value, io.port);

    const call = mocks.writeAtomic.mock.calls.find(
      ([file]) => file === 'manifest.json',
    );
    expect(call).toBeDefined();
    const text = call?.[1];
    expect(typeof text).toBe('string');
    const manifest = JSON.parse(text as string) as {
      artifacts: Array<{ kind: string; path: string }>;
      warnings: { skippedAttachments: number };
    };
    expect(manifest.artifacts.map((artifact) => artifact.kind)).toEqual([
      'report',
      'pdf',
      'email',
      'history',
      'ci-markdown',
    ]);
    expect(manifest.warnings.skippedAttachments).toBe(2);
    expect(text).toBe(
      serializeRunManifest(
        buildRunManifest(
          mainSummary,
          2,
          [
            { kind: 'report', path: 'report.html' },
            { kind: 'pdf', path: 'run.pdf' },
            { kind: 'email', path: 'email.html' },
            { kind: 'history', path: 'history.json' },
            { kind: 'ci-markdown', path: 'ci.md' },
          ],
          'manifest.json',
        ),
      ),
    );
  });

  it('omits history when none was generated', async () => {
    const io = makeIO(events);
    const value = plan({
      report: 'report.html',
      pdf: 'run.pdf',
      email: 'email.html',
      history: 'history.json',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
    });

    await executePlan(value, io.port);

    expect(mocks.writeHistory).not.toHaveBeenCalled();
    const call = mocks.writeAtomic.mock.calls.find(
      ([file]) => file === 'manifest.json',
    );
    const manifest = JSON.parse(call?.[1] as string) as {
      artifacts: Array<{ kind: string }>;
    };
    expect(manifest.artifacts.map((artifact) => artifact.kind)).toEqual([
      'report',
      'pdf',
      'email',
      'ci-markdown',
    ]);
  });

  it('records the summary artifacts as email and CI only', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      email: 'email.html',
      ci: 'markdown',
      ciOut: 'ci.md',
      manifest: 'manifest.json',
      writes: ['email', 'ci-markdown', 'manifest'],
      stdout: { machine: null, confirmations: ['email', 'manifest'] },
    });

    await executePlan(value, io.port);

    const call = mocks.writeAtomic.mock.calls.find(
      ([file]) => file === 'manifest.json',
    );
    const manifest = JSON.parse(call?.[1] as string) as {
      artifacts: Array<{ kind: string }>;
    };
    expect(manifest.artifacts.map((artifact) => artifact.kind)).toEqual([
      'email',
      'ci-markdown',
    ]);
    expect(value.writes.filter((kind: string) => kind !== 'manifest')).toEqual([
      'email',
      'ci-markdown',
    ]);
  });

  it('records no artifact for a manifest-only run', async () => {
    const io = makeIO(events);
    const value = plan({
      mode: 'summary',
      manifest: 'manifest.json',
      writes: ['manifest'],
      stdout: { machine: null, confirmations: ['manifest'] },
    });

    await executePlan(value, io.port);

    const call = mocks.writeAtomic.mock.calls.find(
      ([file]) => file === 'manifest.json',
    );
    const manifest = JSON.parse(call?.[1] as string) as {
      artifacts: Array<{ kind: string }>;
    };
    expect(manifest.artifacts).toEqual([]);
    expect(io.read().stdout).toBe('Manifest written to manifest.json\n');
  });
});
