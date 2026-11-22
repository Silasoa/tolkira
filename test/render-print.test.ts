import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/catalogs.js';
import { CLIENT_SCRIPT } from '../src/render/client-bundle.js';
import { PRINT_SCRIPT } from '../src/render/print-script.js';
import { REPORT_CSS } from '../src/render/styles.js';

const PRINT_MEDIA = '@media print';

// Pinned by openspec/changes/add-print-view/design.md ("Chrome"): explicit
// selectors, never a blanket `button` rule, because screenshots are buttons.
const CHROME_SELECTORS = [
  '.topbar',
  '.toolbar',
  '.search',
  '.tagFilter',
  '.filters',
  '.filter',
  '.presetFilter',
  '.expand',
  '.copyFailure',
  '.copyLog',
  '.view',
  '.lightboxClose',
  '.chev',
  '.lightbox',
];

// Every colour custom property in the first light :root; the print block must
// repeat the whole palette, not a sample of it.
function paletteKeys(root: string): string[] {
  return [...root.matchAll(/(--[\w-]+)\s*:/g)]
    .map((match) => match[1] ?? '')
    .filter((key) => key && !key.startsWith('--font-'));
}

interface CssRule {
  selector: string;
  declarations: string;
}

function printBlock(): string {
  const start = REPORT_CSS.indexOf(PRINT_MEDIA);
  if (start < 0) throw new Error('REPORT_CSS has no @media print block');
  return REPORT_CSS.slice(start);
}

function rules(css: string): CssRule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1]?.trim() ?? '',
    declarations: match[2] ?? '',
  }));
}

function selectorParts(rule: CssRule): string[] {
  return rule.selector.split(',').map((part) => part.trim());
}

function hides(css: string, selector: string): boolean {
  return rules(css).some(
    (rule) =>
      /display\s*:\s*none/.test(rule.declarations) &&
      selectorParts(rule).some(
        (part) => part === selector || part.endsWith(` ${selector}`),
      ),
  );
}

function declaration(block: string, property: string): string | undefined {
  const match = new RegExp(`${property}\\s*:\\s*([^;]+);`).exec(block);
  return match?.[1]?.trim();
}

function lightRoot(): string {
  const match = /:root\s*\{([\s\S]*?)\}/.exec(REPORT_CSS);
  if (!match) throw new Error('REPORT_CSS has no light :root palette');
  return match[1] ?? '';
}

