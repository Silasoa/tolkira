# report-size-units

## Why

The Details Run panel explains report size with contributor rows. The input and
attachment rows use one-decimal MB at 1 MiB and above, but the report HTML row
always shows the exact byte count. At 11.8 MB it sits next to rows like
`11.8 MB` as `12345678 bytes`: correct, but it breaks the scan line and the
shared unit. That is backlog item B-041, deferred from `size-diagnostics` for
lack of a user trigger. No remote issue yet; B-041 is the local backlog item.
The user asked on 2026-11-22 to include it in 0.5 and to follow good UX rules.

The exact count is the promise of the size diagnostics, so it stays visible
rather than moving into a tooltip. The fix is unit consistency with the exact
value alongside.

## What Changes

- The report HTML row shows the exact locale-formatted byte count, followed by
  one-decimal MB in parentheses at 1 MiB and above; below 1 MiB it keeps the
  exact byte count alone, like its neighbours.
- The fixed point now solves on the byte count instead of the formatted text, so
  the leading value still equals the final document's UTF-8 byte length.
- No catalog key, CSS rule, generated asset, summary/CI/email/history field,
  dependency or schema change. Goldens do not change because every checked-in
  golden report is below 1 MiB.

## Impact

- Capability: `report-rendering`.
- Code: `src/render/format.ts` (one label helper) and
  `src/render/details.ts` (fixed-point loop).
- Tests: `test/size-diagnostics.test.ts` (including the 1 MiB boundary sweep)
  and a new case in `test/e2e/size-diagnostics.spec.ts`;
  `test/stream.test.ts` keeps its small report expectation.
- Docs: `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/DROP-IN-VALIDATION.md`, `docs/I18N.md`, `README.md`, `docs/BACKLOG.md`
  (B-041 closes) and the 0.5 scope research note.
