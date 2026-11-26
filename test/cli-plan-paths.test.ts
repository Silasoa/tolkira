import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { planCli, type CliPlan } from '../src/cli/plan.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const MANIFEST_CONFLICT =
  '--manifest must not overwrite an input file, the logo, ' +
  '--out, --pdf, --email, --history, --ci-out or --baseline';
const HISTORY_CONFLICT =
  '--history must not overwrite an input file, the logo, ' +
  '--out, --pdf, --ci-out, --email or --baseline';
const BASELINE_CONFLICT =
  '--baseline must not name an input file, the logo, ' +
  '--out, --pdf, --email, --history or --ci-out';
const OUT_CONFLICT = '--out must not overwrite an input file';
const CI_OUT_OUT = '--ci-out must not overwrite --out';
const CI_OUT_INPUT = '--ci-out must not overwrite an input file or the logo';
const EMAIL_OUT = '--email must not overwrite --out';
const EMAIL_CI_OUT = '--email must not overwrite --ci-out';
const EMAIL_INPUT_DIR = '--email must not overwrite an input file or directory';
const EMAIL_INPUT_LOGO = '--email must not overwrite an input file or the logo';
const PDF_OUT = '--pdf must not overwrite --out';
const PDF_CI_OUT = '--pdf must not overwrite --ci-out';
const PDF_EMAIL = '--pdf must not overwrite --email';
const PDF_LOGO = '--pdf must not overwrite the logo';
const PDF_INPUT_DIR = '--pdf must not overwrite an input file or directory';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-plan-paths-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function runPlan(argv: string[]): Promise<CliPlan> {
  const result = await planCli(argv);
  if (!result.ok) {
    throw new Error(`expected a plan, got ${JSON.stringify(result)}`);
  }
  if (result.action.kind !== 'run') {
    throw new Error(`expected a run action, got ${result.action.kind}`);
  }
  return result.action.plan;
}

async function failure(argv: string[]): Promise<string> {
  const result = await planCli(argv);
  if (result.ok || result.kind !== 'message') {
    throw new Error(
      `expected a message failure, got ${JSON.stringify(result)}`,
    );
  }
  return result.message;
}

async function writeLogo(
  dir: string,
  name = 'logo.png',
  bytes: Uint8Array = PNG,
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return file;
}

async function inputDirectory(dir: string): Promise<string> {
  const inputDir = path.join(dir, 'results');
  await mkdir(inputDir);
  await copyFile(fixture, path.join(inputDir, 'run.ndjson'));
  return inputDir;
}

