import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

const fixture = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
);
const nestedFixture = fileURLToPath(
  new URL('./fixtures/junit/nested.xml', import.meta.url),
);
const edgeCasesFixture = fileURLToPath(
  new URL('./fixtures/junit/edge-cases.xml', import.meta.url),
);
const malformedFixture = fileURLToPath(
  new URL('./fixtures/junit/malformed.xml', import.meta.url),
);
const failureShapesFixture = fileURLToPath(
  new URL('./fixtures/junit/failures-without-attributes.xml', import.meta.url),
);
const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const messages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-junit-'));
  tempDirs.push(dir);
  return dir;
}

describe('JUnit XML input', () => {
  it('maps suites, statuses, durations and system output', async () => {
    const summary = await summarizeReport(fixture);

    expect(summary.counts.features).toBe(2);
    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      passed: 2,
      failed: 1,
      skipped: 1,
    });
    expect(summary.scenarios.map((scenario) => scenario.feature)).toEqual(
      expect.arrayContaining(['checkout', 'profile']),
    );
    const failed = summary.scenarios.find(
      (scenario) => scenario.status === 'failed',
    );
    expect(failed?.name).toBe('expired coupon');
    expect(failed?.steps[0]?.message).toContain('Expected 200');
    expect(failed?.durationMs).toBeGreaterThan(0);
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBeGreaterThan(0);
  });

  it('maps nested suites and ignores an empty suite', async () => {
    const summary = await summarizeReport(nestedFixture);

    expect(summary.counts.features).toBe(2);
    expect(summary.counts.scenarios).toMatchObject({
      total: 2,
      passed: 2,
      failed: 0,
      skipped: 0,
    });
    expect(summary.scenarios.map((scenario) => scenario.name)).toEqual([
      'inner passes',
      'outer passes',
    ]);
    expect(summary.durationMs).toBe(5);
    expect(
      summary.scenarios.some((scenario) => scenario.feature === 'empty suite'),
    ).toBe(false);

    const html = await renderReport(nestedFixture, { title: 'Nested' });
    expect(html).toContain('outer passes');
    expect(html).toContain('inner passes');
    expect(html).not.toContain('empty suite');
  });

  it('maps skipped, error and failure test cases', async () => {
    const summary = await summarizeReport(edgeCasesFixture);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.scenarios).toMatchObject({
      total: 6,
      passed: 3,
      failed: 2,
      skipped: 1,
    });
    expect(byName.get('ignored')?.status).toBe('skipped');
    expect(byName.get('errors')?.status).toBe('failed');
    expect(byName.get('errors')?.steps[0]?.message).toBe(
      'Boom "now"\nTraceback: boom <line 1> & more',
    );
    expect(byName.get('fails with body')?.status).toBe('failed');
    expect(byName.get('fails with body')?.steps[0]?.message).toBe(
      'Expected <200>\nAssertionError: plain & simple',
    );
  });

  it('decodes XML entities and keeps CDATA text', async () => {
    const summary = await summarizeReport(edgeCasesFixture);

    expect(summary.scenarios.map((scenario) => scenario.name)).toContain(
      'passes & prints',
    );
    expect(
      summary.scenarios.every((scenario) => !scenario.name.includes('&amp;')),
    ).toBe(true);
    expect(summary.scenarios.map((scenario) => scenario.feature)).toContain(
      'statuses & entities',
    );

    const html = await renderReport(edgeCasesFixture, { title: 'Entities' });
    expect(html).toContain('passes &amp; prints');
    expect(html).toContain('statuses &amp; entities');
  });

  it('preserves system-out and system-err as text attachments', async () => {
    const summary = await summarizeReport(edgeCasesFixture);
    const prints = summary.scenarios.find(
      (scenario) => scenario.name === 'passes & prints',
    );

    expect(prints?.attachments).toBe(2);
    expect(summary.attachments.total).toBe(2);
    expect(summary.attachments.bytes).toBeGreaterThan(0);

    const html = await renderReport(edgeCasesFixture, { title: 'Output' });
    expect(html).toContain('stdout &lt;ok&gt;');
    expect(html).toContain('stderr &amp; detail');
  });

  it('falls back when optional attributes are missing', async () => {
    const summary = await summarizeReport(edgeCasesFixture);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(byName.get('edge.NoName')).toMatchObject({
      status: 'passed',
      durationMs: 0,
    });
    expect(byName.get('Test 6')).toMatchObject({
      status: 'passed',
      durationMs: 0,
    });
    expect(
      summary.scenarios.every((scenario) =>
        scenario.uri.endsWith('edge-cases.xml'),
      ),
    ).toBe(true);
  });

  it('renders JUnit XML and merges it with Cucumber input', async () => {
    const junitHtml = await renderReport(fixture, { title: 'JUnit only' });
    expect(junitHtml).toContain('JUnit XML');
    expect(junitHtml).toContain('1 step');
    expect(junitHtml).not.toContain('1 steps');

    const html = await renderReport([fixture, legacy], { title: 'Mixed' });

    expect(html).toContain('checkout');
    expect(html).toContain('expired coupon');
    expect(html).toContain('Expected 200');
    expect(html).toContain('request id: abc');
    expect(html).toContain('Happy HTML reporting');
  });

  it('merges JUnit XML with Cucumber Messages input', async () => {
    const html = await renderReport([fixture, messages], {
      title: 'JUnit and Messages',
    });
    expect(html).toContain('expired coupon');
    expect(html).toContain('Second scenario');

    const summary = await summarizeReport([fixture, messages]);
    expect(summary.counts.scenarios.total).toBe(6);
  });

  it('keeps both features when two JUnit files are merged', async () => {
    const summary = await summarizeReport([fixture, edgeCasesFixture]);
    expect(summary.counts.scenarios.total).toBe(10);

    const html = await renderReport([fixture, edgeCasesFixture], {
      title: 'Two JUnit files',
    });
    expect(html).toContain('checkout');
    expect(html).toContain('statuses &amp; entities');
  });

  it('maps failures and errors without attributes', async () => {
    const summary = await summarizeReport(failureShapesFixture);

    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      passed: 0,
      failed: 4,
      skipped: 0,
    });
    const messages = new Map(
      summary.scenarios.map((scenario) => [
        scenario.name,
        scenario.steps[0]?.message,
      ]),
    );
    expect(messages.get('text failure')).toBe('AssertionError: text only');
    expect(messages.get('cdata failure')).toBe('CDATA boom');
    expect(messages.get('self closing failure')).toBeUndefined();
    expect(messages.get('text error')).toBe('RuntimeError: text only');

    const html = await renderReport(failureShapesFixture, {
      title: 'Failure shapes',
    });
    expect(html.match(/class="copyFailure"/g)).toHaveLength(4);
  });

  it('rejects invalid entity references', async () => {
    const dir = await tempDir();
    const cases: Array<[string, string, RegExp]> = [
      ['unknown.xml', '&nbsp;', /invalid entity reference &nbsp;/],
      ['hex.xml', '&#xZZ;', /invalid entity reference &#xZZ;/],
      ['zero.xml', '&#0;', /invalid entity reference &#0;/],
    ];

    for (const [name, entity, expected] of cases) {
      const file = path.join(dir, name);
      await writeFile(
        file,
        `<testsuites><testsuite><testcase name="bad ${entity}"><failure/></testcase></testsuite></testsuites>`,
        'utf8',
      );
      await expect(renderReport(file, { title: 'Entity' })).rejects.toThrow(
        expected,
      );
    }
  });

  it('decodes numeric character references', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'numeric.xml');
    await writeFile(
      file,
      '<testsuites><testsuite name="numeric"><testcase name="&#65;"><failure>&#66;</failure></testcase></testsuite></testsuites>',
      'utf8',
    );

    const summary = await summarizeReport(file);
    expect(summary.scenarios[0]?.name).toBe('A');
    expect(summary.scenarios[0]?.steps[0]?.message).toBe('B');
  });

  it('accepts DTD entities and processing instructions', async () => {
    const dir = await tempDir();
    const dtd = path.join(dir, 'dtd.xml');
    const pi = path.join(dir, 'pi.xml');
    await writeFile(
      dtd,
      '<?xml version="1.0"?><!DOCTYPE testsuites [<!ENTITY custom "value">]><testsuites><testsuite name="dtd"><testcase name="custom"><failure>&custom;</failure></testcase></testsuite></testsuites>',
      'utf8',
    );
    await writeFile(
      pi,
      '<?xml-stylesheet href="x?a=1&b=2;c=3"?><testsuites><testsuite name="pi"><testcase name="passes"/></testsuite></testsuites>',
      'utf8',
    );

    const dtdSummary = await summarizeReport(dtd);
    expect(dtdSummary.counts.scenarios).toMatchObject({
      total: 1,
      failed: 1,
    });

    const piSummary = await summarizeReport(pi);
    expect(piSummary.counts.scenarios).toMatchObject({
      total: 1,
      passed: 1,
    });
  });

  it('rejects empty and multi-root XML clearly', async () => {
    const dir = await tempDir();
    const empty = path.join(dir, 'empty-file.xml');
    const multi = path.join(dir, 'multi-root.xml');
    await writeFile(empty, '', 'utf8');
    await writeFile(multi, '<testsuite name="a"/><testsuite name="b"/>', 'utf8');

    await expect(renderReport(empty, { title: 'Empty' })).rejects.toThrow(
      /line \d+, column \d+/,
    );
    await expect(renderReport(multi, { title: 'Multi root' })).rejects.toThrow(
      /Unsupported JUnit XML .*multi-root\.xml/,
    );
  });

  it('rejects malformed JUnit XML with the file and line', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'broken.xml');
    await writeFile(file, '<testsuites><testsuite>', 'utf8');

    await expect(renderReport(file, { title: 'Broken' })).rejects.toThrow(
      /Invalid JUnit XML in .*broken\.xml at line \d+/,
    );
  });

  it('rejects mismatched closing tags instead of parsing them silently', async () => {
    await expect(
      renderReport(malformedFixture, { title: 'Malformed' }),
    ).rejects.toThrow(
      /Invalid JUnit XML in .*malformed\.xml at line \d+/,
    );
  });

  it('rejects a JUnit document without test cases', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'empty.xml');
    await writeFile(
      file,
      '<testsuites><testsuite name="empty" tests="0"/></testsuites>',
      'utf8',
    );

    await expect(renderReport(file, { title: 'Empty' })).rejects.toThrow(
      /Unsupported JUnit XML in .*empty\.xml/,
    );
  });

  it('ignores unrelated XML in a directory', async () => {
    const dir = await tempDir();
    await copyFile(fixture, path.join(dir, 'junit.xml'));
    await writeFile(path.join(dir, 'notes.xml'), '<notes />', 'utf8');

    const html = await renderReport(dir, { title: 'Directory' });

    expect(html).toContain('expired coupon');
  });
});
