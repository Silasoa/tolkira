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
const REMOTE_ANGLE_IMAGE =
  /!\[([^\]]*)\]\(\s*<(?:https?:)?\/\/[^>]+>\s*\)/gi;
const REMOTE_REFERENCE_DEFINITION =
  /^(\s*\[[^\]]+\]:)\s*(?:https?:)?\/\/\S+.*$/gim;
const RAW_IMAGE_TAG = /<img\b[^>]*>/gi;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;

// The Markdown renderer owns images and emits alt text only. Neutralise remote
// destinations here so no image URL survives into the report.
function stripRemoteImages(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(REMOTE_ANGLE_IMAGE, '![$1]()')
    .replace(REMOTE_MARKDOWN_IMAGE, '![$1]()')
    .replace(REMOTE_REFERENCE_DEFINITION, '$1 <>')
    .replace(RAW_IMAGE_TAG, '');
}

function base64Bytes(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function sanitizeScenario(scenario: Scenario): void {
  scenario.description = stripRemoteImages(scenario.description);
  for (const examples of scenario.examples ?? []) {
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
  for (const child of rule.children ?? []) {
    if (child.background) sanitizeBackground(child.background);
    if (child.scenario) sanitizeScenario(child.scenario);
  }
}

function sanitizeFeature(feature: Feature): void {
  feature.description = stripRemoteImages(feature.description);
  for (const child of feature.children ?? []) {
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
  let totalAttachmentBytes = 0;

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
    if (envelope.attachment) {
      const body = envelope.attachment.body ?? '';
      const bytes =
        envelope.attachment.contentEncoding === 'BASE64'
          ? base64Bytes(body)
          : Buffer.byteLength(body, 'utf8');
      if (bytes > MAX_ATTACHMENT_BYTES) {
        throw new Error('Attachment is larger than 50 MB. Use a smaller asset.');
      }
      totalAttachmentBytes += bytes;
      if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        throw new Error(
          'Attachments exceed 100 MB in total. Split the report or use smaller assets.',
        );
      }
    }
    if (envelope.gherkinDocument) {
      sanitizeDocument(envelope.gherkinDocument);
    }
  }

  return envelopes;
}
