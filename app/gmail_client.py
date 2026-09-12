"""Minimal Gmail API client (spec: fetch one email and return it as
structured data — no Planner/Router/Executor connection yet, that's the
next step; no project-email filtering yet either).

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


def _get_credentials() -> Credentials:
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


def _get_gmail_service():
    creds = _get_credentials()
    return build("gmail", "v1", credentials=creds)


def _get_header(headers: list[dict[str, str]], name: str) -> str | None:
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value")
    return None


def _decode_body_data(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _strip_html(html: str) -> str:
    # Deliberately minimal — not a real HTML parser (spec: no advanced
    # HTML parsing this round). Good enough to get readable text out of a
    # text/html-only email.
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def _extract_body(payload: dict[str, Any]) -> str:
    """Walks a Gmail message payload for a body, preferring text/plain.
    Handles the common shapes: a plain single-part message, a
    multipart/alternative with both text/plain and text/html parts, and
    one level of nesting (e.g. multipart/alternative inside
    multipart/mixed, which is what a plain-text-or-HTML email with an
    attachment looks like)."""
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data")

    if body_data and mime_type == "text/plain":
        return _decode_body_data(body_data)

    parts = payload.get("parts") or []

    for part in parts:
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            return _decode_body_data(part["body"]["data"])

    for part in parts:
        if part.get("parts"):
            nested = _extract_body(part)
            if nested:
                return nested

    for part in parts:
        if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
            return _strip_html(_decode_body_data(part["body"]["data"]))

    if body_data and mime_type == "text/html":
        return _strip_html(_decode_body_data(body_data))

    if body_data:
        return _decode_body_data(body_data)

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
    """Fetches the single most recent message in the mailbox. No search
    query/filtering yet — "give me the newest message" is the whole
    scope this round."""
    service = _get_gmail_service()

    listing = service.users().messages().list(userId="me", maxResults=1).execute()
    messages = listing.get("messages", [])
    if not messages:
        return None

    message = (
        service.users()
        .messages()
        .get(userId="me", id=messages[0]["id"], format="full")
        .execute()
    )
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
