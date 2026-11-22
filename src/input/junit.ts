import type { Envelope } from '@cucumber/messages';
import { parseLegacyValue } from './legacy.js';

type XmlNode = Record<string, unknown>;

const ARRAY_TAGS = new Set([
  'testsuite',
  'testcase',
  'failure',
  'error',
  'skipped',
  'system-out',
  'system-err',
]);

function isObject(value: unknown): value is XmlNode {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function stringOf(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map(textOf).filter(Boolean).join('\n');
  }
  if (isObject(value)) {
    if (typeof value['#text'] === 'string') return value['#text'];
    if (typeof value.text === 'string') return value.text;
  }
  return '';
}

function secondsToNanoseconds(value: unknown): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.round(seconds * 1_000_000_000)
    : 0;
}

function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function checkEntityReferences(fragment: string, source: string): void {
  const entityPattern = /&([^;]{1,32});/g;
  let match: RegExpExecArray | null;

  while ((match = entityPattern.exec(fragment)) !== null) {
    const entity = match[1];
    if (
      entity === 'amp' ||
      entity === 'lt' ||
      entity === 'gt' ||
      entity === 'quot' ||
      entity === 'apos'
    ) {
      continue;
    }

    let code: number | undefined;
    if (/^#\d+$/.test(entity)) {
      code = Number.parseInt(entity.slice(1), 10);
    } else if (/^#x[0-9a-fA-F]+$/.test(entity)) {
      code = Number.parseInt(entity.slice(2), 16);
    }

    if (code === undefined || !Number.isFinite(code) || !isXmlChar(code)) {
      throw new Error(
        `Invalid JUnit XML in ${source}: invalid entity reference &${entity};`,
      );
    }
  }
}

// Validates entity references and rejects DTD declarations. Comments, CDATA
// sections and processing instructions are data, so declaration-looking text
// inside them must not trip the rejection.
function assertSafeMarkup(content: string, source: string): void {
  const scanTag = (start: number): number => {
    let index = start + 1;
    let quote = '';
    let valueStart = 0;

    while (index < content.length) {
      const char = content[index];
      if (quote) {
        if (char === quote) {
          checkEntityReferences(content.slice(valueStart, index), source);
          quote = '';
        }
      } else if (char === '"' || char === "'") {
        quote = char;
        valueStart = index + 1;
      } else if (char === '>') {
        return index + 1;
      }
      index += 1;
    }

    return index;
  };

  let index = 0;
  while (index < content.length) {
    const start = content.indexOf('<', index);
    if (start === -1) {
      checkEntityReferences(content.slice(index), source);
      return;
    }
    if (start > index) {
      checkEntityReferences(content.slice(index, start), source);
    }

    if (content.startsWith('<!--', start)) {
      const end = content.indexOf('-->', start + 4);
      index = end === -1 ? content.length : end + 3;
    } else if (content.startsWith('<![CDATA[', start)) {
      const end = content.indexOf(']]>', start + 9);
      index = end === -1 ? content.length : end + 3;
    } else if (content.startsWith('<?', start)) {
      const end = content.indexOf('?>', start + 2);
      index = end === -1 ? content.length : end + 2;
    } else if (content.startsWith('<!', start)) {
      const declaration = /^<!(DOCTYPE|ENTITY)\b/i.exec(
        content.slice(start, start + 10),
      );
      if (declaration) {
        throw new Error(
          `Invalid JUnit XML in ${source}: <!${declaration[1]!.toUpperCase()}> declarations are not supported.`,
        );
      }
      const end = content.indexOf('>', start + 2);
      index = end === -1 ? content.length : end + 1;
    } else {
      index = scanTag(start);
    }
  }
}

function collectSuites(parsed: unknown): XmlNode[] {
  if (!isObject(parsed)) return [];
  const suites: XmlNode[] = [];

  const add = (value: unknown): void => {
    for (const suite of asArray(value)) {
      if (!isObject(suite)) continue;
      suites.push(suite);
      if (suite.testsuite !== undefined) add(suite.testsuite);
    }
  };

  const root = parsed;
  if (isObject(root.testsuites)) {
    add(root.testsuites.testsuite);
    if (root.testsuites.testsuite === undefined && root.testsuites.testcase !== undefined) {
      suites.push({
        name: root.testsuites.name,
        testcase: root.testsuites.testcase,
      });
    }
  } else if (root.testsuite !== undefined) {
    add(root.testsuite);
  } else if (root.testcase !== undefined) {
    suites.push({ name: 'JUnit XML', testcase: root.testcase });
  }

  return suites;
}

function failureMessage(failure: XmlNode): string {
  const attribute = stringOf(failure.message);
  const text = textOf(failure);
  if (attribute && text && !text.startsWith(attribute)) {
    return `${attribute}\n${text}`;
  }
  return text || attribute;
}

