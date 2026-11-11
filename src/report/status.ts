import { TestStepResultStatus } from '@cucumber/messages';

export type ReportStatus =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'undefined'
  | 'ambiguous'
  | 'unknown';

const STATUS_ORDER: TestStepResultStatus[] = [
  TestStepResultStatus.UNKNOWN,
  TestStepResultStatus.PASSED,
  TestStepResultStatus.SKIPPED,
  TestStepResultStatus.PENDING,
  TestStepResultStatus.UNDEFINED,
  TestStepResultStatus.AMBIGUOUS,
  TestStepResultStatus.FAILED,
];

/** Raw Cucumber ordinal; the report comparator forces passed last. */
export function statusSeverity(status: ReportStatus): number {
  return STATUS_ORDER.indexOf(status.toUpperCase() as TestStepResultStatus);
}

export interface ExecutedStatus {
  executed: boolean;
  status: ReportStatus;
}

/**
 * Worst status across executed rows only: passed when every executed row
 * passed, unknown when nothing executed. Unexecuted rows never contribute.
 */
export function worstExecutedStatus(
  scenarios: readonly ExecutedStatus[],
): ReportStatus {
  const executed = scenarios.filter((scenario) => scenario.executed);
  if (executed.length === 0) return 'unknown';
  let worst: ReportStatus = 'unknown';
  let hasNonPassed = false;
  for (const scenario of executed) {
    if (scenario.status === 'passed') continue;
    hasNonPassed = true;
    if (statusSeverity(scenario.status) > statusSeverity(worst)) {
      worst = scenario.status;
    }
  }
  return hasNonPassed ? worst : 'passed';
}
