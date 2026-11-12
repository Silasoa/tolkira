Feature: Markdown descriptions

  # Feature guide

  A **bold** and *italic* intro with `inline code`.

  ## Formats

  - first item
  - second item
    - nested item
  - ordered one
  - ordered two

  > quoted line
  > second line

  | Name | Value |
  | --- | ---: |
  | alpha | 1 |
  | beta | 2 |

  [HTTPS link](https://example.com/docs)
  [mail link](mailto:qa@example.com)

  **Background** description with `code`.

  Scenario: Plain and nested emphasis
    Plain text without formatting.

    Nested ***bold italic*** and **bold *italic*** and `code`.
    Given a passing step

  Scenario: Link policy
    [safe https](https://example.com/a)
    [javascript](javascript:alert(1))
    Given a passing step

  Scenario: Image policy
    ![inline remote](https://example.com/inline.png)
    ![reference image][ref-image]
    [![linked image](https://example.com/linked.png)](https://example.com/target)
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
