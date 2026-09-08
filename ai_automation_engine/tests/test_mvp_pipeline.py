from app.executor.executor import Executor
from app.task.schema import Task, TaskStatus


def test_file_tool_read_csv_success(tmp_path):
    csv_path = tmp_path / "sample.csv"
    csv_path.write_text("name,age\nAlice,30\nBob,25\n")

    task = Task(
        task_id="t1",
        goal="Read a CSV file",
        tool="file_tool",
        action="read_csv",
        input={"path": str(csv_path)},
    )

    result = Executor().run(task)

    assert result.status == TaskStatus.SUCCESS
    assert result.error is None
    assert result.output == [
        {"name": "Alice", "age": 30},
        {"name": "Bob", "age": 25},
    ]


def test_executor_unknown_tool_returns_error_without_raising():
    task = Task(
        task_id="t2",
        goal="Use a tool that does not exist",
        tool="nonexistent_tool",
        action="read_csv",
        input={},
    )

    result = Executor().run(task)

    assert result.status == TaskStatus.ERROR
    assert result.error is not None
    assert result.output is None


def test_file_tool_unknown_action_returns_error_without_raising():
    task = Task(
        task_id="t3",
        goal="Use an unsupported action",
        tool="file_tool",
        action="write_csv",
        input={},
    )

    result = Executor().run(task)

    assert result.status == TaskStatus.ERROR
    assert result.error is not None
