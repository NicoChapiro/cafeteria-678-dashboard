import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import { buildKanbanColumns } from '@/src/view-models/productCostingDashboard';
import { KanbanColumn } from './KanbanColumn';

export function KanbanBoard({ products, selectedProductId, onOpen }: { products: ProductWithCosting[]; selectedProductId: string | null; onOpen: (id: string) => void }) {
  const columns = buildKanbanColumns(products);
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(4,minmax(240px,1fr))', overflowX: 'auto' }}>
      <KanbanColumn title="Saludable" items={columns.healthy} selectedProductId={selectedProductId} onOpen={onOpen} />
      <KanbanColumn title="Sin precio" items={columns.missingPrice} selectedProductId={selectedProductId} onOpen={onOpen} />
      <KanbanColumn title="Costos faltantes" items={columns.missingCosts} selectedProductId={selectedProductId} onOpen={onOpen} />
      <KanbanColumn title="Sub-recetas" items={columns.unsupported} selectedProductId={selectedProductId} onOpen={onOpen} />
    </div>
  );
}
