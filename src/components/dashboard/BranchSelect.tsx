import type { Branch } from '@/src/domain/types';

export function BranchSelect({ branch, branches, onChange }: { branch: Branch; branches: Branch[]; onChange: (value: Branch) => void }) {
  return (
    <label>
      Sucursal
      <select className="select" value={branch} onChange={(event) => onChange(event.target.value as Branch)}>
        {branches.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}
