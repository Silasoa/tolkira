import path from 'node:path';
import { escapeHtml } from './render/escape.js';
import { ALL_STATUSES, passRate, statusLabel } from './render/format.js';
import {
  createTranslator,
  type MessageKey,
  type Translator,
} from './render/i18n.js';
import type { ReportSummary, SummaryStatus } from './summary.js';
import { isValidAccent } from './validation.js';

export interface EmailOptions {
  /** Used verbatim after escaping; defaults to Tolkira report. */
  title?: string;
  /** Email language tag; defaults to English. */
  locale?: string;
  /** Full report name; only its basename reaches the note. */
  reportName?: string;
  /** Hex accent; invalid values are ignored. */
  accent?: string;
  /** Generation time, labelled Generated; defaults to now. */
  now?: Date;
}

const DEFAULT_TITLE = 'Tolkira report';
const MAX_FAILED = 5;
const MAX_TEXT = 200;
const FONT_FAMILY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const STATUS_COLORS: Record<SummaryStatus, string> = {
  passed: '#1b5e20',
  failed: '#b3261e',
  pending: '#8a5a00',
  undefined: '#8a5a00',
  ambiguous: '#8a5a00',
  skipped: '#4b5563',
  unknown: '#4b5563',
};

/** A summary status can arrive from user data; never trust its own properties. */
function knownStatus(status: SummaryStatus): SummaryStatus {
  return Object.hasOwn(STATUS_COLORS, status) ? status : 'unknown';
}

function clampText(value: string): string {
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT - 1)}…` : value;
}

/**
 * Formats a count through the catalog and then groups the number for English,
 * whose translator keeps count placeholders bare for the report.
 */
function countText(
  key: MessageKey,
  count: number,
  t: Translator,
  format: Intl.NumberFormat,
): string {
  return t.t(key, { count }).replace(String(count), format.format(count));
}

/** Human duration for the email body: 850 ms, 12.3 s, 1 min 5 s, 1 h 2 min. */
function humanDuration(
  milliseconds: number,
  format: Intl.NumberFormat,
): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0 ms';
  if (milliseconds < 1000) {
    return `${format.format(Math.round(milliseconds))} ms`;
  }
  if (milliseconds < 60_000) {
    return `${format.format(Math.round(milliseconds / 100) / 10)} s`;
  }
  const totalSeconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return minutes > 0
      ? `${format.format(hours)} h ${format.format(minutes)} min`
      : `${format.format(hours)} h`;
  }
  return seconds > 0
    ? `${format.format(minutes)} min ${format.format(seconds)} s`
    : `${format.format(minutes)} min`;
}

function metricCell(label: string, value: string): string {
  return `<td class="metric" style="width:50%;padding:10px 0;vertical-align:top"><div style="font-size:12px;line-height:1.4;color:#6b7280">${label}</div><div style="font-size:16px;line-height:1.4;font-weight:700;color:#111827">${value}</div></td>`;
}

function statusPill(
  count: number,
  label: string,
  format: Intl.NumberFormat,
): string {
  return `<span style="display:inline-block;margin:0 6px 6px 0;padding:2px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:13px;line-height:1.5;color:#111827"><strong>${escapeHtml(format.format(count))}</strong> ${escapeHtml(label)}</span>`;
}

function metricSection(summary: ReportSummary, t: Translator): string {
  const counts = summary.counts.scenarios;
  const hasScenarios = summary.scenarios.length > 0;
  const rate = passRate(counts);
  const rateValue = !hasScenarios
    ? t.t('format.emptyRatio')
    : rate.attempted === 0
      ? t.t('format.noAttempts')
      : t.percent(rate.percent ?? 0);
  const unexecuted = summary.scenarios.filter(
    (scenario) => !scenario.executed,
  ).length;
  const format = new Intl.NumberFormat(t.lang);

  const statuses = ALL_STATUSES.filter((status) => counts[status] > 0).map(
    (status) => statusPill(counts[status], statusLabel(status, t), format),
  );
  const unexecutedPill =
    unexecuted > 0
      ? `<span style="display:inline-block;margin:0 6px 6px 0;padding:2px 8px;border:1px solid #e5e7eb;border-radius:4px;font-size:13px;line-height:1.5;color:#111827">${escapeHtml(countText('email.unexecuted', unexecuted, t, format))}</span>`
      : '';
  const pills = [...statuses, unexecutedPill].filter(Boolean).join(' ');
  const passRateNote = hasScenarios
    ? `<div style="font-size:12px;line-height:1.4;color:#6b7280">${escapeHtml(t.t('email.passRateNote'))}</div>`
    : '';
  const emptyNote = hasScenarios
    ? ''
    : `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#111827">${escapeHtml(t.t('email.empty'))}</p>`;

  return `<tr><td style="padding:0 24px 8px"><div style="padding:12px 0;border-top:1px solid #e5e7eb"><div style="font-size:13px;line-height:1.4;color:#6b7280">${escapeHtml(t.t('email.passRate'))}</div><div style="font-size:24px;line-height:1.3;font-weight:700;color:#111827">${escapeHtml(rateValue)}</div>${passRateNote}</div><div style="padding:4px 0 2px">${pills}</div><p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#111827">${escapeHtml(countText('report.scenarioWithResults', counts.total, t, format))}</p>${emptyNote}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:8px"><tr>${metricCell(escapeHtml(t.t('email.features')), escapeHtml(countText('report.featureCount', summary.counts.features, t, format)))}${metricCell(escapeHtml(t.t('email.steps')), escapeHtml(countText('report.stepCount', summary.counts.steps.total, t, format)))}</tr><tr>${metricCell(escapeHtml(t.t('email.duration')), escapeHtml(humanDuration(summary.durationMs, format)))}${metricCell(escapeHtml(t.t('email.attachments')), `${escapeHtml(countText('report.attachmentCount', summary.attachments.total, t, format))}<div style="font-size:12px;line-height:1.4;color:#6b7280">${escapeHtml(countText('format.bytes', summary.attachments.bytes, t, format))}</div>`)}</tr></table></td></tr>`;
}

