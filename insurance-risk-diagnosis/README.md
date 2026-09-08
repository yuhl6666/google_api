# 保険リスク診断ツール

個人・保険代理店向けに、入力情報から必要保障額とリスクを自動診断するツールです。

- フロントエンド: React + TypeScript + Tailwind CSS (Vite) / `web/`
- バックエンド: Firebase Cloud Functions (TypeScript) / `functions/`
- DB: Cloud Firestore (`diagnosisInputs`, `diagnosisResults`)
- 認証: Firebase Authentication(メール/パスワード)
- ホスティング: Firebase Hosting
- 可視化: Recharts(レーダーチャート)
- PDF出力: html2canvas + jsPDF(クライアントサイド)

## ディレクトリ構成

```
insurance-risk-diagnosis/
  firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
  functions/        Cloud Functions (診断計算ロジック・API)
    src/calc/        純粋関数として実装した診断ロジック
    src/api/         onCall関数(runDiagnosisCallable等)
    test/            Jestテスト(複数家族構成パターン)
  web/              React SPA
    src/components/  ステップ入力フォーム・結果ダッシュボード
    src/pages/       画面
    src/lib/         Firebase接続・API呼び出し・PDF出力
```

## 診断ロジックについて

`functions/src/calc/params.ts` にすべての前提パラメータ(生活費割合・教育費テーブル・遺族年金の簡易概算係数など)を集約しています。計算式の詳細と設計意図は各 `calc/*.ts` のコメントおよび本セッションでの設計案を参照してください。特定の保険商品名・保険会社名は一切出力しません(保険の「種類」のみ提案)。

## セットアップ

### 1. 依存関係のインストール

```bash
cd functions && npm install
cd ../web && npm install
```

### 2. Firebaseプロジェクトの準備(要ユーザー作業)

このリポジトリには実際のFirebaseプロジェクトへの認証情報は含まれていません。以下はご自身の環境で実施してください。

```bash
npm install -g firebase-tools   # または npx firebase-tools を都度使用
firebase login
```

`.firebaserc` の `YOUR_FIREBASE_PROJECT_ID` を実際のプロジェクトIDに書き換えるか、以下で紐付けてください。

```bash
firebase use --add
```

Firebase Consoleで以下を有効化してください:
- Authentication(メール/パスワード プロバイダ)
- Cloud Firestore(本番モード)
- Cloud Functions(Node.js 20 / Blazeプラン)
- Hosting

### 3. フロントエンドの環境変数

`web/.env.example` を `web/.env` にコピーし、Firebase ConsoleのWebアプリ設定値を入力してください。

```bash
cp web/.env.example web/.env
```

### 4. ローカル動作確認(エミュレータ)

```bash
# ターミナル1: エミュレータ起動
firebase emulators:start --only auth,firestore,functions

# ターミナル2: フロントエンド起動(.envでVITE_USE_FIREBASE_EMULATOR=trueにしておく)
cd web && npm run dev
```

### 5. テスト実行

```bash
cd functions && npm test
```

複数の家族構成パターン(独身/夫婦のみ/子供1人・2人/ひとり親/資産十分/団信有無/雇用形態違い)で必要保障額とスコアの妥当性を検証しています。

### 6. デプロイ

```bash
cd functions && npm run build
firebase deploy --only firestore:rules,firestore:indexes,functions

cd ../web && npm run build
firebase deploy --only hosting
```

もしくは一括:

```bash
firebase deploy
```

## セキュリティ

`firestore.rules` はクライアントからの直接読み書きをすべて拒否し、Cloud Functions(Admin SDK)経由のみでデータへアクセスする設計です。各Cloud Functionは呼び出し元の認証済みUIDでデータを絞り込み、他ユーザーの診断結果は取得できません。

## CI/CD (GitHub Actions)

`main` ブランチへのマージ(このディレクトリ配下の変更のみ)をトリガーに、リポジトリルートの `.github/workflows/deploy.yml` が自動実行され、Cloud Functionsのビルド・テスト → webのビルド → `firebase deploy --only hosting,firestore,functions` を実行します。`workflow_dispatch` にも対応しているため、GitHub Actionsの画面から手動実行も可能です。

初回セットアップとして、以下をご自身の環境で実施してください。

### 1. `.firebaserc` に実際のプロジェクトIDを設定してコミット

```bash
firebase use --add   # または .firebaserc の YOUR_FIREBASE_PROJECT_ID を直接書き換える
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

### 3. CI用サービスアカウントの作成(Google Cloud Console)

1. [Google Cloud Console](https://console.cloud.google.com/) で対象のFirebaseプロジェクトを選択
2. **IAMと管理 > サービスアカウント > サービスアカウントを作成** で `github-actions-deploy` などの名前で作成
3. 作成したサービスアカウントに、プロジェクトレベルで以下のロールを付与(**IAMと管理 > IAM > アクセス権を付与**):
   - `Firebase Admin` (roles/firebase.admin)
   - `Cloud Functions 管理者` (roles/cloudfunctions.admin)
   - `サービス アカウント ユーザー` (roles/iam.serviceAccountUser)
   - `Cloud Build編集者` (roles/cloudbuild.builds.editor)
   - `Artifact Registry 管理者` (roles/artifactregistry.admin)
   - `Firebase Rules 管理者` (roles/firebaserules.admin)
   - `Cloud Datastore インデックス管理者` (roles/datastore.indexAdmin)

   ※これは「1コマンドの `firebase deploy` でHosting/Firestore/Functionsをまとめてデプロイできる」ことを優先した構成です。権限を絞りたい場合は、Hostingのみなら `Firebase Hosting Admin` (roles/firebasehosting.admin) だけで足ります(その場合はワークフローの `--only` から `functions` と `firestore` を外してください)。
4. 作成したサービスアカウントの **キー** タブ > **鍵を追加 > 新しい鍵を作成 > JSON** でJSON鍵ファイルをダウンロード
5. 初めてCloud Functionsをデプロイする場合は、CIより先に一度ローカルで `firebase deploy --only functions` を実行し、必要なAPI(Cloud Build, Artifact Registry, Cloud Functions, Cloud Run等)を有効化しておくと安全です。

### 4. GitHub Secretsへの登録

リポジトリの **Settings > Secrets and variables > Actions > New repository secret** で、以下の名前でダウンロードしたJSON鍵ファイルの中身をそのまま貼り付けて登録してください。

| Secret名 | 値 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 手順3でダウンロードしたJSON鍵ファイルの中身(全文) |

登録後、`main` ブランチにこのディレクトリの変更をマージすると自動デプロイが実行されます。
