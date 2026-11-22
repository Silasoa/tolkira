# Spec Delta

## ADDED Requirements

### Requirement: Split JUnit suites by nested class

When a JUnit `<testsuite>` has a nested-class shape — at least two distinct
non-empty `classname` values plus either a classname containing `$` or one
classname being a dotted outer prefix of another — the report SHALL split the
suite into one feature per classname, using the classname as the feature name
with no suite prefix, and SHALL preserve every testcase, status, duration and
the source file. Testcases without a classname SHALL stay in a suite-named
feature. Any other multi-classname suite, including a producer template such as
`"{classname} {title}"`, SHALL keep the current suite feature. A suite with one
classname SHALL keep its current feature.

#### Scenario: Nested Surefire classes

- **WHEN** one testsuite has `classname="Outer"` and `classname="Outer$Nested"`
- **THEN** the report shows two features named exactly `Outer` and `Outer$Nested`
- **AND** all testcases and statuses are preserved
- **AND** the source file is unchanged

#### Scenario: Classname template

- **WHEN** a jest-junit suite has distinct classnames such as
  `checkout.guest guest checkout` and `checkout.guest expired coupon`
- **THEN** the suite remains one feature
- **AND** each testcase remains a scenario, not a feature

#### Scenario: One class

- **WHEN** every testcase in a suite shares one classname
- **THEN** the suite remains one feature with its current name

#### Scenario: Mixed class and unclassed cases

- **WHEN** a nested-class suite also has testcases without a classname
- **THEN** the classes become their own features and the unclassed testcases
  stay in a suite-named feature

### Requirement: Keep legacy hook output

A legacy JSON `before` or `after` hook with a non-null string or string-array
`output` SHALL produce a `text/plain` attachment on that hook, with a stable
readable name and the output joined by newlines. Hook entries in the
`before`/`after` arrays and inline hook steps in `steps` follow the same rule.
The existing hook attachment renderer SHALL show it beside the hook; the
attachment count follows the existing attachment semantics. `output: null`, an
empty string and an empty array count as absent, and output on a non-hook step is
ignored. No schema or dependency changes. This is an improvement over
cucumber-html-reporter 7.2.0, which ignores hook output; it is not a parity
claim. The `\n` array join is unit-tested with a synthetic two-line output; the
real 8.1.0 host capture is single-line.

#### Scenario: JVM hook output

- **WHEN** a `before` hook carries `output: ["Runs before @foo"]`
- **THEN** the hook shows a text attachment with that line
- **AND** the hook status/name and the report are unchanged

#### Scenario: No output

- **WHEN** a hook has no `output`, `output: null`, an empty string or an empty
  array
- **THEN** no extra hook attachment is created
