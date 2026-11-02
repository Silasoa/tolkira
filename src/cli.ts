import { rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { renderReport, version } from './index.js';

const USAGE = `Usage: tolkira <input...> --out <file> [options]

Generate one self-contained HTML report from Cucumber JSON or Messages.

Options:
  -o, --out <file>     Output HTML file (required)
      --title <text>   Report title
      --meta key=value Add metadata (repeatable)
  -h, --help           Show this help
  -v, --version        Show the version
`;

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

function parseCliArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      title: { type: 'string' },
      meta: { type: 'string', multiple: true },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  } as const);
}

function parseMetadata(values: string[] | undefined): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const entry of values ?? []) {
    const separator = entry.indexOf('=');
    if (separator <= 0) {
      throw new Error(`Invalid metadata entry "${entry}". Use key=value.`);
    }
    metadata[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return metadata;
}

export async function runCli(
  argv: string[],
  io: CliIO = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  let parsed: ReturnType<typeof parseCliArgs>;

  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  if (parsed.values.help) {
    io.stdout(USAGE);
    return 0;
  }

  if (parsed.values.version) {
    io.stdout(`${version}\n`);
    return 0;
  }

  const inputs = parsed.positionals;
  const output = parsed.values.out;

  if (inputs.length === 0 || !output) {
    io.stderr(USAGE);
    return 2;
  }

  try {
    const metadata = parseMetadata(parsed.values.meta);
    const html = await renderReport(inputs, {
      title: parsed.values.title,
      metadata,
    });
    await writeFile(output, html, 'utf8');
    io.stdout(`Report written to ${output}\n`);
    return 0;
  } catch (error) {
    await rm(output, { force: true }).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
