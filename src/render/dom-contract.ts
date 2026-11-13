import type { ReportStatus } from '../report/status.js';

// Shared server/client DOM facts. CSS class hooks stay in report.css; this
// module owns scenario data attributes and the ids the client looks up.
export const SCENARIO_ATTRIBUTE = 'data-scenario';
export const STATUS_ATTRIBUTE = 'data-status';
export const FILTER_STATUS_ATTRIBUTE = 'data-filter-status';

export const DOM_IDS = {
  reportView: 'report-view',
  analysisView: 'analysis-view',
  live: 'tolkira-live',
  searchNote: 'tolkira-search-note',
  copyLive: 'tolkira-copy-live',
  emptyResults: 'empty-results',
  lightbox: 'tolkira-lightbox',
} as const;

export function featureId(index: number): string {
  return `feature-${index + 1}`;
}

export function scenarioId(featureIndex: number, scenarioIndex: number): string {
  return `scenario-${featureIndex + 1}-${scenarioIndex + 1}`;
}

export interface ScenarioFacts {
  /** Executed result; absent when the row has no result. */
  status?: ReportStatus;
  name: string;
  uri: string;
  tags: string[];
  example?: string;
  examplesName?: string;
  search: string;
}

export type ScenarioAttribute = readonly [name: string, value: string];

export function encodeScenario(facts: ScenarioFacts): ScenarioAttribute[] {
  const attributes: ScenarioAttribute[] = [];
  if (facts.status) attributes.push([STATUS_ATTRIBUTE, facts.status]);
  attributes.push(['data-uri', facts.uri], ['data-scenario-name', facts.name]);
  if (facts.example !== undefined) {
    attributes.push(
      ['data-example', facts.example],
      ['data-examples-name', facts.examplesName ?? ''],
    );
  }
  attributes.push(
    ['data-tags', facts.tags.join(' ')],
    ['data-search', facts.search],
  );
  return attributes;
}

export interface AttributeSource {
  getAttribute(name: string): string | null;
}

export function decodeScenario(source: AttributeSource): ScenarioFacts {
  const status = source.getAttribute(STATUS_ATTRIBUTE) ?? undefined;
  const example = source.getAttribute('data-example') ?? undefined;
  const tags = source.getAttribute('data-tags') ?? '';
  return {
    ...(status === undefined ? {} : { status: status as ReportStatus }),
    name: source.getAttribute('data-scenario-name') ?? '',
    uri: source.getAttribute('data-uri') ?? '',
    tags: tags ? tags.split(' ') : [],
    ...(example === undefined
      ? {}
      : {
          example,
          examplesName: source.getAttribute('data-examples-name') ?? '',
        }),
    search: source.getAttribute('data-search') ?? '',
  };
}

export interface ScenarioVisibility {
  query: string;
  tag: string;
  hidden: ReadonlySet<string>;
  expression?: (tags: string[]) => boolean;
  groupSearch?: string;
}

export function scenarioVisible(
  facts: ScenarioFacts,
  filter: ScenarioVisibility,
): boolean {
  if (facts.status && filter.hidden.has(facts.status)) return false;
  if (filter.tag && !facts.tags.includes(filter.tag)) return false;
  if (filter.expression && !filter.expression(facts.tags)) return false;
  const query = filter.query.toLowerCase();
  if (!query || filter.expression) return true;
  return (facts.search + (filter.groupSearch ?? ''))
    .toLowerCase()
    .includes(query);
}
