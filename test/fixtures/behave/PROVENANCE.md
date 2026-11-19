# Behave producer fixture provenance

`behave-real-attachments.json` is a recorded Behave 1.3.3 JSON report. It is a
verbatim copy of the producer output, not a hand-written approximation.

| Field | Value |
| --- | --- |
| Producer | Behave 1.3.3 |
| Python | 3.11.18 |
| Container | `python:3.11` |
| Image digest | `sha256:55c475496e35ad8d898659c85f92b42d3b1c58f25f5d79023baf0840b0b4a462` |
| Docker | 29.9.2 |
| Recorded | 2026-11-19 |
| Format | `json.pretty` |
| Basis | recorded real run |

The run covers three scenarios:

- a passing scenario with a multiline doc string, a data table and an inline
  PNG attachment;
- a scenario whose step raises `ValueError`, recorded with `status: "error"`;
- a scenario whose assertion carries a two-line message, recorded with
  `status: "failed"` and a line-array `error_message`.

The `behave` process exits non-zero because the feature contains deliberate
failures. The JSON is still complete and non-empty. The container wrapper
command exits 0 because it ends with the successful copy; check the JSON, not
the wrapper exit code.

## Reproduce

From this directory, write to a container-local temp file first so a failed
import cannot truncate the checked-in evidence:

```shell
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 \
  -v "${PWD}:/work" -w /work python:3.11 bash -lc '
    pip install -q behave==1.3.3 &&
    behave -f json.pretty -o /tmp/behave-real-attachments.json;
    test -s /tmp/behave-real-attachments.json &&
    cp /tmp/behave-real-attachments.json /work/behave-real-attachments.json'
```

PowerShell uses the same command with `-v "${PWD}:/work"`. Do not install
Behave on the host. `PYTHONDONTWRITEBYTECODE=1` prevents `__pycache__` from
appearing in the fixture; if a tool still creates it, delete
`features/steps/__pycache__` before committing.

The producer tests run with:

```shell
npx vitest run test/behave-producers.test.ts
```

## Public-safe scan

The recorded JSON, feature, step definitions and PNG were checked for absolute
host paths, home-directory paths, tokens, credentials and URLs. The JSON keeps
only relative `features/...` paths; the image is a generated 32x16 PNG with no
textual metadata. No private value was found. The only public link related to
this work is the tracking issue in the repository docs.

The generated JSON contains run-specific durations and step-definition line
numbers. It must be regenerated, not edited, when the producer shape changes.
