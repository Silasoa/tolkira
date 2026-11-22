// An intentional output change runs `npx vitest run -u test/render-golden.test.ts`,
// then replaces the failing hashes from the failure output.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderReport } from '../src/index.js';

// The legacy parser falls back to `new Date()` for a missing start time, so the
// clock is pinned to keep the hashes stable.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const fixtures = [
  {
    name: 'messages screenshot',
    fixture: 'messages/screenshot.ndjson',
    sha256: '3e79bbbb9530b1dadad93e4fb089291786d39ce341ef3b9f916f859dd09f6921',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '0a8cf2e1bc77b1f2de24533e6ac75aed00c06dbf8ee43873de7c160732f4d0d5',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: 'de73994f2e513a94068ba31e7ff442e9379ceff3b60532264a473702b126a73d',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'ff740499028ee94cf479d3213fd4001df01a97fcb254fe63b7bc2306700336af',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '31da2403b6de7c4be4acd20916a0530cb58861d5406807d87026969cfb5e953c',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '9a550b6e30882fd297e3cef5c96dc1f91eefd5bdc59571532b5acd08d91b14e2',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '8750c92159355b2a73fff6601862bc3efecd840b59d662e4b8e4f6d1c1ea6008',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '41ed37efab9565397169fed925f4cfd2782308c625f5e752f015ebf8c692ecad',
  },
];

describe('render characterization', () => {
  it.each(fixtures)('keeps the $name HTML byte-identical', async ({
    fixture,
    sha256,
  }) => {
    const file = fileURLToPath(
      new URL(`./fixtures/${fixture}`, import.meta.url),
    );
    const html = await renderReport(file, { title: 'Characterization' });

    expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
      sha256,
    );
  });
});
