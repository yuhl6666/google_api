# SES案件×要員 自動マッチングツール

SES（システムエンジニアリングサービス）企業向けに、案件情報と要員（エンジニア）情報を
自動でスコアリング・マッチングする社内ツールです。

- フロントエンド: React + TypeScript + Tailwind CSS（Vite）
- バックエンド: Firebase Cloud Functions（TypeScript / Express）
- DB: Cloud Firestore
- 認証: Firebase Authentication（メール/パスワード、社内利用前提）
- ホスティング: Firebase Hosting

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

すべて `functions/src/scoring/` 配下の純粋関数として実装（Firestoreに依存しない）。

- `normalize.ts`: スキル名表記ゆれ辞書（React/ReactJS/react.js 等）による正規化
- `skillScore.ts`: 必須スキル充足率(経験年数条件含む) + 尚可スキルボーナス → 0〜1
- `rateScore.ts`: 案件単価レンジと希望単価レンジの重なり具合 → 0〜1
- `locationScore.ts`: 勤務地一致 or リモート可否の組み合わせ判定 → 0〜1
- `timingScore.ts`: 案件開始日と稼働可能日の差分日数から減衰 → 0〜1
- `totalScore.ts`: 上記4スコアを重み付き合計し0〜100のスコアへ変換（重みは自動正規化）
- `weightLearning.ts`: フィードバック履歴（採用/却下）から、採用グループと却下グループの
  スコア傾向の差分をもとに重みを微調整するシンプルな加重更新ロジック（勾配降下法は未使用）

単体テストは `functions/src/scoring/__tests__/` に41件あり、`npm test`（functions配下）で実行できます。

---

## 3. ディレクトリ構成

```
ses-matching/
  firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
  functions/           # Cloud Functions (API + スコアリングエンジン)
    src/
      scoring/         # 純粋関数のスコアリングエンジン + テスト
      api/             # Express アプリ (ルーティング, 認証ミドルウェア)
      seed/            # サンプルデータ投入スクリプト
      firestoreAdmin.ts
      models.ts
      index.ts         # Cloud Functions エントリポイント (`api` という名前でexport)
  web/                 # React + TypeScript + Tailwind フロントエンド (Vite)
    src/
      pages/           # 案件/要員/マッチング結果/重み設定の各画面
      components/
      context/         # 認証コンテキスト
      api.ts           # Cloud Functions APIクライアント
      firebase.ts       # Firebase初期化
```

---

## 4. セットアップ手順

### 4.1 前提
- Node.js 20系推奨（開発確認はNode 22でも動作）
- Firebase CLI: `npm install -g firebase-tools`（または `npx firebase-tools`）
- Firebaseプロジェクトを1つ作成し、Firestore / Authentication（メール・パスワード）を有効化

### 4.2 依存関係のインストール
```bash
cd ses-matching/functions && npm install
cd ../web && npm install
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

### 4.5 ローカル動作確認（エミュレータ）
```bash
# functionsをビルド
cd ses-matching/functions && npm run build

# ルートディレクトリ(ses-matching)でエミュレータ起動
cd ..
firebase emulators:start --only firestore,auth,functions
```

別ターミナルでサンプルデータを投入:
```bash
cd ses-matching/functions
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export GCLOUD_PROJECT=<your-project-id>
npm run build && node lib/seed/runSeed.js
```

フロントエンドはエミュレータのFunctions URLを指すよう `web/.env` を設定して起動:
```bash
# web/.env に以下を追加(プロジェクトIDは実際のものに置換)
# VITE_API_BASE_URL=http://127.0.0.1:5001/<project-id>/asia-northeast1/api
# VITE_USE_AUTH_EMULATOR=true

cd ses-matching/web
npm run dev
```

Authエミュレータでテストユーザーを作成してログインするか、Firebase Consoleの
Authentication画面からメール/パスワードユーザーを作成してください。

### 4.6 単体テストの実行
```bash
cd ses-matching/functions
npm test
```

### 4.7 本番デプロイ
```bash
cd ses-matching
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```
デプロイ前に `web/.env` の `VITE_API_BASE_URL` を `/api`（Hostingのrewrite経由）に、
`VITE_USE_AUTH_EMULATOR` を `false` に戻してから `npm run build` してください
（`firebase deploy` で `web/dist` がHostingに配信されます）。

> 本セッションの実行環境にはFirebaseプロジェクトの認証情報が無いため、実際の
> `firebase deploy` の実行はできていません。上記コマンドで、Firebaseプロジェクトを
> 用意した上でご自身の環境から実行してください。ローカルでは、Firestore/Auth/Functions
> エミュレータ上で本セッション内にサンプルデータ投入・全画面の動作確認（案件/要員の
> 登録・編集・削除、マッチング実行、スコア内訳表示、フィードバック登録によるステータス
> 変更、重み設定の保存）まで実施済みです。

---

## 5. API一覧（Cloud Functions / Express、要Firebase Authトークン）

| Method | Path | 内容 |
| --- | --- | --- |
| GET/POST | `/projects` | 案件一覧取得 / 登録 |
| GET/PUT/DELETE | `/projects/:id` | 案件の取得/更新/削除 |
| GET/POST | `/engineers` | 要員一覧取得 / 登録 |
| GET/PUT/DELETE | `/engineers/:id` | 要員の取得/更新/削除 |
| GET | `/matches` | マッチング結果一覧（`projectId`/`engineerId`/`status`で絞込可） |
| POST | `/matches/run` | マッチング実行（`projectId`/`engineerId`省略で全件再計算） |
| PATCH | `/matches/:id` | ステータス変更（未対応/提案済/成約/却下） |
| GET/POST | `/feedback` | フィードバック履歴取得 / 登録（採用/却下→重み自動再学習） |
| GET/PUT | `/weights` | スコア重み設定の取得 / 更新 |

---

## 6. サンプルデータ

`functions/src/seed/data.ts` に案件10件・要員10件を用意しています。表記ゆれ辞書の
動作確認用に、React/ReactJS、AWS/Amazon Web Services、Node/Node.js などをあえて
案件側・要員側で違う表記にしています。`npm run seed`（またはビルド後 `node lib/seed/runSeed.js`）
で投入できます。
