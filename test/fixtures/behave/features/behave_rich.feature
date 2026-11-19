Feature: Behave producer verification
  As a maintainer
  I want a real Behave report
  So that Tolkira is verified against the producer

  Scenario: Doc string, data table and screenshot
    Given a doc string argument
      """
      first line
      second line
      """
    And a data table argument
      | name  | value |
      | alpha | 1     |
      | beta  | 2     |
    When a screenshot is attached
    Then the scenario passes

  Scenario: Unexpected step error
    Given a broken step

  Scenario: Failed assertion with a multiline message
    Given a failing assertion
