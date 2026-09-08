import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { DiagnosisResult } from '../../types/diagnosis';

export function RadarChartPanel({ result }: { result: DiagnosisResult }) {
  const data = [
    { subject: '死亡保障', score: Math.round(result.deathCoverage.riskScore) },
    { subject: '医療', score: Math.round(result.medicalRisk.score) },
    { subject: '就業不能', score: Math.round(result.disabilityRisk.score) },
    { subject: '資産形成', score: Math.round(result.assetFormation.score) },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-base font-semibold text-slate-800 mb-2">リスクスコア(0〜100、高いほど対策の必要性が高い)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: '#334155' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="リスクスコア" dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
