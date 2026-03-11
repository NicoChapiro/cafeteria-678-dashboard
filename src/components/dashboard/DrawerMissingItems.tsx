import Link from 'next/link';
import type { ProductWithCosting } from '@/src/view-models/productCostingDashboard';

export function DrawerMissingItems({ selected }: { selected: ProductWithCosting }) {
  if (selected.costing.missingItems.length === 0) return null;
  return <section className="card" style={{ marginBottom: 0 }}><h3 style={{ marginTop: 0 }}>Items sin costo</h3><ul style={{ margin: 0, paddingLeft: 18 }}>
    {selected.costing.missingItems.map((item) => <li key={item.id}><Link href={`/items/${item.id}`}>{item.name}</Link></li>)}
  </ul></section>;
}
