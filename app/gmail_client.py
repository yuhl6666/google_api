"""Gmail API client, decomposed into reusable operations (spec: no
Planner/Router/Executor connection yet — these are internal building
blocks for a future self-contained Gmail Tool, not Registry entries
themselves, since Executor only ever calls `tool(**parameters)` and a
`service`/`creds` object can never come from Task.parameters).

OAuth ("installed app" flow via google-auth-oauthlib):

  Gmail account -> OAuth consent (browser) -> access/refresh token -> Gmail API

Two files this depends on, neither committed to Git (see .gitignore):
  - credentials.json (CREDENTIALS_PATH): the OAuth client secret you
    download once from Google Cloud Console (APIs & Services ->
    Credentials -> OAuth client ID -> Desktop app).
  - token.json (TOKEN_PATH): the cached user token, created on first
    successful consent and silently refreshed after that. Delete it to
    force re-consent (e.g. if you change SCOPES).

Run `python -m app.gmail_client` for a manual, minimal-output check of
the whole chain against a real mailbox.
"""

import base64
import os
import re
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Read-only on purpose — this client never sends, deletes, or modifies mail.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

CREDENTIALS_PATH = os.environ.get("GMAIL_CREDENTIALS_PATH", "credentials.json")
TOKEN_PATH = os.environ.get("GMAIL_TOKEN_PATH", "token.json")

GMAIL_USER_ID = "me"


def authenticate() -> Credentials:
    """OAuth entry point: returns valid Credentials, refreshing or
    running the browser consent flow as needed, and caching the result
    to TOKEN_PATH (token.json) either way."""
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_PATH, "w", encoding="utf-8") as f:
            f.write(creds.to_json())

    return creds


def get_gmail_service(creds: Credentials):
    return build("gmail", "v1", credentials=creds)


def list_messages(service, max_results: int = 100, query: str | None = None) -> list[dict[str, Any]]:
    """Lists message id/threadId pairs (not full messages — call
    get_message() per id for details). No pagination beyond a single
    page (spec: large-scale pagination is out of scope this round)."""
    request = service.users().messages().list(
        userId=GMAIL_USER_ID,
        maxResults=max_results,
        **({"q": query} if query else {}),
    )
    results = request.execute()
    return results.get("messages", [])


def get_message(service, message_id: str) -> dict[str, Any]:
    return (
        service.users()
        .messages()
        .get(userId=GMAIL_USER_ID, id=message_id, format="full")
        .execute()
    )


def search_messages(service, query: str, max_results: int = 100) -> list[dict[str, Any]]:
    """Thin wrapper over list_messages() — same call, just always with a
    query, so Gmail search syntax (e.g. "from:agency@example.com") is the
    whole interface."""
    return list_messages(service, max_results=max_results, query=query)


def _decode_body_data(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded)


def get_attachments(service, message: dict[str, Any]) -> list[dict[str, Any]]:
    """Walks the message payload for parts that are stored attachments
    (a body.attachmentId with no inline data — that's how Gmail marks
    "fetch this separately") and downloads each via attachments.get().
    Returns [] if there are none. Doesn't write anything to disk."""
    message_id = message.get("id")
    payload = message.get("payload", {})

    attachments = []
    stack = list(payload.get("parts") or [])

    while stack:
        part = stack.pop()
        stack.extend(part.get("parts") or [])

        attachment_id = part.get("body", {}).get("attachmentId")
        filename = part.get("filename")
        if not attachment_id or not filename:
            continue

        attachment = (
            service.users()
            .messages()
            .attachments()
            .get(userId=GMAIL_USER_ID, messageId=message_id, id=attachment_id)
            .execute()
        )

        attachments.append(
            {
                "filename": filename,
                "mime_type": part.get("mimeType"),
                "attachment_id": attachment_id,
                "data": _decode_body_data(attachment["data"]),
            }
        )

    return attachments


def _get_header(headers: list[dict[str, str]], name: str) -> str | None:
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value")
    return None


def _decode_body_text(data: str) -> str:
    return _decode_body_data(data).decode("utf-8", errors="replace")


