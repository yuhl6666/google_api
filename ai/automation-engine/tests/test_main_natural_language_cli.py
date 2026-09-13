import re
from unittest.mock import patch

from app.main import main


# --- `python -m app.main "<instruction>"` runs the same run_task() +
# _print_task_result() path as interactive mode, just skipping the input()
# prompt (spec: no separate implementation, existing paths unchanged).


def test_a_natural_language_argument_reaches_planner_through_tool_and_succeeds(capsys):
    with patch("sys.argv", ["app.main", "今の時刻を教えて"]), patch(
        "builtins.input", side_effect=AssertionError("should not prompt for input")
    ):
        main()

    output = capsys.readouterr().out

    assert "Tool: 現在時刻" in output
    assert "Routed: current_time_tool" in output
    assert "Status: success" in output
    assert re.search(r"Result: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", output)


def test_a_multi_word_unquoted_argument_is_joined_into_one_instruction(capsys):
    # Argparse-free join: `app.main Python 案件を探して` (three argv entries)
    # must behave the same as the single quoted string a shell would pass.
    with patch("sys.argv", ["app.main", "Python", "案件を探して"]), patch(
        "builtins.input", side_effect=AssertionError("should not prompt for input")
    ):
        main()

    output = capsys.readouterr().out

    assert "Task: Python 案件を探して" in output
    assert "Tool: 案件検索" in output
    assert "Status: success" in output


def test_gmail_intake_flag_still_takes_priority_over_being_treated_as_text(capsys):
    with patch("app.gmail_client.get_latest_email", return_value=None), patch(
        "sys.argv", ["app.main", "--gmail-intake"]
    ), patch("builtins.input", side_effect=AssertionError("should not prompt")):
        main()

    output = capsys.readouterr().out

    # Must still hit the Gmail intake path, not be planned as literal text.
    assert "[email] Status: success" in output
    assert "Tool: unknown" not in output
