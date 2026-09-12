from app.evaluator import Evaluator
from app.executor import ToolExecutor
from app.planner import Planner, Task
from app.recommender import Recommender
from app.repair import AIRepair
from app.router import ToolRouter

MAX_RETRY = 1


def run_task(user_input: str) -> tuple[Task, str]:
    """User -> Planner -> Task -> Router -> Executor -> Evaluator ->
    (Success -> Result) | (Error -> Repair -> Retry(max 1) -> Result).

    Returns the Task (status/output/error/retry_count filled in) plus the
    tool name it actually finished on, so callers can act on the result
    (e.g. only invoke the Recommender for an engineer-match result)
    without re-deriving routing themselves.
    """
    planner = Planner()
    router = ToolRouter()
    executor = ToolExecutor()
    evaluator = Evaluator()
    repair = AIRepair()

    task = planner.plan(user_input)
    task.status = "running"

    routed_tool = router.route(task.tool)
    result = executor.execute(routed_tool, task.instruction, task.parameters)
    evaluation = evaluator.evaluate(result)

    while not evaluation.success and task.retry_count < MAX_RETRY:
        task.retry_count += 1
        routed_tool = repair.repair(routed_tool)
        result = executor.execute(routed_tool, task.instruction, task.parameters)
        evaluation = evaluator.evaluate(result)

    if evaluation.success:
        task.status = "success"
        task.output = evaluation.output
    else:
        task.status = "error"
        task.error = evaluation.error

    return task, routed_tool


def main():
    user_input = input("User: ")
    task, routed_tool = run_task(user_input)

    print(f"Task: {task.instruction}")
    print(f"Tool: {task.tool}")
    print(f"Parameters: {task.parameters}")
    print(f"Routed: {routed_tool}")
    print(f"Status: {task.status}")
    print(f"Retry count: {task.retry_count}")
    print(f"Result: {task.output if task.status == 'success' else task.error}")

    if task.status == "success" and routed_tool == "engineer_match_tool":
        recommender = Recommender()
        explanation = recommender.explain(task.output)

        print(f"Recommendation: {explanation}")


if __name__ == "__main__":
    main()
