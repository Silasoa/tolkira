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
    sha256: '4fc50b32a8e9b5a8698df34e40c963dba47dcb7dc6f25f6379c2ac85ed6a5f81',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '325e85fae20c37eb0806a437d935b5ebd44e658fbf1153dd9c8cf95d2d190500',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '50d460f5d3d1bd90ca9e616805cb5c3876169e1a1651dfaeb09c858795a23e04',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '5b55eb6ecdf435ce06c0bc0881666538cacb8df7eb1d6490eedc4cd6526cade6',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'a8a4ec7d4f87b1ac702a28cb4d8776d62b83b43b290e63abf4b92dd6edf03785',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'da479c4ea124071cab4d858e545704e5069f121b3d3f56316aba461a3fa27e18',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '2d51ca184b4fe529a64223e91086a961b5eeef555f0ee1dc1740ae1bcfaa4da2',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '00b789c729a67902ebd2bef78e778196896eaca3dca203763ef935398f3f0c79',
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
