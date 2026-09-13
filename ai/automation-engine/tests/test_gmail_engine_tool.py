import json
from unittest.mock import patch

from app.main import run_task
from app.planner import Planner
from app.tools import get_latest_email


# --- Tool: app.tools.get_latest_email() wraps gmail_client, returns str ---


def test_tool_returns_email_as_json_when_a_message_exists():
    fake_email = {
        "id": "msg-1",
        "from": "agency@example.com",
        "subject": "Python案件のご紹介",
        "body": "単価70万円",
        "date": "Mon, 1 Sep 2026 09:00:00 +0900",
    }

    with patch("app.gmail_client.get_latest_email", return_value=fake_email):
        result = get_latest_email()

    assert json.loads(result) == {"email": fake_email}


def test_tool_succeeds_with_null_email_when_mailbox_is_empty():
    with patch("app.gmail_client.get_latest_email", return_value=None):
        result = get_latest_email()

    assert json.loads(result) == {"email": None}


# --- Planner: new keyword branch, no parameters -------------------------


def test_planner_routes_mail_fetch_phrases_to_the_gmail_task():
    for phrase in ["最新のメールを見せて", "メールを取得して"]:
        task = Planner().plan(phrase)
        assert task.tool == "メール取得"
        assert task.parameters == {}


# --- Engine integration: full loop, Gmail mocked, no real OAuth ----------


def test_gmail_tool_runs_through_the_full_execution_loop_and_succeeds():
    fake_email = {
        "id": "msg-2",
        "from": "agency@example.com",
        "subject": "Java案件のご紹介",
        "body": "単価65万円",
        "date": "Tue, 2 Sep 2026 10:00:00 +0900",
    }

    with patch("app.gmail_client.get_latest_email", return_value=fake_email):
        task, routed_tool = run_task("最新のメールを取得して")

    assert task.tool == "メール取得"
    assert routed_tool == "gmail_get_latest_email"
    assert task.status == "success"
    assert task.retry_count == 0
    assert json.loads(task.output) == {"email": fake_email}
