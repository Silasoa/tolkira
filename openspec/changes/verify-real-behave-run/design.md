# Design

## Context

Tolkira normalises legacy Cucumber JSON into Messages and uses one renderer
(ADR-0004). The existing Behave coverage has two fixtures: a synthetic
`behave.json` for expected shapes and a small real `behave-real.json` with a
passing and a failing assertion. Neither contains a real multiline doc string,
data table, attachment, multiline error message or failed `error` status. The
synthetic fixture therefore cannot catch a producer encoding difference.

A real Behave 1.3.3 run in `python:3.11` produced all of those shapes and
exposed three differences from the synthetic fixtures:

- a multiline doc string is written as `"text": ["line one", "line two"]`,
  while `LegacyStep.text` only allowed a string. The value reached the report
  model unchanged and `renderHtml` crashed with
  `(value ?? "").replace is not a function`;
- a multiline assertion message is written as
  `"error_message": ["ASSERT FAILED: first line", "second line"]`, with the same
  crash path in `result-message.ts`;
- a step that raises a non-assertion exception is written as
  `"status": "error"`; a failing step hook is written as `"hook_error"`.
  `cleanup_error` is recorded on the scenario/feature when context cleanup
  fails, not on a step result. `LEGACY_STATUSES` did not contain `error` or
  `hook_error`, so the whole file was rejected before rendering.

Behave's JSON formatter adds `error_message` only for `failed`, not for
`error` or `hook_error` step results. The adapter therefore cannot show a
message for those statuses; the report must still render the failed step.

## Data flow

```
producer project (feature + steps + png)
  -> behave 1.3.3 --format json.pretty
  -> recorded JSON fixture
  -> legacy detector (element status / string location)
  -> parseLegacyJson
       text / error_message arrays -> normalizeText -> DocString / TestStepResult
       status error|hook_error (cleanup_error defensively) -> FAILED
       embeddings -> base64 attachment
  -> Cucumber Messages envelopes
  -> summary model and single-file HTML
```

The input detector, loader, summary schema and renderer do not change.

## Adapter changes

`LegacyStep.text` and `LegacyResult.error_message` become
`string | string[]`. `stepArgument` and `resultOf` call the existing
`normalizeText` helper, so an array becomes newline-joined text and a string
keeps its current value. `mapPickleArgument` receives the normalised doc string
through the same path.

`validateStep` rejects a `text` or `error_message` that is neither a string nor
an array of strings, with the existing file-naming `Invalid legacy JSON`
error. The validation happens before rendering, so a malformed file cannot
produce a partial report.

`LEGACY_STATUSES` gains `error`, `hook_error` and `cleanup_error`, and
`statusOf` maps all three to `TestStepResultStatus.FAILED`. In Behave 1.3.3,
`error` and `hook_error` are step-result statuses; `cleanup_error` is recorded
on the scenario/feature during context cleanup and is accepted defensively if a
producer writes it in a step result. Scenario and feature status fields remain
informational; step results still drive the model, as for every other legacy
input. Dry-run/WIP statuses (`untested`, `untested_pending`,
`untested_undefined`, `pending_warn`) and `xfailed`/`xpassed` stay out of the
accepted vocabulary and are documented as unsupported. A failing
scenario-level hook produces no step result; that gap is documented rather than
guessed from the element status.

The change is deliberately narrow: no Behave-specific branch in the renderer,
no new producer detection and no status guessing. The failed statuses are
accepted because a crashed step must not make the report unreadable.

## Fixture

All Behave producer material lives in one directory:

```
test/fixtures/behave/
  PROVENANCE.md
  behave-real-attachments.json
  features/behave_rich.feature
  features/steps/steps.py
  features/attachments/sample.png
```

The feature has three scenarios:

1. a passing scenario with a multiline doc string, a data table and a PNG
   attachment;
2. a scenario whose step raises `ValueError`, producing Behave's `error`
   status;
3. a scenario whose assertion carries a two-line message, producing a `failed`
   status with a line-array `error_message`.

The second and third scenarios make the `behave` process exit non-zero by
design, while still writing the JSON. The container wrapper command exits 0
because it ends with the successful copy; check the JSON, not the wrapper exit
code. The image is a small deterministic PNG generated for the fixture; it
contains no screenshot of a real screen, private data or browser chrome.

The recorded JSON is copied unchanged: Behave already writes relative
`features/...` paths, so no sanitisation is needed. The fixture is regenerated,
not hand-edited, if the producer shape changes.

`test/fixtures.ts` gets a `behaveProducerFixture` helper alongside the existing
`legacyFixture`/`playwrightFixture` helpers. The fixture tests live in
`test/behave-producers.test.ts` and run with
`npx vitest run test/behave-producers.test.ts`.

## Reproduce

