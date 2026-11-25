import { stripBidiControls } from '../text.js';

export function escapeHtml(
  value: string | number | boolean | null | undefined,
): string {
  return stripBidiControls(String(value ?? '')).replaceAll(
    /[&<>"']/g,
    (character) => {
      switch (character) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return character;
      }
    },
  );
}
