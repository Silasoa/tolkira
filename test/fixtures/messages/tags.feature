@feature-tag
Feature: Tags in rules
  Feature, rule and scenario tags are inherited by pickles, but the report
  renders each tag once at its own section.

  @rule-tag
  Rule: tagged rule
    @scenario-tag
    Example: tagged scenario
      Given the customer has 100 cents
      And there are chocolate bars in stock
      When the customer tries to buy a 125 cent chocolate bar
      Then the sale should not happen

    Example: Enough money
      Given the customer has 100 cents
      And there are chocolate bars in stock
      When the customer tries to buy a 75 cent chocolate bar
      Then the sale should happen

  @some-tag
  Rule: a sale cannot happen if there is no stock
    Example: No chocolates left
      Given the customer has 100 cents
      And there are no chocolate bars in stock
      When the customer tries to buy a 1 cent chocolate bar
      Then the sale should not happen
