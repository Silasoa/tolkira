import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { capabilitiesJson } from './capabilities.js';
import { executePlan, type CliIO } from './cli/execute.js';
import { planCli } from './cli/plan.js';
import { HISTORY_LIMIT, HISTORY_LIMIT_MAX } from './history.js';
import { version } from './index.js';

export type { CliIO } from './cli/execute.js';

const USAGE = `Usage: tolkira <input...> [--out <file>] [--pdf <file>] [--email <file>] [options]

Generate one self-contained HTML report from Cucumber JSON, Messages, JUnit XML or Playwright JSON.

Options:
  -o, --out <file>     Output HTML file
      --static         Script-free static report with every view and detail open; needs --out or --pdf
      --pdf <file>     Write an A4 PDF through the optional Playwright engine
      --pdf-timeout <ms> PDF render deadline in milliseconds (default 300000); needs --pdf
      --email <file>   Write an HTML email summary
      --json           Print a stable JSON summary to stdout
      --ci <format>    Print a CI summary: github, azure or markdown
      --ci-out <file>  Write the markdown CI summary to a file
      --history <file> Read and append an aggregate run history; needs --out
      --history-limit <n> Runs kept in that history (default ${HISTORY_LIMIT}, range 1 to ${HISTORY_LIMIT_MAX}); needs --history
      --baseline <file> Compare with an earlier schema-2 summary; needs --out, --pdf, --json or --ci markdown
      --manifest <file> Write a JSON manifest of the run
      --title <text>   Report title, email subject/heading and Markdown CI heading
      --locale <tag>   Report, PDF and email language: en or de (default en); needs --out, --pdf or --email
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo; needs --out
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
      --capabilities   Print the JSON capabilities document and exit
  -h, --help           Show this help
  -v, --version        Show the version

At least one of --out, --pdf, --json, --ci, --email or --manifest is required. --ci-out requires
--ci markdown. --history requires --out. Without --ci-out, --ci writes only the
CI summary to stdout. --json and --ci markdown share stdout only with --ci-out;
--ci github and --ci azure always own stdout. Failing tests do not change the
exit code.`;

const DEFAULT_IO: CliIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

export async function runCli(
  argv: string[],
  io: CliIO = DEFAULT_IO,
): Promise<number> {
  const planned = await planCli(argv);
  if (!planned.ok) {
    io.stderr(
      planned.kind === 'usage'
        ? USAGE
        : `tolkira: ${planned.message}\n\n${USAGE}`,
    );
    return 2;
  }
  const action = planned.action;
  if (action.kind === 'help') {
    io.stdout(USAGE);
    return 0;
  }
  if (action.kind === 'version') {
    io.stdout(`${version}\n`);
    return 0;
  }
  if (action.kind === 'capabilities') {
    io.stdout(capabilitiesJson());
    return 0;
  }
  return executePlan(action.plan, io);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
    return code;
  });
}
