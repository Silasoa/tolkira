import path from 'node:path';
import { version } from './index.js';
import type { ReportSummary } from './summary.js';

const MANIFEST_SCHEMA_VERSION = 1;
const MANIFEST_FAILURE_LIMIT = 10;

type ManifestArtifactKind =
  | 'report'
  | 'pdf'
  | 'email'
  | 'history'
  | 'ci-markdown';

export interface ManifestArtifact {
  kind: ManifestArtifactKind;
  path: string;
}

interface ManifestFailure {
  feature: string;
  name: string;
  example?: string;
  uri: string;
}

export interface RunManifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  tool: { name: string; version: string };
  status: ReportSummary['status'];
  counts: ReportSummary['counts'];
  attachments: ReportSummary['attachments'];
  warnings: { skippedAttachments: number };
  artifacts: ManifestArtifact[];
  failures: ManifestFailure[];
}

type SummaryScenarioRow = ReportSummary['scenarios'][number];

function failureRow(scenario: SummaryScenarioRow): ManifestFailure {
  return {
    feature: scenario.feature,
    name: scenario.name,
    ...(scenario.example === undefined ? {} : { example: scenario.example }),
    uri: scenario.uri,
  };
}

/** The first failed rows in summary order; counts carry the complete number. */
function firstFailures(summary: ReportSummary): ManifestFailure[] {
  return summary.scenarios
    .filter((scenario) => scenario.executed && scenario.status === 'failed')
    .slice(0, MANIFEST_FAILURE_LIMIT)
    .map((scenario) => failureRow(scenario));
}

/**
 * A path relative to the manifest's directory with `/` separators. Across
 * Windows drives no relative path exists; the path as given is the fallback.
 */
function artifactPath(manifestFile: string, artifactFile: string): string {
  const relative = path.relative(
    path.dirname(path.resolve(manifestFile)),
    path.resolve(artifactFile),
  );
  if (relative === '' || path.isAbsolute(relative)) return artifactFile;
  return relative.split(path.sep).join('/');
}

/** Builds the deterministic schema-1 manifest: no timestamp, no cwd, no inputs. */
export function buildRunManifest(
  summary: ReportSummary,
  skippedAttachments: number,
  artifacts: readonly ManifestArtifact[],
  manifestFile: string,
): RunManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    tool: { name: 'tolkira', version },
    status: summary.status,
    counts: summary.counts,
    attachments: summary.attachments,
    warnings: { skippedAttachments },
    artifacts: artifacts.map((artifact) => ({
      kind: artifact.kind,
      path: artifactPath(manifestFile, artifact.path),
    })),
    failures: firstFailures(summary),
  };
}

/** Two-space JSON with one trailing newline, like the summary and history. */
export function serializeRunManifest(manifest: RunManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
