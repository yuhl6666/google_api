import json
from datetime import datetime

from app import gmail_client


def get_current_time() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_sales_summary() -> str:
    return "売上ツールは準備中です"


def get_latest_email() -> str:
    # gmail_client.get_latest_email() already does everything (OAuth,
    # service, list+get+parse) and returns a dict/None — this just turns
    # that into the str every registered Tool must return. "No mail" is
    # not an error (same convention as e.g. an empty match_engineers
    # result): it's a normal, successful outcome with a null payload.
    email = gmail_client.get_latest_email()
    return json.dumps({"email": email}, ensure_ascii=False)


def register_project(
    skills: list | None = None,
    location: str | None = None,
    budget_min: int | None = None,
    budget_max: int | None = None,
    start_date: str | None = None,
    experience_years: int | None = None,
) -> str:
    # No DB yet (spec: not this round) — just accept the structured data
    # Planner already extracted and echo it back, shaped so a later DB
    # write can take this "project" dict as-is.
    project = {
        "skills": skills or [],
        "location": location,
        "budget_min": budget_min,
        "budget_max": budget_max,
        "start_date": start_date,
        "experience_years": experience_years,
    }

    return json.dumps(
        {
            "message": "案件登録を受け付けました",
            "project": project,
        },
        ensure_ascii=False,
    )


def search_jobs(keyword: str = "") -> str:
    with open("data/jobs.json", "r", encoding="utf-8") as f:
        jobs = json.load(f)

    keyword = keyword.strip().lower()

    if not keyword:
        return json.dumps(jobs, ensure_ascii=False)

    results = []

    for job in jobs:
        text = json.dumps(job, ensure_ascii=False).lower()

        if keyword in text:
            results.append(job)

    return json.dumps(results, ensure_ascii=False)


def match_engineers(job_id: str) -> str:
    with open("data/jobs.json", "r", encoding="utf-8") as f:
        jobs = json.load(f)

    with open("data/engineers.json", "r", encoding="utf-8") as f:
        engineers = json.load(f)

    job = next((job for job in jobs if job["id"] == job_id), None)

    if job is None:
        return json.dumps(
            {"error": f"Job not found: {job_id}"},
            ensure_ascii=False,
        )

    required_skills = {
        skill.lower()
        for skill in job["skills"]
    }

    results = []

    for engineer in engineers:
        if not engineer["available"]:
            continue

        engineer_skills = {
            skill.lower()
            for skill in engineer["skills"]
        }

        matched_skills = required_skills & engineer_skills

        if not matched_skills:
            continue

        skill_score = (
            len(matched_skills) / len(required_skills)
            if required_skills
            else 0
        )

        budget_score = (
            1.0
            if engineer["rate"] <= job["budget"]
            else 0.0
        )

        location_score = (
            1.0
            if engineer["location"].lower()
            == job["location"].lower()
            else 0.0
        )

        total_score = (
            skill_score * 0.6
            + budget_score * 0.25
            + location_score * 0.15
        )

        results.append(
            {
                "engineer_id": engineer["id"],
                "name": engineer["name"],
                "matched_skills": sorted(matched_skills),
                "skill_score": round(skill_score, 2),
                "budget_score": round(budget_score, 2),
                "location_score": round(location_score, 2),
                "total_score": round(total_score, 2),
                "location": engineer["location"],
                "rate": engineer["rate"],
                "job_budget": job["budget"],
            }
        )

    results.sort(
        key=lambda engineer: engineer["total_score"],
        reverse=True,
    )

    return json.dumps(results, ensure_ascii=False)