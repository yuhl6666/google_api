export function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`text-lg leading-none ${n <= value ? 'text-amber-500' : 'text-slate-300'} ${
            readOnly ? 'cursor-default' : 'cursor-pointer hover:text-amber-400'
          }`}
          aria-label={`${n}点`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
