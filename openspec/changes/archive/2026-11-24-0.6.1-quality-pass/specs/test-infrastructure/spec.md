# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the characterization baseline

The committed render characterization hashes and golden HTML files SHALL stay
unchanged unless a change intentionally changes rendered output. Such a change
SHALL record every re-pinned hash and file and the inspected reason for its
diff: a shell re-pin names the exact markup and CSS delta, a content re-pin
names the output rule that corrected the result. The baseline is the current
nine characterization hashes and the two golden HTML files. A
checkout-line-ending mismatch SHALL still be diagnosed instead of re-recorded.

#### Scenario: Intentional re-pin

- **WHEN** a change intentionally changes rendered output
- **THEN** every changed hash and golden file is re-pinned in the same change
- **AND** the change record names the diff and the rule that caused it
- **AND** an unchanged fixture keeps its old hash

#### Scenario: Characterization unchanged

- **WHEN** a change does not intentionally change rendered output
- **THEN** the nine committed characterization hashes and both golden HTML files
  are unchanged
- **AND** `git diff` shows no change in the hash list or
  `test/fixtures/render-golden/*.html`

#### Scenario: Checkout line endings

- **WHEN** the hashes fail in a fresh checkout
- **THEN** a CRLF checkout is diagnosed with `git ls-files --eol` and
  `core.autocrlf`
- **AND** the hashes are never re-recorded to hide the mismatch

**Reason**: The base requirement freezes the 0.6.0 hashes and goldens, but
0.6.1 intentionally changes the default shell (B-048/B-039) and removes a false
1970 run date (audit 6), and the later hardening change removes an invented
legacy run date.

**Migration**: The re-pin is allowed only with the named diff and reason in the
change record; the scenario `Intentional re-pin` carries the replacement
guarantee.
