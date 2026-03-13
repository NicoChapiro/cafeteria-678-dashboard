import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import EmptyState from '@/src/components/feedback/EmptyState';
import { ProductCard } from './ProductCard';

type KanbanTone = 'healthy' | 'warn' | 'critical';

function getEmptyMessage(title: string): string {
  if (title === 'Saludable') return 'No hay productos saludables en este filtro.';
  if (title === 'Sin precio') return 'No hay productos sin precio vigente.';
  if (title === 'Costos faltantes') return 'No hay productos con costos pendientes.';
  return 'No hay productos con sub-recetas pendientes de revisión.';
}

export function KanbanColumn({ title, tone, items, selectedProductId, onOpen }: { title: string; tone: KanbanTone; items: ProductWithCosting[]; selectedProductId: string | null; onOpen: (id: string) => void }) {
  return (
    <section className={`card kanbanColumn kanbanColumn--${tone}`} style={{ marginBottom: 0 }}>
      <header className="kanbanColumn__header">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={`badge badgeSmall ${tone === 'healthy' ? 'badge--success' : 'badge--warn'}`}>{items.length}</span>
      </header>

      {items.length === 0 ? (
        <EmptyState compact title={getEmptyMessage(title)} />
      ) : (
        <div className="kanbanColumn__items">
          {items.map((entry) => <ProductCard key={entry.product.id} entry={entry} selected={selectedProductId === entry.product.id} onOpen={() => onOpen(entry.product.id)} />)}
        </div>
      )}
    </section>
  );
}
