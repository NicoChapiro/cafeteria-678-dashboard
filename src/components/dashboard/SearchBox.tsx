export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label>
      Buscar
      <input className="input" placeholder="Producto..." value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
