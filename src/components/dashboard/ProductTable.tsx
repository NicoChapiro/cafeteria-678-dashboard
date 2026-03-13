import { formatClp, formatPct, getProductCardHealth, getProductCardHealthLabel } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function ProductTable({ products, onOpen }: { products: ProductWithCosting[]; onOpen: (id: string) => void }) {
  return (
    <section className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Vista tabla</h3>
        <span className="muted" style={{ fontSize: 12 }}>{products.length} filas</span>
      </div>
      <div className="tableWrap">
        <table className="table">
          <thead><tr><th>Producto</th><th>Estado</th><th>Precio</th><th>Costo</th><th>Margen %</th><th>Alertas</th><th /></tr></thead>
          <tbody>
            {products.map((entry) => {
              const health = getProductCardHealth(entry.costing);
              const badges = entry.costing.badges.join(' · ');

              return (
                <tr key={entry.product.id}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 600 }}>{entry.product.name}</p>
                    <p className="muted" style={{ fontSize: 12 }}>{entry.product.category || 'Sin categoría'}</p>
                  </td>
                  <td><span className={`costingProductCard__stateTag costingProductCard__stateTag--${health}`}>{getProductCardHealthLabel(health)}</span></td>
                  <td>{formatClp(entry.costing.priceClp)}</td>
                  <td>{formatClp(entry.costing.costClp)}</td>
                  <td>{formatPct(entry.costing.marginPct)}</td>
                  <td>{badges || 'Sin alertas'}</td>
                  <td><button type="button" className="btnSecondary btnSmall" onClick={() => onOpen(entry.product.id)}>Ver</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
