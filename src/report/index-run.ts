import type {
  Attachment,
  Envelope,
  Examples,
  Feature,
  FeatureChild,
  Hook,
  Pickle,
  Rule,
  RuleChild,
  Scenario,
  Step,
  TestCase,
  TestCaseStarted,
  TestRunHookFinished,
  TestRunHookStarted,
  TestStepFinished,
} from '@cucumber/messages';

export interface RunFeatureDocument {
  feature: Feature;
  uri: string;
}

export interface RunScenarioNode {
  scenario: Scenario;
  rule?: Rule;
}

export interface RunOutlineExample {
  uri: string;
  scenario: Scenario;
  examples: Examples;
  examplesIndex: number;
  exampleIndex: number;
}

export interface RunSuggestion {
  language?: string;
  code: string;
}

export interface RunStepDefinition {
  pattern: string;
  uri: string;
  line?: number;
}

/**
 * Shared projection of the Cucumber Messages envelopes used by both the report
 * model and the machine-readable summary. Each consumer applies its own
 * presentation policy on top; the index only keeps facts both need.
 */
export interface RunIndex {
  /** Unique feature documents in first-appearance order. */
  featureDocuments: RunFeatureDocument[];
  /** First feature per `uri || name`; the report model's fallback. */
  featuresByKey: Map<string, Feature>;
  /** Last feature per URI; the summary's fallback. */
  featuresByUri: Map<string, Feature>;
  /** Last feature per AST scenario id. */
  featureByScenarioId: Map<string, Feature>;
  /** Last AST scenario node per id, with its rule. */
  scenarioTree: Map<string, RunScenarioNode>;
  /** Last examples row per AST id. */
  outlineRows: Map<string, RunOutlineExample>;
  /** Last AST step per id. */
  steps: Map<string, Step>;
  pickles: Map<string, Pickle>;
  testCases: Map<string, TestCase>;
  testCasesByPickle: Map<string, TestCase[]>;
  /** Latest started attempt per pickle id. */
  attempts: Map<string, TestCaseStarted>;
  results: Map<string, TestStepFinished[]>;
  hooks: Map<string, Hook>;
  runHookStarts: Map<string, TestRunHookStarted>;
  runHookFinishes: Map<string, TestRunHookFinished>;
  /** Attachments without a test-run hook owner, grouped by test case start id. */
  caseAttachments: Map<string, Attachment[]>;
  /** Attachments owned by a test-run hook start. */
  runHookAttachments: Map<string, Attachment[]>;
  /** Every attachment with a test case start id; the summary's view. */
  attachmentsByStarted: Map<string, Attachment[]>;
  /** Every attachment envelope in input order. */
  attachments: Attachment[];
  /** Attachments without a test case or run-hook owner. */
  runAttachments: Attachment[];
  suggestions: Map<string, RunSuggestion[]>;
  definitions: Map<string, RunStepDefinition>;
}

function latestAttempt(
  candidates: readonly TestCaseStarted[],
): TestCaseStarted | undefined {
  return candidates.reduce<TestCaseStarted | undefined>((current, candidate) => {
    if (!current) return candidate;
    if (candidate.attempt > current.attempt) return candidate;
    if (candidate.attempt < current.attempt) return current;
    const cSeconds = candidate.timestamp?.seconds ?? 0;
    const currentSeconds = current.timestamp?.seconds ?? 0;
    if (cSeconds !== currentSeconds) return cSeconds > currentSeconds ? candidate : current;
    const cNanos = candidate.timestamp?.nanos ?? 0;
    const currentNanos = current.timestamp?.nanos ?? 0;
    return cNanos > currentNanos ? candidate : current;
  }, undefined);
}

function indexFeature(
  index: RunIndex,
  feature: Feature,
  uri: string,
): void {
  const visit = (
    children: readonly (FeatureChild | RuleChild)[],
    rule?: Rule,
  ): void => {
    for (const child of children) {
      if (child.background) {
        for (const step of child.background.steps ?? []) {
          index.steps.set(step.id, step);
        }
      }
      if (child.scenario) {
        const scenario = child.scenario;
        index.scenarioTree.set(scenario.id, {
          scenario,
          ...(rule ? { rule } : {}),
        });
        index.featureByScenarioId.set(scenario.id, feature);
        for (const step of scenario.steps ?? []) {
          index.steps.set(step.id, step);
        }
        (scenario.examples ?? []).forEach((examples, examplesIndex) => {
          (examples.tableBody ?? []).forEach((row, exampleIndex) => {
            index.outlineRows.set(row.id, {
              uri,
              scenario,
              examples,
              examplesIndex,
              exampleIndex,
            });
          });
        });
      }
      if ('rule' in child && child.rule) {
        visit(child.rule.children ?? [], child.rule);
      }
    }
  };
  visit(feature.children ?? []);
}

