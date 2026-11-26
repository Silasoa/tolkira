import { describe, expect, it } from 'vitest';
import { summarizeReport } from '../src/index.js';
import { buildLoadedRun, type LoadedRun } from '../src/loaded-run.js';
import { projectSummary } from './baseline-helpers.js';
import { messagesFixture } from './fixtures.js';
import { parseFile, remoteImageEnvelopes } from './render-helpers.js';

describe('buildLoadedRun', () => {
  it('builds an empty run with the documented defaults', () => {
    const run = buildLoadedRun([]);

    expect(run.envelopes).toEqual([]);
    expect(run.index.featureDocuments).toEqual([]);
    expect(run.summary.counts.features).toBe(0);
    expect(run.summary.counts.scenarios.total).toBe(0);
    expect(run.summary.status).toBe('unknown');
    expect(run.comparison).toBeUndefined();
    expect(run.provenance).toBeUndefined();
    expect(run.skippedAttachments).toBe(0);
    expect(run.inputFiles).toBeUndefined();
    expect(run.inputBytes).toBeUndefined();
  });

  it('sanitises, indexes and summarises a single input', async () => {
    const run = buildLoadedRun(
      await parseFile(messagesFixture('screenshot.ndjson')),
    );

    expect(run.index.featureDocuments).toHaveLength(1);
    expect(run.summary.counts.features).toBe(1);
    expect(run.summary.counts.scenarios.total).toBe(2);
    expect(run.skippedAttachments).toBe(0);
  });

  it('keeps the built envelopes free of the remote Markdown image', async () => {
    const envelopes = await remoteImageEnvelopes();
    const run = buildLoadedRun(envelopes);

    expect(run.envelopes).toHaveLength(envelopes.length);
    expect(
      run.envelopes.find((envelope) => envelope.gherkinDocument)
        ?.gherkinDocument?.feature?.description,
    ).not.toContain('example.com');
    expect(
      run.envelopes.find((envelope) => envelope.gherkinDocument)
        ?.gherkinDocument?.feature?.description,
    ).toContain('![logo]()');
  });

  it('indexes and summarises a multi-file run', async () => {
    const run = buildLoadedRun([
      ...(await parseFile(messagesFixture('screenshot.ndjson'))),
      ...(await parseFile(messagesFixture('second.ndjson'))),
    ]);

    expect(run.index.featureDocuments).toHaveLength(2);
    expect(run.summary.counts.features).toBe(2);
    expect(run.summary.counts.scenarios.total).toBe(4);
  });

  it('turns a baseline into a comparison and a summary carrying it', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const baseline = projectSummary(await summarizeReport(file));
    const run = buildLoadedRun(await parseFile(file), { baseline });

    expect(run.comparison).toBeDefined();
    expect(run.comparison?.changes).toBeInstanceOf(Map);
    expect(run.summary.baseline).toBeDefined();
    expect(run.summary.baseline).toEqual(run.comparison?.block);
  });

  it('keeps every supplied fact on the run', async () => {
    const provenance = new Map([
      ['features/screenshot.feature', 'screenshot.ndjson'],
    ]);
    const run = buildLoadedRun(
      await parseFile(messagesFixture('screenshot.ndjson')),
      { provenance, skippedAttachments: 2, inputFiles: 3, inputBytes: 4096 },
    );

    expect(run.provenance).toBe(provenance);
    expect(run.skippedAttachments).toBe(2);
    expect(run.inputFiles).toBe(3);
    expect(run.inputBytes).toBe(4096);
    expect(run.comparison).toBeUndefined();
  });

  it('keeps zero input counts as supplied facts', () => {
    const run = buildLoadedRun([], { inputFiles: 0, inputBytes: 0 });

    expect(run.inputFiles).toBe(0);
    expect(run.inputBytes).toBe(0);
  });

  it('leaves absent facts absent except the skipped count', () => {
    const run = buildLoadedRun([], {
      skippedAttachments: 0,
    });

    expect(run.comparison).toBeUndefined();
    expect(run.provenance).toBeUndefined();
    expect(run.inputFiles).toBeUndefined();
    expect(run.inputBytes).toBeUndefined();
    expect(run.skippedAttachments).toBe(0);
  });

  it('rejects a complete object literal outside the builder', () => {
    const source = buildLoadedRun([]);
    // @ts-expect-error LoadedRun is branded; only buildLoadedRun may produce it.
    const forged: LoadedRun = {
      envelopes: source.envelopes,
      index: source.index,
      summary: source.summary,
      ...(source.comparison === undefined
        ? {}
        : { comparison: source.comparison }),
      ...(source.provenance === undefined
        ? {}
        : { provenance: source.provenance }),
      skippedAttachments: source.skippedAttachments,
      ...(source.inputFiles === undefined
        ? {}
        : { inputFiles: source.inputFiles }),
      ...(source.inputBytes === undefined
        ? {}
        : { inputBytes: source.inputBytes }),
    };

    expect(forged.envelopes).toEqual([]);
  });
});
