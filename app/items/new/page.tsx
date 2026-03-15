'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import InlineAlert from '@/src/components/feedback/InlineAlert';
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
    <main style={{ display: 'grid', gap: 16 }}>
      <p style={{ margin: 0 }}>
        <Link href="/items">← Volver a ítems</Link>
      </p>

      <section className="card" style={{ maxWidth: 720, display: 'grid', gap: 16 }}>
        <header style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ margin: 0 }}>Crear nuevo ítem</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>
            Completa los datos base para crear un ítem y continuar con su configuración.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Nombre *</span>
            <input className="input" name="name" required style={{ width: '100%' }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Categoría</span>
            <input className="input" name="category" style={{ width: '100%' }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Unidad base *</span>
            <select className="input" name="baseUnit" defaultValue="g" style={{ width: '100%' }}>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="unit">unidad</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Rendimiento por defecto (0-1)</span>
            <input
              className="input"
              name="yieldRateDefault"
              type="number"
              min="0.0001"
              max="1"
              step="0.0001"
              style={{ width: '100%' }}
            />
          </label>

          {error ? <InlineAlert tone="error">No se pudo guardar: {error}</InlineAlert> : null}

          <div>
            <button className="btn" type="submit">Guardar</button>
          </div>
        </form>
      </section>
    </main>
  );
}
