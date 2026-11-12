import compat = require('tolkira/compat/cucumber-html-reporter');

async function main(): Promise<void> {
  const result = await compat.generate(
    { jsonFile: 'report.json', output: 'report.html' },
    (error) => {
      const typed: Error | null | undefined = error;
      void typed;
    },
  );

  const output: string = result.output;
  const warnings: string[] = result.warnings;
  const schema: number = result.summary.schemaVersion;
  void output;
  void warnings;
  void schema;

  // @ts-expect-error -- the compat subpath has no default export
  void compat.default;
}

void main();
