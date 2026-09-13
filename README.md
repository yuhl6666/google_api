# 副業から始める事業承継マッチングプラットフォーム

副業（業務委託・週数時間の関与）から始めて、双方の相性を見ながら段階的に関係を深め、将来的な事業承継（後継者候補）へと発展させることを目的としたマッチングプラットフォームです。「副業から始めて将来的に事業承継に興味がある人材」と「後継者不足に悩む地方中小企業」を、フェーズ管理を軸に結びつけます。

> 本プラットフォームの実体は `products/staged-succession/frontend/`（フロントエンド。マッチングロジック本体もここに同梱）、`products/staged-succession/supabase/`（DBスキーマ）、`products/staged-succession/functions/`（休眠中の参照実装。後述）です。旧Railsひな型は `legacy/rails-template/` に退避済みです。

## 技術スタック

- フロントエンド: React + TypeScript + Tailwind CSS（Vite）
- バックエンド: **専用サーバーなし**。マッチングロジックはフロントエンド内（`products/staged-succession/frontend/src/calc/scoring/`）の純粋関数として実行し、結果を直接 Supabase に書き込みます
- DB / 認証 / リアルタイム: **Supabase**（Postgres + Auth + Realtime）。テーブル: `profiles` / `talents` / `companies` / `matches` / `messages` / `phase_history`。整合性チェック（フェーズ遷移の妥当性、レビュー/継続希望フラグの越権防止など）は Row Level Security ポリシーとDBトリガーで担保
- メッセージング: Supabaseのリアルタイム購読（`postgres_changes`）でチャットを実現。送信はDB側トリガーでマッチの集計値（メッセージ数など）とアトミックに同期
- ホスティング: Firebase Hosting（静的ファイルのみ。Sparkプラン=無料で利用可）

### なぜCloud Functions/Firestoreを使わなかったか

当初はFirebase Cloud Functions + Firestoreで設計していましたが、このFirebaseアカウントではFirestoreの作成自体にBlazeプラン（課金設定）が要求されることが判明したため、完全無料で動かせる構成としてSupabaseに切り替えました。`products/staged-succession/functions/` ディレクトリには元の設計（スコアリングエンジンの参照実装）が残っていますが、**デプロイはされておらず、ビルド・テストのみ継続確認**しています（実体は `products/staged-succession/frontend/src/calc/scoring/` に同一コードとして存在し、そちらが実際に動いています）。

## データモデルとフェーズ遷移

```
profiles       id(=auth.uid), role('talent'|'company')
talents        id(=auth.uid), name, skills[], interested_industries[], weekly_available_hours,
               work_style, relocatable, prefecture, succession_interest_level(1-5), funding_capacity, bio
companies      id(=auth.uid), name, industry, prefecture, overview, financial_health,
               wanted_persona_tags[], wanted_persona_tag_weights(jsonb), side_job_acceptable,
               required_weekly_hours_min/max, succession_timeframe
matches        talent_id, company_id, phase(1-3), status, score_breakdown(jsonb), reviews(jsonb),
               continuation_intent(jsonb), message_count, phase_entered_at(jsonb)
messages       match_id, sender_id, sender_role, body, created_at
phase_history  match_id, from_phase, to_phase, reason, changed_by, score_at_change
```

詳細スキーマ・RLSポリシー・トリガーは `products/staged-succession/supabase/migrations/0001_init.sql` を参照してください。

```
[フェーズ1: 副業お試し] --昇格判定A--> [フェーズ2: 関係深化] --昇格判定B--> [フェーズ3: 承継検討] --合意--> [承継成立]
        └────────────────── どのフェーズからでも「解消」へ遷移可（終端） ──────────────────┘
```

- 昇格判定A（1→2）: フェーズ1総合スコア ≥ 0.6 かつ双方の継続希望
- 昇格判定B（2→3）: 関与期間・メッセージ量・相互レビュー・フェーズ1スコア引継ぎから算出する昇格スコア ≥ 0.7
- 各フェーズでスコアの重み付けが異なる（フェーズ1はスキル/稼働重視、フェーズ3は承継本気度/資金力重視）。詳細は `products/staged-succession/frontend/src/calc/scoring/`
- フェーズの昇格自体はDBトリガー（`matches_guard_update`）が「1段階ずつしか進めない」「終了済みマッチは編集不可」「相手側のレビュー/継続希望フラグは書き換え不可」を強制するため、クライアント側のバグや悪意ある操作からも一定守られます

