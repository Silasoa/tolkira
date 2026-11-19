from pathlib import Path

from behave import given, then, when


@given("a doc string argument")
def step_doc_string(context):
    assert context.text == "first line\nsecond line"


@given("a data table argument")
def step_data_table(context):
    assert list(context.table.headings) == ["name", "value"]
    assert [list(row) for row in context.table.rows] == [
        ["alpha", "1"],
        ["beta", "2"],
    ]


@when("a screenshot is attached")
def step_screenshot(context):
    image = Path(__file__).parent.parent / "attachments" / "sample.png"
    context.attach("image/png", image.read_bytes())


@then("the scenario passes")
def step_passes(context):
    assert True


@given("a broken step")
def step_broken(context):
    raise ValueError("broken")


@given("a failing assertion")
def step_failing_assertion(context):
    assert False, "first line\nsecond line"
