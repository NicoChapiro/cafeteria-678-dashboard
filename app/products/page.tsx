'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { Product } from '@/src/domain/types';
import { listProducts } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setProducts(listProducts());
  }, []);

  return (
    <main>
      <h1>Productos</h1>
      <p>
        <Link href="/products/new">Nuevo Producto</Link>
      </p>

      <div className="tableWrap"><table className="table" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Name
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Active
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Updated At
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{product.name}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {product.active ? 'Sí' : 'No'}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {formatDate(product.updatedAt)}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                <Link href={`/products/${product.id}`}>Ver detalle</Link>
              </td>
            </tr>
          ))}
          {products.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 8 }}>
                Sin productos aún.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table></div>
    </main>
  );
}
