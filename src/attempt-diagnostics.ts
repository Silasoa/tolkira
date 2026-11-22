// Non-protocol Playwright diagnostics keyed by a test-case-started envelope.
// A WeakMap keeps the count out of Messages, so hand-written NDJSON cannot
// fabricate a notice.
const skippedAttachments = new WeakMap<object, number>();

export function recordSkippedAttachments(started: object, count: number): void {
  skippedAttachments.set(started, count);
}

export function skippedAttachmentsOf(started: object): number | undefined {
  return skippedAttachments.get(started);
}
