from app.tools import (
    get_current_time,
    get_sales_summary,
    search_jobs,
    match_engineers,
    register_project,
)


class ToolRegistry:
    def __init__(self):
        self.tools = {
            "current_time_tool": get_current_time,
            "sales_tool": get_sales_summary,
            "job_search_tool": search_jobs,
            "engineer_match_tool": match_engineers,
            "project_register_tool": register_project,
        }

    def get(self, tool_name: str):
        return self.tools.get(tool_name)