/** Builds the shared envelope index in one pass over a run's messages. */
export function indexRun(envelopes: Envelope[]): RunIndex {
  const index: RunIndex = {
    featureDocuments: [],
    featuresByKey: new Map(),
    featuresByUri: new Map(),
    featureByScenarioId: new Map(),
    scenarioTree: new Map(),
    outlineRows: new Map(),
    steps: new Map(),
    pickles: new Map(),
    testCases: new Map(),
    testCasesByPickle: new Map(),
    attempts: new Map(),
    results: new Map(),
    hooks: new Map(),
    runHookStarts: new Map(),
    runHookFinishes: new Map(),
    caseAttachments: new Map(),
    runHookAttachments: new Map(),
    attachmentsByStarted: new Map(),
    attachments: [],
    runAttachments: [],
    suggestions: new Map(),
    definitions: new Map(),
  };
  const seenFeatures = new Set<Feature>();
  const startedByTestCase = new Map<string, TestCaseStarted[]>();

  for (const envelope of envelopes) {
    if (envelope.gherkinDocument?.feature) {
      const feature = envelope.gherkinDocument.feature;
      const uri = envelope.gherkinDocument.uri ?? '';
      if (!index.featuresByKey.has(envelope.gherkinDocument.uri ?? feature.name)) {
        index.featuresByKey.set(
          envelope.gherkinDocument.uri ?? feature.name,
          feature,
        );
      }
      index.featuresByUri.set(uri, feature);
      if (!seenFeatures.has(feature)) {
        seenFeatures.add(feature);
        index.featureDocuments.push({ feature, uri });
      }
      indexFeature(index, feature, uri);
    }
    if (envelope.pickle) index.pickles.set(envelope.pickle.id, envelope.pickle);
    if (envelope.testCase) {
      const testCase = envelope.testCase;
      index.testCases.set(testCase.id, testCase);
      const list = index.testCasesByPickle.get(testCase.pickleId) ?? [];
      list.push(testCase);
      index.testCasesByPickle.set(testCase.pickleId, list);
    }
    if (envelope.testCaseStarted) {
      const started = envelope.testCaseStarted;
      const list = startedByTestCase.get(started.testCaseId) ?? [];
      list.push(started);
      startedByTestCase.set(started.testCaseId, list);
    }
    if (envelope.hook) index.hooks.set(envelope.hook.id, envelope.hook);
    if (envelope.testRunHookStarted) {
      index.runHookStarts.set(
        envelope.testRunHookStarted.id,
        envelope.testRunHookStarted,
      );
    }
    if (envelope.testRunHookFinished) {
      index.runHookFinishes.set(
        envelope.testRunHookFinished.testRunHookStartedId,
        envelope.testRunHookFinished,
      );
    }
    if (envelope.testStepFinished) {
      const list =
        index.results.get(envelope.testStepFinished.testCaseStartedId) ?? [];
      list.push(envelope.testStepFinished);
      index.results.set(envelope.testStepFinished.testCaseStartedId, list);
    }
    if (envelope.attachment) {
      const attachment = envelope.attachment;
      const startedId = attachment.testCaseStartedId;
      const runHookId = attachment.testRunHookStartedId;
      index.attachments.push(attachment);
      if (startedId) {
        const list = index.attachmentsByStarted.get(startedId) ?? [];
        list.push(attachment);
        index.attachmentsByStarted.set(startedId, list);
      }
      if (runHookId) {
        const list = index.runHookAttachments.get(runHookId) ?? [];
        list.push(attachment);
        index.runHookAttachments.set(runHookId, list);
      } else {
        const id = startedId ?? '';
        const list = index.caseAttachments.get(id) ?? [];
        list.push(attachment);
        index.caseAttachments.set(id, list);
      }
    }
    if (envelope.suggestion) {
      const snippets = Array.isArray(envelope.suggestion.snippets)
        ? envelope.suggestion.snippets
        : [];
      const list = snippets
        .filter((snippet) => typeof snippet?.code === 'string')
        .map((snippet) => ({
          ...(typeof snippet.language === 'string' && snippet.language
            ? { language: snippet.language }
            : {}),
          code: snippet.code,
        }));
      if (list.length > 0) {
        index.suggestions.set(envelope.suggestion.pickleStepId, list);
      }
    }
    if (envelope.stepDefinition) {
      const pattern = envelope.stepDefinition.pattern;
      if (typeof pattern?.source === 'string') {
        const reference = envelope.stepDefinition.sourceReference;
        const uri = typeof reference?.uri === 'string' ? reference.uri : '';
        const line =
          typeof reference?.location?.line === 'number'
            ? reference.location.line
            : undefined;
        index.definitions.set(envelope.stepDefinition.id, {
          pattern: pattern.source,
          uri,
          ...(line !== undefined ? { line } : {}),
        });
      }
    }
  }

  for (const pickle of index.pickles.values()) {
    const candidates = (index.testCasesByPickle.get(pickle.id) ?? []).flatMap(
      (testCase) => startedByTestCase.get(testCase.id) ?? [],
    );
    const latest = latestAttempt(candidates);
    if (latest) index.attempts.set(pickle.id, latest);
  }
  index.runAttachments = index.caseAttachments.get('') ?? [];

  return index;
}
