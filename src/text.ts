// Invisible direction overrides can spoof CI names, URLs and log text.
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

export function stripBidiControls(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}
