import json
from dataclasses import dataclass
from typing import Any


@dataclass
class EvaluationResult:
    success: bool
    output: Any = None
    error: str | None = None


class Evaluator:
    """Judges whether an Executor result counts as success or failure.

    Deliberately separate from ToolExecutor: the Executor's job is to run a
    tool and hand back whatever it returned, the Evaluator's job is to
    decide if that counts as success. Only knows the Executor's own result
    conventions ("Unknown tool", or a JSON string with an "error" key) —
    nothing tool-specific.
    """

    def evaluate(self, result: str | None) -> EvaluationResult:
        if result is None:
            return EvaluationResult(success=False, error="No result returned")

        if result == "Unknown tool":
            return EvaluationResult(success=False, error=result)

        json_error = self._extract_json_error(result)
        if json_error is not None:
            return EvaluationResult(success=False, error=json_error)

        return EvaluationResult(success=True, output=result)

    @staticmethod
    def _extract_json_error(result: str) -> str | None:
        try:
            parsed = json.loads(result)
        except (json.JSONDecodeError, TypeError):
            return None

        if isinstance(parsed, dict) and "error" in parsed:
            return str(parsed["error"])
        return None
