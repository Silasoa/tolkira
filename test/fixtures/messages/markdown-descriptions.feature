# Authoritative input: markdown-descriptions.ndjson. This file illustrates the
# same cases; the NDJSON is authoritative where the two differ.
Feature: Markdown descriptions

  # Feature guide

  A **bold** and *italic* intro with `inline code`.

  ## Formats

  - first item
  - second item
    - nested item

  1. ordered one
  2. ordered two

  > quoted line
  > second line

  | Name | Value |
  | --- | ---: |
  | alpha | 1 |
  | beta | 2 |

  [HTTPS link](https://example.com/docs)
  [http link](http://example.com/plain)
  [mail link](mailto:qa@example.com)

  <script>alert('feature')</script>
  <img src="https://example.com/raw.png" onerror="alert(2)">

  Background: Setup data
    **Background** description with `code`.

  Scenario: Plain and nested emphasis
    Plain text without formatting.

    Nested ***bold italic*** and **bold *italic*** and `code`.
    Given a passing step

  Scenario: Link policy
    [safe https](https://example.com/a)
    [safe http](http://example.com/b)
    [safe mail](mailto:qa@example.com)
    [relative](./docs/readme.md)
    [javascript](javascript:alert(1))
    [data](data:text/html,<b>x</b>)
    [file](file:///etc/passwd)
    Given a passing step

  Scenario: Image policy
    ![inline remote](https://example.com/inline.png)
    ![inline local](./shots/local.png)
    ![data image](data:image/png;base64,iVBORw0KGgo=)
    ![reference image][ref-image]
    [![linked image](https://example.com/linked.png)](https://example.com/target)
    ![angle image](<https://example.com/angle.png>)

    [ref-image]: https://example.com/reference.png
    Given a passing step

  Scenario: Malformed markdown
    **unclosed bold and [unclosed link( and `unclosed code

    | broken | table
    | ---
    | cell
    Given a passing step

  Scenario: Empty description
    Given a passing step

  Rule: Rule markdown
    > Rule quote with **bold** and a [rule link](https://example.com/rule).

    Scenario: Rule scenario
      Rule scenario plain description.
      Given a passing step

  Scenario Outline: Outline <n>
    ## Outline description

    - item one
    - item two
    Given value <n>

    Examples: Rows
      | n |
      | - |
      | 1 |