function elementFromTestcase(testcase: XmlNode, index: number): XmlNode {
  const failures = [
    ...asArray(testcase.failure),
    ...asArray(testcase.error),
  ];
  const failure = failures[0];
  const hasFailure = failure !== undefined;
  const skipped = asArray(testcase.skipped).length > 0;
  const status = hasFailure ? 'failed' : skipped ? 'skipped' : 'passed';
  const name =
    stringOf(testcase.name) || stringOf(testcase.classname) || `Test ${index + 1}`;
  const description = stringOf(testcase.description);

  const result: XmlNode = {
    status,
    duration: secondsToNanoseconds(testcase.time),
  };
  if (hasFailure) {
    const message = isObject(failure)
      ? failureMessage(failure)
      : textOf(failure).trim();
    if (message) result.error_message = message;
  }

  const embeddings: XmlNode[] = [];
  for (const key of ['system-out', 'system-err']) {
    const text = textOf(testcase[key]);
    if (!text) continue;
    embeddings.push({
      data: Buffer.from(text, 'utf8').toString('base64'),
      mime_type: 'text/plain',
    });
  }

  const step: XmlNode = {
    keyword: 'Test ',
    name,
    line: 1,
    result,
  };
  if (embeddings.length > 0) step.embeddings = embeddings;

  return {
    type: 'scenario',
    keyword: 'Scenario',
    name,
    description,
    // JUnit has no source line. The AST keeps the placeholder; the legacy
    // pickle mapping reads the missing line as unknown (0).
    tags: [],
    steps: [step],
  };
}

interface TestcaseEntry {
  testcase: XmlNode;
  index: number;
}

function featureFor(
  suite: XmlNode,
  source: string,
  name: string,
  entries: TestcaseEntry[],
): XmlNode {
  return {
    keyword: 'Feature',
    name,
    description: stringOf(suite.description),
    uri: source,
    line: 1,
    tags: [],
    elements: entries.map(({ testcase, index }) =>
      elementFromTestcase(testcase, index),
    ),
  };
}

function isNestedClassShape(classnames: string[]): boolean {
  if (classnames.length < 2) return false;
  if (classnames.some((classname) => classname.includes('$'))) return true;
  return classnames.some((outer) =>
    classnames.some(
      (inner) => inner !== outer && inner.startsWith(`${outer}.`),
    ),
  );
}

function featuresFromSuite(
  suite: XmlNode,
  source: string,
  index: number,
): XmlNode[] {
  const name =
    stringOf(suite.name) || stringOf(suite.classname) || `JUnit suite ${index + 1}`;
  const entries: TestcaseEntry[] = asArray(suite.testcase)
    .filter(isObject)
    .map((testcase, testcaseIndex) => ({ testcase, index: testcaseIndex }));
  const byClass = new Map<string, TestcaseEntry[]>();

  for (const entry of entries) {
    const classname = stringOf(entry.testcase.classname);
    if (!classname) continue;
    const group = byClass.get(classname) ?? [];
    group.push(entry);
    byClass.set(classname, group);
  }

  if (!isNestedClassShape([...byClass.keys()])) {
    return [featureFor(suite, source, name, entries)];
  }

  const features = [...byClass.entries()].map(([classname, group]) =>
    featureFor(suite, source, classname, group),
  );
  const unclassed = entries.filter(
    ({ testcase }) => !stringOf(testcase.classname),
  );
  if (unclassed.length > 0) {
    features.push(featureFor(suite, source, name, unclassed));
  }
  return features;
}

export function looksLikeJUnit(content: string): boolean {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();
  return trimmed.startsWith('<') && /<testsuites?\b/i.test(trimmed);
}

export async function parseJUnitXml(
  content: string,
  source: string,
  options: { idPrefix?: string } = {},
): Promise<Envelope[]> {
  const { XMLParser, XMLValidator } = await import('fast-xml-parser');

  assertSafeMarkup(content, source);

  // fast-xml-parser's parser is lenient about mismatched closing tags and would
  // silently reshape broken XML; validate first so bad input fails clearly.
  const validation = XMLValidator.validate(content);
  if (validation !== true) {
    const line = Number.isFinite(validation.err.line)
      ? validation.err.line
      : 1;
    const column = Number.isFinite(validation.err.col)
      ? validation.err.col
      : 1;
    throw new Error(
      `Invalid JUnit XML in ${source} at line ${line}, column ${column}: ${validation.err.msg}`,
    );
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    htmlEntities: true,
    isArray: (name: string) => ARRAY_TAGS.has(name),
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JUnit XML in ${source}: ${detail}`);
  }

  const suites = collectSuites(parsed).filter(
    (suite) => asArray(suite.testcase).length > 0,
  );
  if (suites.length === 0) {
    throw new Error(
      `Unsupported JUnit XML in ${source}: expected <testsuites> or <testsuite> with <testcase>.`,
    );
  }

  const legacy = suites.flatMap((suite, index) =>
    featuresFromSuite(suite, source, index),
  );
  const envelopes = parseLegacyValue(legacy, source, {
    idPrefix: options.idPrefix ?? 'junit',
  });
  for (const envelope of envelopes) {
    if (envelope.meta) {
      envelope.meta.implementation = { name: 'JUnit XML', version: '' };
    }
  }
  return envelopes;
}
