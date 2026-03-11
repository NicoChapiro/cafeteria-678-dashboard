import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import { ProductCard } from './ProductCard';

export function KanbanColumn({ title, items, selectedProductId, onOpen }: { title: string; items: ProductWithCosting[]; selectedProductId: string | null; onOpen: (id: string) => void }) {
  return (
    <section className="card" style={{ marginBottom: 0 }}>
      <h3 style={{ marginTop: 0 }}>{title} ({items.length})</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((entry) => <ProductCard key={entry.product.id} entry={entry} selected={selectedProductId === entry.product.id} onOpen={() => onOpen(entry.product.id)} />)}
      </div>
    </section>
  );
}