From `test/fixtures/behave/`, write to a container-local temp path first so a
failed import cannot truncate the checked-in evidence:

```shell
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$PWD:/work" -w /work python:3.11 bash -lc '
    pip install -q behave==1.3.3 &&
    behave -f json.pretty -o /tmp/behave-real-attachments.json;
    test -s /tmp/behave-real-attachments.json &&
    cp /tmp/behave-real-attachments.json /work/behave-real-attachments.json'
```

PowerShell mounts the same directory with `-v "${PWD}:/work"`. The run leaves
no `__pycache__` in the fixture because bytecode writing is disabled; if a
tool ignores the variable, delete `features/steps/__pycache__` before commit.

The `behave` process returns non-zero because the feature contains deliberate
failures; the JSON file must still exist and be non-empty, and the wrapper
command exits 0 after the successful copy. Do not install Behave on the host;
the container is the documented toolchain. Provenance records Python 3.11.18,
Behave 1.3.3, the date, the exact command, the recorded `python:3.11` image
digest `sha256:55c475496e35ad8d898659c85f92b42d3b1c58f25f5d79023baf0840b0b4a462`
and the expected non-zero `behave` exit.

## Verification

`test/behave-producers.test.ts` covers:

- raw fixture shape: `text` and `error_message` are arrays, the error step has
  `status: "error"`, the embedding has `mime_type: "image/png"`;
- public safety: the recorded JSON, feature, step definitions, provenance and
  image bytes contain no absolute host path, home directory, URL or `file:`
  path;
- adapter values: newline-joined doc string, table headings and rows,
  attachment media type, decoded bytes equal to `sample.png`, a pinned
  screenshot-step duration and non-zero milliseconds;
- summary: one passed and two failed scenarios, one attachment with the
  derived byte count, run status failed;
- report: the exact doc-string and data-table markup, both multiline
  error-message lines, a `data:` image `<img>` and the failed error scenario.

`test/legacy.test.ts` covers the synthetic edge cases: string-valued `text`
unchanged, number/object/mixed-array `text` and `error_message` shapes rejected
with a clear error, `hook_error` and `cleanup_error` mapped to failed with a
failed run, unsupported dry-run/WIP and xfail statuses rejected, and line-array
doc strings and error messages containing HTML-like text escaped in the report.

Existing fixtures stay as regression coverage. The synthetic `behave.json` is
hand-shaped and has no element `status`/string `location`, so it is not used as
proof of Behave detection; the real fixture is.

## Docs

- `docs/LIMITATIONS.md`: update the Behave row and date; state the real-run
  cover, the missing error text and the unsupported dry-run/WIP and
  scenario-hook gaps.
- `docs/CUCUMBER-COMPATIBILITY.md`: update the header date and fixture
  definition, the Behave row, the breaking-change note and the reproduce
  command.
- `README.md`: update the producer table, the limitations date and remove the
  "remaining real-run gap" wording.
- `docs/COMPARISON.md`, `docs/ARCHITECTURE.md`, `docs/AGENT-INTERFACE.md` and
  `docs/research/open-questions.md`: remove stale Behave claims; correct the
  agent-interface statement that Behave durations are nanoseconds.
- `docs/CHANGELOG.md`: add the fixture and adapter fixes under Unreleased.
- `docs/BACKLOG.md`: mark B-012 resolved.

## Risks and limits

- Behave's `error` and `hook_error` step results carry no error text in JSON.
  The report shows the failed status and no message; this is a producer limit,
  recorded in the docs. `cleanup_error` is not a Behave step-result status and
  is accepted defensively only.
- The real run is one feature and three scenarios, not a full Behave status or
  hook matrix. Dry-run/WIP and xfail modes remain unsupported and documented.
- A failing scenario-level hook can leave the element failed without a failed
  step result; the adapter does not invent one. Documented as a limitation.
- Behave is external to the repo and is not part of the gate. The recorded
  fixture is the durable test input; provenance makes regeneration possible.

## Alternatives considered

- **Keep the synthetic fixture only.** No new code, but it cannot prove that
  the shapes are real and already hid all three adapter gaps.
- **Run Behave on the host.** Rejected by the fixture toolchain policy; the
  container keeps the host clean and records the toolchain.
- **Hand-edit the JSON to use string doc strings and error messages.**
  Rejected: it would erase the producer difference the verification is meant
  to catch.
- **Map `error` to skipped, as the old reporter did.** The legacy
  cucumber-html-reporter counts unknown statuses as skipped, which hides a
  crashed step. Cucumber Messages has no `error`/`broken` status; mapping to
  failed is the honest user-facing choice.
- **Reconstruct failing hook statuses from the element status.** The element
  status is informational and can be `failed` without a step result; inventing
  a synthetic step would misstate what the producer recorded. Documented
  instead.
