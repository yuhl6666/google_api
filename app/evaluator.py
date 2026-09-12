from app.tools import get_current_time


class ToolExecutor:
    def execute(self, tool_name: str, instruction: str) -> str:
        if tool_name == "current_time_tool":
            return get_current_time()

        if tool_name == "sales_tool":
            return f"売上確認を実行しました: {instruction}"

        if tool_name == "job_search_tool":
            return f"案件検索を実行しました: {instruction}"

        return "Unknown tool"