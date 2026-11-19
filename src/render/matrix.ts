import type { ReportModel } from '../report/model.js';
import type { ReportStatus } from '../report/status.js';
import { escapeHtml } from './escape.js';
import {
  ALL_STATUSES,
  compareStatus,
  countStatuses,
  durationLabel,
  executedOnly,
  featureSourceLabel,
  statusLabel,
} from './format.js';

function matrixStatuses(model: ReportModel): ReportStatus[] {
  return ALL_STATUSES.filter((status) => model.counts.scenarios[status] > 0).sort(
    compareStatus,
  );
}

export function renderFeatureMatrix(model: ReportModel): string {
  const statuses = matrixStatuses(model);
  const head = `<tr><th>Feature</th><th>Total</th>${statuses
    .map((status) => `<th>${statusLabel(status)}</th>`)
    .join('')}<th>Scenario time</th></tr>`;
  const rows = model.features
    .map((feature) => {
      const executed = executedOnly(feature.scenarios);
      const counts = countStatuses(executed);
      const cells = statuses
        .map((status) => {
          const count = counts[status] ?? 0;
          return `<td class="num${count === 0 ? ' zero' : ''}">${count}</td>`;
        })
        .join('');
      return `<tr><th scope="row"><span class="matrixName">${escapeHtml(feature.name)}</span><span class="matrixUri">${escapeHtml(featureSourceLabel(feature))}</span></th><td class="num">${executed.length}</td>${cells}<td class="num">${durationLabel(feature.durationMs)}</td></tr>`;
    })
    .join('');
  return `<table class="featureTable"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
