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
