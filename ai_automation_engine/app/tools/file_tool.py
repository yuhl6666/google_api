import time
from typing import Any

import pandas as pd

from app.tools.base import BaseTool, ToolResult


class FileTool(BaseTool):
    @property
    def name(self) -> str:
        return "file_tool"

    def execute(self, action: str, input_data: dict[str, Any]) -> ToolResult:
        if action != "read_csv":
            return ToolResult(
                success=False,
                error=f"Unsupported action: {action}",
                execution_time=0.0,
            )

        start = time.perf_counter()
        try:
            df = pd.read_csv(input_data["path"])
            records = df.to_dict(orient="records")
            return ToolResult(
                success=True,
                output=records,
                execution_time=time.perf_counter() - start,
            )
        except Exception as e:
            return ToolResult(
                success=False,
                error=str(e),
                execution_time=time.perf_counter() - start,
            )
