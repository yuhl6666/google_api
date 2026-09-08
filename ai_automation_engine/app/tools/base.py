from abc import ABC, abstractmethod
from typing import Any, Optional

from pydantic import BaseModel


class ToolResult(BaseModel):
    success: bool
    output: Optional[Any] = None
    error: Optional[str] = None
    execution_time: float


class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    def execute(self, action: str, input_data: dict[str, Any]) -> ToolResult:
        ...
