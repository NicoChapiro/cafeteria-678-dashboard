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
  const [search, setSearch] = useState('');

  useEffect(() => {
    setProducts(listProducts());
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(normalizedSearch)
  );

  return (
    <main>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Gestión de productos</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Revisa catálogo, estado operativo y última actualización de cada producto.
          </p>
          <span className="badge badge--info">Total: {products.length}</span>
        </div>
        <Link href="/products/new" className="btn" style={{ alignSelf: 'center' }}>
          + Nuevo producto
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
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
      </div>

      <div className="tableWrap"><table className="table" style={{ minWidth: 700 }}>
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
                  Ver detalle →
                </Link>
              </td>
            </tr>
          ))}
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 18 }}>
                <div className="calloutInfo">
                  {products.length === 0 ? (
                    <>
                      <strong>No hay productos creados todavía.</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Crea tu primer producto para comenzar a operar el catálogo.
                      </p>
                      <Link href="/products/new" className="btn" style={{ display: 'inline-block', marginTop: 8 }}>
                        + Nuevo producto
                      </Link>
                    </>
                  ) : (
                    <>
                      <strong>Sin resultados para la búsqueda actual.</strong>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Ajusta el nombre buscado para ver otros productos.
                      </p>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table></div>
    </main>
  );
}
