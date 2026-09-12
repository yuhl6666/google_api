from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
import re

# Known skill/location vocabularies, shared with the existing 案件検索
# keyword matching below — deliberately the same small, explicit lists
# rather than any NLP/LLM guessing (spec: rule-based only, for now).
KNOWN_SKILLS = ["Python", "Java", "AWS", "Spring", "PyTorch"]
KNOWN_LOCATIONS = ["リモート", "東京", "大阪", "名古屋", "福岡"]


def _extract_skills(text: str) -> list[str]:
    lowered = text.lower()
    found = [
        (lowered.index(skill.lower()), skill)
        for skill in KNOWN_SKILLS
        if skill.lower() in lowered
    ]
    found.sort(key=lambda pair: pair[0])
    return [skill for _, skill in found]


def _extract_location(text: str) -> str | None:
    for location in KNOWN_LOCATIONS:
        if location in text:
            return location
    return None


def _extract_budget(text: str) -> tuple[int | None, int | None]:
    range_match = re.search(r"(\d+)\s*[〜~～\-]\s*(\d+)\s*万円", text)
    if range_match:
        low, high = int(range_match.group(1)), int(range_match.group(2))
        return low * 10_000, high * 10_000

    single_match = re.search(r"(\d+)\s*万円", text)
    if single_match:
        value = int(single_match.group(1)) * 10_000
        return value, value

    return None, None


def _extract_start_date(text: str, today: datetime | None = None) -> str | None:
    match = re.search(r"(\d{1,2})\s*月開始", text)
    if not match:
        return None

    month = int(match.group(1))
    if not 1 <= month <= 12:
        return None

    now = today or datetime.now()
    # No year is ever written in these postings ("9月開始"), so infer the
    # nearest upcoming occurrence: this year if that month hasn't passed
    # yet, otherwise next year.
    year = now.year if month >= now.month else now.year + 1
    return f"{year}-{month:02d}"


def _extract_experience_years(text: str) -> int | None:
    match = re.search(r"経験\s*(\d+)\s*年", text)
    return int(match.group(1)) if match else None


@dataclass
class Task:
    instruction: str
    tool: str
    parameters: dict[str, Any] = field(default_factory=dict)
    status: str = "pending"
    output: Any = None
    error: str | None = None
    retry_count: int = 0


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

        if "案件" in user_input and ("単価" in user_input or "万円" in user_input):
            # A job-posting email (has rate info), not a search query like
            # "Python案件を探して" — those never mention 単価/万円.
            budget_min, budget_max = _extract_budget(user_input)

            return Task(
                instruction=user_input,
                tool="案件登録",
                parameters={
                    "skills": _extract_skills(user_input),
                    "location": _extract_location(user_input),
                    "budget_min": budget_min,
                    "budget_max": budget_max,
                    "start_date": _extract_start_date(user_input),
                    "experience_years": _extract_experience_years(user_input),
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