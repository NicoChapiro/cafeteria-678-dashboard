'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Product, ProductAlias } from '@/src/domain/types';
import {
  deleteProductAlias,
  listProductAliases,
  listProducts,
  upsertProductAlias,
} from '@/src/storage/local/store';

type Message = {
  type: 'success' | 'error';
  text: string;
};

export default function ProductAliasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [externalName, setExternalName] = useState('');
  const [productId, setProductId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<Message | null>(null);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  function refresh(): void {
    const nextProducts = listProducts();
    setProducts(nextProducts);
    setAliases(listProductAliases('fudo'));
    if (!productId && nextProducts.length > 0) {
      setProductId(nextProducts[0].id);
    }
  }

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAliases = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es-CL');
    if (!term) {
      return aliases;
    }

    return aliases.filter((alias) => {
      const productName = productsById.get(alias.productId)?.name ?? '';
      return (
        alias.externalName.toLocaleLowerCase('es-CL').includes(term) ||
        productName.toLocaleLowerCase('es-CL').includes(term)
      );
    });
  }, [aliases, productsById, query]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    try {
      upsertProductAlias({
        source: 'fudo',
        externalName,
        productId,
      });
      setExternalName('');
      setMessage({ type: 'success', text: 'Alias guardado correctamente.' });
      setAliases(listProductAliases('fudo'));
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo guardar el alias.',
      });
    }
  }

  function handleDelete(aliasId: string): void {
    try {
      deleteProductAlias(aliasId);
      setAliases(listProductAliases('fudo'));
      setMessage({ type: 'success', text: 'Alias eliminado.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo eliminar el alias.',
      });
    }
  }

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1>Aliases de productos FU.DO</h1>
        <p className="muted" style={{ margin: 0 }}>
          Define equivalencias entre nombres de FU.DO y productos internos.
        </p>
      </header>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Nuevo alias</h2>
        <p className="muted" style={{ margin: 0 }}>
          Source: <strong>FU.DO</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <label>
            Nombre externo (FU.DO)
            <br />
            <input
              className="input"
              type="text"
              value={externalName}
              onChange={(event) => setExternalName(event.target.value)}
              placeholder="Ej: Cappuccino Grande"
              required
            />
          </label>

          <label>
            Producto interno
            <br />
            <select
              className="select"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
            >
              {products.length === 0 ? <option value="">No hay productos</option> : null}
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <button className="btn" type="submit" disabled={products.length === 0}>
              Guardar alias
            </button>
          </div>
        </form>

        {message ? (
          <p style={{ color: message.type === 'error' ? '#b00020' : '#0f5132', margin: 0 }}>
            {message.text}
          </p>
        ) : null}
      </section>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Aliases existentes</h2>

        <label>
          Buscar
          <br />
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre externo o producto"
          />
        </label>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>Source</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>External Name</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>Producto</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredAliases.map((alias) => (
                <tr key={alias.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{alias.source.toUpperCase()}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{alias.externalName}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                    {productsById.get(alias.productId)?.name ?? '(Producto eliminado)'}
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                    <button
                      className="btnSecondary"
                      type="button"
                      onClick={() => handleDelete(alias.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAliases.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 8 }}>
                    Sin aliases cargados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
