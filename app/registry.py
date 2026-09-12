from app.tools import (
    get_current_time,
    search_jobs,
    match_engineers,
)


class ToolRegistry:
    def __init__(self):
        self.tools = {
            "current_time_tool": get_current_time,
            "job_search_tool": search_jobs,
            "engineer_match_tool": match_engineers,
        }

    def get(self, tool_name: str):
        return self.tools.get(tool_name)