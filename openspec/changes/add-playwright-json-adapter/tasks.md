# Tasks

## 1. Spec gate

- [ ] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
- [ ] 1.2 Confirm the change is linked to issue #4.

## 2. TDD-Red

- [ ] 2.1 Add detection-table cases for Playwright JSON, malformed JSON and
  non-misclassification of Cucumber legacy, Messages and JUnit.
- [ ] 2.2 Add a real Playwright JSON fixture covering two projects, nested
  describes, passed/failed/skipped/flaky, retries, inline and path
  attachments, tags, annotations and error context.
- [ ] 2.3 Add adapter tests for project mapping, final status, attempt, steps,
  errors, attachment safety, malformed shapes and merged inputs.
- [ ] 2.4 Confirm the new tests fail for the right reason before implementation.

## 3. Implement

- [ ] 3.1 Add the Playwright shape detector and loader dispatch.
- [ ] 3.2 Add the Playwright adapter with project/rule/scenario mapping,
  statuses, retries, steps, errors and safe attachments.
- [ ] 3.3 Set the Playwright producer metadata and generated IDs.
- [ ] 3.4 Keep existing Cucumber legacy, Messages and JUnit behavior green.

## 4. Docs

- [ ] 4.1 Update `docs/LIMITATIONS.md` with the native adapter and path
  containment limit.
- [ ] 4.2 Update `docs/COMPATIBILITY.md` and the README producer table.
- [ ] 4.3 Add `docs/PLAYWRIGHT-JSON.md` with the native JSON contract,
  detection, mapping and path-attachment limit.
- [ ] 4.4 Update `docs/AGENT-INTERFACE.md` current limits for the native
  Playwright input and the final-attempt behavior.
- [ ] 4.5 Add the Playwright JSON contract and detection rule to the input
  spec.

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, CMP, SEC.
- [ ] 5.3 Fix findings and record any deferred decision in `docs/BACKLOG.md`.
- [ ] 5.4 Commit and push with the issue and change reference.
