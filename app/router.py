class ToolRouter:
    def route(self, tool_name: str) -> str:
        tools = {
            "sales": "sales_tool",
            "案件検索": "job_search_tool",
            "現在時刻": "current_time_tool",
            "要員マッチング": "engineer_match_tool",
            "案件登録": "project_register_tool",
        }

        return tools.get(tool_name, "unknown_tool")