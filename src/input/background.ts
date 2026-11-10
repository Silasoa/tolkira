import type { Background } from '@cucumber/messages';

const synthetic = new WeakSet<Background>();

/** Marks the Background node legacy normalisation invents for step resolution. */
export function markSyntheticBackground(background: Background): void {
  synthetic.add(background);
}

export function isSyntheticBackground(background: Background): boolean {
  return synthetic.has(background);
}
