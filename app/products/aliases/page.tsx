'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { Product } from '@/src/domain/types';
import {
  deleteProductAlias,
  listProductAliases,
  listProducts,
  type ProductAliasEntry,
  upsertProductAlias,
} from '@/src/storage/local/store';

export default function ProductAliasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [aliases, setAliases] = useState<ProductAliasEntry[]>([]);
  const [source, setSource] = useState('fudo');
  const [externalName, setExternalName] = useState('');
  const [productId, setProductId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const allProducts = listProducts();
    setProducts(allProducts);
    setAliases(listProductAliases());
    if (allProducts.length > 0) {
      setProductId(allProducts[0].id);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const sourceFromQuery = params.get('source')?.trim();
    const nameFromQuery = params.get('name')?.trim();

    setSource(sourceFromQuery || 'fudo');
    if (nameFromQuery) {
      setExternalName(nameFromQuery);
    }
  }, []);

  const productNameById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product.name]));
  }, [products]);

  function handleSaveAlias(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const normalizedSource = source.trim();
    const normalizedExternalName = externalName.trim();

    if (!normalizedSource || !normalizedExternalName || !productId) {
      setMessage('Completa source, externalName y producto.');
      return;
    }

    upsertProductAlias({
      source: normalizedSource,
      externalName: normalizedExternalName,
      productId,
    });

    setAliases(listProductAliases());
    setMessage('Alias guardado.');
  }



  function handleDeleteAlias(source: string, aliasExternalName: string): void {
    const deleted = deleteProductAlias(source, aliasExternalName);
    if (!deleted) {
      setMessage('No se pudo eliminar el alias.');
      return;
    }

    setAliases(listProductAliases());
    setMessage('Alias eliminado.');
  }

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ marginBottom: 0 }}>Aliases de productos</h1>
      <p style={{ margin: 0 }}>
        <Link href="/sales/import">Volver a importación</Link>
      </p>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Crear / actualizar alias</h2>
        <form onSubmit={handleSaveAlias} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <label>
            Source
            <br />
            <input className="input" value={source} onChange={(event) => setSource(event.target.value)} />
          </label>

          <label>
            External name
            <br />
            <input
              className="input"
              value={externalName}
              onChange={(event) => setExternalName(event.target.value)}
              autoFocus
            />
          </label>

          <label>
            Producto
            <br />
            <select
              className="select"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              disabled={products.length === 0}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <button className="btnSecondary" type="submit">
            Guardar alias
          </button>

          {message ? <p style={{ margin: 0 }}>{message}</p> : null}
        </form>
      </section>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Aliases existentes ({aliases.length})</h2>
        {aliases.length === 0 ? (
          <p style={{ margin: 0 }} className="muted">
            Aún no hay aliases.
          </p>
        ) : (
          <ul style={{ margin: 0 }}>
            {aliases.map((entry) => (
              <li key={`${entry.source}-${entry.externalName}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>
                  [{entry.source}] {entry.externalName} → {productNameById.get(entry.productId) ?? entry.productId}
                </span>
                <button
                  className="btnSecondary"
                  type="button"
                  onClick={() => handleDeleteAlias(entry.source, entry.externalName)}
                  style={{ fontSize: 12, padding: '2px 8px' }}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
