'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import FieldHint from '@/src/components/feedback/FieldHint';
import InlineAlert from '@/src/components/feedback/InlineAlert';
import type { RecipeType, YieldUnit } from '@/src/domain/types';
import { upsertRecipe } from '@/src/storage/local/store';

const RECIPE_TYPES: RecipeType[] = [
  'fria',
  'caliente',
  'sin_cafeina',
  'pan',
  'sandwich',
  'intermedia',
];

const YIELD_UNITS: YieldUnit[] = ['portion', 'g', 'ml', 'unit'];

export default function NewRecipePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      const yieldQty = Number(formData.get('yieldQty'));

      if (!name) {
        throw new Error('name es obligatorio');
      }

      if (!Number.isFinite(yieldQty) || yieldQty <= 0) {
        throw new Error('yieldQty debe ser > 0');
      }

      const recipe = upsertRecipe({
        id: crypto.randomUUID(),
        name,
        type: String(formData.get('type') ?? 'fria') as RecipeType,
        yieldQty,
        yieldUnit: String(formData.get('yieldUnit') ?? 'portion') as YieldUnit,
        active: String(formData.get('active') ?? '') === 'on',
      });

      router.push(`/recipes/${recipe.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al guardar receta');
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <header style={{ marginBottom: 20 }}>
        <h1>Nueva receta</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>
          Crea una receta base y luego completa sus líneas de composición desde el detalle.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/recipes">← Volver al listado de recetas</Link>
        </p>
      </header>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Metadatos</h2>
        <FieldHint>Completa los campos obligatorios para poder crear la receta.</FieldHint>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            Nombre *
            <br />
            <input name="name" required style={{ width: '100%' }} />
          </label>

          <label>
            Tipo *
            <br />
            <select name="type" defaultValue="fria" style={{ width: '100%' }}>
              {RECIPE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad de yield *
            <br />
            <input name="yieldQty" type="number" min="0.0001" step="0.0001" required />
          </label>

          <label>
            Unidad de yield *
            <br />
            <select name="yieldUnit" defaultValue="portion" style={{ width: '100%' }}>
              {YIELD_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            <input name="active" type="checkbox" defaultChecked /> Activa
          </label>

          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

          <button type="submit">Guardar</button>
        </form>
      </section>
    </main>
  );
}
