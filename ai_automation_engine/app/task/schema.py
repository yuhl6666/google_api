from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"


class Task(BaseModel):
    task_id: str
    goal: str
    tool: str
    action: str
    input: dict[str, Any]
    output: Optional[Any] = None
    status: TaskStatus = TaskStatus.PENDING
    error: Optional[str] = None
    retry_count: int = 0
