import { loadEnvelopes } from './input/load.js';
import { renderHtml } from './render/html.js';

export const version = '0.0.0';
export const phase = 'development';

export interface RenderReportOptions {
  title?: string;
  metadata?: Record<string, string>;
}

export async function renderReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<string> {
  const envelopes = await loadEnvelopes(inputs);
  return renderHtml(envelopes, {
    title: options.title ?? 'Tolkira report',
    metadata: options.metadata,
  });
}
