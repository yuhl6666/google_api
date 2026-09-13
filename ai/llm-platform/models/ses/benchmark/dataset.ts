import { SesCategory, SesEmailInput } from '../sesEmail.js';

/**
 * Synthetic SES benchmark dataset (spec: no real customer email ever
 * leaves this machine, let alone gets sent to an external API — every
 * example here is invented). Shape matches exactly what
 * `models/ses/benchmark/runBenchmark.ts` needs: Prompt (built from
 * `email`) -> Local Model -> Prediction -> compare against
 * `expectedCategory`.
 *
 * >= 10 examples per category, deliberately including hard cases per the
 * benchmark plan: mixed project/sales signals, an engineer profile
 * written as a sales-style pitch, subject-alone-is-not-enough, sparse SES
 * vocabulary, broken/informal Japanese, HTML-email leftovers, a long
 * signature block, a forwarded email, and a multi-project digest.
 */
export interface SesBenchmarkExample {
  id: string;
  email: SesEmailInput;
  expectedCategory: SesCategory;
  /** Why this example is included / what makes it hard, for humans reading benchmark failures. */
  note?: string;
}

export const SES_BENCHMARK_DATASET: SesBenchmarkExample[] = [
  // ---------------------------------------------------------------- project
  {
    id: 'project-01',
    email: {
      subject: '【急募】AWSインフラエンジニア案件のご紹介',
      body: '案件名: ECサイト基盤構築\n単価: 80万円/月\n勤務地: 東京(リモート可)\nスキル: AWS, Terraform, Kubernetes\n稼働: 週5日\n開始時期: 即日',
      sender: 'project-info@ses-agency.example.com',
      attachmentNames: ['案件概要.pdf'],
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-02',
    email: {
      subject: 'Javaバックエンドエンジニア募集(大手金融系)',
      body: '大手金融機関向け基幹システム刷新案件です。\n必須スキル: Java, Spring Boot, Oracle\n単価: 70~85万円\n場所: 大阪\n面談: 1回\nご興味あればスキルシートをお送りください。',
      sender: 'sales@partner-ses.example.jp',
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-03',
    email: {
      subject: '案件情報',
      body:
        '下記の案件が新着です。\n\n■案件名: 社内向け勤怠管理システム改修\n■スキル: PHP, Laravel, MySQL\n■単価: 60万円〜\n■場所: 完全リモート\n■稼働率: 週3日〜可\n\nご対応可能なエンジニア様がいらっしゃいましたらご連絡ください。',
      sender: 'info@ses-matching.example.co.jp',
    },
    expectedCategory: 'project',
    note: '件名だけでは判定できない(「案件情報」のみ) — 本文を読まないと分類できない',
  },
  {
    id: 'project-04',
    email: {
      subject: 'インフラ運用エンジニア(夜勤あり)のお仕事',
      body: 'データセンター運用監視のお仕事です。24時間シフト制。\n時給換算: 3,000円相当\n必須: Linux基本操作、監視ツール(Zabbix)経験\n勤務地: 千葉県内データセンター\n交通費支給',
      sender: 'jobs@it-staffing.example.com',
    },
    expectedCategory: 'project',
    note: 'SES用語(単価/月など)が少なく、時給・シフトなど一般求人寄りの表現',
  },
  {
    id: 'project-05',
    email: {
      subject: '複数案件のご案内(2025年12月版)',
      body:
        '今月の新着案件をまとめてご案内します。\n\n1) AWS環境構築案件 / 東京 / 75万円 / AWS,Docker\n2) 社内SE(製造業) / 埼玉 / 55万円 / Excel VBA,ネットワーク\n3) React フロントエンド開発 / フルリモート / 65万円 / React,TypeScript\n\nご興味のある案件がございましたら番号でご返信ください。',
      sender: 'newsletter@ses-agency.example.com',
      attachmentNames: ['案件一覧_2025年12月.xlsx'],
    },
    expectedCategory: 'project',
    note: '複数案件を含むメール — 全体としては案件紹介なのでprojectとする',
  },
  {
    id: 'project-06',
    email: {
      subject: 'PMOご経験者様向け案件',
      body: '大手製造業向けDXプロジェクトのPMO募集です。\n単価: 90万円\n勤務地: 名古屋(常駐)\n必須: プロジェクト管理経験3年以上\n開始: 来月から',
      sender: 'recruit@consulting-ses.example.jp',
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-07',
    email: {
      subject: 'ネットワークエンジニア案件(常駐)のご紹介',
      body: '通信キャリア向けネットワーク構築・保守案件です。\nCCNA相当のスキルをお持ちの方歓迎。\n単価: 68万円/月、精算幅140-180\n勤務地: 川崎',
      sender: 'agent01@ses-connect.example.net',
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-08',
    email: {
      subject: 'ﾃﾞｰﾀｱﾅﾘｽﾄ案件のご案内です',
      body: 'いつもお世話になってます。標題の件、案件見つかったので送ります。単価72万でPython/SQL使えれば大丈夫です。場所は品川、リモート可です。良ければ折り返しください。',
      sender: 'tanaka@small-ses.example.jp',
    },
    expectedCategory: 'project',
    note: '日本語がやや崩れている・口語的だが内容は明確な案件紹介',
  },
  {
    id: 'project-09',
    email: {
      subject: 'セキュリティエンジニア案件(SOC運用)',
      body: 'SOC監視・インシデント対応の案件です。\n必須: セキュリティ運用経験、SIEM操作経験\n単価: 78万円\n勤務地: 東京(一部リモート)\n稼働: 週5日',
      sender: 'security-jobs@ses-agency.example.com',
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-10',
    email: {
      subject: 'Re: Re: Fwd: 案件のご紹介(転送)',
      body:
        '> ---------- Forwarded message ---------\n> From: agent@another-ses.example.com\n> Subject: 案件のご紹介\n>\n> スマホアプリ開発案件です。\n> スキル: Swift, Kotlin\n> 単価: 70万円\n> 勤務地: 渋谷\n\n田中さん、こちらの案件どうでしょうか。良さそうなら教えてください。',
      sender: 'yamada@partner-company.example.co.jp',
    },
    expectedCategory: 'project',
    note: '転送メール — 引用符(>)付きの元メール本文から案件情報を拾う必要がある',
  },
  {
    id: 'project-11',
    email: {
      subject: 'QAエンジニア(テスト自動化)募集',
      body: 'テスト自動化基盤構築の案件です。\n必須: Selenium, CI/CD経験\n単価: 65万円\n勤務地: フルリモート可\n稼働: 週4日〜相談可',
      sender: 'qa-team@ses-firm.example.com',
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-12',
    email: {
      subject: '案件のご連絡',
      body:
        '<div style="font-family:sans-serif"><p>お疲れ様です。&nbsp;</p><p>下記案件のご紹介です。</p><ul><li>スキル: C#, .NET&nbsp;</li><li>単価: 73万円</li><li>勤務地: 横浜</li></ul><p>&nbsp;</p></div>',
      sender: 'noreply@ses-portal.example.com',
    },
    expectedCategory: 'project',
    note: 'HTMLメールからのテキスト抽出由来のノイズ(タグ・&nbsp;)が残っている',
  },
  {
    id: 'project-13',
    email: {
      subject: '社内SE案件のご紹介(不動産業界)',
      body: '中堅不動産会社の社内SEポジションです。\nインフラ〜ヘルプデスクまで幅広く対応いただきます。\n単価: 58万円\n勤務地: 新宿\n稼働: 週5日',
      sender: 'career@it-jinzai.example.jp',
    },
    expectedCategory: 'project',
  },
  {
    id: 'project-14',
    email: {
      subject: '案件確認のお願い',
      body:
        '——署名——\n株式会社サンプルITソリューションズ\n営業部 案件担当 佐藤 太郎\n〒100-0001 東京都千代田区千代田1-1\nTEL: 03-0000-0000 / FAX: 03-0000-0001\nMail: sato@sample-it-solutions.example.co.jp\nhttps://sample-it-solutions.example.co.jp\n———————\n\nいつもお世話になっております、佐藤です。\n下記案件についてご確認をお願いいたします。\n\n案件名: 基幹システムAPI連携開発\nスキル: Node.js, TypeScript, REST API\n単価: 74万円\n勤務地: フルリモート',
      sender: 'sato@sample-it-solutions.example.co.jp',
      attachmentNames: ['会社概要.pdf', '案件詳細.docx'],
    },
    expectedCategory: 'project',
    note: '署名が長い(本文の前半が署名ブロック)',
  },

  // --------------------------------------------------------------- engineer
  {
    id: 'engineer-01',
    email: {
      subject: 'エンジニア稼働可能のご連絡(バックエンド)',
      body: '来月からの稼働に向けて対応可能なエンジニアがおります。\n言語: Java, Kotlin\n経験年数: 8年\n希望単価: 75万円\n稼働可能日: 来月1日から\nスキルシート添付します。',
      sender: 'jinzai@engineer-partners.example.com',
      attachmentNames: ['スキルシート_鈴木.xlsx'],
    },
    expectedCategory: 'engineer',
  },
  {
    id: 'engineer-02',
    email: {
      subject: 'フロントエンドエンジニアのご紹介',
      body: '弊社所属のフロントエンドエンジニアが来月より稼働可能です。\nReact/Vue.jsの実務経験5年、単価目安68万円。\n面談可能日: 今週中いつでも。\nよろしくお願いいたします。',
      sender: 'staffing@dev-partner.example.jp',
    },
    expectedCategory: 'engineer',
  },
  {
    id: 'engineer-03',
    email: {
      subject: 'スキルシート送付の件',
      body:
        '田中様\n\nお世話になっております。\n先日お話しした弊社エンジニアのスキルシートを添付にてお送りします。\nインフラエンジニア、AWS実務3年、稼働率100%対応可能です。\nご確認のほどよろしくお願いいたします。',
      sender: 'watanabe@engineer-agency.example.co.jp',
      attachmentNames: ['スキルシート_山本.pdf'],
    },
    expectedCategory: 'engineer',
  },
  {
    id: 'engineer-04',
    email: {
      subject: '稼働状況のご連絡',
      body: 'いつもお世話になっております。\n弊社エンジニア(PM経験10年)が来月中旬より空き稼働となります。\n単価80万円想定、常駐・リモートどちらも可能とのことです。',
      sender: 'pm-desk@it-human.example.com',
    },
    expectedCategory: 'engineer',
  },
  {
    id: 'engineer-05',
    email: {
      subject: 'エンジニア情報',
      body:
        '氏名: (仮)S.K\n年齢: 32歳\n経験: PHP/Laravel 6年、AWS 3年\n希望単価: 65万円〜\n稼働可能時期: 即日\n備考: リモート希望、常駐は週2日まで可',
      sender: 'coordinator@freelance-engineers.example.net',
    },
    expectedCategory: 'engineer',
    note: '件名だけでは判定できない(「エンジニア情報」のみ) — 本文の経歴・希望単価の記載で判断',
  },
  {
    id: 'engineer-06',
    email: {
      subject: 'データサイエンティスト、来月から動けます',
      body: 'こんにちは、いつもお世話になっております。\nうちのデータサイエンティスト(Python/機械学習3年)が来月頭から空くので、良い案件あれば紹介お願いします。単価は70万くらい希望とのことです。',
      sender: 'ono@small-ses.example.jp',
    },
    expectedCategory: 'engineer',
    note: '日本語が口語的・崩れているが、エンジニアの稼働状況共有という点は明確',
  },
  {
    id: 'engineer-07',
    email: {
      subject: 'アサイン先探しております',
      body: '弊社所属のインフラエンジニアのアサイン先を探しております。\nLinux/Ansible経験4年、単価60万円〜、来週から動けます。\n面談日程はご相談可能です。',
      sender: 'assign@engineer-office.example.com',
    },
    expectedCategory: 'engineer',
  },
  {
    id: 'engineer-08',
    email: {
      subject: 'モバイルアプリエンジニアの空き状況',
      body: 'iOS/Androidアプリ開発経験7年のエンジニアが来月より空きます。\n単価: 72万円想定\n稼働: フルリモート希望\nポートフォリオ・スキルシート添付いたします。',
      sender: 'mobile-team@dev-agency.example.jp',
      attachmentNames: ['ポートフォリオ.pdf', 'スキルシート.xlsx'],
    },
    expectedCategory: 'engineer',
  },
  {
    id: 'engineer-09',
    email: {
      subject: '',
      body: 'お世話になります。エンジニアの稼働可能情報を送付します。\nSalesforce開発経験5年、単価75万円、即日対応可能です。ご検討よろしくお願いします。',
      sender: 'sf-team@crm-engineers.example.com',
    },
    expectedCategory: 'engineer',
    note: '件名が空 — 本文のみで判定する必要がある',
  },
  {
    id: 'engineer-10',
    email: {
      subject: 'Fwd: エンジニア紹介の件',
      body:
        '> ---------- Forwarded message ---------\n> From: hr@another-agency.example.com\n> Subject: エンジニア紹介の件\n>\n> インフラエンジニア、Azure実務経験4年、単価68万円、来月から稼働可能です。\n\n上記、良さそうであれば面談セットしますので教えてください。',
      sender: 'kobayashi@partner-firm.example.co.jp',
    },
    expectedCategory: 'engineer',
    note: '転送メール — 引用符(>)付きの元メールにエンジニア情報がある',
  },
  {
    id: 'engineer-11',
    email: {
      subject: 'エンジニア稼働可否のご連絡',
      body:
        '<p>お世話になっております。</p><p>下記エンジニアが対応可能です。</p><ul><li>スキル: Ruby on Rails 実務5年</li><li>単価: 66万円</li><li>稼働: 週5日、来月から</li></ul>',
      sender: 'noreply@engineer-portal.example.com',
    },
    expectedCategory: 'engineer',
    note: 'HTMLメール由来のタグが本文に残っている',
  },
  {
    id: 'engineer-12',
    email: {
      subject: 'エンジニアご紹介(組込み系)',
      body:
        '——署名——\n株式会社サンプルテックパートナーズ\n人材コーディネート部 高橋 花子\nTEL: 03-1111-2222\nMail: takahashi@sample-tech-partners.example.co.jp\n———————\n\nいつもありがとうございます。\n組込みソフトウェアエンジニア(C言語10年)が来月から稼働可能です。\n単価78万円、常駐(名古屋)希望とのことです。',
      sender: 'takahashi@sample-tech-partners.example.co.jp',
    },
    expectedCategory: 'engineer',
    note: '署名が長い',
  },
  {
    id: 'engineer-13',
    email: {
      subject: 'SES用語少なめですが、人の紹介です',
      body: 'こんにちは。うちの会社にいる若手のエンジニアなんですが、来月から手が空くので誰かいい仕事あったら紹介してもらえませんか。Web制作全般できます。予算は月60万くらいで考えてます。',
      sender: 'freelance-desk@small-office.example.jp',
    },
    expectedCategory: 'engineer',
    note: 'SES業界用語(単価/稼働/スキルシート等)がほとんど使われていない',
  },
  {
    id: 'engineer-14',
    email: {
      subject: 'クラウドエンジニア空き状況(GCP)',
      body: 'GCP実務経験6年のクラウドエンジニアが再来週より空き稼働となります。\n単価: 80万円、フルリモート希望、面談は柔軟に対応可能です。',
      sender: 'gcp-team@cloud-engineers.example.com',
    },
    expectedCategory: 'engineer',
  },

  // ------------------------------------------------------------------ sales
  {
    id: 'sales-01',
    email: {
      subject: '弊社サービスのご案内(SES管理システム)',
      body: '御社のSES事業を効率化するクラウド型管理システムをご提案いたします。\n案件管理・請求書発行・稼働管理が一元化できます。\n一度オンラインでご説明のお時間をいただけますでしょうか。',
      sender: 'sales@saas-vendor.example.com',
    },
    expectedCategory: 'sales',
  },
  {
    id: 'sales-02',
    email: {
      subject: '新規開拓のご提案 - 採用支援サービス',
      body: 'エンジニア採用にお困りの企業様向けに、採用支援サービスをご提供しております。\n初回相談無料ですので、ぜひ一度お話しさせてください。',
      sender: 'ad@recruit-support.example.jp',
    },
    expectedCategory: 'sales',
  },
  {
    id: 'sales-03',
    email: {
      subject: '【広告】セミナーのご案内',
      body: 'IT業界向けDX推進セミナーを開催いたします。\n日時: 来月15日 14:00-16:00\nオンライン開催、参加費無料です。\nお申し込みは下記URLからお願いいたします。',
      sender: 'event@marketing-firm.example.com',
    },
    expectedCategory: 'sales',
  },
  {
    id: 'sales-04',
    email: {
      subject: 'エンジニア様必見!スキルアップ研修のご案内',
      body:
        'エンジニアの皆様のキャリアアップを支援する研修プログラムです。\nクラウド資格取得コース、単価アップにつながる講座を多数ご用意しております。\n受講料は特別割引中です。',
      sender: 'training@skillup-service.example.jp',
    },
    expectedCategory: 'sales',
    note: 'エンジニア募集に見えるが実際は研修サービスの営業メール',
  },
  {
    id: 'sales-05',
    email: {
      subject: '案件多数!今なら特別単価でご紹介キャンペーン中',
      body:
        '弊社の求人サイトにご登録いただくと、多数の案件情報にアクセスできます。\n今なら登録キャンペーン中、Amazonギフト券プレゼント!\n下記URLからご登録ください。',
      sender: 'promo@job-site.example.com',
    },
    expectedCategory: 'sales',
    note: '案件情報が多い風だが実態は求人サイトへの登録勧誘(営業)',
  },
  {
    id: 'sales-06',
    email: {
      subject: 'ITニュースレター登録のお願い',
      body: '最新のIT業界動向、案件トレンド、エンジニア単価相場のレポートを毎月配信しています。\n無料登録はこちらからどうぞ。',
      sender: 'newsletter@it-media.example.jp',
    },
    expectedCategory: 'sales',
  },
  {
    id: 'sales-07',
    email: {
      subject: '弊社サービス紹介の件',
      body: 'いつもお世話になっております。弊社のサービスについてご案内させてください。エンジニア単価は業界最高水準、案件も豊富ですので、ぜひ一度お話しできればと思います。',
      sender: 'biz@another-ses-vendor.example.com',
    },
    expectedCategory: 'sales',
    note: '案件と営業情報が混在 — 主目的は自社サービスの売り込みなのでsales',
  },
  {
    id: 'sales-08',
    email: {
      subject: 'ﾎﾟｲﾝﾄ還元中!ｼｽﾃﾑ導入ｷｬﾝﾍﾟｰﾝ',
      body: '勤怠・案件管理をまとめて効率化できるシステムを特別価格でご提供中です。今なら初期費用0円キャンペーン実施中!詳細は資料をご覧ください。',
      sender: 'campaign@biz-tool.example.com',
      attachmentNames: ['サービス資料.pdf'],
    },
    expectedCategory: 'sales',
  },
  {
    id: 'sales-09',
    email: {
      subject: 'すごいシステム紹介させてください!',
      body: 'いつもお世話になってます!弊社の案件管理ツール、めちゃくちゃ評判いいのでぜひ一回デモ見てもらえませんか?単価計算とかも自動でできて便利です!',
      sender: 'yamamoto@startup-tool.example.jp',
    },
    expectedCategory: 'sales',
    note: '日本語がカジュアル・崩れているが内容は自社ツールの営業',
  },
  {
    id: 'sales-10',
    email: {
      subject: '',
      body: '弊社では法人様向けにIT導入補助金の申請サポートを行っております。詳しくは資料をご確認ください。ご興味あればご連絡ください。',
      sender: 'subsidy@support-office.example.com',
    },
    expectedCategory: 'sales',
    note: '件名が空 — 本文のみで営業メールと判定する必要がある',
  },
  {
    id: 'sales-11',
    email: {
      subject: 'Fwd: サービスご紹介の件',
      body:
        '> ---------- Forwarded message ---------\n> From: sales-team@vendor.example.com\n> Subject: サービスご紹介の件\n>\n> 弊社の請求書自動化サービスをご紹介させてください。SES事業者様の業務効率化に役立ちます。\n\n一応共有しておきます。興味あれば連絡してみてください。',
      sender: 'suzuki@internal-team.example.co.jp',
    },
    expectedCategory: 'sales',
    note: '転送メール — 元メールの内容は自社サービスの営業',
  },
  {
    id: 'sales-12',
    email: {
      subject: 'システム導入のご提案',
      body:
        '<div><p>お世話になっております。</p><p>&nbsp;</p><p>案件管理・請求管理を一元化できるクラウドサービスをご提案いたします。&nbsp;</p><p>詳細資料を添付いたしますのでご確認ください。</p></div>',
      sender: 'noreply@cloud-vendor.example.com',
      attachmentNames: ['提案資料.pdf'],
    },
    expectedCategory: 'sales',
    note: 'HTMLメール由来のノイズ(&nbsp;等)を含む',
  },
  {
    id: 'sales-13',
    email: {
      subject: 'サービスご案内',
      body:
        '——署名——\n株式会社サンプルクラウドサービス\n営業部 中村 一郎\nTEL: 03-3333-4444\nMail: nakamura@sample-cloud-service.example.co.jp\n———————\n\nいつもお世話になっております。\n貴社のSES業務を支援するマッチングプラットフォームをご紹介させてください。\n月額プランのご案内資料を添付いたします。',
      sender: 'nakamura@sample-cloud-service.example.co.jp',
      attachmentNames: ['月額プラン案内.pdf'],
    },
    expectedCategory: 'sales',
    note: '署名が長い',
  },
  {
    id: 'sales-14',
    email: {
      subject: '福利厚生アウトソーシングのご案内',
      body: '貴社従業員様向けの福利厚生アウトソーシングサービスをご案内します。導入企業様には割引特典もございます。詳細資料をご確認ください。',
      sender: 'welfare@outsourcing-service.example.jp',
    },
    expectedCategory: 'sales',
    note: 'SES用語がほぼ登場しない一般的な営業メール',
  },

  // ------------------------------------------------------------------ other
  {
    id: 'other-01',
    email: {
      subject: 'パスワード変更のお知らせ',
      body: 'ご利用中のアカウントのパスワードが変更されました。\nお心当たりのない場合は至急サポートまでご連絡ください。',
      sender: 'noreply@account-service.example.com',
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-02',
    email: {
      subject: '請求書送付のご連絡',
      body: '先月分のご利用料金の請求書を添付いたします。お支払い期限は今月末日です。ご確認のほどよろしくお願いいたします。',
      sender: 'billing@office-service.example.com',
      attachmentNames: ['請求書_2025年11月分.pdf'],
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-03',
    email: {
      subject: 'Re: 打ち合わせ日程の件',
      body: 'ご連絡ありがとうございます。来週火曜14時で問題ございません。よろしくお願いいたします。',
      sender: 'staff@internal-company.example.co.jp',
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-04',
    email: {
      subject: '休暇のお知らせ',
      body: '誠に勝手ながら、下記期間を休業とさせていただきます。\n休業期間: 12月29日〜1月3日\nご不便をおかけしますがよろしくお願いいたします。',
      sender: 'admin@some-company.example.com',
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-05',
    email: {
      subject: '配信停止手続き完了のお知らせ',
      body: 'メールマガジンの配信停止手続きが完了しました。今後の配信はございません。',
      sender: 'noreply@newsletter-service.example.com',
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-06',
    email: {
      subject: '',
      body: 'お問い合わせいただきありがとうございます。担当より改めてご連絡いたします。',
      sender: 'contact@some-office.example.jp',
    },
    expectedCategory: 'other',
    note: '件名が空、内容も一般的な事務連絡',
  },
  {
    id: 'other-07',
    email: {
      subject: '同窓会のご案内',
      body: '来年3月に同窓会を開催します。参加可否を今月末までにご返信ください。会場は例年通りのホテルです。',
      sender: 'reunion@alumni-group.example.com',
    },
    expectedCategory: 'other',
    note: 'SESと無関係な一般的な案内メール',
  },
  {
    id: 'other-08',
    email: {
      subject: 'Fwd: 社内イベントのご案内',
      body:
        '> ---------- Forwarded message ---------\n> From: hr@internal.example.com\n> Subject: 社内イベントのご案内\n>\n> 年末懇親会を開催します。参加希望の方は今週中にご連絡ください。\n\n参加される方は教えてください。',
      sender: 'staff2@internal.example.com',
    },
    expectedCategory: 'other',
    note: '転送メールだが内容はSESと無関係な社内イベント連絡',
  },
  {
    id: 'other-09',
    email: {
      subject: 'システムメンテナンスのお知らせ',
      body: '<p>下記日程でシステムメンテナンスを実施いたします。&nbsp;</p><p>日時: 来週土曜 2:00-5:00</p><p>この間サービスをご利用いただけません。</p>',
      sender: 'noreply@platform-ops.example.com',
    },
    expectedCategory: 'other',
    note: 'HTMLメール由来のノイズを含む事務連絡',
  },
  {
    id: 'other-10',
    email: {
      subject: 'ありがとうございました',
      body:
        '——署名——\n株式会社サンプル商事\n総務部 小林 次郎\nTEL: 03-5555-6666\n———————\n\n先日はお時間いただきありがとうございました。今後ともよろしくお願いいたします。',
      sender: 'kobayashi2@sample-shoji.example.co.jp',
    },
    expectedCategory: 'other',
    note: '署名が長いが内容は単純な御礼メール',
  },
  {
    id: 'other-11',
    email: {
      subject: 'ﾌｧｲﾙ共有ｻｰﾋﾞｽ利用制限のお知らせ',
      body: '来月からファイル共有サービスの容量制限が変更になります。詳細はヘルプページをご確認ください。',
      sender: 'noreply@file-service.example.com',
    },
    expectedCategory: 'other',
    note: '崩れた表記(半角カナ)を含む一般的なお知らせ',
  },
  {
    id: 'other-12',
    email: {
      subject: 'アンケートのお願い',
      body: '先日ご利用いただいたサービスについて、簡単なアンケートにご協力いただけますでしょうか。所要時間は3分程度です。',
      sender: 'survey@service-provider.example.com',
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-13',
    email: {
      subject: '会議室予約確認',
      body: '来週水曜10:00からの会議室予約を確認しました。人数変更がある場合はご連絡ください。',
      sender: 'facility@internal-office.example.com',
    },
    expectedCategory: 'other',
  },
  {
    id: 'other-14',
    email: {
      subject: 'すみません、間違えて送ってしまいました',
      body: 'すみません、先ほどのメールは別の方宛でした。お手数ですが破棄してください。',
      sender: 'someone@random-address.example.com',
    },
    expectedCategory: 'other',
    note: '日本語は崩れていないが内容自体が非定型・SESと無関係',
  },
];
