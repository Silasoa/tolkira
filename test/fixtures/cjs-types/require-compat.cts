import compat = require('tolkira/compat/cucumber-html-reporter');
import type {
  CompatResult,
  CucumberHtmlReporterOptions,
} from 'tolkira/compat/cucumber-html-reporter';

async function main(): Promise<void> {
  const options: compat.CucumberHtmlReporterOptions = {
    jsonFile: 'report.json',
    output: 'report.html',
  };
  const alsoOptions: CucumberHtmlReporterOptions = options;

  const result: compat.CompatResult = await compat.generate(
    alsoOptions,
    (error) => {
      const typed: Error | null | undefined = error;
      void typed;
    },
  );
  const alsoResult: CompatResult = result;

  const output: string = alsoResult.output;
  const warnings: string[] = alsoResult.warnings;
  const schema: number = alsoResult.summary.schemaVersion;
  void output;
  void warnings;
  void schema;

  // @ts-expect-error -- the compat subpath has no default export
  void compat.default;
}

void main();
