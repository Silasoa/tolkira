import type { ReportModel } from '../report/model.js';
import { stripBidiControls } from '../text.js';
import { escapeHtml } from './escape.js';
import { safeHttpUrl } from './format.js';
import type { Translator } from './i18n.js';

function githubRepoPath(url: URL): string | undefined {
  if (url.hostname.toLowerCase() !== 'github.com') return undefined;
  const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
  return /^\/[^/]+\/[^/]+$/.test(path) ? path : undefined;
}

// Accepts https, ssh:// and scp-like GitHub remotes; everything else is plain.
function githubBaseUrl(remote: string | undefined): string | undefined {
  const value = stripBidiControls(remote ?? '').trim();
  if (!value) return undefined;
  const direct = safeHttpUrl(value);
  if (direct) {
    const url = new URL(direct);
    const path = githubRepoPath(url);
    return path ? `${url.origin}${path}` : undefined;
  }
  const scp =
    /^(?:[^@\s/:]+@)?github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(
      value,
    );
  if (scp) return `https://github.com/${scp[1]}/${scp[2]}`;
  if (!/^(?:ssh|git\+ssh):\/\//i.test(value)) return undefined;
  try {
    const path = githubRepoPath(new URL(value));
    return path ? `https://github.com${path}` : undefined;
  } catch {
    return undefined;
  }
}

function shortRevision(revision: string): string {
  return stripBidiControls(revision).slice(0, 7);
}

function githubCommitUrl(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string | undefined {
  if (!ci?.remote || !ci.revision) return undefined;
  const base = githubBaseUrl(ci.remote);
  if (!base) return undefined;
  return `${base}/commit/${encodeURIComponent(stripBidiControls(ci.revision))}`;
}

function revisionMarkup(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  if (!ci?.revision) return '';
  const short = escapeHtml(shortRevision(ci.revision));
  const commit = githubCommitUrl(ci);
  if (!commit) return short;
  return `<a href="${escapeHtml(commit)}" title="${escapeHtml(ci.revision)}" rel="noopener noreferrer">${short}</a>`;
}

function ciNameMarkup(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  const href = safeHttpUrl(ci?.url);
  const label = ci?.name || href;
  if (!label) return '';
  return href
    ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    : escapeHtml(label);
}

export function ciHeaderMarkup(
  ci: NonNullable<ReportModel['environment']>['ci'],
  t: Translator,
): string {
  if (!ci) return '';
  const name = ciNameMarkup(ci);
  const rows = [
    name ? `<span class="ci"><b>${t.t('ci.label')}</b> ${name}</span>` : '',
    ci.revision
      ? `<span><b>${t.t('ci.revision')}</b> ${revisionMarkup(ci)}</span>`
      : '',
    ci.branch
      ? `<span><b>${t.t('ci.branch')}</b> <span>${escapeHtml(ci.branch)}</span></span>`
      : '',
    ci.tag
      ? `<span><b>${t.t('ci.tag')}</b> <span>${escapeHtml(ci.tag)}</span></span>`
      : '',
  ].filter(Boolean);
  return rows.join('');
}

export function ciDetailRows(
  ci: NonNullable<ReportModel['environment']>['ci'],
  t: Translator,
): string {
  if (!ci) return '';
  const name = ciNameMarkup(ci);
  return [
    name ? `<dt>${t.t('ci.label')}</dt><dd>${name}</dd>` : '',
    ci.revision
      ? `<dt>${t.t('ci.revision')}</dt><dd>${revisionMarkup(ci)}</dd>`
      : '',
    ci.branch
      ? `<dt>${t.t('ci.branch')}</dt><dd>${escapeHtml(ci.branch)}</dd>`
      : '',
    ci.tag ? `<dt>${t.t('ci.tag')}</dt><dd>${escapeHtml(ci.tag)}</dd>` : '',
  ].join('');
}
