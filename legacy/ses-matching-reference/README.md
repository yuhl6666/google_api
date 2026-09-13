# SES案件×要員 自動マッチングツール

SES（システムエンジニアリングサービス）企業向けに、案件情報と要員（エンジニア）情報を
自動でスコアリング・マッチングする社内ツールです。

- フロントエンド: React + TypeScript + Tailwind CSS（Vite）
- バックエンド: **なし（Cloud Functions不使用）** — ブラウザからCloud Firestoreへ直接アクセス
- DB: Cloud Firestore
- 認証: Firebase Authentication（メール/パスワード、社内利用前提）
- ホスティング: Firebase Hosting

> **アーキテクチャについて**: 当初はCloud Functions(Express API)でスコアリング/CRUDを
> 実装していましたが、Cloud FunctionsのデプロイにはBlaze(従量課金)プランへの切り替えが
> 必須になるため、**無料のSparkプランだけで運用できるよう、スコアリングエンジンを
> フロントエンド(ブラウザ)に移植し、Firestoreクライアントアプリから直接読み書きする構成**
> に変更しました。Firestoreのセキュリティルール(`firestore.rules`)でログイン済みユーザー
> のみアクセスできるよう制御しています。Cloud Functions版のコード(`functions/`)は
> 参考実装として残していますが、現在はデプロイ対象に含めていません（後述）。

---

## 1. データモデル / Firestoreコレクション設計

| コレクション | 内容 |
| --- | --- |
| `projects` | 案件情報 |
| `engineers` | 要員（エンジニア）情報 |
| `matchResults` | 案件×要員のマッチングスコア結果 |
| `feedbackLog` | 採用/却下フィードバックの履歴 |
| `settings`（補助） | スコア重み設定（`settings/weights` の1ドキュメントのみ）。要件の4コレクションに加え、重み調整設定画面のための設定値を保持する目的でのみ使用 |

### projects/{projectId}
```
name: string                     // 案件名
requiredSkills: {                // 必要スキル(配列)
  name: string
  minYears: number               // 最低経験年数
  required: boolean              // true=必須 / false=尚可
}[]
rateMin: number                  // 単価下限(万円/月)
rateMax: number                  // 単価上限(万円/月)
location: string                 // 勤務地(都道府県 等)
remoteAllowed: boolean           // リモート可否
startDate: string                // 稼働開始日 (YYYY-MM-DD)
durationMonths: number | null    // 期間(ヶ月)
commercialTier: number | null    // 商流(何次請けか)
japaneseLevel: string            // 日本語レベル要件 (none/N1-N4/business/native)
sourceEmailBody: string          // 元の案件情報メール本文
createdAt / updatedAt: Timestamp
```

### engineers/{engineerId}
```
name: string                     // 氏名 or 要員コード
skills: { name: string, years: number }[]  // 保有スキル+経験年数
desiredRateMin / desiredRateMax: number    // 希望単価レンジ(万円/月)
desiredLocations: string[]       // 希望勤務地(複数可)
remoteDesired: boolean           // リモート希望
availableFrom: string            // 稼働開始可能日 (YYYY-MM-DD)
japaneseLevel: string
sourceSkillSheetBody: string     // 元のスキルシート本文
createdAt / updatedAt: Timestamp
```

### matchResults/{projectId_engineerId}
案件×要員の組み合わせごとに決定的なID（`${projectId}_${engineerId}`）で1件保持し、
再マッチング時は上書き更新する。
```
projectId / engineerId: string
projectName / engineerName: string   // 表示用に非正規化して保持
totalScore: number                   // 0〜100の総合スコア
scoreBreakdown: {
  skillScore: number                 // 0〜1
  rateScore: number                  // 0〜1
  locationScore: number              // 0〜1
  timingScore: number                // 0〜1
  weightsUsed: ScoreWeights          // 計算時に使用した重み
}
status: '未対応' | '提案済' | '成約' | '却下'
createdAt / updatedAt: Timestamp
```

