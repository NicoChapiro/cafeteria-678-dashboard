import { formatClp } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import EmptyState from '@/src/components/feedback/EmptyState';

export function DrawerBreakdown({ selected }: { selected: ProductWithCosting }) {
  const hasLines = selected.costing.breakdown.length > 0;

  return (
    <section className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Desglose</h3>
        <span className="muted" style={{ fontSize: 12 }}>{selected.costing.breakdown.length} líneas</span>
      </div>

      {!hasLines ? (
        <EmptyState compact tone="warning" title="No hay líneas de desglose para este producto en la fecha seleccionada." />
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Costo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {selected.costing.breakdown.map((line) => (
                <tr key={`${line.itemId}-${line.itemName}`} className={line.status === 'Falta costo' ? 'tableRowMissing' : ''}>
                  <td>{line.itemName}</td>
                  <td>{formatClp(line.lineCostClp)}</td>
                  <td>
                    <span className={`badge ${line.status === 'Falta costo' ? 'badge--warn' : 'badge--info'}`}>{line.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
