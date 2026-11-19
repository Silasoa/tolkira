import { readFile } from 'node:fs/promises';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { messagesFixture } from './fixtures.js';
import { renderMessagesFile } from './render-helpers.js';

const hooksFixture = messagesFixture('hooks.ndjson');
const globalHooksFixture = messagesFixture('global-hooks.ndjson');
const globalHookAttachments = messagesFixture('global-hooks-attachments.ndjson');

describe('hooks rendering', () => {
  it('renders per-scenario hooks separately from steps', async () => {
    const html = await renderMessagesFile(hooksFixture);

    expect(html).toContain('class="hookGroup"');
    expect(html).toContain('class="hook"');
    expect(html).not.toContain('data-run-hooks');
    expect(html).toContain('Steps (excl. hooks)');
    expect(html).toContain('<dt>Hooks</dt>');
  });

  it('renders test-run hooks below the feature list', async () => {
    const html = await renderMessagesFile(globalHooksFixture);

    expect(html).toContain('data-run-hooks');
    expect(html).toContain('BeforeAll');
    expect(html).toContain('AfterAll');
    expect(html.indexOf('data-run-hooks')).toBeGreaterThan(
      html.indexOf('id="feature-list"'),
    );
  });

  it('renders run-hook attachments in the Hooks section', async () => {
    const html = await renderMessagesFile(globalHookAttachments);

    expect(html).toContain('data-run-hooks');
    expect(html).toContain('class="attachmentText"');
    expect(html).toContain('Attachment from BeforeAll hook');
  });

  it('uses a failed hook for triage when no step failed', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture);
    const pickle = envelopes.find(
      (envelope) => envelope.pickle?.name === 'No tags and a passed step',
    )?.pickle;
    expect(pickle).toBeDefined();
    if (!pickle) return;
    const testCase = envelopes.find(
      (envelope) => envelope.testCase?.pickleId === pickle.id,
    )?.testCase;
    const started = envelopes.find(
      (envelope) => envelope.testCaseStarted?.testCaseId === testCase?.id,
    )?.testCaseStarted;
    const hookStep = testCase?.testSteps.find((step) => step.hookId);
    expect(started).toBeDefined();
    expect(hookStep).toBeDefined();
    if (!started || !hookStep) return;
    const result = envelopes.find(
      (envelope) =>
        envelope.testStepFinished?.testCaseStartedId === started.id &&
        envelope.testStepFinished.testStepId === hookStep.id,
    )?.testStepFinished;
    expect(result).toBeDefined();
    if (!result) return;
    result.testStepResult.status = TestStepResultStatus.FAILED;
    result.testStepResult.message = 'hook boom';

    const html = await renderHtml(envelopes, { title: 'Hook failure' });
    expect(html).toContain('class="hook" data-status="failed"');
    expect(html).toContain('hook boom');
    expect(html).toContain('data-copy-failure');
    expect(html).toContain('Before — hook boom');
  });

  it('renders a hook without Hook metadata with a generic label', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture).filter(
      (envelope) => !envelope.hook,
    );
    const html = await renderHtml(envelopes, { title: 'Generic hooks' });
    expect(html).toContain('class="hook"');
    expect(html).toContain('class="hookLabel">Hook');
  });

  it('renders a named hook with its type and name', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture);
    const hook = envelopes.find((envelope) => envelope.hook)?.hook;
    expect(hook).toBeDefined();
    if (!hook) return;
    hook.name = 'seed database';

    const html = await renderHtml(envelopes, { title: 'Named hooks' });
    expect(html).toContain('Before: seed database');
    expect(html).toContain('seed database');
  });

  it('escapes hook names and messages', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture);
    const hook = envelopes.find((envelope) => envelope.hook)?.hook;
    expect(hook).toBeDefined();
    if (!hook) return;
    hook.name = '<script>alert(1)</script>';

    const html = await renderHtml(envelopes, { title: 'Escaped hooks' });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
