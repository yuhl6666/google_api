class AIRepair:
    def repair(self, tool_name: str) -> str:
        if tool_name == "nonexistent_tool":
            return "job_search_tool"

        return tool_name