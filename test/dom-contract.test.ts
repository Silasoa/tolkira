import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMessages } from '../src/input/messages.js';
import {
  DOM_IDS,
  decodeScenario,
  encodeScenario,
  featureId,
  scenarioId,
  scenarioVisible,
  type ScenarioFacts,
} from '../src/render/dom-contract.js';
import { renderHtml } from '../src/render/html.js';

const examplesFixture = fileURLToPath(
  new URL('./fixtures/messages/examples-tables.ndjson', import.meta.url),
);
const emptyMixedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-mixed.ndjson', import.meta.url),
);

const SCENARIO_DATA_NAMES = new Set([
  'data-scenario',
  'data-status',
  'data-uri',
  'data-scenario-name',
  'data-example',
  'data-examples-name',
  'data-tags',
  'data-search',
]);

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
};

function unescapeHtml(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|#39);/g,
    (_, entity: string) => HTML_ENTITIES[entity] ?? '',
  );
}

function attributesOf(openingTag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of openingTag.matchAll(
    /\s([a-z][\w-]*)(?:="([^"]*)")?/gi,
  )) {
    attributes.set(match[1] ?? '', unescapeHtml(match[2] ?? ''));
  }
  return attributes;
}

function sourceOf(attributes: Map<string, string>) {
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
  };
}

function attributesFromEntries(
  entries: ReadonlyArray<readonly [string, string]>,
): Map<string, string> {
  return new Map(entries);
}

function scenarioTagsOf(html: string): string[] {
  return [...html.matchAll(/<details class="scenario"[^>]*>/g)].map(
    (match) => match[0],
  );
}

function idsOf(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1] ?? '');
}

async function parsedFixture(path: string) {
  return parseMessages(await readFile(path, 'utf8'), path);
}

describe('scenario DOM contract', () => {
  it('round-trips every scenario fact without adding mark-up concerns', () => {
    const cases: ScenarioFacts[] = [
      {
        status: 'failed',
        name: 'Name with "quotes" & <tags>',
        uri: 'samples/a.feature',
        tags: ['@a', '@b'],
        example: '#1.2',
        examplesName: 'Examples <one>',
        search: 'Name with "quotes" & <tags> @a @b #1.2',
      },
      {
        status: 'passed',
        name: 'Passed scenario',
        uri: 'samples/b.feature',
        tags: [],
        search: 'Passed scenario samples/b.feature',
      },
      {
        name: 'Unexecuted scenario',
        uri: 'samples/c.feature',
        tags: ['@c'],
        search: 'Unexecuted scenario @c',
      },
    ];

    for (const facts of cases) {
      const encoded = encodeScenario(facts);
      const decoded = decodeScenario(
        sourceOf(attributesFromEntries(encoded)),
      );

      expect(decoded).toStrictEqual(facts);
      const names = encoded.map(([name]) => name);
      if (facts.status === undefined) {
        expect(names).not.toContain('data-status');
      } else {
        expect(encoded).toContainEqual(['data-status', facts.status]);
      }
      if (facts.example === undefined) {
        expect(names).not.toContain('data-example');
        expect(names).not.toContain('data-examples-name');
      } else {
        expect(encoded).toContainEqual(['data-example', facts.example]);
        expect(encoded).toContainEqual([
          'data-examples-name',
          facts.examplesName ?? '',
        ]);
      }
    }
  });

  it('decides visibility from facts, filters and tag expressions', () => {
    const facts: ScenarioFacts = {
      status: 'failed',
      name: 'Alpha',
      uri: 'samples/a.feature',
      tags: ['@a', '@b'],
      search: 'Alpha failure samples/a.feature',
    };
    const open = { query: '', tag: '', hidden: new Set<string>() };

    expect(scenarioVisible(facts, open)).toBe(true);
    expect(
      scenarioVisible(facts, { ...open, hidden: new Set(['failed']) }),
    ).toBe(false);
    expect(scenarioVisible(facts, { ...open, tag: '@a' })).toBe(true);
    expect(scenarioVisible(facts, { ...open, tag: '@ab' })).toBe(false);
    expect(
      scenarioVisible(facts, { ...open, expression: (tags) => tags.includes('@b') }),
    ).toBe(true);
    expect(
      scenarioVisible(facts, { ...open, expression: () => false }),
    ).toBe(false);
    expect(scenarioVisible(facts, { ...open, query: 'ALPHA' })).toBe(true);
    expect(scenarioVisible(facts, { ...open, query: 'missing' })).toBe(false);
    expect(
      scenarioVisible(facts, {
        ...open,
        query: 'outline',
        groupSearch: ' Outline name',
      }),
    ).toBe(true);
    expect(
      scenarioVisible(facts, {
        ...open,
        query: 'does not match',
        expression: () => true,
      }),
    ).toBe(true);
    expect(
      scenarioVisible(
        { ...facts, status: undefined },
        { ...open, hidden: new Set(['unknown']) },
      ),
    ).toBe(true);
  });

  it('uses one definition for generated feature and scenario ids', () => {
    expect(featureId(0)).toBe('feature-1');
    expect(featureId(11)).toBe('feature-12');
    expect(scenarioId(0, 0)).toBe('scenario-1-1');
    expect(scenarioId(2, 4)).toBe('scenario-3-5');
  });
});