function dataUri(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

describe('planCli path identity', () => {
  it('treats two spellings of the same missing path as the same file', async () => {
    const dir = await tempDir();
    const trailing = `${dir}${path.sep}nested${path.sep}..${path.sep}history.json`;
    const plain = path.join(dir, 'history.json');

    expect(
      await failure([
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--history',
        trailing,
        '--baseline',
        plain,
      ]),
    ).toBe(HISTORY_CONFLICT);
  });

  it('treats a missing manifest and a missing --out with the same spelling as one path', async () => {
    const dir = await tempDir();
    const plain = path.join(dir, 'artifact.json');
    const trailing = `${dir}${path.sep}nested${path.sep}..${path.sep}artifact.json`;

    expect(
      await failure([fixture, '--out', plain, '--manifest', trailing]),
    ).toBe(MANIFEST_CONFLICT);
  });

  it('resolves a symlinked or junctioned parent before containment', async () => {
    const dir = await tempDir();
    const inputDir = await inputDirectory(dir);
    const link = path.join(dir, 'linked-results');
    try {
      await symlink(
        inputDir,
        link,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES') return;
      throw error;
    }

    expect(
      await failure([
        inputDir,
        '--out',
        path.join(dir, 'report.html'),
        '--email',
        path.join(link, 'missing.html'),
      ]),
    ).toBe(EMAIL_INPUT_DIR);
  });

  it.skipIf(!['win32', 'darwin'].includes(process.platform))(
    'folds case on a case-insensitive platform',
    async () => {
      const dir = await tempDir();

      expect(
        await failure([
          fixture,
          '--out',
          path.join(dir, 'Report.html'),
          '--pdf',
          path.join(dir, 'report.html'),
        ]),
      ).toBe(PDF_OUT);
    },
  );

  it.skipIf(process.platform !== 'win32')(
    'treats UNC spellings and trailing separators as the same path',
    async () => {
      const dir = await tempDir();
      const report = path.join(dir, 'report.html');

      expect(
        await failure([
          fixture,
          '--out',
          report,
          '--history',
          '\\\\server\\share\\h.json',
          '--baseline',
          '//server/share/h.json',
        ]),
      ).toBe(HISTORY_CONFLICT);

      const history = path.join(dir, 'history.json');
      expect(
        await failure([
          fixture,
          '--out',
          report,
          '--history',
          history,
          '--baseline',
          `${history}${path.sep}`,
        ]),
      ).toBe(HISTORY_CONFLICT);
    },
  );
});

describe('planCli containment (input files and directories)', () => {
  it('allows a missing --out or --ci-out inside an input directory', async () => {
    const dir = await tempDir();
    const inputDir = await inputDirectory(dir);
    const report = path.join(dir, 'report.html');
    const insideReport = path.join(inputDir, 'report.html');

    const outPlan = await runPlan([inputDir, '--out', insideReport]);
    expect(outPlan.report).toBe(insideReport);

    const ciPlan = await runPlan([
      inputDir,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      path.join(inputDir, 'summary.md'),
    ]);
    expect(ciPlan.writes).toEqual(['report', 'ci-markdown']);
  });

  it.each([
    [
      '--email',
      (inputDir: string, dir: string) => [
        inputDir,
        '--out',
        path.join(dir, 'report.html'),
        '--email',
        path.join(inputDir, 'missing.html'),
      ],
      EMAIL_INPUT_DIR,
    ],
    [
      '--pdf',
      (inputDir: string, dir: string) => [
        inputDir,
        '--out',
        path.join(dir, 'report.html'),
        '--pdf',
        path.join(inputDir, 'missing.pdf'),
      ],
      PDF_INPUT_DIR,
    ],
    [
      '--history',
      (inputDir: string, dir: string) => [
        inputDir,
        '--out',
        path.join(dir, 'report.html'),
        '--history',
        path.join(inputDir, 'missing.json'),
      ],
      HISTORY_CONFLICT,
    ],
    [
      '--baseline',
      (inputDir: string, dir: string) => [
        inputDir,
        '--out',
        path.join(dir, 'report.html'),
        '--baseline',
        path.join(inputDir, 'missing.json'),
      ],
      BASELINE_CONFLICT,
    ],
    [
      '--manifest',
      (inputDir: string) => [
        inputDir,
        '--manifest',
        path.join(inputDir, 'missing.json'),
      ],
      MANIFEST_CONFLICT,
    ],
  ])(
    'rejects a missing %s target inside an input directory',
    async (_flag, argv, message) => {
      const dir = await tempDir();
      const inputDir = await inputDirectory(dir);
      expect(await failure(argv(inputDir, dir))).toBe(message);
    },
  );

  it('rejects --out and --ci-out replacing an existing file inside an input directory', async () => {
    const dir = await tempDir();
    const inputDir = await inputDirectory(dir);
    const existing = path.join(inputDir, 'existing.html');
    await writeFile(existing, 'keep me', 'utf8');

    expect(await failure([inputDir, '--out', existing])).toBe(OUT_CONFLICT);

    expect(
      await failure([
        inputDir,
        '--out',
        path.join(dir, 'report.html'),
        '--ci',
        'markdown',
        '--ci-out',
        existing,
      ]),
    ).toBe(CI_OUT_INPUT);
  });
});

describe('planCli input-file collisions per flag', () => {
  it.each([
    ['--out', (_dir: string) => [fixture, '--out', fixture], OUT_CONFLICT],
    [
      '--ci-out',
      (dir: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--ci',
        'markdown',
        '--ci-out',
        fixture,
      ],
      CI_OUT_INPUT,
    ],
    ['--email', () => [fixture, '--email', fixture], EMAIL_INPUT_DIR],
    ['--pdf', () => [fixture, '--pdf', fixture], PDF_INPUT_DIR],
    [
      '--history',
      (dir: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--history',
        fixture,
      ],
      HISTORY_CONFLICT,
    ],
    [
      '--baseline',
      (dir: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--baseline',
        fixture,
      ],
      BASELINE_CONFLICT,
    ],
    ['--manifest', () => [fixture, '--manifest', fixture], MANIFEST_CONFLICT],
  ])('rejects %s naming the input file', async (_flag, argv, message) => {
    const dir = await tempDir();
    expect(await failure(argv(dir))).toBe(message);
  });
});

describe('planCli peer collisions', () => {
  it.each([
    [
      '--out',
      (_dir: string, m: string) => [fixture, '--out', m, '--manifest', m],
    ],
    [
      '--pdf',
      (_dir: string, m: string) => [fixture, '--pdf', m, '--manifest', m],
    ],
    [
      '--email',
      (_dir: string, m: string) => [fixture, '--email', m, '--manifest', m],
    ],
    [
      '--history',
      (dir: string, m: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--history',
        m,
        '--manifest',
        m,
      ],
    ],
    [
      '--ci-out',
      (dir: string, m: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--ci',
        'markdown',
        '--ci-out',
        m,
        '--manifest',
        m,
      ],
    ],
    [
      '--baseline',
      (dir: string, m: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--baseline',
        m,
        '--manifest',
        m,
      ],
    ],
    [
      'the logo',
      (dir: string, m: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        m,
        '--manifest',
        m,
      ],
    ],
  ])('rejects --manifest colliding with %s', async (_peer, argv) => {
    const dir = await tempDir();
    expect(await failure(argv(dir, path.join(dir, 'artifact.json')))).toBe(
      MANIFEST_CONFLICT,
    );
  });

  it.each([
    [
      '--out',
      (_dir: string, h: string) => [fixture, '--out', h, '--history', h],
    ],
    [
      '--pdf',
      (dir: string, h: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--pdf',
        h,
        '--history',
        h,
      ],
    ],
    [
      '--ci-out',
      (dir: string, h: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--ci',
        'markdown',
        '--ci-out',
        h,
        '--history',
        h,
      ],
    ],
    [
      '--email',
      (dir: string, h: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--email',
        h,
        '--history',
        h,
      ],
    ],
    [
      'the baseline',
      (dir: string, h: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--baseline',
        h,
        '--history',
        h,
      ],
    ],
    [
      'the logo',
      (dir: string, h: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        h,
        '--history',
        h,
      ],
    ],
  ])('rejects --history colliding with %s', async (_peer, argv) => {
    const dir = await tempDir();
    expect(await failure(argv(dir, path.join(dir, 'artifact.json')))).toBe(
      HISTORY_CONFLICT,
    );
  });

  it.each([
    [
      '--out',
      (_dir: string, b: string) => [fixture, '--out', b, '--baseline', b],
    ],
    [
      '--pdf',
      (dir: string, b: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--pdf',
        b,
        '--baseline',
        b,
      ],
    ],
    [
      '--email',
      (dir: string, b: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--email',
        b,
        '--baseline',
        b,
      ],
    ],
    [
      '--ci-out',
      (dir: string, b: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--ci',
        'markdown',
        '--ci-out',
        b,
        '--baseline',
        b,
      ],
    ],
    [
      'the logo',
      (dir: string, b: string) => [
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        b,
        '--baseline',
        b,
      ],
    ],
  ])('rejects --baseline colliding with %s', async (_peer, argv) => {
    const dir = await tempDir();
    expect(await failure(argv(dir, path.join(dir, 'artifact.json')))).toBe(
      BASELINE_CONFLICT,
    );
  });

  it('rejects --ci-out colliding with --out', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    expect(
      await failure([
        fixture,
        '--out',
        report,
        '--ci',
        'markdown',
        '--ci-out',
        report,
      ]),
    ).toBe(CI_OUT_OUT);
  });

  it('rejects --email colliding with --out, --ci-out and the logo', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');
    const logo = await writeLogo(dir);

    expect(await failure([fixture, '--out', email, '--email', email])).toBe(
      EMAIL_OUT,
    );

    expect(
      await failure([
        fixture,
        '--out',
        report,
        '--ci',
        'markdown',
        '--ci-out',
        email,
        '--email',
        email,
      ]),
    ).toBe(EMAIL_CI_OUT);

    expect(
      await failure([
        fixture,
        '--out',
        report,
        '--logo',
        logo,
        '--email',
        logo,
      ]),
    ).toBe(EMAIL_INPUT_LOGO);
  });

  it('rejects --pdf colliding with --out, --ci-out, --email and the logo', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const pdf = path.join(dir, 'run.pdf');
    const logo = await writeLogo(dir);

    expect(await failure([fixture, '--out', pdf, '--pdf', pdf])).toBe(PDF_OUT);

    expect(
      await failure([
        fixture,
        '--out',
        report,
        '--ci',
        'markdown',
        '--ci-out',
        pdf,
        '--pdf',
        pdf,
      ]),
    ).toBe(PDF_CI_OUT);

    expect(
      await failure([fixture, '--out', report, '--email', pdf, '--pdf', pdf]),
    ).toBe(PDF_EMAIL);

    expect(
      await failure([fixture, '--out', report, '--logo', logo, '--pdf', logo]),
    ).toBe(PDF_LOGO);
  });
});

