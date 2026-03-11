import { formatClp } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function DrawerBreakdown({ selected }: { selected: ProductWithCosting }) {
  return <section className="card" style={{ marginBottom: 8 }}><h3 style={{ marginTop: 0 }}>Breakdown</h3><div className="tableWrap"><table className="table"><thead><tr><th>Item</th><th>Costo</th><th>Estado</th></tr></thead><tbody>
    {selected.costing.breakdown.map((line) => <tr key={`${line.itemId}-${line.itemName}`} className={line.status === 'Falta costo' ? 'tableRowMissing' : ''}><td>{line.itemName}</td><td>{formatClp(line.lineCostClp)}</td><td>{line.status}</td></tr>)}
  </tbody></table></div></section>;
}
