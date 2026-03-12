'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import FieldHint from '@/src/components/feedback/FieldHint';
import InlineAlert from '@/src/components/feedback/InlineAlert';
import { ReturnToLink } from '@/src/components/navigation/ReturnToLink';
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
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Crear nuevo item</h1>
      <p>Completa los datos base para registrar un item en la plataforma de costeo.</p>
      <p>
        <Link href="/items">← Volver al listado de items</Link>
      </p>
      <ReturnToLink returnTo="/items" />

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h2>Datos del item</h2>
        <FieldHint>Estos datos serán la base para cargar costos y calcular rendimientos.</FieldHint>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Nombre *
            <br />
            <input name="name" required style={{ width: '100%' }} />
          </label>

          <label>
            Categoría
            <br />
            <input name="category" style={{ width: '100%' }} />
          </label>

          <label>
            Unidad base *
            <br />
            <select name="baseUnit" defaultValue="g" style={{ width: '100%' }}>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="unit">unit</option>
            </select>
          </label>

          <label>
            Rendimiento por defecto (0-1)
            <br />
            <input name="yieldRateDefault" type="number" min="0.0001" max="1" step="0.0001" />
          </label>

          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

          <button type="submit">Guardar item</button>
        </form>
      </section>
    </main>
  );
}
