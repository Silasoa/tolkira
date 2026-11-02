import type {
  Background,
  Envelope,
  Examples,
  Feature,
  GherkinDocument,
  Rule,
  Scenario,
} from '@cucumber/messages';

const REMOTE_MARKDOWN_IMAGE =
  /!\[([^\]]*)\]\(\s*(?:https?:)?\/\/[^)\s]+(?:\s+["'][^"']*["'])?\s*\)/gi;
const RAW_IMAGE_TAG = /<img\b[^>]*>/gi;

function stripRemoteImages(value: string): string {
  return value
    .replace(REMOTE_MARKDOWN_IMAGE, '$1')
    .replace(RAW_IMAGE_TAG, '');
}

function sanitizeScenario(scenario: Scenario): void {
  scenario.description = stripRemoteImages(scenario.description);
  for (const examples of scenario.examples) {
    sanitizeExamples(examples);
  }
}

function sanitizeExamples(examples: Examples): void {
  examples.description = stripRemoteImages(examples.description);
}

function sanitizeBackground(background: Background): void {
  background.description = stripRemoteImages(background.description);
}

function sanitizeRule(rule: Rule): void {
  rule.description = stripRemoteImages(rule.description);
  for (const child of rule.children) {
    if (child.background) sanitizeBackground(child.background);
    if (child.scenario) sanitizeScenario(child.scenario);
  }
}

function sanitizeFeature(feature: Feature): void {
  feature.description = stripRemoteImages(feature.description);
  for (const child of feature.children) {
    if (child.background) sanitizeBackground(child.background);
    if (child.scenario) sanitizeScenario(child.scenario);
    if (child.rule) sanitizeRule(child.rule);
  }
}

function sanitizeDocument(document: GherkinDocument): void {
  if (document.feature) sanitizeFeature(document.feature);
}

/**
 * Enforces the offline/no-network promise for user-supplied messages.
 * Remote attachment URLs and external attachments are rejected; remote
 * Markdown images in descriptions are stripped.
 */
export function sanitizeEnvelopes(envelopes: Envelope[]): Envelope[] {
  for (const envelope of envelopes) {
    if (envelope.externalAttachment) {
      throw new Error(
        'External attachments are not supported. Inline the attachment for an offline report.',
      );
    }
    if (envelope.attachment?.url) {
      throw new Error(
        'Remote attachment URLs are not supported. Inline the attachment for an offline report.',
      );
    }
    if (envelope.gherkinDocument) {
      sanitizeDocument(envelope.gherkinDocument);
    }
  }

  return envelopes;
}
