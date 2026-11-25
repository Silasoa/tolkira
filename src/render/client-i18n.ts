// Browser-side message formatting. No catalog enters this module; the report
// supplies the active locale's client.* strings and the document language.
export type ClientParams = Record<string, string | number>;

// One level of `{param}` is allowed inside a branch body; nested plurals are
// already forbidden by the catalog check.
/* oxlint-disable unicorn/prefer-string-replace-all, typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-conversion -- the embedded browser bundle is pinned to the report bytes */
const PLURAL =
  /\{([A-Za-z_]\w*), plural, ((?:[A-Za-z]+\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*)+)\}/g;
const BRANCH = /([A-Za-z]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
const PARAM = /\{([A-Za-z_]\w*)\}/g;

export interface ClientFormatter {
  lang: string;
  format(template: string, params?: ClientParams): string;
  number(value: number): string;
}

export function createClientFormatter(lang: string): ClientFormatter {
  const tag = lang || 'en';
  const english = (tag.split('-')[0] ?? tag).toLowerCase() === 'en';
  const format = english ? null : new Intl.NumberFormat(tag);
  const number = (value: number): string =>
    format ? format.format(value) : String(value);
  const rules = new Intl.PluralRules(tag);

  return {
    lang: tag,
    number,
    format(template, params = {}) {
      const withPlurals = template.replace(
        PLURAL,
        (_match, name: string, body: string) => {
          const numeric = Number(
            Object.hasOwn(params, name) ? params[name] : 0,
          );
          const value = Number.isFinite(numeric) ? numeric : 0;
          const branches: Record<string, string> = {};
          for (const branch of body.matchAll(BRANCH)) {
            branches[branch[1] as string] = branch[2] as string;
          }
          const selected =
            branches[rules.select(value)] ?? branches.other ?? '';
          return selected.replace(/#/g, number(value));
        },
      );
      return withPlurals.replace(PARAM, (_match, name: string) => {
        if (!Object.hasOwn(params, name)) return '';
        const value = params[name];
        return typeof value === 'number' ? number(value) : String(value ?? '');
      });
    },
  };
}