### feedbackLog/{feedbackId}
```
matchId: string
projectId / engineerId: string
decision: '採用' | '却下'
reasonNote: string
scoreBreakdownAtFeedback: ScoreBreakdown  // フィードバック時点のスコア内訳(学習用)
createdAt: Timestamp
```

### settings/weights（重み設定・補助コレクション）
```
skillWeight / rateWeight / locationWeight / timingWeight: number  // 合計1.0に正規化
updatedAt: Timestamp
```

---

## 2. マッチングエンジン仕様（自前実装、外部APIなし）

すべて `web/src/scoring/` 配下の純粋関数として実装（フレームワークに依存しない）。
ブラウザ上で実行され、Firestoreからは案件・要員データを読み取るだけで、計算結果
(`matchResults`)のみを書き込みます。

- `normalize.ts`: スキル名表記ゆれ辞書（React/ReactJS/react.js 等）による正規化
- `skillScore.ts`: 必須スキル充足率(経験年数条件含む) + 尚可スキルボーナス → 0〜1
- `rateScore.ts`: 案件単価レンジと希望単価レンジの重なり具合 → 0〜1
- `locationScore.ts`: 勤務地一致 or リモート可否の組み合わせ判定 → 0〜1
- `timingScore.ts`: 案件開始日と稼働可能日の差分日数から減衰 → 0〜1
- `totalScore.ts`: 上記4スコアを重み付き合計し0〜100のスコアへ変換（重みは自動正規化）
- `weightLearning.ts`: フィードバック履歴（採用/却下）から、採用グループと却下グループの
  スコア傾向の差分をもとに重みを微調整するシンプルな加重更新ロジック（勾配降下法は未使用）

単体テストは `web/src/scoring/__tests__/` に41件あり、`npm test`（web配下、vitest）で
実行できます。

> `functions/src/scoring/` にも同一のコードが残っています（Cloud Functions版の参考実装）。
> 現在のフロントエンド版(`web/src/scoring/`)が本番で使われる唯一の実体です。

---

## 3. ディレクトリ構成

```
ses-matching/
  firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
  web/                 # React + TypeScript + Tailwind フロントエンド (Vite) ← 本番で使用
    src/
      scoring/         # 純粋関数のスコアリングエンジン + テスト(vitest)
      pages/           # 案件/要員/マッチング結果/重み設定の各画面
      components/
      context/         # 認証コンテキスト
      api.ts           # Firestoreクライアントアクセス層(CRUD・マッチング実行・フィードバック)
      firebase.ts      # Firebase初期化 (Auth + Firestore)
  functions/           # [参考/現在未使用] Cloud Functions版のAPI実装一式
                        # Blazeプランに切り替えて再デプロイする場合のみ使用
```

---

## 4. セットアップ手順

### 4.1 前提
- Node.js 20系推奨（開発確認はNode 22でも動作）
- Firebase CLI: `npm install -g firebase-tools`（または `npx firebase-tools`）
- Firebaseプロジェクトを1つ作成し、**Firestore** と **Authentication（メール/パスワード）**
  を有効化（**Blazeプランへの切り替えは不要**です。Spark(無料)プランのままでOK）

### 4.2 依存関係のインストール
```bash
cd ses-matching/web && npm install
```

### 4.3 Firebaseプロジェクトの紐付け
```bash
cd ses-matching
firebase login
firebase use --add   # 作成したプロジェクトIDを選択し、.firebaserc の "default" を更新
```

### 4.4 フロントエンドの環境変数
`web/.env.example` を `web/.env` にコピーし、Firebase Consoleの「プロジェクトの設定」→
「マイアプリ」から取得したWebアプリの設定値を入力してください。

```bash
cp web/.env.example web/.env
```