## セットアップ

### 1. Supabaseプロジェクトを作成

1. https://supabase.com でプロジェクトを新規作成（クレジットカード登録不要の無料プランで開始できます）
2. **Authentication > Providers > Email** で「Confirm email」をオフにする（デモ用に確認メール無しでサインアップ即ログインできるようにするため。本番運用時はオンに戻すことを推奨）
3. **SQL Editor** で `products/staged-succession/supabase/migrations/0001_init.sql` の中身を貼り付けて実行（テーブル・RLSポリシー・トリガーが作成されます）
   - Supabase CLIが使える場合は `supabase link` 後に `supabase db push` でも同じことができます
4. **Project Settings > API** から以下をメモ:
   - Project URL
   - `anon` `public` キー（フロントエンド用）
   - `service_role` キー（後述のシードスクリプト専用。**絶対にフロントエンドや公開リポジトリに含めないこと**）

### 2. 依存関係のインストール

```bash
cd products/staged-succession/frontend && npm install
```

### 3. 環境変数

```bash
cp products/staged-succession/frontend/.env.example products/staged-succession/frontend/.env.local
```

`.env.local` に手順1でメモした値を設定:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
```

### 4. サンプルデータ投入（任意）

人材5件・企業5件のサンプルデータ（Auth ユーザーも含めて自動作成）を投入し、1組はフェーズ1→2→3まで遷移させたデモ状態、もう1組はフェーズ2で足踏み中のデモ状態を再現します。

```bash
cd products/staged-succession/frontend
SUPABASE_URL=https://xxxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxxxx \
npm run seed
```

投入後、`talent1@example.com` 〜 `talent5@example.com` / `company1@example.com` 〜 `company5@example.com`（パスワードは全て `password123!`、`products/staged-succession/frontend/scripts/seedData.ts` で定義）でログインして確認できます。

## ローカル開発

Cloud Functionsのエミュレータのような「完全ローカル」の選択肢はありません（SupabaseはSaaSのため）。上記1〜3を済ませたSupabaseプロジェクトに対して、ローカルのVite dev serverから接続します。

```bash
cd products/staged-succession/frontend && npm run dev
```

### スマホなど他デバイスから見る（同一Wi-Fi）

Supabase自体はクラウド上にあるため接続先の心配は不要です。Vite dev serverだけLANに公開すれば、PCの電源が入っている間はスマホからも同じ内容を確認できます。

1. 開発機のLAN IPを確認（例: `192.168.1.23`）
   - Mac: `ipconfig getifaddr en0` / Windows: `ipconfig` / Linux: `hostname -I`
2. `npm run dev -- --host 0.0.0.0` で起動
3. スマホのブラウザで `http://192.168.1.23:5173` を開く（同じWi-Fiであること）

これはあくまで開発機を起動しっぱなしにする一時的な確認方法です。PCを閉じても常時アクセスできる状態にしたい場合は下記「デプロイ」を行ってください。

## テスト

```bash
cd products/staged-succession/frontend
npm test           # スコアリングロジックの単体テスト（Vitest）
npm run build      # 型チェック + ビルド
cd ../functions
npm test           # 参照実装側でも同じロジックのテストを継続確認（デプロイはしない）
```

## デプロイ（Firebase Hosting、無料）

Cloud FunctionsもFirestoreも使わないため、Firebase側はHostingの設定だけで済み、**Blazeプラン（課金設定）は不要**です。

```bash
npm install -g firebase-tools   # 未導入の場合
firebase login
```

`products/staged-succession/.firebaserc` の `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` を実際のFirebaseプロジェクトIDに置き換えてください（Firebaseコンソールで新規プロジェクトを作成、Sparkプランのままで構いません）。

```bash
cd products/staged-succession
firebase use --add   # 対話式でプロジェクトIDを選択・設定
cd frontend && npm run build && cd ..
firebase deploy --only hosting
```

デプロイ後に発行される `https://<プロジェクトID>.web.app` のようなURLに、PCを起動していなくてもスマホから含めいつでもアクセスできます。

このセッションのサンドボックス環境には実際のFirebase/Supabaseプロジェクトの認証情報がないため、上記コマンドはご自身の環境から実行してください。設定ファイル（`products/staged-succession/firebase.json`、`products/staged-succession/supabase/migrations/`）は全て用意済みです。
