class AIRepair:
    """Deterministic tool/route correction — no LLM involved yet (spec: get
    a decisive Repair/Retry loop working before wiring any model into it).

    Only handles the one failure mode this MVP can meaningfully fix
    without more context: the Router couldn't map the Planner's tool label
    to anything ("unknown_tool"), so fall back to a generic tool instead
    of giving up immediately. Anything else (a known tool that ran but
    returned an error, e.g. a job id that doesn't exist) is left
    unchanged — retrying the same tool with the same parameters is the
    honest thing to do until a real repair strategy exists for that case.
    """

    FALLBACK_TOOL = "job_search_tool"

    def repair(self, tool_name: str) -> str:
        if tool_name == "unknown_tool":
            return self.FALLBACK_TOOL

        return tool_name
