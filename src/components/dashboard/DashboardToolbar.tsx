import type { Branch } from '@/src/domain/types';
import type { ViewMode } from '@/src/view-models/productCostingDashboard';
import { AsOfDateSelect } from './AsOfDateSelect';
import { BranchSelect } from './BranchSelect';
import { SearchBox } from './SearchBox';
import { ViewModeToggle } from './ViewModeToggle';

export function DashboardToolbar(props: {
  branch: Branch;
  branches: Branch[];
  asOfDate: string;
  search: string;
  viewMode: ViewMode;
  onBranchChange: (value: Branch) => void;
  onAsOfDateChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onReset: () => void;
  resetDisabled: boolean;
}) {
  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', alignItems: 'end' }}>
        <BranchSelect branch={props.branch} branches={props.branches} onChange={props.onBranchChange} />
        <AsOfDateSelect value={props.asOfDate} onChange={props.onAsOfDateChange} />
        <SearchBox value={props.search} onChange={props.onSearchChange} />
        <div>
          <p className="muted" style={{ marginBottom: 6, fontSize: 12 }}>Vista</p>
          <ViewModeToggle value={props.viewMode} onChange={props.onViewModeChange} />
        </div>
        <button type="button" className="btnSecondary" onClick={props.onReset} disabled={props.resetDisabled}>Limpiar filtros</button>
      </div>
    </section>
  );
}
