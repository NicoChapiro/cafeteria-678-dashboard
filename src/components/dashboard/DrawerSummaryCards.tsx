import { formatClp, formatPct } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function DrawerSummaryCards({ selected }: { selected: ProductWithCosting }) {
  return <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2,minmax(120px,1fr))' }}>
    <article className="card" style={{ marginBottom: 0, padding: 10 }}><p className="muted" style={{ fontSize: 12 }}>Precio</p><strong>{formatClp(selected.costing.priceClp)}</strong></article>
    <article className="card" style={{ marginBottom: 0, padding: 10 }}><p className="muted" style={{ fontSize: 12 }}>Costo</p><strong>{formatClp(selected.costing.costClp)}</strong></article>
    <article className="card" style={{ marginBottom: 0, padding: 10 }}><p className="muted" style={{ fontSize: 12 }}>Margen %</p><strong>{formatPct(selected.costing.marginPct)}</strong></article>
    <article className="card" style={{ marginBottom: 0, padding: 10 }}><p className="muted" style={{ fontSize: 12 }}>Margen CLP</p><strong>{formatClp(selected.costing.marginClp)}</strong></article>
  </div>;
}
