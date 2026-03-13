import { getCardActionLabel, getProductCardHealth } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import { ProductCardBadges } from './ProductCardBadges';
import { ProductCardMeta } from './ProductCardMeta';

export function ProductCard({ entry, selected, onOpen }: { entry: ProductWithCosting; selected: boolean; onOpen: () => void }) {
  const health = getProductCardHealth(entry.costing);

  return (
    <button
      type="button"
      className={`card costingProductCard costingProductCard--${health} ${selected ? 'costingProductCard--selected' : ''}`}
      onClick={onOpen}
      style={{ textAlign: 'left', marginBottom: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <div>
          <h3 style={{ margin: 0 }}>{entry.product.name}</h3>
          <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>{entry.product.category || 'Sin categoría'}</p>
        </div>
        <span className="badge badge--neutral badgeSmall">{getCardActionLabel(entry.costing)}</span>
      </div>
      <div style={{ marginTop: 8 }}><ProductCardBadges badges={entry.costing.badges} /></div>
      <div style={{ marginTop: 10 }}><ProductCardMeta entry={entry} /></div>
    </button>
  );
}
