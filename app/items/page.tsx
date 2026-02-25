'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { Item } from '@/src/domain/types';
import { listItems } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    setItems(listItems());
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Items</h1>
      <p>
        <Link href="/items/new">Nuevo Item</Link>
      </p>

      <table style={{ borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Name
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Base Unit
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Yield
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
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{item.name}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{item.baseUnit}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {item.yieldRateDefault ?? '-'}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {formatDate(item.updatedAt)}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                <Link href={`/items/${item.id}`}>Ver detalle</Link>
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 8 }}>
                Sin items aún.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