describe('print stylesheet', () => {
  it('ships a print media block after the dark-scheme palette', () => {
    const print = REPORT_CSS.indexOf(PRINT_MEDIA);
    const dark = REPORT_CSS.indexOf('@media (prefers-color-scheme: dark)');

    expect(dark, 'dark-scheme block').toBeGreaterThan(-1);
    expect(print, 'print block').toBeGreaterThan(-1);
    expect(print, 'print block after dark rules').toBeGreaterThan(dark);
  });

  it('hides the interactive chrome by explicit selector', () => {
    const block = printBlock();

    for (const selector of CHROME_SELECTORS) {
      expect(hides(block, selector), `${selector} hidden in print`).toBe(true);
    }
    expect(hides(block, 'video'), 'video hidden in print').toBe(true);
    expect(hides(block, 'audio'), 'audio hidden in print').toBe(true);
  });

  it('does not hide every button and keeps screenshots printable', () => {
    const block = printBlock();
    const hideRules = rules(block).filter((rule) =>
      /display\s*:\s*none/.test(rule.declarations),
    );

    const genericButton = hideRules.some((rule) =>
      selectorParts(rule).some((part) => /^button(?![\w-])/.test(part)),
    );
    expect(genericButton, 'no blanket button hide').toBe(false);

    for (const keeper of ['.shotButton', '.shot']) {
      const hidden = hideRules.some((rule) =>
        selectorParts(rule).some((part) =>
          new RegExp(
            `${keeper.replace('.', '\\.')}(?![\\w-])`,
          ).test(part),
        ),
      );
      expect(hidden, `${keeper} stays visible`).toBe(false);
    }
  });

  it('repeats the complete light palette in print', () => {
    const block = printBlock();
    const root = lightRoot();
    const keys = paletteKeys(root);

    expect(keys, 'light palette properties').toHaveLength(45);
    for (const key of keys) {
      const light = declaration(root, key);
      expect(light, `${key} light value`).toBeTruthy();
      expect(declaration(block, key), `${key} repeated in print`).toBe(light);
    }
  });

  it('keeps colours exact with prefixed and unprefixed print-color-adjust', () => {
    const block = printBlock();

    expect(block).toMatch(/(?:^|[^\w-])print-color-adjust\s*:\s*exact/);
    expect(block).toMatch(/-webkit-print-color-adjust\s*:\s*exact/);
  });

  it('turns the visible-count filter marker into a printable block', () => {
    const block = printBlock();
    const marker = rules(block).find((rule) =>
      selectorParts(rule).some((part) => part.includes('#tolkira-live')),
    );

    expect(marker, '#tolkira-live print rule').toBeDefined();
    expect(marker?.declarations).toMatch(/position\s*:\s*static/);
  });

  it('starts the Details and Trends panels on a new printed page', () => {
    const block = printBlock();

    for (const id of ['#analysis-view', '#trends-view']) {
      const rule = rules(block).find(
        (entry) =>
          selectorParts(entry).some((part) => part.includes(id)) &&
          /break-before\s*:\s*page/.test(entry.declarations),
      );
      expect(rule, `${id} break-before: page`).toBeDefined();
    }
    expect(block).toMatch(/@page\s*\{[^}]*margin\s*:\s*12mm/);
  });

  it('fits the matrix and Trends tables to the printed page', () => {
    const block = printBlock();

    // Both tables use fixed layout; the Trends table splits its columns
    // explicitly so the title keeps room and the numeric cells stay whole.
    const layouts: Record<string, RegExp> = {
      '.featureTable': /table-layout\s*:\s*fixed/,
      '.trendsTable': /table-layout\s*:\s*fixed/,
    };

    for (const table of ['.featureTable', '.trendsTable']) {
      const tableRules = rules(block).filter((rule) =>
        selectorParts(rule).some((part) => part.includes(table)),
      );
      const declarations = tableRules
        .map((rule) => rule.declarations)
        .join(';');

      expect(declarations, `${table} min-width`).toMatch(
        /min-width\s*:\s*0/,
      );
      expect(declarations, `${table} width`).toMatch(/width\s*:\s*100%/);
      expect(declarations, `${table} table-layout`).toMatch(
        layouts[table] as RegExp,
      );
      expect(declarations, `${table} print type`).toMatch(
        /font-size\s*:\s*8pt/,
      );

      const child = tableRules.find(
        (rule) =>
          selectorParts(rule).some(
            (part) =>
              part.includes(table) &&
              /(?:^|[\s>])(?:th|td)(?![\w-])/.test(part),
          ) &&
          /(min-width\s*:\s*0|width\s*:\s*auto)/.test(rule.declarations),
      );
      expect(child, `${table} child widths reset`).toBeDefined();
    }

    const trendsDeclarations = rules(block)
      .filter((rule) =>
        selectorParts(rule).some((part) => part.includes('.trendsTable')),
      )
      .map((rule) => rule.declarations)
      .join(';');
    for (const width of ['13%', '20%', '14%', '6.625%']) {
      expect(trendsDeclarations, `Trends ${width} column`).toContain(
        `width: ${width}`,
      );
    }
    expect(trendsDeclarations, 'Trends print type').toContain('font-size: 7pt');
    expect(
      rules(block).some(
        (rule) =>
          selectorParts(rule).includes('.trendsTable td.num') &&
          /white-space\s*:\s*nowrap/.test(rule.declarations),
      ),
      'Trends numeric nowrap',
    ).toBe(true);
    expect(
      rules(block).some(
        (rule) =>
          selectorParts(rule).includes('.trendsTable th') &&
          /white-space\s*:\s*nowrap/.test(rule.declarations),
      ),
      'Trends headers may wrap',
    ).toBe(false);
  });

  it('fits every other wrapped table, including step data tables', () => {
    const block = printBlock();
    const tableRule = rules(block).find((rule) =>
      selectorParts(rule).includes('.tableWrap table'),
    );

    expect(tableRule, '.tableWrap table print rule').toBeDefined();
    expect(tableRule?.declarations).toMatch(/width\s*:\s*100%/);
    expect(tableRule?.declarations).toMatch(/min-width\s*:\s*0/);
    expect(tableRule?.declarations).toMatch(/table-layout\s*:\s*fixed/);
    expect(tableRule?.declarations).toMatch(/font-size\s*:\s*8pt/);

    const childRule = rules(block).find((rule) =>
      selectorParts(rule).some((part) =>
        /^\.tableWrap table (?:th|td)$/.test(part),
      ),
    );
    expect(childRule, '.tableWrap table child reset').toBeDefined();
    expect(childRule?.declarations).toMatch(/min-width\s*:\s*0/);
    expect(childRule?.declarations).toMatch(/overflow-wrap\s*:\s*anywhere/);
  });

  it('reveals the printed panels only in print media', () => {
    const block = printBlock();
    const screen = REPORT_CSS.slice(0, REPORT_CSS.indexOf(PRINT_MEDIA));

    expect(block).toContain('.printing .tabPanel');
    expect(screen, 'screen styles carry no printing hook').not.toContain(
      'printing',
    );
  });
});

describe('print script', () => {
  it('keeps the print lifecycle out of the interactive client bundle', () => {
    expect(CLIENT_SCRIPT.length).toBeLessThan(16_000);
    expect(CLIENT_SCRIPT).not.toMatch(
      /addEventListener\(["'](?:beforeprint|afterprint)["']/,
    );
    expect(CLIENT_SCRIPT).not.toMatch(
      /classList\.(?:add|remove)\(["']printing["']\)/,
    );
  });

  it('opens the report for print and restores the previous state', () => {
    expect(PRINT_SCRIPT).toContain('beforeprint');
    expect(PRINT_SCRIPT).toContain('afterprint');
    expect(PRINT_SCRIPT).toContain('printing');
    expect(PRINT_SCRIPT).toContain('.lightbox');
    expect(PRINT_SCRIPT).toMatch(/img\[loading=(?:"lazy"|lazy)\]/);
    expect(PRINT_SCRIPT).toContain('eager');
    expect(PRINT_SCRIPT).toContain('documentElement.style.overflow');
    expect(PRINT_SCRIPT).toContain('close?.()');
  });

  it('adds no catalog key for the print view', () => {
    const keys = Object.keys(en);

    expect(keys.filter((key) => /print/i.test(key))).toEqual([]);
    expect(keys.filter((key) => key.startsWith('client.'))).toHaveLength(19);
  });
});
