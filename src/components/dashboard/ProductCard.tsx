import { getCardActionLabel } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import { ProductCardBadges } from './ProductCardBadges';
import { ProductCardMeta } from './ProductCardMeta';

export function ProductCard({ entry, selected, onOpen }: { entry: ProductWithCosting; selected: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={`card costingProductCard ${selected ? 'costingProductCard--selected' : ''}`} onClick={onOpen} style={{ textAlign: 'left', marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <h3 style={{ margin: 0 }}>{entry.product.name}</h3>
        <span className="badge badge--info">{getCardActionLabel(entry.costing)}</span>
      </div>
      <div style={{ marginTop: 8 }}><ProductCardBadges badges={entry.costing.badges} /></div>
      <div style={{ marginTop: 10 }}><ProductCardMeta entry={entry} /></div>
    </button>
  );
}