def _strip_html(html: str) -> str:
    # Deliberately minimal — not a real HTML parser (spec: no advanced
    # HTML parsing this round). Good enough to get readable text out of a
    # text/html-only email. <style>/<script> blocks are dropped whole
    # first (not just their tags) so their contents — CSS rules, JS —
    # don't leak into the "text" as noise.
    text = re.sub(r"(?is)<(style|script)\b[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# Phrases ASPs commonly send as the text/plain part of a multipart/alternative
# mail whose real content is only in text/html ("view this in your browser"
# filler) — not real message content, so a part matching one of these should
# be treated as if it were absent rather than returned as the body.
_PLAIN_FALLBACK_PATTERNS = (
    "メールがうまく表示されない",
    "正しく表示されない場合",
    "うまく表示されない場合",
)


def _is_plain_fallback(text: str) -> bool:
    return any(pattern in text for pattern in _PLAIN_FALLBACK_PATTERNS)


def _extract_body(payload: dict[str, Any]) -> str:
    """Walks a Gmail message payload for a body, preferring text/plain.
    Handles the common shapes: a plain single-part message, a
    multipart/alternative with both text/plain and text/html parts, and
    one level of nesting (e.g. multipart/alternative inside
    multipart/mixed, which is what a plain-text-or-HTML email with an
    attachment looks like).

    A text/plain part that is only a known "view in browser" filler (see
    _PLAIN_FALLBACK_PATTERNS) is treated as if absent, so the text/html
    alternative's real content is used instead — but kept as a
    last-resort return in case no html turns up anywhere."""
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data")

    plain_fallback = None

    if body_data and mime_type == "text/plain":
        text = _decode_body_text(body_data)
        if _is_plain_fallback(text):
            plain_fallback = text
        else:
            return text

    parts = payload.get("parts") or []

    for part in parts:
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            text = _decode_body_text(part["body"]["data"])
            if _is_plain_fallback(text):
                plain_fallback = plain_fallback or text
            else:
                return text

    for part in parts:
        if part.get("parts"):
            nested = _extract_body(part)
            if nested:
                return nested

    for part in parts:
        if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
            return _strip_html(_decode_body_text(part["body"]["data"]))

    if body_data and mime_type == "text/html":
        return _strip_html(_decode_body_text(body_data))

    if plain_fallback is not None:
        return plain_fallback

    if body_data:
        return _decode_body_text(body_data)

    return ""


def parse_message(message: dict[str, Any]) -> dict[str, Any]:
    """Turns a raw Gmail API `messages.get` response into the structured
    shape the next step (Planner) will consume. Pure function, no
    network — this is what gets unit-tested without a real mailbox."""
    payload = message.get("payload", {})
    headers = payload.get("headers", [])

    return {
        "id": message.get("id"),
        "from": _get_header(headers, "From"),
        "subject": _get_header(headers, "Subject"),
        "body": _extract_body(payload),
        "date": _get_header(headers, "Date"),
    }


def get_latest_email() -> dict[str, Any] | None:
    """Fetches the single most recent message in the mailbox, structured
    via parse_message(). No search query/filtering — "give me the
    newest message" is the whole scope this round."""
    creds = authenticate()
    service = get_gmail_service(creds)

    messages = list_messages(service, max_results=1)
    if not messages:
        return None

    message = get_message(service, messages[0]["id"])
    return parse_message(message)


if __name__ == "__main__":
    # Manual confirmation entry point: `python -m app.gmail_client`.
    # Prints only what's needed to confirm the fields came through —
    # body is truncated so a long real email doesn't dump its full
    # contents into a terminal/log.
    email = get_latest_email()
    if email is None:
        print("No messages found.")
    else:
        body_preview = email["body"][:100] + ("..." if len(email["body"]) > 100 else "")
        print(f"id:      {email['id']}")
        print(f"from:    {email['from']}")
        print(f"subject: {email['subject']}")
        print(f"date:    {email['date']}")
        print(f"body:    {body_preview!r}")
