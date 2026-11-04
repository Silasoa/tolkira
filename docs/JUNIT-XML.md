# JUnit XML (basic mode)

Tolkira accepts JUnit XML from any framework or CI system that can write it.
This is a **basic** input mode: suites, test cases, statuses, durations,
failures and `system-out`/`system-err`. It does not claim Gherkin steps,
screenshots, videos or traces.

## Usage

```shell
tolkira reports/junit.xml --out reports/report.html
tolkira reports/ --out reports/report.html
```

You can mix JUnit XML with Cucumber legacy JSON and Messages in one report:

```shell
tolkira reports/junit.xml reports/cucumber.json --out report.html
```

## Mapping

| JUnit XML | Report |
| --- | --- |
| `<testsuite name="...">` | feature; `name` falls back to `classname` or `JUnit suite N` |
| `<testcase name="...">` | scenario with one synthetic step |
| `<failure>` / `<error>` | failed; `message` and text become the step error |
| `<skipped>` | skipped |
| no status child | passed |
| `time="1.234"` | 1234 ms |
| `system-out` / `system-err` | `text/plain` attachments |
| `file` attribute | not used yet; the input file is the URI |

Suites and test cases are recomputed; `<testsuite tests="...">` totals are not
trusted.

## Example

```xml
<testsuites>
  <testsuite name="checkout">
    <testcase name="guest checkout" time="0.004"/>
    <testcase name="expired coupon" time="0.005">
      <failure message="Expected 200, got 500">AssertionError: Expected 200, got 500</failure>
      <system-out>request id: abc</system-out>
    </testcase>
  </testsuite>
</testsuites>
```

The report shows two scenarios, one failed, with the failure text and the
`system-out` attachment. There is no screenshot because JUnit XML does not carry
one.

## Limits

- No screenshots, videos, traces or arbitrary attachments.
- No Gherkin steps, doc strings or data tables.
- `system-out`/`system-err` are text only; HTML is escaped and never executed.
- JUnit XML dialects differ; v0.1 handles the common Jenkins/Gradle/Maven/
  pytest/Playwright shape and fails clearly otherwise.
- The existing 100 MB total input limit applies.

## Why a parser dependency

JUnit XML is XML, not JSON. A correct XML parser is not worth hand-rolling.
Tolkira uses `fast-xml-parser@^5.12.0` (MIT) and loads it only when an XML input
is present; Cucumber-only runs do not pay the import cost. Version 4.x has a
moderate XMLBuilder advisory, so the fixed 5.x line is used. `npm audit` stays
at zero.

The mode is intentionally separate from the Cucumber path: it is breadth, not
depth. A JUnit XML report is a test list with failures and timings, not a
Gherkin report.
