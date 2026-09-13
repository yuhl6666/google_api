import json

from app.main import run_task


def test_project_email_runs_through_the_full_loop_and_succeeds():
    email = (
        "Python/AWS案件です。リモート可。単価70〜80万円。"
        "9月開始。Python経験3年以上希望。"
    )

    task, routed_tool = run_task(email)

    assert task.tool == "案件登録"
    assert routed_tool == "project_register_tool"
    assert task.status == "success"
    assert task.retry_count == 0

    result = json.loads(task.output)
    assert result["message"] == "案件登録を受け付けました"
    assert result["project"] == {
        "skills": ["Python", "AWS"],
        "location": "リモート",
        "budget_min": 700_000,
        "budget_max": 800_000,
        "start_date": "2026-09",
        "experience_years": 3,
    }
