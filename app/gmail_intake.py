"""Chains the Gmail fetch Tool into a second Planner pass: the latest
email's body becomes the input to a fresh run_task() call, so a
project-posting email can reach 案件登録 without a human retyping it.

No changes to Planner/Router/Executor/Evaluator/Repair/main.py — this
just calls run_task() twice (already the public Engine entry point) and
threads the first Task's output into the second Task's input.
"""

import json

from app.main import run_task
from app.planner import Task


def run_gmail_project_intake() -> tuple[Task, str, Task | None, str | None]:
    """Fetches the latest email via the existing gmail_get_latest_email
    Tool, then plans/routes/executes a second Task from its body through
    the same run_task() loop (Repair/Retry included).

    Returns (email_task, email_routed_tool, project_task, project_routed_tool).
    The second pair is None when there was nothing to plan from — the
    fetch itself failed, or the mailbox was empty ({"email": null}, which
    is a successful email_task with no email to act on)."""
    email_task, email_routed_tool = run_task("最新のメールを取得して")

    if email_task.status != "success":
        return email_task, email_routed_tool, None, None

    email_payload = json.loads(email_task.output).get("email")
    if not email_payload:
        return email_task, email_routed_tool, None, None

    project_task, project_routed_tool = run_task(email_payload.get("body", ""))
    return email_task, email_routed_tool, project_task, project_routed_tool
