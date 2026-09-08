from app.task.schema import Task, TaskStatus
from app.tools.base import BaseTool
from app.tools.file_tool import FileTool

TOOL_REGISTRY: dict[str, BaseTool] = {
    "file_tool": FileTool(),
}


class Executor:
    def run(self, task: Task) -> Task:
        task.status = TaskStatus.RUNNING

        tool = TOOL_REGISTRY.get(task.tool)
        if tool is None:
            task.status = TaskStatus.ERROR
            task.error = f"Unknown tool: {task.tool}"
            return task

        result = tool.execute(task.action, task.input)

        if result.success:
            task.status = TaskStatus.SUCCESS
            task.output = result.output
        else:
            task.status = TaskStatus.ERROR
            task.error = result.error

        return task
