'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { Item } from '@/src/domain/types';
import { listItems } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setItems(listItems());
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(normalizedSearch)),
    [items, normalizedSearch],
  );

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Items</h1>
          <p style={{ margin: '6px 0 0', color: '#555' }}>
            Revisa rápidamente tus insumos, su rendimiento y fecha de actualización.
          </p>
        </div>
        <Link
          href="/items/new"
          style={{
            background: '#111827',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            fontWeight: 600,
          }}
        >
          + Nuevo item
        </Link>
      </header>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: 10,
          padding: 14,
          marginBottom: 14,
          background: '#fafafa',
        }}
      >
        <label htmlFor="items-search" style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
          Buscar por nombre
        </label>
        <input
          id="items-search"
          name="items-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Harina, Leche, Azúcar..."
          style={{
            marginTop: 8,
            width: '100%',
            maxWidth: 380,
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: 8,
          }}
        />
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 760, width: '100%' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '10px 12px' }}>
                Nombre
              </th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '10px 12px' }}>
                Unidad base
              </th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'right', padding: '10px 12px' }}>
                Rendimiento
              </th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '10px 12px' }}>
                Actualizado
              </th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '10px 12px' }}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: '10px 12px', fontWeight: 600 }}>
                  {item.name}
                </td>
                <td style={{ borderBottom: '1px solid #eee', padding: '10px 12px' }}>{item.baseUnit}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '10px 12px', textAlign: 'right' }}>
                  {item.yieldRateDefault ?? '-'}
                </td>
                <td style={{ borderBottom: '1px solid #eee', padding: '10px 12px' }}>
                  {formatDate(item.updatedAt)}
                </td>
                <td style={{ borderBottom: '1px solid #eee', padding: '10px 12px' }}>
                  <Link href={`/items/${item.id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: '#555' }}>
                  {items.length === 0
                    ? 'Aún no hay items cargados. Crea uno nuevo para comenzar a gestionar costos.'
                    : 'No encontramos items que coincidan con tu búsqueda. Prueba con otro nombre.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
