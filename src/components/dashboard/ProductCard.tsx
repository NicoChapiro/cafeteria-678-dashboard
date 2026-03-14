import Link from 'next/link';

import { getCardActionLabel, getProductCardHealth } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import { ProductCardBadges } from './ProductCardBadges';
import { ProductCardMeta } from './ProductCardMeta';

type ProductCardQuickAction = { label: string; href: string };

export function ProductCard({ entry, selected, onOpen, quickAction }: { entry: ProductWithCosting; selected: boolean; onOpen: () => void; quickAction: ProductCardQuickAction }) {
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
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Link
          href={quickAction.href}
          className="btn btnSmall"
          onClick={(event) => event.stopPropagation()}
        >
          {quickAction.label}
        </Link>
        <span className="muted" style={{ fontSize: 12 }}>Más contexto en panel lateral</span>
      </div>
    </button>
  );
}
