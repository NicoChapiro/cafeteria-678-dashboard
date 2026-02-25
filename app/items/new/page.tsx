'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import type { BaseUnit } from '@/src/domain/types';
import { upsertItem } from '@/src/storage/local/store';

function parseYield(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error('yieldRateDefault debe estar entre (0,1]');
  }

  return parsed;
}

export default function NewItemPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      if (!name) {
        throw new Error('name es obligatorio');
      }

      const item = upsertItem({
        id: crypto.randomUUID(),
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        baseUnit: String(formData.get('baseUnit') ?? 'g') as BaseUnit,
        yieldRateDefault: parseYield(String(formData.get('yieldRateDefault') ?? '')),
      });

      router.push(`/items/${item.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al guardar');
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Nuevo Item</h1>
      <p>
        <Link href="/items">Volver a items</Link>
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Name *
          <br />
          <input name="name" required style={{ width: '100%' }} />
        </label>

        <label>
          Category
          <br />
          <input name="category" style={{ width: '100%' }} />
        </label>

        <label>
          Base Unit *
          <br />
          <select name="baseUnit" defaultValue="g" style={{ width: '100%' }}>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="unit">unit</option>
          </select>
        </label>

        <label>
          Yield Rate Default (0-1)
          <br />
          <input name="yieldRateDefault" type="number" min="0.0001" max="1" step="0.0001" />
        </label>

        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

        <button type="submit">Guardar</button>
      </form>
    </main>
  );
}
