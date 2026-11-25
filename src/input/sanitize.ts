import type {
  Background,
  Envelope,
  Examples,
  Feature,
  GherkinDocument,
  Rule,
  Scenario,
} from '@cucumber/messages';

import {
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  attachmentBytes,
} from '../attachment.js';

const REMOTE_MARKDOWN_IMAGE =
  /!\[([^\]]*)\]\(\s*(?:https?:)?\/\/[^)\s]+(?:\s+["'][^"']*["'])?\s*\)/gi;
const REMOTE_ANGLE_IMAGE = /!\[([^\]]*)\]\(\s*<(?:https?:)?\/\/[^>]+>\s*\)/gi;
const RAW_IMAGE_TAG = /<img\b[^>]*>/gi;

// The Markdown renderer owns images and emits alt text only. Neutralise remote
// image destinations here so no image URL survives into the report. Reference
// definitions stay intact: the renderer never emits an image URL and
// reference-style links must keep working.
function stripRemoteImages(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  return value
    .replaceAll(REMOTE_ANGLE_IMAGE, '![$1]()')
    .replaceAll(REMOTE_MARKDOWN_IMAGE, '![$1]()')
    .replaceAll(RAW_IMAGE_TAG, '');
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
      const bytes = attachmentBytes(envelope.attachment);
      if (bytes > MAX_ATTACHMENT_BYTES) {
        throw new Error(
          'Attachment is larger than 50 MB. Use a smaller asset.',
        );
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