### 4.5 ローカル動作確認（エミュレータ、無料・ログイン不要）
```bash
# ルートディレクトリ(ses-matching)でFirestore/Authエミュレータ起動
firebase emulators:start --only firestore,auth
```

別ターミナルでサンプルデータを投入（Admin SDKを使うため`functions/`の依存関係だけ利用）:
```bash
cd ses-matching/functions
npm install
npm run build
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export GCLOUD_PROJECT=<your-project-id>
node lib/seed/runSeed.js
```

フロントエンドはエミュレータを使うよう `web/.env` に以下を設定して起動:
```
VITE_USE_EMULATORS=true
```
```bash
cd ses-matching/web
npm run dev
```

Authエミュレータでテストユーザーを作成してログインしてください（Emulator UI
http://127.0.0.1:4000/auth から追加するか、REST APIで作成できます）。

### 4.6 単体テストの実行
```bash
cd ses-matching/web
npm test
```

### 4.7 本番デプロイ（無料・Blaze不要）
```bash
cd ses-matching
firebase deploy --only firestore:rules,firestore:indexes,hosting
```
デプロイ前に `web/.env` の `VITE_USE_EMULATORS` を `false` にしてから
`cd web && npm run build` してください（`dist/` がHostingに配信されます）。

### 4.8 本番Firestoreへのサンプルデータ投入（任意）
Firebase Console →「プロジェクトの設定」→「サービスアカウント」→
「新しい秘密鍵の生成」でJSONキーを取得し（無料機能、Blaze不要）:
```bash
cd ses-matching/functions
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GCLOUD_PROJECT=<your-project-id>
npm run build && node lib/seed/runSeed.js
```

### 4.9 セキュリティ上の注意
- `firestore.rules` は「ログイン済みユーザーなら読み書き可」という設計です。ログイン画面に
  新規登録フォームは置いていませんが、Firebase Authのメール/パスワード認証はAPIを直接叩けば
  誰でも自己登録できてしまうため、**社外の第三者にアプリのURLを不用意に共有しない**、
  **利用者アカウントはFirebase Console側で手動作成する運用にする**、といった対策を推奨します。
  より厳格に制限したい場合は、将来的にBlazeプランへ切り替えて
  Cloud Functionsのユーザー作成トリガーで許可ドメインを制限する、App Checkを導入する、
  などの拡張が可能です（`functions/`のコードをベースに拡張できます）。

---

## 5. データアクセス（Firestore直接、REST APIなし）

`web/src/api.ts` が唯一のデータアクセス層です。Cloud Functions/REST APIは使わず、
Firebase Authで認証したユーザーとしてFirestoreクライアントSDKを直接呼び出します。

| 関数 | 内容 |
| --- | --- |
| `listProjects` / `getProject` / `createProject` / `updateProject` / `deleteProject` | 案件CRUD |
| `listEngineers` / `getEngineer` / `createEngineer` / `updateEngineer` / `deleteEngineer` | 要員CRUD |
| `listMatches(params?)` | マッチング結果一覧（`projectId`/`engineerId`/`status`で絞込可） |
| `runMatching(params)` | マッチング実行（ブラウザ側で`calcTotalScore`を計算し`matchResults`へ書き込み） |
| `updateMatchStatus(id, status)` | ステータス変更（未対応/提案済/成約/却下） |
| `submitFeedback(data)` | フィードバック登録（`feedbackLog`へ追記→重み自動再学習→`settings/weights`更新） |
| `getWeights` / `putWeights` | スコア重み設定の取得 / 更新 |

書き込み時のバリデーションは `firestore.rules` 側で行っています（必須フィールドの型チェック等）。

---

## 6. サンプルデータ

`functions/src/seed/data.ts` に案件10件・要員10件を用意しています。表記ゆれ辞書の
動作確認用に、React/ReactJS、AWS/Amazon Web Services、Node/Node.js などをあえて
案件側・要員側で違う表記にしています。投入方法は「4.5 / 4.8」を参照してください。
