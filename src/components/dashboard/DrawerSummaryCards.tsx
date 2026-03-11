import { formatClp, formatPct, getMarginStatus } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function DrawerSummaryCards({ selected }: { selected: ProductWithCosting }) {
  const margin = getMarginStatus(selected.costing.marginPct);

  return (
    <div className="costingDrawerSummary">
      <article className="card costingDrawerSummary__card costingDrawerSummary__card--key" style={{ marginBottom: 0, padding: 10 }}>
        <p className="muted" style={{ fontSize: 12 }}>Precio</p>
        <strong className="costingDrawerSummary__value">{formatClp(selected.costing.priceClp)}</strong>
      </article>
      <article className="card costingDrawerSummary__card" style={{ marginBottom: 0, padding: 10 }}>
        <p className="muted" style={{ fontSize: 12 }}>Costo</p>
        <strong className="costingDrawerSummary__value">{formatClp(selected.costing.costClp)}</strong>
      </article>
      <article className="card costingDrawerSummary__card" style={{ marginBottom: 0, padding: 10 }}>
        <p className="muted" style={{ fontSize: 12 }}>Margen %</p>
        <span className={`marginPill marginPill--${margin.tone}`}>{formatPct(selected.costing.marginPct)}</span>
      </article>
      <article className="card costingDrawerSummary__card" style={{ marginBottom: 0, padding: 10 }}>
        <p className="muted" style={{ fontSize: 12 }}>Margen CLP</p>
        <strong className="costingDrawerSummary__value">{formatClp(selected.costing.marginClp)}</strong>
      </article>
    </div>
  );
}
