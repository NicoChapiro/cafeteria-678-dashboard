import { formatClp, formatPct, getMarginStatus } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function ProductCardMeta({ entry }: { entry: ProductWithCosting }) {
  const margin = getMarginStatus(entry.costing.marginPct);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
      <div><p className="muted" style={{ fontSize: 12 }}>Precio</p><strong>{formatClp(entry.costing.priceClp)}</strong></div>
      <div><p className="muted" style={{ fontSize: 12 }}>Costo</p><strong>{formatClp(entry.costing.costClp)}</strong></div>
      <div><p className="muted" style={{ fontSize: 12 }}>Margen</p><span className={`marginPill marginPill--${margin.tone}`}>{formatPct(entry.costing.marginPct)}</span></div>
    </div>
  );
}
