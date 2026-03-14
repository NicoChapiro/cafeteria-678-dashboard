import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import { buildKanbanColumns } from '@/src/view-models/productCostingDashboard';
import { KanbanColumn } from './KanbanColumn';

type KanbanQuickAction = { label: string; href: string };

export function KanbanBoard({
  products,
  selectedProductId,
  onOpen,
  getQuickAction,
}: {
  products: ProductWithCosting[];
  selectedProductId: string | null;
  onOpen: (id: string) => void;
  getQuickAction: (entry: ProductWithCosting) => KanbanQuickAction;
}) {
  const columns = buildKanbanColumns(products);

  return (
    <section className="kanbanBoard">
      <div className="kanbanBoard__header">
        <h3 style={{ margin: 0 }}>Vista Kanban</h3>
        <p className="muted" style={{ fontSize: 12 }}>Arrastre visual por estado de costing ({products.length} productos visibles).</p>
      </div>
      <div className="kanbanBoard__grid">
        <KanbanColumn title="Saludable" tone="healthy" items={columns.healthy} selectedProductId={selectedProductId} onOpen={onOpen} getQuickAction={getQuickAction} />
        <KanbanColumn title="Sin precio" tone="warn" items={columns.missingPrice} selectedProductId={selectedProductId} onOpen={onOpen} getQuickAction={getQuickAction} />
        <KanbanColumn title="Costos faltantes" tone="warn" items={columns.missingCosts} selectedProductId={selectedProductId} onOpen={onOpen} getQuickAction={getQuickAction} />
        <KanbanColumn title="Sub-recetas" tone="critical" items={columns.unsupported} selectedProductId={selectedProductId} onOpen={onOpen} getQuickAction={getQuickAction} />
      </div>
    </section>
  );
}
