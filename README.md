# 副業から始める事業承継マッチングプラットフォーム

副業（業務委託・週数時間の関与）から始めて、双方の相性を見ながら段階的に関係を深め、将来的な事業承継（後継者候補）へと発展させることを目的としたマッチングプラットフォームです。「副業から始めて将来的に事業承継に興味がある人材」と「後継者不足に悩む地方中小企業」を、フェーズ管理を軸に結びつけます。

> リポジトリ内の `app/` `config/` などは元々あった別プロジェクト（Rails）のひな型で、本プラットフォームとは無関係です。本プラットフォームの実体は `functions/`（バックエンド）と `frontend/`（フロントエンド）、およびリポジトリ直下の Firebase 設定ファイル（`firebase.json` など）です。

## 技術スタック

- フロントエンド: React + TypeScript + Tailwind CSS（Vite）
- バックエンド: Firebase Cloud Functions（TypeScript）
- DB: Firestore（`talents` / `companies` / `matches` / `messages` / `phaseHistory`）
- 認証: Firebase Authentication（`role` カスタムクレームで人材/企業を分離）
- メッセージング: Firestore のリアルタイムリスナー（`onSnapshot`）でチャットを実現。書き込みは `sendMessage` callable 経由（マッチの集計値とアトミックに同期させるため）
- ホスティング: Firebase Hosting

## データモデルとフェーズ遷移

詳細はコード中のコメント（`functions/src/types.ts`, `functions/src/api/phases.ts`）を参照してください。概要:

```
talents/{id}      スキル/経験, 興味業種, 稼働可能時間, 勤務形態, 移住可能性, 承継関心度(1-5), 資金余力
companies/{id}    業種, 所在地, 事業概要, 経営状況, 求める人物像タグ, 副業受け入れ可否, 承継希望時期
matches/{id}      talentId, companyId, phase(1-3), status, scoreBreakdown, reviews, messageCount, phaseEnteredAt
messages/{id}     matchId, senderId, senderRole, body, createdAt
phaseHistory/{id} matchId, fromPhase, toPhase, reason, changedBy, scoreAtChange
```

```
[フェーズ1: 副業お試し] --昇格判定A--> [フェーズ2: 関係深化] --昇格判定B--> [フェーズ3: 承継検討] --合意--> [承継成立]
        └────────────────── どのフェーズからでも「解消」へ遷移可（終端） ──────────────────┘
```

- 昇格判定A（1→2）: フェーズ1総合スコア ≥ 0.6 かつ双方の継続希望
- 昇格判定B（2→3）: 関与期間・メッセージ量・相互レビュー・フェーズ1スコア引継ぎから算出する昇格スコア ≥ 0.7
- 各フェーズでスコアの重み付けが異なる（フェーズ1はスキル/稼働重視、フェーズ3は承継本気度/資金力重視）。詳細は `functions/src/scoring/`。

## セットアップ

### 1. 依存関係のインストール

```bash
cd functions && npm install
cd ../frontend && npm install
```

### 2. Firebase プロジェクトの紐付け

```bash
npm install -g firebase-tools   # 未導入の場合
firebase login
```

`.firebaserc` の `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` を実際の Firebase プロジェクトID に置き換えてください（Firebase コンソールで新規プロジェクトを作成しておく必要があります）。

```bash
firebase use --add   # 対話式でプロジェクトIDを選択・設定
```

### 3. フロントエンドの環境変数

```bash
cp frontend/.env.example frontend/.env.local
```

Firebase コンソール（プロジェクト設定 > 全般 > マイアプリ > SDK の設定と構成）の値を `frontend/.env.local` に設定してください。

## ローカル開発（エミュレータ）

```bash
# ルートで: Auth / Firestore / Functions エミュレータを起動
firebase emulators:start --only auth,firestore,functions

# 別ターミナルでフロントエンドを起動（VITE_USE_FIREBASE_EMULATOR=true を .env.local に設定）
cd frontend && npm run dev
```

### サンプルデータ投入

人材5件・企業5件のサンプルデータを投入し、1組はフェーズ1→2→3まで遷移させたデモ状態、もう1組はフェーズ2で足踏み中のデモ状態を再現します（Firestore エミュレータ起動後に実行してください）。

```bash
cd functions
npm run build
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=<your-project-id> node lib/seed/seed.js
```

安全のため、`FIRESTORE_EMULATOR_HOST` が未設定の場合はスクリプトが実行を拒否します（本番 Firestore への誤投入防止）。

## テスト

```bash
cd functions && npm test        # スコアリングロジックの単体テスト
cd frontend && npm run build    # 型チェック + ビルド
```

## デプロイ

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
cd frontend && npm run build && cd ..
firebase deploy --only hosting
# まとめて: firebase deploy
```

デプロイには実際の Firebase プロジェクトへのログイン・課金設定（Cloud Functions は Blaze プランが必要）が必要です。このセッションのサンドボックス環境には実際の Firebase プロジェクトの認証情報がないため、上記コマンドは実際の Firebase プロジェクトを用意した上でご自身の環境から実行してください。`firebase.json` / `firestore.rules` / `firestore.indexes.json` / Cloud Functions のコードはすべて用意済みで、`firebase init` 相当の設定は完了しています。
