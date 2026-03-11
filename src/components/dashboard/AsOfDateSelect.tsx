export function AsOfDateSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label>
      Fecha
      <input className="input" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
