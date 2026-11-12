# Design

## Context

See `proposal.md`. `package.json` is `"type": "module"` and exposes
`./compat/cucumber-html-reporter` only with an `import` condition. The shim's
`generate` is async. ADR 0002 made the package ESM-only; this change is a
narrow exception for the legacy shim.

## Goals / Non-Goals

**Goals:**

- `require('tolkira/compat/cucumber-html-reporter').generate(options)` works.
- Same behavior and errors as the ESM import.
- No default export; no CJS core.

**Non-Goals:**

- CJS root/CLI, changing option mapping, Seed-Test sidecar, dual build of the
  core.

## Decisions

### Thin `.cjs` wrapper

Ship `dist/compat/cucumber-html-reporter.cjs`:

```js
async function generate(options, callback) {
  const mod = await import('./cucumber-html-reporter.js');
  return mod.generate(options, callback);
}
module.exports = { generate };
```

The dynamic import resolves the ESM shim and forwards the optional callback;
no default export.

### Exports map

Add a `require` condition with `types` pointing at a `.d.cts` declaration:

```json
"./compat/cucumber-html-reporter": {
  "import": {
    "types": "./dist/compat/cucumber-html-reporter.d.ts",
    "default": "./dist/compat/cucumber-html-reporter.js"
  },
  "require": {
    "types": "./dist/compat/cucumber-html-reporter.d.cts",
    "default": "./dist/compat/cucumber-html-reporter.cjs"
  }
}
```

Do not put a top-level `types` on this subpath; it would win before the
`require` condition. Add a tracked `.cts` source so `tsc` emits the `.cjs` and
`.d.cts` build outputs; do not hand-write `dist`. The `.d.cts` declares
`generate(options, callback?)`.

### Tests

Add a test that spawns a real `.cjs` file with `require(...)` and awaits
`generate` on a legacy fixture, asserting the HTML and summary, including the
callback form. Add a root `require('tolkira')` failure test pinned to
`ERR_PACKAGE_PATH_NOT_EXPORTED`, and a `.cts` TypeScript fixture under
NodeNext. Because the fixture resolves the built package, run the build before
tests in `check` or test the packed tarball; assert the `.cjs`/`.d.cts` files
in `npm pack --dry-run`.

### Docs and ADR

Update `docs/COMPATIBILITY.md` (CJS example), `docs/CHANGELOG.md`, `README.md`
(the “cannot be required”/ESM-only claims and migration matrix), the Seed-Test
paragraph and ADR 0002: ESM core, async CJS wrapper only for the shim.

## Risks / Trade-offs

- **Wrapper drift** → keep it one line delegating to the ESM shim; no duplicated
  option mapping.
- **Types** → test with `tsc` in a CJS project or a `.cjs` fixture.
- **Expectations** → clearly state the core remains ESM-only.

## Migration Plan

No runtime dependency or CLI change. Existing ESM users are unaffected.

## Open Questions

None.
