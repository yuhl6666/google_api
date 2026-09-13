import json

from app.llm import OllamaProvider


class Recommender:
    def __init__(self):
        self.llm = OllamaProvider(model="qwen3:0.6b")

    def explain(self, match_result: str) -> str:
        candidates = json.loads(match_result)

        if not candidates:
            return "該当する要員は見つかりませんでした。"

        top_candidate = candidates[0]

        prompt = f"""
以下のSES要員マッチング結果を基に、
1位の候補者を推薦する理由を日本語で簡潔に説明してください。

候補者:
{json.dumps(top_candidate, ensure_ascii=False, indent=2)}

条件:
- スキル一致
- 予算適合
- 勤務地適合
- 事実にない情報は追加しない
- 3文以内
"""

        return self.llm.generate(prompt)