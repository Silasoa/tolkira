import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';
import { junitFixture } from './fixtures.js';

describe('JUnit producer fixtures', () => {
  it('maps jest-junit suites, statuses and suite output tolerance', async () => {
    const file = junitFixture('jest-junit.xml');
    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.features).toBe(1);
    expect(summary.counts.scenarios).toMatchObject({
      total: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
    });
    expect(summary.scenarios[0]?.feature).toBe('checkout');
    expect(byName.get('expired coupon')?.status).toBe('failed');
    expect(byName.get('expired coupon')?.steps[0]?.message).toContain(
      'Expected 200, got 500',
    );
    expect(byName.get('expired coupon')?.attachments).toBe(0);
    expect(byName.get('slow payment')?.status).toBe('skipped');
    // Suite-level output is a documented limitation: it is not attached.
    expect(summary.attachments.total).toBe(0);

    const html = await renderReport(file, { title: 'Jest' });
    expect(html).not.toContain('checkout request id: req-42');
  });

  it('maps pytest properties, failure text and testcase output', async () => {
    const file = junitFixture('pytest.xml');
    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.features).toBe(1);
    expect(summary.counts.scenarios).toMatchObject({
      total: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
    });
    expect(summary.scenarios[0]?.feature).toBe('pytest');
    expect(byName.get('test_expired_coupon')?.steps[0]?.message).toContain(
      'assert 500 == 200',
    );
    expect(byName.get('test_slow_payment')?.status).toBe('skipped');
    expect(byName.get('test_expired_coupon')?.attachments).toBe(2);
    expect(summary.attachments.total).toBe(2);

    const html = await renderReport(file, { title: 'pytest' });
    expect(html).toContain('request id req-42');
    expect(html).toContain('coupon warning');
  });

  it('maps a root Gradle testsuite with error, failure and skipped cases', async () => {
    const file = junitFixture('gradle.xml');
    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.features).toBe(1);
    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      passed: 1,
      failed: 2,
      skipped: 1,
    });
    expect(summary.scenarios[0]?.feature).toBe('com.example.CheckoutTest');
    expect(byName.get('expiredCoupon()')?.steps[0]?.message).toContain(
      'expected: <200> but was: <500>',
    );
    expect(byName.get('brokenSetup()')?.steps[0]?.message).toContain(
      'IllegalStateException: no database',
    );
    expect(byName.get('slowPayment()')?.status).toBe('skipped');
    expect(summary.attachments.total).toBe(0);

    const html = await renderReport(file, { title: 'Gradle' });
    expect(html).toContain('com.example.CheckoutTest');
  });

  it('records producer provenance for every fixture', async () => {
    for (const [name, producer] of [
      ['jest-junit.xml', 'jest-junit'],
      ['pytest.xml', 'pytest'],
      ['gradle.xml', 'Gradle'],
    ] as const) {
      const content = await readFile(junitFixture(name), 'utf8');
      expect(content).toContain('Provenance:');
      expect(content).toContain(producer);
      expect(content).toContain('2026-11-12');
      expect(content).toContain('not a recorded CI run');
    }

    const provenance = await readFile(junitFixture('PROVENANCE.md'), 'utf8');
    expect(provenance).toContain('synthetic');
    expect(provenance).toContain('jest-junit');
    expect(provenance).toContain('pytest');
    expect(provenance).toContain('Gradle');
  });
});