describe('rendered scenario contract', () => {
  it('round-trips scenario facts and ids through real rendered HTML', async () => {
    const envelopes = [
      ...(await parsedFixture(examplesFixture)),
      ...(await parsedFixture(emptyMixedFixture)),
    ];
    const html = await renderHtml(envelopes, { title: 'DOM contract' });
    const tags = scenarioTagsOf(html);

    expect(tags.length).toBeGreaterThan(0);
    const ids = idsOf(html);
    expect(new Set(ids).size).toBe(ids.length);

    for (const openingTag of tags) {
      const attributes = attributesOf(openingTag);
      for (const name of attributes.keys()) {
        if (name.startsWith('data-')) {
          expect(SCENARIO_DATA_NAMES.has(name), name).toBe(true);
        }
      }

      const facts = decodeScenario(sourceOf(attributes));
      expect(facts.name.length).toBeGreaterThan(0);
      expect(facts.uri).toContain('.feature');
      expect(facts.search.length).toBeGreaterThan(0);
      expect(facts.tags).toEqual(
        (attributes.get('data-tags') ?? '').split(' ').filter(Boolean),
      );
      expect(attributes.get('data-uri')).toBe(facts.uri);
      expect(attributes.get('data-scenario-name')).toBe(facts.name);
      expect(attributes.get('data-search')).toBe(facts.search);
      if (attributes.has('data-example')) {
        expect(facts.example).toBe(attributes.get('data-example'));
        expect(facts.examplesName).toBe(
          attributes.get('data-examples-name') ?? '',
        );
      } else {
        expect(facts.example).toBeUndefined();
      }

      const roundTrip = decodeScenario(
        sourceOf(attributesFromEntries(encodeScenario(facts))),
      );
      expect(roundTrip).toStrictEqual(facts);

      const id = attributes.get('id') ?? '';
      expect(id).toMatch(/^scenario-\d+-\d+$/);
      expect(ids).toContain(id);
    }

    const triageLinks = [
      ...html.matchAll(/href="#((?:feature|scenario)-\d+(?:-\d+)?)"/g),
    ].map((match) => match[1] ?? '');
    expect(triageLinks.length).toBeGreaterThan(0);
    for (const target of triageLinks) {
      expect(ids, target).toContain(target);
    }

    for (const id of Object.values(DOM_IDS)) {
      expect(ids, id).toContain(id);
    }
  });

  it('keeps data-status for results and data-filter-status for controls', async () => {
    const html = await renderHtml(
      [
        ...(await parsedFixture(examplesFixture)),
        ...(await parsedFixture(emptyMixedFixture)),
      ],
      { title: 'Status attributes' },
    );
    const filters = [...html.matchAll(/<button class="filter"([^>]*)>/g)].map(
      (match) => attributesOf(match[1] ?? ''),
    );

    expect(filters.length).toBeGreaterThan(0);
    for (const attributes of filters) {
      expect(attributes.has('data-filter-status')).toBe(true);
      expect(attributes.has('data-status')).toBe(false);
    }

    const scenarios = scenarioTagsOf(html);
    expect(
      scenarios.filter((tag) => !/\sdata-status=/.test(tag)).length,
    ).toBeGreaterThan(0);
    expect(scenarios.some((tag) => /\sdata-status="/.test(tag))).toBe(true);
  });
});
