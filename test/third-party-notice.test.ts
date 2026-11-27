import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { THIRD_PARTY_NOTICE } from '../src/render/third-party-notice.js';
import { legacyFixture } from './fixtures.js';

const COMPONENT = '@cucumber/tag-expressions';
const SENTINEL = `Third-party notice: ${COMPONENT}`;
const START = '<!--\n';
const END = '\n-->';

const require = createRequire(import.meta.url);
const manifestPath = require.resolve(`${COMPONENT}/package.json`);
const installedVersion = (
  JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string }
).version;
const installedLicense = readFileSync(
  join(dirname(manifestPath), 'LICENSE'),
  'utf8',
);

const fixture = legacyFixture('failed.json');

function extractNotice(html: string): string {
  const start = html.indexOf(START);
  expect(start, SENTINEL).toBeGreaterThanOrEqual(0);
  const contentStart = start + START.length;
  const end = html.indexOf(END, contentStart);
  expect(end, SENTINEL).toBeGreaterThanOrEqual(0);
  return html.slice(contentStart, end);
}

describe('third-party notice', () => {
  it('carries exactly one notice comment in a scripted report', async () => {
    const html = await renderReport(fixture, { title: 'License size' });

    expect(html.split(SENTINEL)).toHaveLength(2);
    expect(extractNotice(html)).toBe(THIRD_PARTY_NOTICE);
  });

  it('places the comment inside body after the last script', async () => {
    const html = await renderReport(fixture, { title: 'License size' });
    const start = html.indexOf(START);
    const end = html.indexOf(END, start + START.length) + END.length;

    expect(start).toBeGreaterThan(html.indexOf('<body>'));
    expect(start).toBeGreaterThan(html.lastIndexOf('</script>'));
    expect(end).toBeLessThan(html.indexOf('</body>'));
  });

  it('states the installed component, copyright, permission and license', () => {
    expect(THIRD_PARTY_NOTICE, COMPONENT).toContain(
      `${COMPONENT} ${installedVersion} (MIT)`,
    );
    expect(THIRD_PARTY_NOTICE, COMPONENT).toContain(
      'Copyright (c) 2016 Cucumber Ltd and contributors',
    );
    expect(THIRD_PARTY_NOTICE, COMPONENT).toContain(
      [
        'Permission is hereby granted, free of charge, to any person obtaining a copy',
        'of this software and associated documentation files (the "Software"), to deal',
        'in the Software without restriction, including without limitation the rights',
        'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
        'copies of the Software, and to permit persons to whom the Software is',
        'furnished to do so, subject to the following conditions:',
      ].join('\n'),
    );
    expect(THIRD_PARTY_NOTICE, COMPONENT).toMatch(/SOFTWARE\.\n$/);
    expect(THIRD_PARTY_NOTICE, COMPONENT).not.toMatch(/[<>]/);
    expect(THIRD_PARTY_NOTICE, COMPONENT).not.toContain('<!--');
    expect(THIRD_PARTY_NOTICE, COMPONENT).not.toContain('-->');
    expect(THIRD_PARTY_NOTICE, COMPONENT).not.toContain('--');
  });

  it('leaves a static report byte-identical without the notice', async () => {
    const html = await renderReport(fixture, {
      title: 'License size',
      static: true,
    });

    expect(html).not.toContain(SENTINEL);
    expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
      'a9fdb994abb81eccd7e014912b4f0eb9c3ffc333c9e5a16ba7222846c145d1e9',
    );
  });

  it('renders the same notice in German', async () => {
    const html = await renderReport(fixture, {
      title: 'License size',
      locale: 'de',
    });

    expect(html.split(SENTINEL)).toHaveLength(2);
    expect(extractNotice(html)).toBe(THIRD_PARTY_NOTICE);
  });

  it('keeps the constant and the notice file on the installed release', () => {
    const lock = JSON.parse(
      readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
    ) as { packages: Record<string, { version?: string }> };
    const lockedVersion = lock.packages[`node_modules/${COMPONENT}`]?.version;
    expect(lockedVersion, COMPONENT).toBe(installedVersion);

    const noticeFile = readFileSync(
      fileURLToPath(new URL('../THIRD-PARTY-NOTICES.md', import.meta.url)),
      'utf8',
    );

    expect(installedLicense, COMPONENT).toMatch(/SOFTWARE\.\n$/);
    for (const [label, text] of [
      ['the rendered constant', THIRD_PARTY_NOTICE],
      ['THIRD-PARTY-NOTICES.md', noticeFile],
    ] as const) {
      expect(
        text.endsWith(installedLicense),
        `${COMPONENT}: ${label} does not end with the installed license`,
      ).toBe(true);
      expect(text, `${COMPONENT}: ${label} version`).toContain(
        `${COMPONENT} ${installedVersion}`,
      );
    }
  });
});
