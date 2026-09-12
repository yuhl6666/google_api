import json
import re

from app.main import run_task


# --- existing正常系 (spec item 7): must keep working unchanged -----------


def test_current_time_succeeds():
    task, routed_tool = run_task("今の時刻を教えて")

    assert task.status == "success"
    assert task.retry_count == 0
    assert routed_tool == "current_time_tool"
    assert re.match(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", task.output)


def test_job_search_succeeds():
    task, routed_tool = run_task("Python案件を探して")

    assert task.status == "success"
    assert task.retry_count == 0
    assert routed_tool == "job_search_tool"
    jobs = json.loads(task.output)
    assert any(job["id"] == "JOB001" for job in jobs)


def test_engineer_match_succeeds():
    task, routed_tool = run_task("JOB001に合う要員を探して")

    assert task.status == "success"
    assert task.retry_count == 0
    assert routed_tool == "engineer_match_tool"
    candidates = json.loads(task.output)
    assert candidates[0]["engineer_id"] == "ENG001"


# --- Executor success -> Evaluator success (spec item 8, bullet 1) -------


def test_evaluator_reports_success_for_a_working_tool():
    task, _ = run_task("今の時刻を教えて")
    assert task.status == "success"
    assert task.error is None


# --- Executor failure -> Repair -> Retry succeeds (spec item 8, bullet 2) -


def test_unrouted_input_is_repaired_and_retried_successfully():
    # No keyword matches -> Planner falls back to tool="unknown" -> Router
    # can't map it -> "unknown_tool" -> Executor fails -> Repair falls back
    # to job_search_tool -> retry succeeds.
    task, routed_tool = run_task("こんにちは")

    assert task.status == "success"
    assert task.retry_count == 1
    assert routed_tool == "job_search_tool"


# --- Retry cap: repair can't fix everything, so it must stop at 1 --------


def test_retry_stops_at_the_cap_when_repair_cannot_fix_the_error():
    # A valid, registered tool (engineer_match_tool) that fails on its own
    # merits (unknown job id) — repair has no rule for this, so it retries
    # once with the same tool/params, fails again, and gives up.
    task, routed_tool = run_task("JOB999に合う要員を探して")

    assert task.status == "error"
    assert task.retry_count == 1
    assert routed_tool == "engineer_match_tool"
    assert "JOB999" in task.error
