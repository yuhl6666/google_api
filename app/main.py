from app.planner import Planner
from app.router import ToolRouter
from app.executor import ToolExecutor
from app.recommender import Recommender


def main():
    user_input = input("User: ")

    planner = Planner()
    task = planner.plan(user_input)

    router = ToolRouter()
    routed_tool = router.route(task.tool)

    executor = ToolExecutor()
    result = executor.execute(
        routed_tool,
        task.instruction,
        task.parameters,
    )

    print(f"Task: {task.instruction}")
    print(f"Tool: {task.tool}")
    print(f"Parameters: {task.parameters}")
    print(f"Routed: {routed_tool}")
    print(f"Result: {result}")

    if routed_tool == "engineer_match_tool":
        recommender = Recommender()
        explanation = recommender.explain(result)

        print(f"Recommendation: {explanation}")


if __name__ == "__main__":
    main()