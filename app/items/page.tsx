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
    <main>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Gestión de ítems</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Revisa rápidamente tus insumos, su rendimiento y fecha de actualización.
          </p>
          <span className="badge badge--info">Total: {items.length}</span>
        </div>
        <Link href="/items/new" className="btn" style={{ alignSelf: 'center' }}>
          + Crear nuevo ítem
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <label htmlFor="items-search" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          Buscar por nombre
        </label>
        <input
          id="items-search"
          name="items-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Harina, Leche, Azúcar..."
          className="input"
        />
      </div>

      <div className="tableWrap">
        <table className="table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Unidad base</th>
              <th style={{ textAlign: 'right' }}>Rendimiento</th>
              <th>Actualizado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td>{item.baseUnit}</td>
                <td style={{ textAlign: 'right' }}>{item.yieldRateDefault ?? '-'}</td>
                <td>{formatDate(item.updatedAt)}</td>
                <td>
                  <Link href={`/items/${item.id}`} className="btnSecondary">
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 18 }}>
                  <div className="calloutInfo">
                    {items.length === 0 ? (
                      <>
                        <strong>No hay ítems creados todavía.</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          Crea tu primer ítem para comenzar a gestionar insumos y costos.
                        </p>
                        <Link href="/items/new" className="btn" style={{ display: 'inline-block', marginTop: 8 }}>
                          + Crear nuevo ítem
                        </Link>
                      </>
                    ) : (
                      <>
                        <strong>Sin resultados para la búsqueda actual.</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          Ajusta el nombre buscado para encontrar otros ítems.
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
