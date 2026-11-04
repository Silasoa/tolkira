# Cucumber input compatibility

2026-11-04. "Tested" means a real producer output is checked in under
`test/fixtures/legacy/` and parsed and rendered by the legacy fixture tests
(`test/legacy-version.test.ts` for cucumber-js, `test/legacy-jvm.test.ts` for
cucumber-jvm). Each fixture is a two-scenario feature: one passes, one fails
with `Error: boom`.

## Legacy JSON

| Producer | Tested | Notes |
| --- | --- | --- |
| cucumber-js | 2.3.1, 3.2.1, 4.2.1, 5.1.0, 6.0.7, 7.3.2, 13.3.0 | The shape is stable enough. 2.x has no `type` on elements and uses absolute URIs; duration units vary below 6.0.5. |
| Behave | 1.3.3 real run (`behave-real.json`) | Duration is seconds and is normalised to milliseconds. A real run with attachments and doc strings is still outstanding; the synthetic `behave.json` covers those shapes. |
| cucumber-jvm | 7.22.1 real run | The legacy `json` formatter still ships in 7.x/8.x. The fixture covers `classpath:` URIs, nanosecond durations and a Java assertion. |
| cucumber-ruby | not yet | `json` formatter still ships; a real fixture is outstanding. |

## Messages

| Producer | Tested | Notes |
| --- | --- | --- |
| cucumber-js | 11.2.0 fixture | 7.0 introduced Messages; the fields Tolkira reads exist since Messages 15/16. |
| cucumber-jvm | not yet | `message` formatter since 7.x; a real fixture is outstanding. |
| cucumber-ruby | not yet | `message` formatter; a real fixture is outstanding. |
| Behave | not applicable | No Messages formatter. |

## Breaking changes that matter

- **3.2.1 (2017):** JSON mime-type revert; duration handling was still in flux.
- **4.0.0 (2018):** JSON duration reverted to nanoseconds;
  `defineSupportCode` deprecated.
- **6.0.0 (2019):** JSON formatter overhaul, reverted in 6.0.3; duration was
  femtoseconds in 6.0.0–6.0.4 and fixed to nanoseconds in 6.0.5.
- **7.0.0 (2020):** Messages introduced; the `json` formatter was deprecated
  but kept. It is still shipped in 13.3.0.
- **8.0–13.x:** Messages additions are additive for the fields Tolkira reads
  (`workerId`, `Hook.type`, `testRunStartedId`, test-run hooks, external
  attachments).
- **Behave 1.3.3:** JSON duration is in seconds, and features/elements carry
  `status` and `location` strings. The adapter detects that dialect and scales
  durations; Behave has no Messages formatter.
- **cucumber-jvm 7.22.1:** legacy JSON uses `classpath:` URIs, nanosecond
  durations and Java stack traces. The shape matches the Cucumber legacy
  dialect and needs no adapter change.

## What "best effort" means

- The adapter preserves scenarios, steps, statuses, errors, tags, doc strings,
  data tables and attachments for the tested shape.
- Duration accuracy is only claimed for the tested window (cucumber-js
  6.0.5–13.x). Older producers used different units; the shape still renders.
- A malformed file fails with a clear file/line message. It is never silently
  dropped, except through the compatibility shim's `ignoreBadJsonFile`.
- cucumber-js 1.x and earlier are not tested. The event-protocol era is best
  effort with no claim.

## Reproduce

```shell
npx vitest run test/legacy-version.test.ts
```

The fixtures are generated from a minimal feature with:

```gherkin
Feature: Old cucumber compatibility

  Scenario: passes
    Given a passing step

  Scenario: fails
    Given a failing step
```

The step definitions are one empty function and one that throws `Error: boom`.
The versions were installed in isolated temp projects; the checked-in JSON is
the producer output, not a hand-written approximation.
