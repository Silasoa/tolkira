import type { ReportModel } from '../report/model.js';
import { stripBidiControls } from '../text.js';
import { escapeHtml } from './escape.js';
import { safeHttpUrl } from './format.js';

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
  const scp = /^(?:[^@\s/:]+@)?github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(
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
): string {
  if (!ci) return '';
  const name = ciNameMarkup(ci);
  const rows = [
    name ? `<span class="ci"><b>CI</b> ${name}</span>` : '',
    ci.revision
      ? `<span><b>Revision</b> ${revisionMarkup(ci)}</span>`
      : '',
    ci.branch
      ? `<span><b>Branch</b> <span>${escapeHtml(ci.branch)}</span></span>`
      : '',
    ci.tag ? `<span><b>Tag</b> <span>${escapeHtml(ci.tag)}</span></span>` : '',
  ].filter(Boolean);
  return rows.join('');
}

export function ciDetailRows(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  if (!ci) return '';
  const name = ciNameMarkup(ci);
  return [
    name ? `<dt>CI</dt><dd>${name}</dd>` : '',
    ci.revision
      ? `<dt>Revision</dt><dd>${revisionMarkup(ci)}</dd>`
      : '',
    ci.branch ? `<dt>Branch</dt><dd>${escapeHtml(ci.branch)}</dd>` : '',
    ci.tag ? `<dt>Tag</dt><dd>${escapeHtml(ci.tag)}</dd>` : '',
  ].join('');
}
