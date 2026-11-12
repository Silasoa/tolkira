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
async function generate(options) {
  const mod = await import('./cucumber-html-reporter.js');
  return mod.generate(options);
}
module.exports = { generate };
```

The dynamic import resolves the ESM shim; no default export.

### Exports map

Add a `require` condition with `types` pointing at a `.d.cts` declaration:

```json
"./compat/cucumber-html-reporter": {
  "types": "./dist/compat/cucumber-html-reporter.d.ts",
  "import": "./dist/compat/cucumber-html-reporter.js",
  "require": "./dist/compat/cucumber-html-reporter.cjs"
}
```

TypeScript CJS consumers get a `.d.cts` (or `require` types) declaring
`generate(options): Promise<...>`. The build copies/creates the wrapper.

### Tests

Add a test that spawns a real `.cjs` file with `require(...)` and awaits
`generate` on a legacy fixture, asserting the HTML and summary. Add a root
`require('tolkira')` failure test. Test errors reject.

### Docs and ADR

Update `docs/COMPATIBILITY.md` (CJS example), `docs/CHANGELOG.md` and ADR 0002:
ESM core, CJS wrapper only for the shim.

## Risks / Trade-offs

- **Wrapper drift** → keep it one line delegating to the ESM shim; no duplicated
  option mapping.
- **Types** → test with `tsc` in a CJS project or a `.cjs` fixture.
- **Expectations** → clearly state the core remains ESM-only.

## Migration Plan

No runtime dependency or CLI change. Existing ESM users are unaffected.

## Open Questions

None.
