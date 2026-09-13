import base64
from unittest.mock import MagicMock, patch

import app.gmail_client as gmail_client
from app.gmail_client import (
    get_attachments,
    get_latest_email,
    get_message,
    list_messages,
    parse_message,
    search_messages,
)


def _b64(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return base64.urlsafe_b64encode(data).decode("ascii")


def _headers(from_: str, subject: str, date: str) -> list[dict[str, str]]:
    return [
        {"name": "From", "value": from_},
        {"name": "Subject", "value": subject},
        {"name": "Date", "value": date},
    ]


# --- authenticate: no real OAuth/network, everything mocked -------------


def test_authenticate_reuses_a_cached_valid_token_without_reauth(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    token_path.write_text("{}")
    monkeypatch.setattr(gmail_client, "TOKEN_PATH", str(token_path))

    cached_creds = MagicMock(valid=True)

    with patch("app.gmail_client.Credentials.from_authorized_user_file", return_value=cached_creds) as from_file, \
         patch("app.gmail_client.InstalledAppFlow.from_client_secrets_file") as flow_ctor:
        result = gmail_client.authenticate()

    from_file.assert_called_once()
    flow_ctor.assert_not_called()
    assert result is cached_creds


def test_authenticate_refreshes_an_expired_token_with_a_refresh_token(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    token_path.write_text("{}")
    monkeypatch.setattr(gmail_client, "TOKEN_PATH", str(token_path))

    expired_creds = MagicMock(valid=False, expired=True, refresh_token="r-token")
    expired_creds.to_json.return_value = "{}"

    with patch("app.gmail_client.Credentials.from_authorized_user_file", return_value=expired_creds), \
         patch("app.gmail_client.InstalledAppFlow.from_client_secrets_file") as flow_ctor:
        result = gmail_client.authenticate()

    expired_creds.refresh.assert_called_once()
    flow_ctor.assert_not_called()
    assert result is expired_creds


def test_authenticate_runs_the_oauth_consent_flow_when_no_token_is_cached(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    monkeypatch.setattr(gmail_client, "TOKEN_PATH", str(token_path))
    assert not token_path.exists()

    new_creds = MagicMock()
    new_creds.to_json.return_value = "{}"
    fake_flow = MagicMock()
    fake_flow.run_local_server.return_value = new_creds

    with patch("app.gmail_client.InstalledAppFlow.from_client_secrets_file", return_value=fake_flow) as flow_ctor:
        result = gmail_client.authenticate()

    flow_ctor.assert_called_once_with(gmail_client.CREDENTIALS_PATH, gmail_client.SCOPES)
    fake_flow.run_local_server.assert_called_once()
    assert result is new_creds
    assert token_path.exists()  # the new token was cached


# --- list_messages / get_message / search_messages: service is mocked ---


def test_list_messages_passes_max_results_and_omits_query_when_none():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "m1"}, {"id": "m2"}]
    }

    result = list_messages(fake_service, max_results=5)

    fake_service.users.return_value.messages.return_value.list.assert_called_once_with(
        userId="me", maxResults=5
    )
    assert result == [{"id": "m1"}, {"id": "m2"}]


def test_list_messages_passes_query_when_given():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {}

    list_messages(fake_service, max_results=10, query="件名:案件")

    fake_service.users.return_value.messages.return_value.list.assert_called_once_with(
        userId="me", maxResults=10, q="件名:案件"
    )


def test_list_messages_returns_empty_list_when_mailbox_has_nothing():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {}

    assert list_messages(fake_service) == []


def test_get_message_requests_full_format_for_the_given_id():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.get.return_value.execute.return_value = {
        "id": "msg-1"
    }

    result = get_message(fake_service, "msg-1")

    fake_service.users.return_value.messages.return_value.get.assert_called_once_with(
        userId="me", id="msg-1", format="full"
    )
    assert result == {"id": "msg-1"}


def test_search_messages_delegates_to_list_messages_with_the_query():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {
        "messages": [{"id": "m1"}]
    }

    result = search_messages(fake_service, "from:agency@example.com", max_results=20)

    fake_service.users.return_value.messages.return_value.list.assert_called_once_with(
        userId="me", maxResults=20, q="from:agency@example.com"
    )
    assert result == [{"id": "m1"}]


# --- get_attachments: service is mocked, no disk writes ------------------


def test_get_attachments_downloads_each_stored_attachment():
    message = {
        "id": "msg-1",
        "payload": {
            "mimeType": "multipart/mixed",
            "parts": [
                {"mimeType": "text/plain", "body": {"data": _b64("本文")}},
                {
                    "mimeType": "application/pdf",
                    "filename": "案件概要.pdf",
                    "body": {"attachmentId": "att-1"},
                },
            ],
        },
    }

    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.attachments.return_value.get.return_value.execute.return_value = {
        "data": _b64(b"%PDF-fake-bytes")
    }

    result = get_attachments(fake_service, message)

    assert result == [
        {
            "filename": "案件概要.pdf",
            "mime_type": "application/pdf",
            "attachment_id": "att-1",
            "data": b"%PDF-fake-bytes",
        }
    ]
    fake_service.users.return_value.messages.return_value.attachments.return_value.get.assert_called_once_with(
        userId="me", messageId="msg-1", id="att-1"
    )


def test_get_attachments_returns_empty_list_when_there_are_none():
    message = {
        "id": "msg-2",
        "payload": {
            "mimeType": "text/plain",
            "body": {"data": _b64("本文のみ")},
        },
    }
    fake_service = MagicMock()

    assert get_attachments(fake_service, message) == []
    fake_service.users.return_value.messages.return_value.attachments.assert_not_called()


def test_get_attachments_finds_attachments_nested_inside_sub_parts():
    message = {
        "id": "msg-3",
        "payload": {
            "mimeType": "multipart/mixed",
            "parts": [
                {
                    "mimeType": "multipart/alternative",
                    "parts": [
                        {"mimeType": "text/plain", "body": {"data": _b64("本文")}},
                    ],
                },
                {
                    "mimeType": "image/png",
                    "filename": "screenshot.png",
                    "body": {"attachmentId": "att-2"},
                },
            ],
        },
    }

    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.attachments.return_value.get.return_value.execute.return_value = {
        "data": _b64(b"\x89PNG-fake")
    }

    result = get_attachments(fake_service, message)

    assert len(result) == 1
    assert result[0]["filename"] == "screenshot.png"
    assert result[0]["data"] == b"\x89PNG-fake"


# --- parse_message: pure, no network (unchanged behavior) ----------------


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


def test_parse_message_falls_through_to_html_when_plain_is_a_view_in_browser_filler():
    message = {
        "id": "msg-002b",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers("sender@example.com", "案件のご紹介", "Tue, 2 Sep 2026 10:00:00 +0900"),
            "parts": [
                {
                    "mimeType": "text/plain",
                    "body": {"data": _b64(
                        "メールがうまく表示されない方はこちらをご覧ください\r\nhttps://example.com/view"
                    )},
                },
                {"mimeType": "text/html", "body": {"data": _b64("<p>Go/PHP案件です。単価100万円。</p>")}},
            ],
        },
    }

    result = parse_message(message)

    assert result["body"] == "Go/PHP案件です。単価100万円。"


