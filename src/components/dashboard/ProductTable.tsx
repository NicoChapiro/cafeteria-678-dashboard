import { formatClp, formatPct } from '@/src/view-models/productCostingDashboard';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function ProductTable({ products, onOpen }: { products: ProductWithCosting[]; onOpen: (id: string) => void }) {
  return (
    <div className="tableWrap">
      <table className="table">
        <thead><tr><th>Producto</th><th>Precio</th><th>Costo</th><th>Margen %</th><th>Issues</th><th /></tr></thead>
        <tbody>
          {products.map((entry) => (
            <tr key={entry.product.id}>
              <td>{entry.product.name}</td>
              <td>{formatClp(entry.costing.priceClp)}</td>
              <td>{formatClp(entry.costing.costClp)}</td>
              <td>{formatPct(entry.costing.marginPct)}</td>
              <td>{entry.costing.badges.join(' · ') || 'Sin issues'}</td>
              <td><button type="button" className="btnSecondary" onClick={() => onOpen(entry.product.id)}>Ver</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
