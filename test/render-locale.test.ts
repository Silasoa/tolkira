import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HistoryRun } from '../src/history.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { createTranslator } from '../src/render/i18n.js';
import type { RenderReportOptions } from '../src/options.js';

const fixture = (path: string): string =>
  fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));

const screenshotFixture = fixture('messages/screenshot.ndjson');
const allStatusesFixture = fixture('messages/all-statuses.ndjson');
const emptyReportFixture = fixture('messages/empty-none.ndjson');
const happyFixture = fixture('legacy/happy.json');
const minimalFixture = fixture('legacy/minimal.json');
const germanTestDataFixture = fixture('i18n/german-testdata.json');
const historyFixture = fixture('history/two-runs.json');

async function renderFile(
  file: string,
  locale?: string,
  extra: Partial<RenderReportOptions> = {},
): Promise<string> {
  const content = await readFile(file, 'utf8');
  const envelopes = file.endsWith('.json')
    ? parseLegacyJson(content, basename(file))
    : parseMessages(content, basename(file));
  const options: RenderReportOptions = {
    title: 'Tolkira report',
    ...extra,
    ...(locale === undefined ? {} : { locale }),
  };
  return renderHtml(envelopes, options);
}

async function historyRuns(): Promise<HistoryRun[]> {
  const parsed = await readFile(historyFixture, 'utf8');
  return (JSON.parse(parsed) as { runs: HistoryRun[] }).runs;
}

function openingTag(html: string, marker: string): string {
  const index = html.indexOf(marker);
  expect(index, marker).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function cssBlocks(css: string, header: RegExp): string[] {
  const blocks: string[] = [];
  for (const match of css.matchAll(header)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(match.index, index));
  }
  return blocks;
}

