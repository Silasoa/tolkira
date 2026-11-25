import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { parseJUnitXml } from '../src/input/junit.js';
import { generateReport, renderReport, summarizeReport } from '../src/index.js';

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
    expect(summary.counts.features).toBe(3);

    const html = await renderReport([fixture, edgeCasesFixture], {
      title: 'Two JUnit files',
    });
    expect(html).toContain('checkout');
    expect(html).toContain('profile loads');
    expect(html).toContain('statuses &amp; entities');
    expect(html).not.toContain(path.dirname(fixture));

    const matrix = html.slice(html.indexOf('<table class="featureTable">'));
    const names = [
      ...matrix.matchAll(
        /<tr><th scope="row"><span class="matrixName">(.*?)<\/span>/g,
      ),
    ].map((match) => match[1]);
    expect(names).toEqual(['checkout', 'profile', 'statuses &amp; entities']);
  });

  it('maps failures and errors without attributes', async () => {
    const summary = await summarizeReport(failureShapesFixture);

    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      passed: 0,
      failed: 4,
      skipped: 0,
    });
    const messageByScenario = new Map(
      summary.scenarios.map((scenario) => [
        scenario.name,
        scenario.steps[0]?.message,
      ]),
    );
    expect(messageByScenario.get('text failure')).toBe(
      'AssertionError: text only',
    );
    expect(messageByScenario.get('cdata failure')).toBe('CDATA boom');
    expect(messageByScenario.get('self closing failure')).toBeUndefined();
    expect(messageByScenario.get('text error')).toBe(
      'RuntimeError: text only',
    );

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

  it.each([
    [
      'attribute',
      '<testsuites><testsuite name="a &amp; b & c"><testcase name="passes"/></testsuite></testsuites>',
    ],
    [
      'text',
      '<testsuites><testsuite name="bare text"><testcase name="passes"><failure>a &amp; b & c</failure></testcase></testsuite></testsuites>',
    ],
  ])('rejects a bare ampersand before a later entity in %s', async (_where, xml) => {
    const dir = await tempDir();
    const file = path.join(dir, 'bare-amp-before-entity.xml');
    await writeFile(file, xml, 'utf8');

    await expect(renderReport(file, { title: 'Bare ampersand' })).rejects.toThrow(
      /Invalid JUnit XML .*invalid entity reference/,
    );
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

  it('rejects DTD and entity declarations', async () => {
    const dir = await tempDir();
    const dtd = path.join(dir, 'dtd.xml');
    const entity = path.join(dir, 'entity.xml');
    const pi = path.join(dir, 'pi.xml');
    await writeFile(
      dtd,
      '<?xml version="1.0"?><!DOCTYPE testsuites [<!ENTITY custom "value">]><testsuites><testsuite name="dtd"><testcase name="custom"><failure>&custom;</failure></testcase></testsuite></testsuites>',
      'utf8',
    );
    await writeFile(
      entity,
      '<!ENTITY custom "value"><testsuites><testsuite name="entity"><testcase name="passes"/></testsuite></testsuites>',
      'utf8',
    );
    await writeFile(
      pi,
      '<?xml-stylesheet href="x?a=1&b=2;c=3"?><testsuites><testsuite name="pi"><testcase name="passes"/></testsuite></testsuites>',
      'utf8',
    );

    await expect(renderReport(dtd, { title: 'DTD' })).rejects.toThrow(
      /Invalid JUnit XML in .*dtd\.xml: <!DOCTYPE> declarations are not supported\./,
    );
    await expect(renderReport(entity, { title: 'Entity' })).rejects.toThrow(
      /Invalid JUnit XML in .*entity\.xml: <!ENTITY> declarations are not supported\./,
    );

    const piSummary = await summarizeReport(pi);
    expect(piSummary.counts.scenarios).toMatchObject({
      total: 1,
      passed: 1,
    });
  });

  it('ignores declaration text inside comments, CDATA and processing instructions', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'declaration-text.xml');
    await writeFile(
      file,
      '<?xml version="1.0"?>' +
        '<!-- <!DOCTYPE ignored> <!ENTITY ignored "x"> -->' +
        '<?note <!DOCTYPE ignored> <!ENTITY ignored "x">?>' +
        '<testsuites><testsuite name="declaration text"><testcase name="cdata">' +
        '<failure message="CDATA"><![CDATA[<!DOCTYPE note> <!ENTITY custom "value">]]></failure>' +
        '</testcase></testsuite></testsuites>',
      'utf8',
    );

    const summary = await summarizeReport(file);
    expect(summary.scenarios[0]?.steps[0]?.message).toContain(
      '<!DOCTYPE note>',
    );
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

  describe('empty JUnit documents in a directory', () => {
    const surefireEmpty =
      '<testsuites><testsuite name="skipped-surefire" tests="0"/></testsuites>';
    const bareEmpty = '<testsuite name="skipped-bare" tests="0"/>';

    it('skips a Surefire zero-test document and renders the rest', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(path.join(dir, 'empty.xml'), surefireEmpty, 'utf8');

      const summary = await summarizeReport(dir);

      expect(summary.counts.features).toBe(2);
      expect(summary.counts.scenarios).toMatchObject({
        total: 4,
        passed: 2,
        failed: 1,
        skipped: 1,
      });
      expect(
        summary.scenarios.some(
          (scenario) => scenario.feature === 'skipped-surefire',
        ),
      ).toBe(false);

      const html = await renderReport(dir, { title: 'Directory' });
      expect(html).toContain('expired coupon');
      expect(html).not.toContain('skipped-surefire');
    });

    it('skips a bare zero-test testsuite and renders the rest', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(path.join(dir, 'empty.xml'), bareEmpty, 'utf8');

      const summary = await summarizeReport(dir);

      expect(summary.counts.features).toBe(2);
      expect(summary.counts.scenarios.total).toBe(4);
      expect(
        summary.scenarios.some(
          (scenario) => scenario.feature === 'skipped-bare',
        ),
      ).toBe(false);

      const html = await renderReport(dir, { title: 'Directory' });
      expect(html).toContain('expired coupon');
      expect(html).not.toContain('skipped-bare');
    });

    it('rejects a directory with only zero-test documents and writes no report', async () => {
      const dir = await tempDir();
      await writeFile(path.join(dir, 'surefire.xml'), surefireEmpty, 'utf8');
      await writeFile(path.join(dir, 'bare.xml'), bareEmpty, 'utf8');

      await expect(renderReport(dir, { title: 'Empty' })).rejects.toThrow(
        /No supported report files found\./,
      );

      const outDir = await tempDir();
      const output = path.join(outDir, 'report.html');
      let stderr = '';
      const code = await runCli([dir, '--out', output], {
        stdout: () => {},
        stderr: (text) => {
          stderr += text;
        },
      });

      expect(code).toBe(1);
      expect(stderr).toContain('No supported report files found.');
      expect(await readdir(outDir)).toEqual([]);
    });

    it('rejects an explicit list that includes a zero-test document', async () => {
      const dir = await tempDir();
      const empty = path.join(dir, 'empty.xml');
      await writeFile(empty, surefireEmpty, 'utf8');

      await expect(
        renderReport([fixture, empty], { title: 'Mixed' }),
      ).rejects.toThrow(/Unsupported JUnit XML in .*empty\.xml/);
    });

    it('rejects a malformed JUnit document in a directory instead of skipping it', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(
        path.join(dir, 'broken.xml'),
        '<testsuites><testsuite>',
        'utf8',
      );

      await expect(renderReport(dir, { title: 'Broken' })).rejects.toThrow(
        /Invalid JUnit XML in .*broken\.xml at line \d+/,
      );
    });

    it('renders exactly one scenario for one test case plus an empty document', async () => {
      const dir = await tempDir();
      await writeFile(
        path.join(dir, 'single.xml'),
        '<testsuites><testsuite name="single suite"><testcase name="only test"/></testsuite></testsuites>',
        'utf8',
      );
      await writeFile(path.join(dir, 'empty.xml'), bareEmpty, 'utf8');

      const summary = await summarizeReport(dir);

      expect(summary.counts.features).toBe(1);
      expect(summary.counts.scenarios).toMatchObject({
        total: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
      });
      expect(summary.scenarios.map((scenario) => scenario.name)).toEqual([
        'only test',
      ]);
    });

    it('skips two empty documents and renders the usable one', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(path.join(dir, 'surefire.xml'), surefireEmpty, 'utf8');
      await writeFile(path.join(dir, 'bare.xml'), bareEmpty, 'utf8');

      const summary = await summarizeReport(dir);

      expect(summary.counts.features).toBe(2);
      expect(summary.counts.scenarios.total).toBe(4);
      expect(summary.scenarios.map((scenario) => scenario.feature)).toEqual(
        expect.arrayContaining(['checkout', 'profile']),
      );
      expect(
        summary.scenarios.every(
          (scenario) =>
            scenario.feature !== 'skipped-surefire' &&
            scenario.feature !== 'skipped-bare',
        ),
      ).toBe(true);
    });

    it('keeps a skipped empty document in the input-file count', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(path.join(dir, 'empty.xml'), surefireEmpty, 'utf8');

      const report = await generateReport(dir);

      expect(report.inputFiles).toBe(2);
      expect(report.summary.counts.scenarios.total).toBe(4);
    });

    it('keeps nested test cases when the wrapper suite has none of its own', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(
        path.join(dir, 'wrapped.xml'),
        '<testsuites><testsuite name="wrapper"><testsuite name="nested child"><testcase name="nested only"/></testsuite></testsuite></testsuites>',
        'utf8',
      );

      const summary = await summarizeReport(dir);

      expect(summary.counts.scenarios.total).toBe(5);
      expect(summary.scenarios.map((scenario) => scenario.name)).toContain(
        'nested only',
      );
    });

    it('rejects a wrapper root that hides a real test case in a directory', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(
        path.join(dir, 'wrapped.xml'),
        '<testResults><testsuite name="wrapper"><testcase name="REAL TEST"/></testsuite></testResults>',
        'utf8',
      );

      const error = await renderReport(dir, { title: 'Wrapped' }).then(
        () => undefined,
        (cause: unknown) => cause,
      );

      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : '';
      expect(message).toMatch(/Unsupported JUnit XML in .*wrapped\.xml/);
      expect(message).not.toContain('REAL TEST');
    });

    it('rejects an empty multi-root document in a directory', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(
        path.join(dir, 'multi.xml'),
        '<testsuite name="a"/><testsuite name="b"/>',
        'utf8',
      );

      await expect(renderReport(dir, { title: 'Multi root' })).rejects.toThrow(
        /Unsupported JUnit XML in .*multi\.xml/,
      );
    });

    it('rejects a test case under an unrecognised root in a directory', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      await writeFile(
        path.join(dir, 'nested.xml'),
        '<testsuites><report><testcase name="nested lost"/></report></testsuites>',
        'utf8',
      );

      await expect(renderReport(dir, { title: 'Nested' })).rejects.toThrow(
        /Unsupported JUnit XML in .*nested\.xml/,
      );
    });

    it('treats a file named explicitly as explicit inside a scanned directory', async () => {
      const dir = await tempDir();
      await copyFile(fixture, path.join(dir, 'valid.xml'));
      const empty = path.join(dir, 'empty.xml');
      await writeFile(empty, surefireEmpty, 'utf8');

      await expect(
        renderReport([dir, empty], { title: 'Explicit' }),
      ).rejects.toThrow(/Unsupported JUnit XML in .*empty\.xml/);
    });

    it('rejects a directory with only a zero-test document and unrelated XML', async () => {
      const dir = await tempDir();
      await writeFile(path.join(dir, 'empty.xml'), surefireEmpty, 'utf8');
      await writeFile(path.join(dir, 'notes.xml'), '<notes />', 'utf8');

      await expect(renderReport(dir, { title: 'Empty' })).rejects.toThrow(
        /No supported report files found\./,
      );
    });

    it('rejects an explicit zero-test file and writes no report', async () => {
      const dir = await tempDir();
      const empty = path.join(dir, 'empty.xml');
      await writeFile(empty, surefireEmpty, 'utf8');

      const outDir = await tempDir();
      const output = path.join(outDir, 'report.html');
      let stderr = '';
      const code = await runCli([empty, '--out', output], {
        stdout: () => {},
        stderr: (text) => {
          stderr += text;
        },
      });

      expect(code).toBe(1);
      expect(stderr).toContain('Unsupported JUnit XML in');
      expect(await readdir(outDir)).toEqual([]);
    });

    it('rejects an explicit byte-identical copy of a scanned zero-test document', async () => {
      const dir = await tempDir();
      const scanned = path.join(dir, 'a-empty.xml');
      const explicit = path.join(dir, 'z-empty.xml');
      await writeFile(scanned, surefireEmpty, 'utf8');
      await copyFile(scanned, explicit);
      await copyFile(fixture, path.join(dir, 'valid.xml'));

      await expect(
        renderReport([dir, explicit], { title: 'Duplicate' }),
      ).rejects.toThrow(/Unsupported JUnit XML in .*z-empty\.xml/);
    });
  });
});

