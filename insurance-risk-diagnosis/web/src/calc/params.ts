// 診断ロジックで使う前提パラメータを1箇所に集約する。
// 画面の「計算根拠」表示はここの値をそのまま参照して説明文を組み立てる。
// すべて概算目安であり、公的統計(総務省家計調査・文部科学省子供の学習費調査等)を
// 参考にした簡易モデルの係数。実額とは異なる。

export const LIVING_COST_RATIO = 0.6; // 年収に対する年間生活費の目安割合
export const PHASE_A_RATIO = 0.7; // 末子独立前(配偶者+子)の生活水準維持率
export const PHASE_B_RATIO = 0.5; // 末子独立後(配偶者のみ)の生活水準維持率
export const INDEPENDENCE_AGE = 22; // 子の独立想定年齢
export const SPOUSE_LIFE_EXPECTANCY = 90; // 配偶者の生存想定年齢

export const FUNERAL_AND_MISC_COST = 200; // 万円。葬儀費用+当面の予備費(固定値)

// 教育費ステージテーブル: 各ステージの在籍全期間にかかる総額目安(万円)
export const EDUCATION_STAGES = [
  { name: '幼稚園', startAge: 3, endAge: 6, publicTotal: 65, privateTotal: 165 },
  { name: '小学校', startAge: 6, endAge: 12, publicTotal: 211, privateTotal: 1000 },
  { name: '中学校', startAge: 12, endAge: 15, publicTotal: 162, privateTotal: 430 },
  { name: '高校', startAge: 15, endAge: 18, publicTotal: 154, privateTotal: 316 },
  { name: '大学', startAge: 18, endAge: 22, publicTotal: 243, privateTotal: 469 },
] as const;

// 遺族年金の簡易概算(万円)。実制度は複雑なため大幅に単純化している。
export const SURVIVOR_BASIC_PENSION_BASE = 78; // 遺族基礎年金 基本額(年額目安)
export const SURVIVOR_BASIC_PENSION_CHILD_ADD = 22.4; // 子1人あたり加算年額(2人目まで)
export const SURVIVOR_BASIC_PENSION_CHILD_LIMIT_AGE = 18; // 末子がこの年齢に達するまで支給
export const EMPLOYEE_PENSION_RATE = 0.05; // 遺族厚生年金の簡易係数(年収に対する年率目安)

// 医療リスクスコア
export const MEDICAL_AGE_SCORE_TABLE: Record<string, number> = {
  '20s': 5, '30s': 10, '40s': 18, '50s': 28, '60plus': 40,
};
export const MEDICAL_OCCUPATION_SCORE: Record<RiskLevelKey, number> = { low: 5, mid: 15, high: 30 };
export const MEDICAL_HISTORY_SCORE = 30;

// 就業不能リスクスコア
export const DISABILITY_OCCUPATION_SCORE: Record<RiskLevelKey, number> = { low: 10, mid: 20, high: 35 };
export const DISABILITY_AGE_SCORE_TABLE: Record<string, number> = {
  '20s': 5, '30s': 10, '40s': 15, '50s': 20, '60plus': 25,
};

// 資産形成ニーズスコア
export const RETIREMENT_AGE = 65;
export const RETIREMENT_END_AGE = 95;
export const RETIREMENT_MONTHLY_COST = 25; // 万円/月、老後生活費目安
export const PUBLIC_PENSION_MONTHLY = 15; // 万円/月、公的年金受給目安
export const ASSET_FORMATION_MAX_PREP_YEARS = 45; // 準備期間の最大想定年数(新卒〜退職)

export const SUGGESTION_THRESHOLD = 50; // この点数以上でその保険種類を提案

type RiskLevelKey = 'low' | 'mid' | 'high';

export function ageBand(age: number): '20s' | '30s' | '40s' | '50s' | '60plus' {
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60plus';
}
