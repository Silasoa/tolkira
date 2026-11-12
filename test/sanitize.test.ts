import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { sanitizeEnvelopes } from '../src/input/sanitize.js';

function finishedStep(status: string, duration: unknown = { seconds: 0, nanos: 1 }) {
  return {
    testStepFinished: {
      testCaseStartedId: 'started-1',
      testStepId: 'step-1',
      testStepResult: { status, duration },
      timestamp: { seconds: 1, nanos: 0 },
    },
  };
}

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

  it('keeps reference definitions while stripping angle-bracket remote images', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          name: 'Reference image feature',
          description:
            'A ![pixel][ref] and ![angle](<https://tolkira-probe.invalid/x.png>)\n\n[ref]: https://tolkira-probe.invalid/x.png',
          elements: [],
        },
      ]),
      'reference.json',
    );

    const description = sanitizeEnvelopes(envelopes).find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument?.feature?.description;

    expect(description).toContain(
      '[ref]: https://tolkira-probe.invalid/x.png',
    );
    expect(description).toContain('![pixel][ref]');
    expect(description).toContain('![angle]()');
    expect(description).not.toContain('<https://tolkira-probe.invalid/x.png>');
  });

  it('rejects unknown and missing step statuses', () => {
    expect(() =>
      parseMessages(
        JSON.stringify(finishedStep('BANANA')),
        'banana.ndjson',
      ),
    ).toThrow('known Cucumber status');

    expect(() =>
      parseMessages(
        JSON.stringify(finishedStep(undefined as unknown as string)),
        'missing.ndjson',
      ),
    ).toThrow('known Cucumber status');
  });

  it('rejects a missing duration', () => {
    expect(() =>
      parseMessages(
        JSON.stringify(finishedStep('PASSED', {})),
        'duration.ndjson',
      ),
    ).toThrow('duration');
  });
});
