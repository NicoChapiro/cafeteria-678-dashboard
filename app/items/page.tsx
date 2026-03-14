'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '@/src/components/feedback/EmptyState';
import type { Item } from '@/src/domain/types';
import { listItems } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | 'g' | 'ml' | 'unit'>('all');

  useEffect(() => {
    setItems(listItems());
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(normalizedSearch);
        const matchesUnit = unitFilter === 'all' || item.baseUnit === unitFilter;

        return matchesSearch && matchesUnit;
      }),
    [items, normalizedSearch, unitFilter],
  );

  const unitItemCount = items.filter((item) => item.baseUnit === 'unit').length;

  const filterButtonStyle = (selected: boolean) =>
    selected
      ? { background: 'rgba(72, 102, 48, 0.14)', borderColor: 'rgba(72, 102, 48, 0.4)' }
      : undefined;

  return (
    <main className="pageStack">
      <div className="listPageHeader">
        <div>
          <h1 style={{ marginBottom: 6 }}>Listado de ítems</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Encuentra insumos por nombre y unidad base para abrir el ítem correcto más rápido.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge badge--neutral">Total: {items.length}</span>
            <span className="badge badge--neutral">Unidad base «unit»: {unitItemCount}</span>
          </div>
        </div>
        <Link href="/items/new" className="btn" style={{ alignSelf: 'center' }}>
          + Crear nuevo ítem
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 0, maxWidth: 860 }}>
        <label htmlFor="items-search" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
          Buscar y filtrar ítems
        </label>
        <p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
          Combina búsqueda y unidad base para reducir el listado más rápido.
        </p>
        <input
          id="items-search"
          name="items-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Harina, Leche, Azúcar..."
          className="input"
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className={unitFilter === 'all' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(unitFilter === 'all')}
            onClick={() => setUnitFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={unitFilter === 'g' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(unitFilter === 'g')}
            onClick={() => setUnitFilter('g')}
          >
            g
          </button>
          <button
            type="button"
            className={unitFilter === 'ml' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(unitFilter === 'ml')}
            onClick={() => setUnitFilter('ml')}
          >
            ml
          </button>
          <button
            type="button"
            className={unitFilter === 'unit' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(unitFilter === 'unit')}
            onClick={() => setUnitFilter('unit')}
          >
            unit
          </button>
          <span className="badge badge--info">Mostrando: {filteredItems.length}</span>
        </div>
      </div>

      <div className="tableWrap listPageTable">
        <table className="table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Unidad base</th>
              <th style={{ textAlign: 'right' }}>Rendimiento por defecto</th>
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
                    Abrir ítem
                  </Link>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 18 }}>
                  <EmptyState
                    tone="info"
                    title={items.length === 0 ? 'No hay ítems creados todavía.' : 'Sin resultados para la búsqueda actual.'}
                    description={
                      items.length === 0
                        ? 'Crea tu primer ítem para comenzar a gestionar insumos y costos.'
                        : 'Ajusta el nombre buscado para encontrar otros ítems.'
                    }
                    action={
                      items.length === 0 ? (
                        <Link href="/items/new" className="btn" style={{ display: 'inline-block' }}>
                          + Crear nuevo ítem
                        </Link>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
