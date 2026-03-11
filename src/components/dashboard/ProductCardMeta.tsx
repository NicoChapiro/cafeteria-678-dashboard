import {
  formatClp,
  formatPct,
  getMarginStatus,
  getProductCardHealth,
  getProductCardHealthLabel,
} from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function ProductCardMeta({ entry }: { entry: ProductWithCosting }) {
  const margin = getMarginStatus(entry.costing.marginPct);
  const health = getProductCardHealth(entry.costing);
  const recipeItemsCount = entry.costing.breakdown.length;
  const missingItemsCount = entry.costing.missingItems.length;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="costingProductCard__metrics">
        <div className="costingProductCard__metric">
          <p className="muted" style={{ fontSize: 12 }}>Precio</p>
          <strong>{formatClp(entry.costing.priceClp)}</strong>
        </div>
        <div className="costingProductCard__metric">
          <p className="muted" style={{ fontSize: 12 }}>Costo</p>
          <strong>{formatClp(entry.costing.costClp)}</strong>
        </div>
        <div className="costingProductCard__metric">
          <p className="muted" style={{ fontSize: 12 }}>Margen</p>
          <span className={`marginPill marginPill--${margin.tone}`}>{formatPct(entry.costing.marginPct)}</span>
        </div>
      </div>

      <div className="costingProductCard__contextRow">
        <span className={`costingProductCard__stateTag costingProductCard__stateTag--${health}`}>{getProductCardHealthLabel(health)}</span>
        <span className="costingProductCard__metaHint">Ítems receta: {recipeItemsCount}</span>
        {missingItemsCount > 0 ? <span className="costingProductCard__metaHint">Sin costo: {missingItemsCount}</span> : null}
      </div>
    </div>
  );
}
