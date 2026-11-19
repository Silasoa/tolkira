import { AttachmentContentEncoding } from '@cucumber/messages';
import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT_BYTES } from '../src/attachment.js';
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

const MIB = 1024 * 1024;

// One large allocation per boundary family; the exact-50-MiB values are cheap
// derivations (a zero-copy slice for identity, a padding swap for base64). The
// arithmetic counts them without decoding.
const BASE64_BOUNDARY_LENGTH = Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4;
const BASE64_50_MIB_PLUS_ONE = 'A'.repeat(BASE64_BOUNDARY_LENGTH);
const BASE64_50_MIB = `${BASE64_50_MIB_PLUS_ONE.slice(0, -1)}=`;
const IDENTITY_50_MIB_PLUS_ONE = 'a'.repeat(50 * MIB + 1);
const IDENTITY_50_MIB = IDENTITY_50_MIB_PLUS_ONE.slice(0, -1);

function attachmentEnvelope(
  body: string,
  contentEncoding: AttachmentContentEncoding = AttachmentContentEncoding.IDENTITY,
): Envelope {
  return {
    attachment: {
      body,
      contentEncoding,
      fileName: 'cap.bin',
      mediaType: 'application/octet-stream',
    },
  };
}

function rejectionMessage(envelopes: Envelope[]): string {
  try {
    sanitizeEnvelopes(envelopes);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('attachment caps', () => {
  it('accepts a base64 attachment at exactly 50 MB', () => {
    expect(() =>
      sanitizeEnvelopes([
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
      ]),
    ).not.toThrow();
  });

  it('rejects a base64 attachment at 50 MB + 1 with the exact message', () => {
    expect(
      rejectionMessage([
        attachmentEnvelope(
          BASE64_50_MIB_PLUS_ONE,
          AttachmentContentEncoding.BASE64,
        ),
      ]),
    ).toBe('Attachment is larger than 50 MB. Use a smaller asset.');
  });

  it('accepts an identity attachment at exactly 50 MB', () => {
    expect(() => sanitizeEnvelopes([attachmentEnvelope(IDENTITY_50_MIB)])).not.toThrow();
  });

  it('rejects an identity attachment at 50 MB + 1 with the exact message', () => {
    expect(rejectionMessage([attachmentEnvelope(IDENTITY_50_MIB_PLUS_ONE)])).toBe(
      'Attachment is larger than 50 MB. Use a smaller asset.',
    );
  });

  it('accepts exactly 100 MB in total across attachments', () => {
    expect(() =>
      sanitizeEnvelopes([
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
      ]),
    ).not.toThrow();
  });

  it('rejects 100 MB + 1 in total with the exact message', () => {
    expect(
      rejectionMessage([
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
        attachmentEnvelope('a'),
      ]),
    ).toBe(
      'Attachments exceed 100 MB in total. Split the report or use smaller assets.',
    );
  });

  it('reports the per-attachment error when both caps are exceeded', () => {
    expect(
      rejectionMessage([
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
        attachmentEnvelope(BASE64_50_MIB, AttachmentContentEncoding.BASE64),
        attachmentEnvelope(
          BASE64_50_MIB_PLUS_ONE,
          AttachmentContentEncoding.BASE64,
        ),
      ]),
    ).toBe('Attachment is larger than 50 MB. Use a smaller asset.');
  });
});
