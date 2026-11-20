import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CLIENT_SCRIPT } from '../src/render/client-bundle.js';

const BUNDLE = new URL('../src/render/client-bundle.ts', import.meta.url);
const CLIENT_SOURCE = new URL('../src/render/report-client.ts', import.meta.url);

describe('client bundle', () => {
  it('stays under the 16 kB budget', () => {
    expect(CLIENT_SCRIPT.length).toBeLessThan(16_000);
  });

  it('embeds no catalog strings or English fallback map', async () => {
    const bundle = await readFile(BUNDLE, 'utf8');
    const client = await readFile(CLIENT_SOURCE, 'utf8');

    for (const german of ['Szenarien', 'Fehlgeschlagen', 'Bericht', 'Kopiert']) {
      expect(bundle, german).not.toContain(german);
    }
    expect(bundle).not.toContain('No scenarios match');
    expect(bundle).not.toContain('Failure details copied');
    expect(client).not.toMatch(/\bFALLBACK\b/);
    expect(client).toContain("createClientFormatter(document.documentElement.lang)");
  });
});
