import Link from 'next/link';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function DrawerMissingItems({ selected }: { selected: ProductWithCosting }) {
  if (selected.costing.missingItems.length === 0) {
    return (
      <section className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ marginTop: 0 }}>Ítems sin costo</h3>
        <p className="muted">Sin faltantes. Todos los ítems del desglose tienen costo vigente.</p>
      </section>
    );
  }

  return (
    <section className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Ítems sin costo</h3>
        <span className="badge badge--warn">{selected.costing.missingItems.length} faltantes</span>
      </div>
      <ul className="costingDrawerMissingList">
        {selected.costing.missingItems.map((item) => (
          <li key={item.id} className="costingDrawerMissingList__item">
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{item.name}</p>
              <p className="muted" style={{ fontSize: 12 }}>ID: {item.id}</p>
            </div>
            <Link className="btnSecondary" href={`/items/${item.id}`}>Editar ítem</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
