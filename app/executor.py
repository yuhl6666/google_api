from app.registry import ToolRegistry


class ToolExecutor:
    def __init__(self):
        self.registry = ToolRegistry()

    def execute(
        self,
        tool_name: str,
        instruction: str,
        parameters: dict | None = None,
    ) -> str:
        tool = self.registry.get(tool_name)

        if tool is None:
            return "Unknown tool"

        parameters = parameters or {}

        return tool(**parameters)