describe('JUnit XML entities', () => {
  it('accepts the five XML named entities in text and attributes', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'named.xml');
    await writeFile(
      file,
      '<testsuites><testsuite name="A &amp; B &lt; C &gt; D &quot; E &apos; F">' +
        '<testcase name="named &amp; entities"><failure>A &amp; B &lt; C &gt; D &quot; E &apos; F</failure></testcase>' +
        '</testsuite></testsuites>',
      'utf8',
    );

    const summary = await summarizeReport(file);

    expect(summary.scenarios[0]?.name).toBe('named & entities');
    expect(summary.scenarios[0]?.feature).toBe(
      'A & B < C > D " E \' F',
    );
    expect(summary.scenarios[0]?.steps[0]?.message).toBe(
      'A & B < C > D " E \' F',
    );
  });

  it.each(['&#160;', '&#xA0;'])(
    'accepts the numeric reference %s as data',
    async (reference) => {
      const dir = await tempDir();
      const file = path.join(dir, 'numeric-nbsp.xml');
      await writeFile(
        file,
        `<testsuites><testsuite name="numeric"><testcase name="passes${reference}here"><failure/></testcase></testsuite></testsuites>`,
        'utf8',
      );

      const summary = await summarizeReport(file);

      expect(summary.scenarios[0]?.name).toBe('passes\u00A0here');
    },
  );

  it.each([
    ['an unknown named entity', '&copy;'],
    ['a 32-character unknown entity', `&${'a'.repeat(32)};`],
    ['a 33-character unknown entity', `&${'a'.repeat(33)};`],
  ])('rejects %s with the invalid-entity error', async (name, entity) => {
    const dir = await tempDir();
    const file = path.join(dir, 'unknown-named.xml');
    await writeFile(
      file,
      `<testsuites><testsuite name="named"><testcase name="bad ${entity}"><failure/></testcase></testsuite></testsuites>`,
      'utf8',
    );
    const before = await readFile(file, 'utf8');

    await expect(renderReport(file, { title: name })).rejects.toThrow(
      new RegExp(
        `Invalid JUnit XML in .*unknown-named\\.xml: invalid entity reference &${entity.slice(1, -1)};`,
      ),
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it.each([
    ['a bare ampersand at the end of an element text', 'a &', ''],
    ['an unterminated &amp at the end of an element text', 'a &amp', 'amp'],
  ])('rejects %s and writes no report', async (_name, body, entity) => {
    const dir = await tempDir();
    const input = path.join(dir, 'bare-amp-tail.xml');
    const xml =
      '<testsuites><testsuite name="bare"><testcase name="edge">' +
      `<failure>${body}</failure></testcase></testsuite></testsuites>`;
    await writeFile(input, xml, 'utf8');
    const expected = new RegExp(
      `Invalid JUnit XML in .*bare-amp-tail\\.xml: invalid entity reference &${entity};`,
    );

    await expect(parseJUnitXml(xml, input)).rejects.toThrow(expected);

    const outDir = await tempDir();
    let stderr = '';
    const code = await runCli([input, '--out', path.join(outDir, 'report.html')], {
      stdout: () => {},
      stderr: (text) => {
        stderr += text;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('invalid entity reference');
    expect(await readdir(outDir)).toEqual([]);
  });

  it('rejects numeric references outside the XML character ranges', async () => {
    const dir = await tempDir();
    for (const [name, reference] of [
      ['above-max.xml', '&#x110000;'],
      ['surrogate.xml', '&#xD800;'],
    ] as const) {
      const file = path.join(dir, name);
      await writeFile(
        file,
        `<testsuites><testsuite name="range"><testcase name="bad"><failure>${reference}</failure></testcase></testsuite></testsuites>`,
        'utf8',
      );

      await expect(renderReport(file, { title: name })).rejects.toThrow(
        new RegExp(
          `Invalid JUnit XML in .*${name.replace('.', '\\.')}: invalid entity reference ${reference}`,
        ),
      );
    }
  });

  it('keeps an entity-looking value inside CDATA as data', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'cdata-entity.xml');
    await writeFile(
      file,
      '<testsuites><testsuite name="cdata"><testcase name="cdata">' +
        '<failure><![CDATA[&nbsp; stays data]]></failure>' +
        '</testcase></testsuite></testsuites>',
      'utf8',
    );

    const summary = await summarizeReport(file);

    expect(summary.scenarios[0]?.steps[0]?.message).toBe('&nbsp; stays data');
  });

  it('keeps the same entity decision for explicit and directory input', async () => {
    const acceptedDir = await tempDir();
    const accepted = path.join(acceptedDir, 'accepted.xml');
    await writeFile(
      accepted,
      '<testsuites><testsuite name="accepted"><testcase name="passes &amp; prints"><failure/></testcase></testsuite></testsuites>',
      'utf8',
    );
    const rejectedDir = await tempDir();
    const rejected = path.join(rejectedDir, 'rejected.xml');
    await writeFile(
      rejected,
      '<testsuites><testsuite name="rejected"><testcase name="bad &nbsp;"><failure/></testcase></testsuite></testsuites>',
      'utf8',
    );

    await expect(renderReport(acceptedDir, { title: 'Accepted dir' })).resolves
      .toContain('passes &amp; prints');
    await expect(renderReport(rejectedDir, { title: 'Rejected dir' })).rejects
      .toThrow(/Invalid JUnit XML in .*rejected\.xml: invalid entity reference &nbsp;/);
  });

  it(
    'scans a long bare-& run in linear time',
    async () => {
      const dir = await tempDir();
      const file = path.join(dir, 'bare-amp.xml');
      await writeFile(
        file,
        `<testsuites><testsuite name="bare"><testcase name="long"><failure>${'&'.repeat(200_000)}</failure></testcase></testsuite></testsuites>`,
        'utf8',
      );

      await expect(renderReport(file, { title: 'Bare ampersands' })).rejects
        .toThrow(/Invalid JUnit XML/);
    },
    5_000,
  );

  it('caps an over-long entity name in the error text', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'huge-entity.xml');
    const entity = 'a'.repeat(100);
    await writeFile(
      file,
      `<testsuites><testsuite name="huge"><testcase name="bad &${entity};"><failure/></testcase></testsuite></testsuites>`,
      'utf8',
    );

    const error = await renderReport(file, { title: 'Huge entity' }).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    const message = error instanceof Error ? error.message : '';

    expect(message).toContain(`invalid entity reference &${'a'.repeat(64)}...;`);
    expect(message).not.toContain(entity);
  });

  it('writes no partial report when a long named entity is rejected', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'long-entity.xml');
    await writeFile(
      input,
      `<testsuites><testsuite name="long"><testcase name="bad &${'a'.repeat(33)};"><failure/></testcase></testsuite></testsuites>`,
      'utf8',
    );
    const outDir = await tempDir();
    const output = path.join(outDir, 'report.html');
    let stderr = '';

    const code = await runCli([input, '--out', output], {
      stdout: () => {},
      stderr: (text) => {
        stderr += text;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('invalid entity reference');
    expect(await readdir(outDir)).toEqual([]);
  });
});
