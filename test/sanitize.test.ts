import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { sanitizeEnvelopes } from '../src/input/sanitize.js';

describe('input sanitisation', () => {
  it('rejects remote attachment URLs', () => {
    const envelopes = parseMessages(
      JSON.stringify({
        attachment: {
          url: 'https://tolkira-probe.invalid/pixel.png',
          mediaType: 'image/png',
        },
      }),
      'remote.ndjson',
    );

    expect(() => sanitizeEnvelopes(envelopes)).toThrow(
      'Remote attachment URLs are not supported',
    );
  });

  it('rejects external attachments', () => {
    const envelopes = parseMessages(
      JSON.stringify({
        externalAttachment: {
          url: 'https://tolkira-probe.invalid/pixel.png',
          mediaType: 'image/png',
        },
      }),
      'external.ndjson',
    );

    expect(() => sanitizeEnvelopes(envelopes)).toThrow(
      'External attachments are not supported',
    );
  });

  it('strips remote Markdown images from descriptions', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          name: 'Remote image feature',
          description: 'Before ![pixel](https://tolkira-probe.invalid/pixel.png) after',
          elements: [],
        },
      ]),
      'remote.json',
    );

    const sanitized = sanitizeEnvelopes(envelopes);
    const description = sanitized.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument?.feature?.description;

    expect(description).toContain('pixel');
    expect(description).not.toContain('tolkira-probe.invalid');
  });
});