describe('planCli manifest relative expressibility', () => {
  it('accepts absolute artifacts', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const manifest = path.join(dir, 'manifest.json');

    const plan = await runPlan([
      fixture,
      '--out',
      report,
      '--manifest',
      manifest,
    ]);
    expect(plan.manifest).toBe(manifest);
  });

  it('accepts a relative artifact inside the manifest directory', async () => {
    const dir = await mkdtemp(
      path.join(process.cwd(), '.tolkira-plan-relative-'),
    );
    dirs.push(dir);
    const out = path.relative(process.cwd(), path.join(dir, 'report.html'));
    const manifest = path.relative(
      process.cwd(),
      path.join(dir, 'manifest.json'),
    );

    const plan = await runPlan([fixture, '--out', out, '--manifest', manifest]);
    expect(plan.report).toBe(out);
  });

  it.skipIf(process.platform !== 'win32')(
    'rejects a relative artifact on a different drive with the per-flag message',
    async () => {
      const dir = await tempDir();
      const drive =
        process.cwd().slice(0, 2).toUpperCase() === 'Z:' ? 'Y:' : 'Z:';
      const manifest = `${drive}\\tolkira\\manifest.json`;
      const stem = `tolkira-${path.basename(dir)}`;
      const out = `${stem}-report.html`;
      const pdf = `${stem}-run.pdf`;
      const email = `${stem}-email.html`;
      const history = `${stem}-history.json`;
      const ciOut = `${stem}-summary.md`;

      expect(
        await failure([fixture, '--out', out, '--manifest', manifest]),
      ).toBe(
        `--out ${out} cannot be expressed relative to --manifest; ` +
          'pass an absolute --out path',
      );

      expect(
        await failure([fixture, '--pdf', pdf, '--manifest', manifest]),
      ).toBe(
        `--pdf ${pdf} cannot be expressed relative to --manifest; ` +
          'pass an absolute --pdf path',
      );

      expect(
        await failure([fixture, '--email', email, '--manifest', manifest]),
      ).toBe(
        `--email ${email} cannot be expressed relative to --manifest; ` +
          'pass an absolute --email path',
      );

      expect(
        await failure([
          fixture,
          '--out',
          path.join(dir, 'report.html'),
          '--history',
          history,
          '--manifest',
          manifest,
        ]),
      ).toBe(
        `--history ${history} cannot be expressed relative to --manifest; ` +
          'pass an absolute --history path',
      );

      expect(
        await failure([
          fixture,
          '--ci',
          'markdown',
          '--ci-out',
          ciOut,
          '--manifest',
          manifest,
        ]),
      ).toBe(
        `--ci-out ${ciOut} cannot be expressed relative to --manifest; ` +
          'pass an absolute --ci-out path',
      );
    },
  );
});

