import type { TestStepResult } from '@cucumber/messages';

/**
 * Some producers put the readable error in `exception.message` and only the
 * stack trace in `message` (cucumber-ruby); others put both in `message`.
 */
export function stepResultMessage(result: TestStepResult): string | undefined {
  const exception = result.exception?.message?.trim();
  const message = result.message?.trim();
  if (exception && message && !message.includes(exception)) {
    return `${exception}\n${message}`;
  }
  return message || exception || undefined;
}
