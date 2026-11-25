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
import type { Translator } from './i18n.js';

function matrixStatuses(model: ReportModel): ReportStatus[] {
  return ALL_STATUSES.filter(
    (status) => model.counts.scenarios[status] > 0,
  ).sort(compareStatus);
}

export function renderFeatureMatrix(model: ReportModel, t: Translator): string {
  const statuses = matrixStatuses(model);
  const head = `<tr><th>${t.t('matrix.feature')}</th><th>${t.t('matrix.total')}</th>${statuses
    .map((status) => `<th>${statusLabel(status, t)}</th>`)
    .join('')}<th>${t.t('matrix.scenarioTime')}</th></tr>`;
  const rows = model.features
    .map((feature) => {
      const executed = executedOnly(feature.scenarios);
      const counts = countStatuses(executed);
      const cells = statuses
        .map((status) => {
          const count = counts[status] ?? 0;
          return `<td class="num${count === 0 ? ' zero' : ''}">${t.number(count)}</td>`;
        })
        .join('');
      return `<tr><th scope="row"><span class="matrixName">${escapeHtml(feature.name)}</span><span class="matrixUri">${escapeHtml(featureSourceLabel(feature, t))}</span></th><td class="num">${t.number(executed.length)}</td>${cells}<td class="num">${durationLabel(feature.durationMs, t)}</td></tr>`;
    })
    .join('');
  return `<table class="featureTable"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
