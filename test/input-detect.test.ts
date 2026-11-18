import { describe, expect, it } from 'vitest';
import { detectInput } from '../src/input/detect.js';
import type { InputDecision } from '../src/input/detect.js';

const LEGACY = '[{"uri":"features/a.feature","name":"A","elements":[]}]';
const JUNIT =
  '<?xml version="1.0"?><testsuites><testsuite name="suite"><testcase name="case"/></testsuite></testsuites>';
const MESSAGES =
  '{"meta":{"protocolVersion":"1","implementation":{},"runtime":{},"os":{},"cpu":{}}}';
const PLAYWRIGHT =
  '{"config":{"version":"1.65.0"},"suites":[],"stats":{"expected":0}}';

interface Case {
  case: string;
  content: string;
  file: string;
  explicit: boolean;
  kind: InputDecision['kind'];
}

describe('input detection decision table', () => {
  describe('content sniffing', () => {
    const cases: Case[] = [
      {
        case: 'parses a JSON array of features as legacy',
        content: LEGACY,
        file: 'report.json',
        explicit: true,
        kind: 'legacy',
      },
      {
        case: 'accepts legacy JSON with a BOM and leading whitespace',
        content: `\uFEFF  \n${LEGACY}`,
        file: 'report.json',
        explicit: true,
        kind: 'legacy',
      },
      {
        case: 'treats a feature-shaped object as legacy',
        content: '[{"keyword":"Feature","name":"A"}]',
        file: 'report.json',
        explicit: true,
        kind: 'legacy',
      },
      {
        case: 'treats an empty JSON array as legacy',
        content: '[]',
        file: 'report.json',
        explicit: true,
        kind: 'legacy',
      },
      {
        case: 'routes malformed legacy JSON to legacy validation',
        content: '[{"name":"Broken","elements":[',
        file: 'report.json',
        explicit: true,
        kind: 'legacy-validation',
      },
      {
        case: 'selects JUnit for testsuites XML',
        content: '<testsuites><testsuite name="suite"><testcase name="case"/></testsuite></testsuites>',
        file: 'report.xml',
        explicit: true,
        kind: 'junit',
      },
      {
        case: 'selects JUnit for a testsuite with an XML declaration',
        content: JUNIT,
        file: 'report.xml',
        explicit: true,
        kind: 'junit',
      },
      {
        case: 'selects Messages for the first envelope',
        content: MESSAGES,
        file: 'report.ndjson',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'accepts Messages with a BOM',
        content: `\uFEFF${MESSAGES}`,
        file: 'report.ndjson',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'accepts Messages after blank lines',
        content: `\n\n  ${MESSAGES}\n`,
        file: 'report.ndjson',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'finds an envelope on the twentieth line',
        content: `${'\n'.repeat(19)}${MESSAGES}`,
        file: 'report.ndjson',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'does not sniff an envelope beyond the first twenty lines',
        content: `${'\n'.repeat(20)}${MESSAGES}`,
        file: 'report.ndjson',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'does not treat a JSON array of non-features as legacy',
        content: '[1,2,3]',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'does not treat arbitrary XML as JUnit',
        content: '<root><child/></root>',
        file: 'report.xml',
        explicit: false,
        kind: 'skip',
      },
      {
        case: 'selects Playwright for a Playwright JSON report',
        content: PLAYWRIGHT,
        file: 'report.json',
        explicit: true,
        kind: 'playwright',
      },
      {
        case: 'accepts Playwright JSON with a BOM and leading whitespace',
        content: `\uFEFF  \n${PLAYWRIGHT}`,
        file: 'report.json',
        explicit: true,
        kind: 'playwright',
      },
      {
        case: 'selects Playwright for run-level errors without suites',
        content:
          '{"config":{},"errors":[{"message":"no tests"}],"stats":{"expected":0}}',
        file: 'report.json',
        explicit: true,
        kind: 'playwright',
      },
      {
        case: 'routes a non-array suites value to Playwright validation',
        content:
          '{"config":{},"suites":{},"stats":{"expected":0},"errors":[]}',
        file: 'report.json',
        explicit: true,
        kind: 'playwright',
      },
      {
        case: 'rejects a suites-only object without stats as generic JSON',
        content: '{"suites":[]}',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects Playwright-like JSON without stats as generic JSON',
        content: '{"config":{},"suites":[]}',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects Playwright-like JSON with a non-object config',
        content: '{"config":[],"suites":[],"stats":{}}',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects malformed Playwright JSON',
        content: '{"config":{',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'does not treat a multi-key JSON object as Messages',
        content: '{"meta":{},"source":{}}',
        file: 'report.json',
        explicit: false,
        kind: 'skip',
      },
    ];

    it.each(cases)('$case', ({ content, file, explicit, kind }) => {
      expect(detectInput(content, { file, explicit }).kind).toBe(kind);
    });
  });

  describe('identity fallback', () => {
    const cases: Case[] = [
      {
        case: 'validates an explicit XML file that is not JUnit',
        content: '<root><child/></root>',
        file: 'report.xml',
        explicit: true,
        kind: 'junit-validation',
      },
      {
        case: 'matches the XML extension case-insensitively',
        content: '<root/>',
        file: 'REPORT.XML',
        explicit: true,
        kind: 'junit-validation',
      },
      {
        case: 'validates an empty explicit XML file',
        content: '',
        file: 'report.xml',
        explicit: true,
        kind: 'junit-validation',
      },
      {
        case: 'validates an empty explicit Messages file',
        content: '',
        file: 'report.ndjson',
        explicit: true,
        kind: 'messages-validation',
      },
      {
        case: 'treats whitespace-only explicit Messages as empty',
        content: '\n\t ',
        file: 'REPORT.NDJSON',
        explicit: true,
        kind: 'messages-validation',
      },
      {
        case: 'validates an empty explicit JSONL file',
        content: '',
        file: 'report.jsonl',
        explicit: true,
        kind: 'messages-validation',
      },
      {
        case: 'rejects an explicit Messages extension with non-envelope JSON',
        content: '{"a":1}',
        file: 'report.ndjson',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects an explicit JSON object that is not a report',
        content: '{"name":"not-a-report"}',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects malformed explicit JSON',
        content: '{"name":',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects an empty explicit JSON file',
        content: '',
        file: 'report.json',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'rejects an explicit unknown extension',
        content: 'plain text',
        file: 'report.txt',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'validates directory-discovered Messages with non-envelope JSON',
        content: '{"a":1}',
        file: 'report.ndjson',
        explicit: false,
        kind: 'messages-validation',
      },
      {
        case: 'validates an empty directory-discovered JSONL file',
        content: '',
        file: 'report.jsonl',
        explicit: false,
        kind: 'messages-validation',
      },
      {
        case: 'skips directory-discovered unrelated JSON',
        content: '{"name":"not-a-report"}',
        file: 'package.json',
        explicit: false,
        kind: 'skip',
      },
      {
        case: 'skips directory-discovered non-JUnit XML',
        content: '<root/>',
        file: 'report.xml',
        explicit: false,
        kind: 'skip',
      },
      {
        case: 'skips directory-discovered unknown extensions',
        content: 'plain text',
        file: 'report.txt',
        explicit: false,
        kind: 'skip',
      },
    ];

    it.each(cases)('$case', ({ content, file, explicit, kind }) => {
      expect(detectInput(content, { file, explicit }).kind).toBe(kind);
    });
  });

  describe('precedence', () => {
    const cases: Case[] = [
      {
        case: 'legacy content wins over a Messages extension',
        content: LEGACY,
        file: 'report.ndjson',
        explicit: true,
        kind: 'legacy',
      },
      {
        case: 'legacy content wins over an XML extension',
        content: LEGACY,
        file: 'report.xml',
        explicit: true,
        kind: 'legacy',
      },
      {
        case: 'malformed legacy content wins over an XML extension',
        content: '[{"name":"Broken","elements":[',
        file: 'report.xml',
        explicit: true,
        kind: 'legacy-validation',
      },
      {
        case: 'JUnit content wins over a Messages extension',
        content:
          '<testsuite name="suite"><testcase name="case"/></testsuite>',
        file: 'report.ndjson',
        explicit: true,
        kind: 'junit',
      },
      {
        case: 'JUnit content wins over a JSON extension',
        content:
          '<testsuite name="suite"><testcase name="case"/></testsuite>',
        file: 'report.json',
        explicit: true,
        kind: 'junit',
      },
      {
        case: 'Messages content wins over an XML extension',
        content: MESSAGES,
        file: 'report.xml',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'Messages content wins over a JSON extension',
        content: MESSAGES,
        file: 'report.json',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'Messages content wins over an unknown extension',
        content: MESSAGES,
        file: 'report.txt',
        explicit: true,
        kind: 'messages',
      },
      {
        case: 'non-feature JSON arrays do not win over a Messages extension',
        content: '[1,2,3]',
        file: 'report.ndjson',
        explicit: true,
        kind: 'json-validation',
      },
      {
        case: 'Playwright content wins over a Messages extension',
        content: PLAYWRIGHT,
        file: 'report.ndjson',
        explicit: true,
        kind: 'playwright',
      },
      {
        case: 'Playwright content wins over an XML extension',
        content: PLAYWRIGHT,
        file: 'report.xml',
        explicit: true,
        kind: 'playwright',
      },
      {
        case: 'legacy content wins over a Playwright-looking object',
        content:
          '[{"name":"A","elements":[],"config":{},"stats":{},"suites":[]}]',
        file: 'report.json',
        explicit: true,
        kind: 'legacy',
      },
    ];

    it.each(cases)('$case', ({ content, file, explicit, kind }) => {
      expect(detectInput(content, { file, explicit }).kind).toBe(kind);
    });
  });

  it('returns the parsed legacy payload for the legacy adapter', () => {
    expect(detectInput(LEGACY, { file: 'report.json', explicit: true })).toEqual({
      kind: 'legacy',
      parsed: JSON.parse(LEGACY),
    });
  });
});
