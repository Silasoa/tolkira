// Non-protocol Playwright diagnostics keyed by a test-case-started envelope.
// A WeakMap keeps the skip count out of Messages, so hand-written NDJSON cannot
// fabricate a notice.
export type AttachmentSkipReason =
  | 'outside'
  | 'missing'
  | 'unreadable'
  | 'not-regular'
  | 'non-local';

export interface SkippedAttachment {
  name: string;
  reason: AttachmentSkipReason;
}

interface SkippedAttachmentRecord {
  count: number;
  entries: SkippedAttachment[];
}

const skippedAttachments = new WeakMap<object, SkippedAttachmentRecord>();

// Marks one Playwright earlier-attempt image. A WeakSet keeps the mark out of
// Messages, so hand-written NDJSON cannot embed an earlier image.
const retryEvidence = new WeakSet<object>();

export function markRetryEvidence(value: object): void {
  retryEvidence.add(value);
}

export function isRetryEvidence(value: object): boolean {
  return retryEvidence.has(value);
}

export function recordSkippedAttachments(
  started: object,
  count: number,
  entries: SkippedAttachment[] = [],
): void {
  skippedAttachments.set(started, { count, entries });
}

export function skippedAttachmentsOf(started: object): number | undefined {
  return skippedAttachments.get(started)?.count;
}

export function skippedAttachmentEntriesOf(
  started: object,
): SkippedAttachment[] {
  const record = skippedAttachments.get(started);
  return record ? record.entries.map((entry) => ({ ...entry })) : [];
}
