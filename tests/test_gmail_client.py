import base64
from unittest.mock import MagicMock, patch

from app.gmail_client import get_latest_email, parse_message


def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii")


def _headers(from_: str, subject: str, date: str) -> list[dict[str, str]]:
    return [
        {"name": "From", "value": from_},
        {"name": "Subject", "value": subject},
        {"name": "Date", "value": date},
    ]


# --- parse_message: pure, no network -------------------------------------


def test_parse_message_single_part_plain_text():
    message = {
        "id": "msg-001",
        "payload": {
            "mimeType": "text/plain",
            "headers": _headers(
                "sender@example.com", "Python/AWS案件のご紹介", "Mon, 1 Sep 2026 09:00:00 +0900"
            ),
            "body": {"data": _b64("Python/AWS案件です。単価70万円。")},
        },
    }

    result = parse_message(message)

    assert result == {
        "id": "msg-001",
        "from": "sender@example.com",
        "subject": "Python/AWS案件のご紹介",
        "body": "Python/AWS案件です。単価70万円。",
        "date": "Mon, 1 Sep 2026 09:00:00 +0900",
    }


def test_parse_message_multipart_prefers_text_plain_over_html():
    message = {
        "id": "msg-002",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers("sender@example.com", "案件のご紹介", "Tue, 2 Sep 2026 10:00:00 +0900"),
            "parts": [
                {"mimeType": "text/html", "body": {"data": _b64("<p>HTML本文</p>")}},
                {"mimeType": "text/plain", "body": {"data": _b64("プレーンテキスト本文")}},
            ],
        },
    }

    result = parse_message(message)

    assert result["body"] == "プレーンテキスト本文"


def test_parse_message_html_only_falls_back_to_stripped_text():
    message = {
        "id": "msg-003",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers("sender@example.com", "HTML案件メール", "Wed, 3 Sep 2026 11:00:00 +0900"),
            "parts": [
                {"mimeType": "text/html", "body": {"data": _b64("<div><p>Java案件です。</p></div>")}},
            ],
        },
    }

    result = parse_message(message)

    assert "Java案件です。" in result["body"]
    assert "<" not in result["body"]


def test_parse_message_handles_nested_multipart():
    # multipart/mixed (has an attachment) wrapping a multipart/alternative
    message = {
        "id": "msg-004",
        "payload": {
            "mimeType": "multipart/mixed",
            "headers": _headers("sender@example.com", "添付付き案件メール", "Thu, 4 Sep 2026 12:00:00 +0900"),
            "parts": [
                {
                    "mimeType": "multipart/alternative",
                    "parts": [
                        {"mimeType": "text/plain", "body": {"data": _b64("ネストされた本文")}},
                    ],
                },
                {"mimeType": "application/pdf", "body": {"attachmentId": "abc"}},
            ],
        },
    }

    result = parse_message(message)

    assert result["body"] == "ネストされた本文"


def test_parse_message_missing_headers_are_none_not_guessed():
    message = {
        "id": "msg-005",
        "payload": {
            "mimeType": "text/plain",
            "headers": [],
            "body": {"data": _b64("本文のみ")},
        },
    }

    result = parse_message(message)

    assert result["from"] is None
    assert result["subject"] is None
    assert result["date"] is None
    assert result["body"] == "本文のみ"


# --- get_latest_email: orchestration, Gmail service mocked ---------------


def test_get_latest_email_lists_then_gets_and_parses():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "msg-100"}]
    }
    fake_service.users.return_value.messages.return_value.get.return_value.execute.return_value = {
        "id": "msg-100",
        "payload": {
            "mimeType": "text/plain",
            "headers": _headers("client@example.com", "案件のご相談", "Fri, 5 Sep 2026 13:00:00 +0900"),
            "body": {"data": _b64("Java案件、東京、単価65万円。")},
        },
    }

    with patch("app.gmail_client._get_gmail_service", return_value=fake_service):
        result = get_latest_email()

    assert result["id"] == "msg-100"
    assert result["from"] == "client@example.com"
    assert result["subject"] == "案件のご相談"
    assert result["body"] == "Java案件、東京、単価65万円。"


def test_get_latest_email_returns_none_when_mailbox_is_empty():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {}

    with patch("app.gmail_client._get_gmail_service", return_value=fake_service):
        result = get_latest_email()

    assert result is None
