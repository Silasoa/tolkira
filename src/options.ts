export interface RenderReportOptions {
  title?: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
}

export function renderOptions(options: RenderReportOptions) {
  return {
    title: options.title ?? 'Tolkira report',
    metadata: options.metadata,
    logo: options.logo,
    accent: options.accent,
  };
}
