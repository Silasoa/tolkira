import { describe, expect, it } from 'vitest';
import { phase, version } from '../src/index.js';

describe('scaffold', () => {
  it('exposes the package phase and version', () => {
    expect(phase).toBe('specification');
    expect(version).toBe('0.0.0');
  });
});
