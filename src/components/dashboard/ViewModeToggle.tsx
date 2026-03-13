import type { ViewMode } from '@/src/view-models/productCostingDashboard';

export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  const modes: ViewMode[] = ['cards', 'kanban', 'table'];
  return <div style={{ display: 'flex', gap: 6 }}>{modes.map((mode) => (
    <button key={mode} type="button" className="btnSecondary btnSmall" aria-pressed={value === mode} onClick={() => onChange(mode)} style={{ fontSize: 12, padding: '6px 10px' }}>
      {mode === 'cards' ? 'Cards' : mode === 'kanban' ? 'Kanban' : 'Table'}
    </button>
  ))}</div>;
}
