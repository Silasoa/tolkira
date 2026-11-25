import type { CompatResult, CucumberHtmlReporterOptions } from './options.js';

function generate(
  options: CucumberHtmlReporterOptions,
  callback?: (error?: Error | null) => void,
): Promise<CompatResult> {
  const promise = import('./cucumber-html-reporter.js').then((mod) =>
    mod.generate(options, callback),
  );
  if (callback) {
    // Callback-only callers ignore the returned promise; keep its rejection
    // handled without changing what awaiting callers see.
    promise.catch(() => undefined);
  }
  return promise;
}

// oxlint-disable-next-line eslint/no-redeclare -- the public CJS type names must merge with the export = value
const compat = { generate };

namespace compat {
  export type CucumberHtmlReporterOptions =
    import('./options.js').CucumberHtmlReporterOptions;
  export type CompatResult = import('./options.js').CompatResult;
}

export = compat;
