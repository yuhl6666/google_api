export function ProductSuggestions({ types }: { types: string[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-base font-semibold text-slate-800 mb-2">検討をおすすめする保険の種類</h3>
      {types.length === 0 ? (
        <p className="text-sm text-slate-500">現時点で緊急に検討すべき保険種類はありません。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <span key={t} className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3">
        ※特定の保険商品・保険会社を推奨するものではありません。保障の「種類」の目安としてご活用ください。
      </p>
    </div>
  );
}
