import { readdir, readFile, writeFile } from 'node:fs/promises';

const LOCALES = new URL('../src/i18n/locales/', import.meta.url);
const files = (await readdir(LOCALES))
  .filter((name) => name.endsWith('.json'))
  .sort();
const tags = files.map((name) => name.slice(0, -'.json'.length));

if (!tags.includes('en')) {
  throw new Error('src/i18n/locales/en.json is required');
}

const readCatalog = async (tag) =>
  JSON.parse(await readFile(new URL(`${tag}.json`, LOCALES), 'utf8'));

const en = await readCatalog('en');
const keys = Object.keys(en).sort();
const targets = new Map();
for (const tag of tags) {
  if (tag === 'en') continue;
  const target = await readCatalog(tag);
  const targetKeys = Object.keys(target);
  const missing = keys.filter((key) => !(key in target));
  const extra = targetKeys.filter((key) => !(key in en));
  if (missing.length > 0 || extra.length > 0) {
    const detail = [
      ...missing.map((key) => `${key}: missing in ${tag}.json`),
      ...extra.map((key) => `${key}: not present in en.json`),
    ].join('; ');
    throw new Error(`${tag}.json does not match en.json: ${detail}`);
  }
  for (const key of keys) {
    if (typeof target[key] !== 'string' || target[key].length === 0) {
      throw new Error(`${tag}.json: ${key}: target value must be non-empty`);
    }
  }
  targets.set(tag, target);
}

const identifier = (tag) => {
  const sanitized = tag.replaceAll(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(sanitized) ? sanitized : `_${sanitized}`;
};

const object = (values) =>
  `{\n${keys.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(values[key])},`).join('\n')}\n}`;

const sortedTargets = [...targets.keys()].sort(
  (a, b) => (a < b ? -1 : a > b ? 1 : 0),
);
const usedIdentifiers = new Set(['en', 'catalogs', 'MessageKey']);
const declarations = sortedTargets.map((tag) => {
  const name = identifier(tag);
  if (usedIdentifiers.has(name)) {
    throw new Error(`Locale tag "${tag}" maps to duplicate identifier "${name}"`);
  }
  usedIdentifiers.add(name);
  return `export const ${name}: Record<MessageKey, string> = ${object(targets.get(tag))};`;
});

const catalogEntries = ['en', ...sortedTargets].map((tag) => {
  const name = tag === 'en' ? 'en' : identifier(tag);
  return name === tag
    ? `  ${name},`
    : `  ${JSON.stringify(tag)}: ${name},`;
});

const keyUnion = keys.map((key) => `  | ${JSON.stringify(key)}`).join('\n');
const output =
  '// Generated from src/i18n/locales by scripts/build-i18n.mjs. Do not edit.\n' +
  `export type MessageKey =\n${keyUnion};\n\n` +
  `export const en: Record<MessageKey, string> = ${object(Object.fromEntries(keys.map((key) => [key, en[key].message])))};\n\n` +
  `${declarations.join('\n\n')}${declarations.length > 0 ? '\n\n' : ''}` +
  `export const catalogs = {\n${catalogEntries.join('\n')}\n} as const;\n`;
await writeFile(new URL('../src/i18n/catalogs.ts', import.meta.url), output);
console.log(`catalogs.ts ${keys.length} keys, ${tags.length} locales`);
