Feature: Mixed statuses
  A passed, a failed and a blank scenario.

  Scenario: Passed scenario
    Given a passing step

  Scenario: Failed scenario
    Then the assertion fails

  Scenario: Blank unexecuted scenario