def test_parse_message_uses_plain_fallback_text_when_no_html_alternative_exists():
    message = {
        "id": "msg-002c",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers("sender@example.com", "案件のご紹介", "Tue, 2 Sep 2026 10:00:00 +0900"),
            "parts": [
                {
                    "mimeType": "text/plain",
                    "body": {"data": _b64(
                        "メールがうまく表示されない方はこちらをご覧ください\r\nhttps://example.com/view"
                    )},
                },
            ],
        },
    }

    result = parse_message(message)

    assert "メールがうまく表示されない" in result["body"]


def test_parse_message_strips_style_and_script_block_contents_not_just_tags():
    message = {
        "id": "msg-003b",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers("sender@example.com", "HTML案件メール", "Wed, 3 Sep 2026 11:00:00 +0900"),
            "parts": [
                {
                    "mimeType": "text/html",
                    "body": {"data": _b64(
                        "<style>body{color:red}</style>"
                        "<script>track();</script>"
                        "<div><p>Java案件です。</p></div>"
                    )},
                },
            ],
        },
    }

    result = parse_message(message)

    assert result["body"] == "Java案件です。"


def test_parse_message_handles_nested_multipart():
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


# --- get_latest_email: full orchestration, everything mocked ------------


def test_get_latest_email_authenticates_lists_gets_and_parses():
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

    with patch("app.gmail_client.authenticate", return_value=MagicMock()), \
         patch("app.gmail_client.get_gmail_service", return_value=fake_service):
        result = get_latest_email()

    assert result["id"] == "msg-100"
    assert result["from"] == "client@example.com"
    assert result["subject"] == "案件のご相談"
    assert result["body"] == "Java案件、東京、単価65万円。"


def test_get_latest_email_returns_none_when_mailbox_is_empty():
    fake_service = MagicMock()
    fake_service.users.return_value.messages.return_value.list.return_value.execute.return_value = {}

    with patch("app.gmail_client.authenticate", return_value=MagicMock()), \
         patch("app.gmail_client.get_gmail_service", return_value=fake_service):
        result = get_latest_email()

    assert result is None
