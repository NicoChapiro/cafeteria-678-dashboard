'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import EmptyState from '@/src/components/feedback/EmptyState';
import type { Product } from '@/src/domain/types';
import { listProducts } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    setProducts(listProducts());
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? product.active : !product.active);

    return matchesSearch && matchesStatus;
  });

  const activeProducts = products.filter((product) => product.active).length;

  return (
    <main className="pageStack">
      <div
        className="listPageHeader"
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Productos del catálogo</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Encuentra productos por nombre y estado para abrir su ficha más rápido.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge badge--info">Total: {products.length}</span>
            <span className="badge badge--success">Activos: {activeProducts}</span>
          </div>
        </div>
        <Link href="/products/new" className="btn" style={{ alignSelf: 'center' }}>
          + Crear nuevo producto
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 0, maxWidth: 860 }}>
        <label htmlFor="product-search" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          Buscar producto
        </label>
        <input
          id="product-search"
          type="search"
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Cappuccino"
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className={statusFilter === 'all' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={statusFilter === 'active' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            onClick={() => setStatusFilter('active')}
          >
            Activos
          </button>
          <button
            type="button"
            className={statusFilter === 'inactive' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactivos
          </button>
        </div>
      </div>

      <div className="tableWrap listPageTable"><table className="table" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Activo</th>
            <th>Actualizado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map((product) => (
            <tr key={product.id}>
              <td style={{ fontWeight: 600 }}>{product.name}</td>
              <td>
                <span
                  className={`badge ${product.active ? 'badge--info' : 'badge--warn'}`}
                  style={{ minWidth: 76, justifyContent: 'center' }}
                >
                  {product.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>{formatDate(product.updatedAt)}</td>
              <td>
                <Link href={`/products/${product.id}`} className="btnSecondary">
                  Abrir ficha
                </Link>
              </td>
            </tr>
          ))}
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 18 }}>
                <EmptyState
                  tone="info"
                  title={products.length === 0 ? 'No hay productos creados todavía.' : 'Sin resultados para la búsqueda actual.'}
                  description={
                    products.length === 0
                      ? 'Crea tu primer producto para comenzar a operar el catálogo.'
                      : 'Ajusta el nombre buscado para ver otros productos.'
                  }
                  action={
                    products.length === 0 ? (
                      <Link href="/products/new" className="btn" style={{ display: 'inline-block' }}>
                        + Crear nuevo producto
                      </Link>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table></div>
    </main>
  );
}
