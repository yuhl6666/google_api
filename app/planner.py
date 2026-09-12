from dataclasses import dataclass, field
from typing import Any
import re


@dataclass
class Task:
    instruction: str
    tool: str
    parameters: dict[str, Any] = field(default_factory=dict)


class Planner:
    def plan(self, user_input: str) -> Task:
        if "売上" in user_input:
            return Task(
                instruction=user_input,
                tool="sales",
                parameters={},
            )

        if "時刻" in user_input or "時間" in user_input:
            return Task(
                instruction=user_input,
                tool="現在時刻",
                parameters={},
            )

        if "合う要員" in user_input or "要員を探して" in user_input:
            match = re.search(r"JOB\d+", user_input.upper())
            job_id = match.group(0) if match else ""

            return Task(
                instruction=user_input,
                tool="要員マッチング",
                parameters={
                    "job_id": job_id,
                },
            )

        if "案件" in user_input:
            keyword = ""

            for skill in ["Python", "Java", "AWS", "Spring", "PyTorch"]:
                if skill.lower() in user_input.lower():
                    keyword = skill
                    break

            return Task(
                instruction=user_input,
                tool="案件検索",
                parameters={
                    "keyword": keyword,
                },
            )

        return Task(
            instruction=user_input,
            tool="unknown",
            parameters={},
        )