@feature-outline
Feature: Rules with outlines and backgrounds
  A feature background and a rule background wrap an outline.

  Background: Feature setup
    Feature background description.

  @rule-outline
  Rule: Outline rule
    Every row in this rule uses the shared setup.

    Background: Rule setup
      Rule background description.

    Scenario Outline: Eating cucumbers
      Given there are <start> cucumbers
      When I eat <eat> cucumbers
      Then I should have <left> cucumbers

      @passing
      Examples: These are passing
        | start | eat | left |
        |    12 |   5 |    7 |
        |    20 |   5 |   15 |

      @failing
      Examples: These are failing
        | start | eat | left |
        |    12 |  20 |    0 |
        |     0 |   1 |    0 |

  Scenario Outline: Eating cucumbers with <friends> friends
    Given there are <start> cucumbers
    When I eat <eat> cucumbers
    Then I should have <left> cucumbers

    Examples:
      | start | eat | left |
      |    12 |   5 |    7 |
      |    20 |   5 |   15 |
      |     0 |   1 |    0 |
