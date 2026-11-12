import { readFile } from 'node:fs/promises';
import * as compat from 'tolkira/compat/cucumber-html-reporter';

const [jsonFile, output] = process.argv.slice(2);

try {
  const result = await compat.generate({ jsonFile, output });
  const html = await readFile(output, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      result,
      html,
      shape: {
        generate: typeof compat.generate,
        hasDefault: Object.hasOwn(compat, 'default'),
      },
    })}\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
