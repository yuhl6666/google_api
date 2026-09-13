# SES Matching（現行プロダクト・準備中）

このディレクトリは、今後実装する**現行のSES案件×要員マッチングプロダクト**の置き場所です。現時点ではまだ実装していません（このディレクトリにはこのREADMEのみ存在します）。

## 位置付け

- 実行基盤（Planner/Router/Executor/Evaluator/Repair/Retry、Gmail連携等）は [`ai/automation-engine/`](../../ai/automation-engine/) の共通Automation Engineを利用する想定です。SES Matchingは、このEngineが複数プロダクトから利用されることを示す最初の主要ユースケースという位置付けであり、Engine自体はSES専用ではありません。
- 共通LLM/AI基盤が必要な場合は [`ai/llm-platform/`](../../ai/llm-platform/) を利用します。
- 過去に作成されたFirebase/Firestore版の実装（4軸スコアリング、フィードバックによる重み自動学習、41件のテスト、業務UI一式）は [`legacy/ses-matching-reference/`](../../legacy/ses-matching-reference/) に参考資産として保存されています。現行プロダクトはこれをそのまま復活させるものではなく、必要な部分を参照しながら改めて実装する想定です。