describe('planCli logo validation', () => {
  it.each([
    ['png', PNG, 'image/png'],
    ['jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]), 'image/jpeg'],
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00]), 'image/jpeg'],
    ['gif', Buffer.from('GIF89a'), 'image/gif'],
    ['webp', Buffer.from('RIFF\x04\x00\x00\x00WEBP'), 'image/webp'],
  ])('embeds a valid %s logo', async (extension, bytes, mime) => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const logo = await writeLogo(dir, `logo.${extension}`, bytes);

    const plan = await runPlan([fixture, '--out', report, '--logo', logo]);
    expect(plan.logoDataUri).toBe(dataUri(mime, bytes));
  });

  it.each([
    [
      'xml declaration',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
    ],
    ['BOM', '\uFEFF<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
  ])('embeds a valid SVG logo with %s', async (_label, content) => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const bytes = Buffer.from(content, 'utf8');
    const logo = await writeLogo(dir, 'logo.svg', bytes);

    const plan = await runPlan([fixture, '--out', report, '--logo', logo]);
    expect(plan.logoDataUri).toBe(dataUri('image/svg+xml', bytes));
  });

  it('lowercases an uppercase extension', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const logo = await writeLogo(dir, 'LOGO.PNG');

    const plan = await runPlan([fixture, '--out', report, '--logo', logo]);
    expect(plan.logoDataUri).toBe(dataUri('image/png', PNG));
  });

  it('rejects a missing logo with the filesystem detail', async () => {
    const dir = await tempDir();
    const logo = path.join(dir, 'missing.png');

    expect(
      await failure([
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        logo,
      ]),
    ).toBe(`ENOENT: no such file or directory, stat '${logo}'`);
  });

  it('rejects an unsupported extension by name', async () => {
    const dir = await tempDir();
    const logo = await writeLogo(dir, 'logo.txt', Buffer.from('not an image'));

    expect(
      await failure([
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        logo,
      ]),
    ).toBe('Unsupported logo type ".txt". Use PNG, JPEG, GIF, WebP or SVG.');
  });

  it('accepts a logo of exactly 2 MB and rejects one byte more', async () => {
    const dir = await tempDir();
    const atLimit = Buffer.alloc(2 * 1024 * 1024);
    PNG.copy(atLimit);
    const limitLogo = await writeLogo(dir, 'limit.png', atLimit);
    const overLogo = await writeLogo(
      dir,
      'over.png',
      Buffer.alloc(2 * 1024 * 1024 + 1),
    );

    const plan = await runPlan([
      fixture,
      '--out',
      path.join(dir, 'report.html'),
      '--logo',
      limitLogo,
    ]);
    expect(plan.logoDataUri).toMatch(/^data:image\/png;base64,/);

    expect(
      await failure([
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        overLogo,
      ]),
    ).toBe('Logo is larger than 2 MB.');
  });

  it.each([
    ['png', 'not a png'],
    ['jpg', 'not a jpeg'],
    ['jpeg', 'not a jpeg'],
    ['gif', 'not a gif'],
    ['webp', 'not a webp'],
    ['svg', 'not an svg'],
  ])('rejects %s content with the wrong magic', async (extension, content) => {
    const dir = await tempDir();
    const logo = await writeLogo(
      dir,
      `logo.${extension}`,
      Buffer.from(content, 'utf8'),
    );

    expect(
      await failure([
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--logo',
        logo,
      ]),
    ).toBe(`Logo content does not match the ".${extension}" extension.`);
  });

  it('parses --meta, --max-size, --accent and --logo in that order', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const missing = path.join(dir, 'missing.png');
    const argv = (
      meta: string,
      maxSize: string,
      accent: string,
      logo: string,
    ) => [
      fixture,
      '--out',
      report,
      '--meta',
      meta,
      '--max-size',
      maxSize,
      '--accent',
      accent,
      '--logo',
      logo,
    ];
    const metadataMessage = 'Invalid metadata entry "bad". Use key=value.';
    const maxSizeMessage =
      'Invalid --max-size "0". Use a positive number of MB.';
    const accentMessage =
      'Invalid --accent "red". Use a hex colour such as #1b5e20.';
    const logoMessage = `ENOENT: no such file or directory, stat '${missing}'`;

    expect(await failure(argv('bad', '0', 'red', missing))).toBe(
      metadataMessage,
    );
    expect(await failure(argv('k=v', '0', 'red', missing))).toBe(
      maxSizeMessage,
    );
    expect(await failure(argv('k=v', '5', 'red', missing))).toBe(accentMessage);
    expect(await failure(argv('k=v', '5', '#123456', missing))).toBe(
      logoMessage,
    );
  });

  it('keeps the out collision before logo validation', async () => {
    const dir = await tempDir();
    const logo = await writeLogo(dir, 'logo.txt', Buffer.from('not an image'));

    expect(await failure([fixture, '--out', logo, '--logo', logo])).toBe(
      OUT_CONFLICT,
    );
  });
});

describe('planCli input-directory identity through a symlink', () => {
  it.skipIf(process.platform === 'linux')(
    'keeps checking containment when the input is reached by another name',
    async () => {
      const dir = await tempDir();
      const inputDir = await inputDirectory(dir);
      const link = path.join(dir, 'alias-results');
      try {
        await symlink(
          inputDir,
          link,
          process.platform === 'win32' ? 'junction' : 'dir',
        );
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EACCES') return;
        throw error;
      }

      expect(
        await failure([
          link,
          '--out',
          path.join(dir, 'report.html'),
          '--pdf',
          path.join(inputDir, 'missing.pdf'),
        ]),
      ).toBe(PDF_INPUT_DIR);
    },
  );
});

describe('planCli accepts a valid logo on a normal output', () => {
  it('does not require the logo to be a report surface', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const logo = await writeLogo(dir);

    const plan = await runPlan([
      fixture,
      '--out',
      report,
      '--logo',
      logo,
      '--accent',
      '#1b5e20',
    ]);

    expect(plan.writes).toEqual(['report']);
    expect(plan.accent).toBe('#1b5e20');
    await expect(stat(logo)).resolves.toMatchObject({ size: PNG.byteLength });
  });
});