function germanPercent(value: number): string {
  return new Intl.NumberFormat('de', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

describe('German report rendering', () => {
  let german = '';

  beforeAll(async () => {
    german = await renderFile(screenshotFixture, 'de', {
      history: await historyRuns(),
    });
  });

  it('sets lang and dir and localizes the tabs', () => {
    expect(german).toContain('<html lang="de" dir="ltr">');
    expect(german).toContain('<title>Tolkira report</title>');
    expect(german).toContain('<h1>Tolkira report</h1>');
    expect(german).toContain('aria-label="Berichtsansichten"');
    expect(german).toContain('>Bericht</button>');
    expect(german).toContain('>Details</button>');
    expect(german).toContain('>Trends</button>');
  });

  it('localizes the toolbar, filters, empty state and footer', () => {
    expect(german).toContain('placeholder="Szenario, Feature oder Tag suchen"');
    expect(german).toContain('aria-label="Szenarien durchsuchen"');
    expect(german).toContain('<span>Tag</span>');
    expect(german).toContain('<option value="">Alle Tags</option>');
    expect(german).toContain('>Nur fehlgeschlagene</button>');
    expect(german).toContain('data-expand="all">Alle ausklappen</button>');
    expect(german).toContain('data-expand="none">Alle einklappen</button>');
    expect(german).toContain(
      '<div class="empty" id="empty-results" hidden>Keine Szenarien entsprechen der aktuellen Suche oder den Filtern.</div>',
    );
    expect(german).toContain(
      '<p class="foot">Erstellt von Tolkira. Eine Datei. Keine Netzwerkanfragen. Anhänge sind eingebettet, wenn verfügbar.</p>',
    );
  });

  it('localizes status, count, health and triage copy', () => {
    expect(german).toContain('>Bestanden</span>');
    expect(german).toContain('>Fehlgeschlagen</span>');
    expect(german).toContain('1 Feature');
    expect(german).toContain('2 Szenarien mit Ergebnissen');
    expect(german).toContain('1 von 2 ausgeführten Szenarien bestanden');
    expect(german).toContain('<b>Testzeit</b>');
    expect(german).toContain('>Aufmerksamkeit erforderlich<');
    expect(german).toContain('Erster Fehler:');
  });

  it('localizes the Details view', () => {
    expect(german).toContain('Laufdetails');
    expect(german).toContain('>Lauf</h2>');
    expect(german).toContain('<dt>Schritte (ohne Hooks)</dt>');
    expect(german).toContain('<dt>Anhänge</dt>');
    expect(german).toContain('<dt>Anhangsgröße</dt>');
    expect(german).toContain('<dt>Quelle</dt>');
    expect(german).toContain('>Laufumgebung</h2>');
    expect(german).toContain(
      'Nur ausgeführte Szenarien. Für alle Statusspalten scrollen.',
    );
    expect(german).toContain('aria-label="Feature-Statusmatrix"');
    expect(german).toContain('>Statusverteilung</h2>');
    expect(german).toContain(
      'Die Erfolgsquote zählt ausgeführte (nicht übersprungene) Szenarien; Anzahlen und Balken enthalten übersprungene Szenarien.',
    );
    expect(german).toContain('>Agenten-Zusammenfassung</h2>');
    expect(german).toContain('aria-label="Agenten-Zusammenfassung JSON"');
    expect(german).toContain('Vollständige Zusammenfassung:');
  });

  it('localizes scenario detail and attachment labels', () => {
    expect(german).toContain(
      'data-copy-failure>Fehlerdetails kopieren</button>',
    );
    expect(german).toContain('<p class="detailLabel">Schritte</p>');
    expect(german).toContain('aria-label="Schritte und Hooks"');
    expect(german).toContain('aria-label="Anhang in voller Größe"');
    expect(german).toContain('>Schließen</button>');
  });

  it('stacks the German Details metadata list in a narrow shell', () => {
    const narrow = cssBlocks(
      german,
      /@container\s*\(max-width:[^)]+\)\{/g,
    ).filter((block) => block.includes(':lang(de) .metaList{'));

    expect(narrow).toHaveLength(1);
    expect(narrow[0]).toMatch(/@container\s*\(max-width:\s*[\d.]+rem\)/);
    expect(narrow[0]).toMatch(
      /:lang\(de\) \.metaList\{[^}]*grid-template-columns:minmax\(0,\s*1fr\)/,
    );
  });

  it('localizes every status label', async () => {
    const html = await renderFile(allStatusesFixture, 'de');
    for (const label of [
      'Bestanden',
      'Fehlgeschlagen',
      'Übersprungen',
      'Ausstehend',
      'Undefiniert',
      'Mehrdeutig',
    ]) {
      expect(html, label).toContain(`>${label}</span>`);
    }
    expect(html).toContain('>Versuch: ');
    // The zero-second fixture timestamps are unknown now, so the started date
    // is checked on the real-timestamp German report instead of a 1970 date.
    expect(html).not.toContain('1970');
    expect(german).toContain('>Gestartet: 02.11.2026, 14:58 UTC');
    expect(html).toContain('Feature: All statuses');
  });

  it('renders German numbers, dates, durations and pass rates in Trends', () => {
    expect(german).toContain('>Aufgezeichnet am</th>');
    expect(german).toContain('>Titel</th>');
    expect(german).toContain('>Gesamt</th>');
    expect(german).toContain('>Erfolgsquote</th>');
    expect(german).toContain('>Dauer</th>');
    expect(german).toContain('>Neueste zuerst<');
    expect(german).toContain('>Aufgezeichnete Läufe<');
    expect(german).toContain('>Aktuell<');

    expect(german).toContain('05.01.2026, 09:30 UTC');
    expect(german).toContain('05.02.2026, 09:30 UTC');
    expect(german).toContain('12,35 s');
    expect(german).toContain('9,88 s');
    expect(german).toContain(germanPercent(66.7));
    expect(german).toContain(germanPercent(100));
    expect(germanPercent(66.7)).toContain('\u00a0');

    expect(german).not.toContain('2026-01-05 09:30 UTC');
    expect(german).not.toContain('12.35 s');
    expect(german).not.toContain('66.7%');
  });

  it('embeds only client messages as inert escaped JSON', () => {
    const blocks = [
      ...german.matchAll(
        /<script\b[^>]*\bid="tolkira-messages"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.[0]).toContain('type="application/json"');

    const raw = blocks[0]?.[1] ?? '';
    expect(raw).not.toMatch(/[<>&]/);
    expect(raw).not.toContain('</script');

    const map = JSON.parse(raw) as Record<string, string>;
    expect(Object.keys(map).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(map)) {
      expect(key, key).toMatch(/^client\./);
      expect(value.length, key).toBeGreaterThan(0);
    }
    expect(map).toEqual(
      JSON.parse(createTranslator('de').clientMessages()) as Record<
        string,
        string
      >,
    );
    expect(raw).not.toContain('scenarios visible');
  });

  it('keeps the Report view visible without JavaScript', () => {
    expect(openingTag(german, 'id="report-view"')).not.toContain('hidden');
    expect(openingTag(german, 'id="analysis-view"')).toContain('hidden');
    expect(openingTag(german, 'id="trends-view"')).toContain('hidden');
    expect(openingTag(german, 'id="report-view"')).toContain(
      'aria-labelledby="view-report"',
    );
  });

  it('keeps English chrome out of the German report', () => {
    for (const english of [
      'aria-label="Report views"',
      'placeholder="Search scenario, feature or tag"',
      'aria-label="Search scenarios"',
      '>Expand all</button>',
      '>Collapse all</button>',
      '>Failed only</button>',
      '>Run details<',
      'aria-label="Steps and hooks"',
      'aria-label="Full-size attachment"',
      'Generated by Tolkira. Single file.',
    ]) {
      expect(german, english).not.toContain(english);
    }
  });

  it('renders German test data verbatim under an English UI', async () => {
    const html = await renderFile(germanTestDataFixture);

    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('aria-label="Report views"');
    expect(html).toContain(
      'Kontoeröffnung &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;Zitat&quot;',
    );
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('Überweisung ohne Deckung');
    expect(html).toContain('Überweisung mit ausreichendem Guthaben');
    expect(html).toContain('>Angenommen</span>');
    expect(html).toContain('>Wenn</span>');
    expect(html).toContain('>Dann</span>');
    expect(html).toContain('>Und</span>');
    expect(html).toContain('das Konto hat 1.000,00 € Guthaben');
    expect(html).toContain('ich 250,00 € überweise');
    expect(html).toContain('<span class="tag">@konto</span>');
    expect(html).toContain(
      '<pre class="docString">„Nicht genügend Guthaben“</pre>',
    );
  });

  it('renders the same German test data verbatim under the German UI', async () => {
    const html = await renderFile(germanTestDataFixture, 'de');

    expect(html).toContain('>Bericht</button>');
    expect(html).toContain('>Bestanden</span>');
    expect(html).toContain('>Fehlgeschlagen</span>');
    expect(html).toContain('Überweisung ohne Deckung');
    expect(html).toContain('Angenommen');
    expect(html).toContain('das Konto hat 10,00 € Guthaben');
    expect(html).toContain('<span class="tag">@fehler</span>');
  });

  it('renders English test data verbatim under the German UI', async () => {
    const html = await renderFile(happyFixture, 'de');

    expect(html).toContain('>Bericht</button>');
    expect(html).toContain('Happy HTML reporting');
    expect(html).toContain(
      'Fred wants to see passing scenarios in the HTML report',
    );
  });

  it('renders the German empty state for a run without rows', async () => {
    const html = await renderFile(emptyReportFixture, 'de');
    expect(html).toContain('Keine Szenarien in diesem Bericht.');
  });

  it('keeps the default English shell and adds dir', async () => {
    const html = await renderFile(screenshotFixture);

    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('aria-label="Report views"');
    expect(html).toContain('>Report</button>');
    expect(html).toContain('>Passed</span>');
    expect(html).toContain('id="tolkira-messages"');
    expect(html).not.toContain('>Bericht</button>');
  });

  it('keeps the German report within 10 kB of the English report', async () => {
    const english = await renderFile(minimalFixture);
    const germanHtml = await renderFile(minimalFixture, 'de');

    expect(
      Buffer.byteLength(germanHtml, 'utf8') -
        Buffer.byteLength(english, 'utf8'),
    ).toBeLessThanOrEqual(10_000);
  });

  it('rejects an unsupported render locale', async () => {
    await expect(renderFile(screenshotFixture, 'fr')).rejects.toThrow(/\bde\b/);
  });
});