function failedSection(summary: ReportSummary, t: Translator): string {
  if (summary.scenarios.length === 0) return '';

  const failed = summary.scenarios.filter(
    (scenario) => scenario.status === 'failed',
  );
  const format = new Intl.NumberFormat(t.lang);
  let body: string;
  if (failed.length === 0) {
    const status = statusLabel(knownStatus(summary.status), t);
    const copy =
      summary.status === 'passed'
        ? t.t('email.noFailures')
        : t.t('email.noFailuresStatus', { status });
    body = `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#111827">${escapeHtml(copy)}</p>`;
  } else {
    const rows = failed
      .slice(0, MAX_FAILED)
      .map(
        (scenario) =>
          `<div style="padding:10px 0;border-top:1px solid #e5e7eb"><div style="font-size:12px;line-height:1.4;color:#6b7280;overflow-wrap:anywhere">${escapeHtml(clampText(scenario.feature))}</div><div style="font-size:14px;line-height:1.5;font-weight:600;color:#111827;overflow-wrap:anywhere">${escapeHtml(clampText(scenario.name))}</div><div style="font-size:12px;line-height:1.4;color:#6b7280">${escapeHtml(statusLabel(knownStatus(scenario.status), t))} &middot; ${escapeHtml(humanDuration(scenario.durationMs, format))}</div></div>`,
      )
      .join('');
    const rest = failed.length - MAX_FAILED;
    const more =
      rest > 0
        ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#111827">${escapeHtml(countText('email.moreFailures', rest, t, format))}</p>`
        : '';
    body = `${rows}${more}`;
  }

  return `<tr><td style="padding:16px 24px 0"><h2 style="margin:0;font-size:16px;line-height:1.4;color:#111827">${escapeHtml(t.t('email.failedTitle'))}</h2>${body}</td></tr>`;
}

function reportNote(options: EmailOptions, t: Translator): string {
  if (!options.reportName) return t.t('email.reportMissing');
  // Published names may use either separator; keep only the basename and cap it.
  const name = clampText(
    path.basename(options.reportName.replace(/\\/g, '/')),
  );
  if (!name) return t.t('email.reportMissing');
  return t.t('email.reportNote', { name });
}

/**
 * Renders one self-contained HTML email summary from a stable report summary.
 * Writes nothing, sends nothing and makes no request.
 */
export function renderEmail(
  summary: ReportSummary,
  options: EmailOptions = {},
): string {
  const t = createTranslator(options.locale);
  const title = options.title ?? DEFAULT_TITLE;
  const overall = knownStatus(summary.status);
  const status = escapeHtml(statusLabel(overall, t));
  const heading = t.t('email.title', {
    title,
    status: statusLabel(overall, t),
  });
  const accent = isValidAccent(options.accent) ? options.accent : undefined;
  const border = accent ?? STATUS_COLORS[overall];
  const now = options.now ?? new Date();
  const generatedAt = Number.isNaN(now.getTime())
    ? ''
    : t.date(now.toISOString());
  const generated = generatedAt
    ? `<div style="margin-top:12px;font-size:13px;line-height:1.4;color:#6b7280">${escapeHtml(t.t('email.generated', { date: generatedAt }))}</div>`
    : '';
  const note = reportNote(options, t);

  return `<!doctype html>
<html lang="${escapeHtml(t.lang)}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
<style>
body{margin:0;padding:0;background-color:#f3f4f6;font-family:${FONT_FAMILY}}
table{border-collapse:collapse}
@media (max-width:480px){.shell{padding:12px 8px !important}.metric{display:block;width:100% !important}}
@media (forced-colors:active){body{background-color:Canvas}table{background-color:Canvas}}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:${FONT_FAMILY}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:#f3f4f6">
<tr><td class="shell" align="center" style="padding:24px 12px;font-family:${FONT_FAMILY}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #d1d5db;border-top:4px solid ${border};font-family:${FONT_FAMILY}">
<tr><td style="padding:24px 24px 8px">
<div style="font-size:12px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Tolkira</div>
<h1 style="margin:6px 0 12px;font-size:24px;line-height:1.3;color:#111827;overflow-wrap:anywhere">${escapeHtml(heading)}</h1>
<div><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:13px;line-height:1.5;font-weight:600;color:#ffffff;background-color:${STATUS_COLORS[overall]}">${status}</span></div>
${generated}
</td></tr>
${metricSection(summary, t)}
${failedSection(summary, t)}
<tr><td style="padding:16px 24px"><p style="margin:0;font-size:13px;line-height:1.5;color:#111827;overflow-wrap:anywhere">${escapeHtml(note)}</p></td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb"><p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(t.t('email.footer'))}</p></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
