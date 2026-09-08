# 保険リスク診断ツール

個人・保険代理店向けに、入力情報から必要保障額とリスクを自動診断するツールです。

- フロントエンド: React + TypeScript + Tailwind CSS (Vite) / `web/`
- 診断計算ロジック: `web/src/calc/`(ブラウザ内で実行する純粋関数)
- DB: Cloud Firestore (`diagnosisInputs`, `diagnosisResults`)。ブラウザから直接読み書きし、Firebase Authenticationのuidでアクセスを制限
- 認証: Firebase Authentication(メール/パスワード)
- ホスティング: Firebase Hosting
- 可視化: Recharts(レーダーチャート)
- PDF出力: html2canvas + jsPDF(クライアントサイド)

**この構成はFirebaseの無料プラン(Spark)だけで完結し、課金設定は一切不要です。**

## なぜCloud Functionsを使っていないか

当初はバックエンドをFirebase Cloud Functionsで実装していましたが、Cloud Functions(Gen 1/Gen 2とも)はFirebaseの**Blazeプラン(従量課金制、要クレジットカード登録)への加入が必須**という制約があります。このツールは「計算式を画面に表示して透明性を保つ」設計であり、計算ロジック自体を秘匿する必要がないため、完全無料で運用できるよう計算ロジックをブラウザ側に移し、Firestoreへの保存もクライアントから直接行う構成に変更しました。

`functions/` ディレクトリは参考実装として残しています(将来Blazeプランへ移行しロジックをサーバー側に隠したくなった場合の移行元)。CIではビルド・テストのみ継続実行し、デプロイはしていません。

## ディレクトリ構成

```
insurance-risk-diagnosis/
  firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
  functions/        (未デプロイの参考実装。web/src/calcと同じロジック)
  web/              React SPA
    src/calc/        診断ロジック本体(純粋関数)。functions/src/calcと同一内容
    src/components/  ステップ入力フォーム・結果ダッシュボード
    src/pages/       画面
    src/lib/         Firebase接続・Firestore読み書き・PDF出力
```

## 診断ロジックについて

`web/src/calc/params.ts` にすべての前提パラメータ(生活費割合・教育費テーブル・遺族年金の簡易概算係数など)を集約しています。特定の保険商品名・保険会社名は一切出力しません(保険の「種類」のみ提案)。

## セットアップ

### 1. 依存関係のインストール

```bash
cd web && npm install
```

(`functions/` はデプロイ対象外ですが、参考実装として `cd functions && npm install` でテストは実行できます)

### 2. Firebaseプロジェクトの準備(要ユーザー作業)

```bash
npm install -g firebase-tools   # または npx firebase-tools を都度使用
firebase login
```

`.firebaserc` の `default` を実際のプロジェクトIDに書き換えるか、以下で紐付けてください。

```bash
firebase use --add
```

Firebase Consoleで以下を有効化してください:
- Authentication(メール/パスワード プロバイダ)
- Cloud Firestore(データベースを作成。ロケーションは任意)
- Hosting

Cloud Functionsは有効化不要です(Sparkプランのままで構いません)。

### 3. フロントエンドの環境変数

`web/.env.example` を `web/.env` にコピーし、Firebase ConsoleのWebアプリ設定値を入力してください。

```bash
cp web/.env.example web/.env
```

### 4. ローカル動作確認(エミュレータ)

```bash
# ターミナル1: エミュレータ起動
firebase emulators:start --only auth,firestore

# ターミナル2: フロントエンド起動(.envでVITE_USE_FIREBASE_EMULATOR=trueにしておく)
cd web && npm run dev
```

### 5. テスト実行

```bash
cd web && npm test
```

複数の家族構成パターン(独身/夫婦のみ/子供1人・2人/ひとり親/資産十分/団信有無/雇用形態違い)で必要保障額とスコアの妥当性を検証しています(Vitest、13件)。

### 6. デプロイ

```bash
cd web && npm run build
firebase deploy --only hosting,firestore
```

## セキュリティ

`firestore.rules` は、ログイン済みユーザーが**自分のuidと一致するドキュメントのみ**読み書きできるよう制限しています。作成後の更新・削除は禁止し、診断履歴を改ざんできない監査ログとして扱います。

## CI/CD (GitHub Actions)

`main` ブランチへのマージ(このディレクトリ配下の変更のみ)をトリガーに、リポジトリルートの `.github/workflows/deploy.yml` が自動実行され、web側のテスト・ビルド → `firebase deploy --only hosting,firestore` を実行します(Cloud Functionsはデプロイしません)。`workflow_dispatch` にも対応しているため、GitHub Actionsの画面から手動実行も可能です。

初回セットアップとして、以下をご自身の環境で実施してください。

### 1. `.firebaserc` に実際のプロジェクトIDを設定してコミット

```bash
firebase use --add   # または .firebaserc の default を直接書き換える
git add .firebaserc && git commit -m "Set Firebase project id" && git push
```

(プロジェクトIDは秘密情報ではないため、リポジトリにコミットして問題ありません。)

### 2. フロントエンドのFirebase設定を本番ビルドに反映

Vite は `web/.env.production` を本番ビルド時に読み込みます。Firebase ConsoleのWebアプリ設定値(`apiKey`等)は公開されても問題ない値のため、そのままコミットして構いません。

```bash
cp web/.env.example web/.env.production
# web/.env.production を実際の値で編集(VITE_USE_FIREBASE_EMULATOR=false のまま)
git add web/.env.production && git commit -m "Add production Firebase web config" && git push
```

### 3. Firestoreデータベースの作成(Firebase Console)

Firebase Console → 対象プロジェクト → Firestore Database → 「データベースを作成」で一度だけ作成してください(ロケーションは任意、テストモード/本番モードどちらでも構いません。ルールはCIが`firestore.rules`で上書きします)。

### 4. CI用サービスアカウントの作成(Google Cloud Console)

1. [Google Cloud Console](https://console.cloud.google.com/) で対象のFirebaseプロジェクトを選択
2. **IAMと管理 > サービスアカウント > サービスアカウントを作成** で `github-actions-deploy` などの名前で作成
3. 作成したサービスアカウントに、プロジェクトレベルで以下のロールを付与(**IAMと管理 > IAM > アクセス権を付与**):
   - `Firebase Hosting 管理者` (roles/firebasehosting.admin)
   - `Firebase Rules 管理者` (roles/firebaserules.admin)
   - `Cloud Datastore インデックス管理者` (roles/datastore.indexAdmin)
   - `Service Usage 管理者` (roles/serviceusage.serviceUsageAdmin) — firebase-toolsがデプロイ前に各APIの有効化状態を確認するために必要

   Cloud Functionsをデプロイしないため、`Cloud Functions 管理者` や `Cloud Build編集者` 等は不要です。
4. 作成したサービスアカウントの **キー** タブ > **鍵を追加 > 新しい鍵を作成 > JSON** でJSON鍵ファイルをダウンロード

### 5. GitHub Secretsへの登録

リポジトリの **Settings > Secrets and variables > Actions > New repository secret** で、以下の名前でダウンロードしたJSON鍵ファイルの中身をそのまま貼り付けて登録してください。

| Secret名 | 値 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 手順4でダウンロードしたJSON鍵ファイルの中身(全文) |

登録後、`main` ブランチにこのディレクトリの変更をマージするか、Actions画面から手動実行(`workflow_dispatch`)すると自動デプロイが実行されます。
