'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import InlineAlert from '@/src/components/feedback/InlineAlert';
import type { RecipeType, YieldUnit } from '@/src/domain/types';
import { upsertRecipe } from '@/src/services/catalog/clientCatalog';

const RECIPE_TYPES: RecipeType[] = [
  'fria',
  'caliente',
  'sin_cafeina',
  'pan',
  'sandwich',
  'intermedia',
];

const YIELD_UNITS: YieldUnit[] = ['portion', 'g', 'ml', 'unit'];

function unitLabel(unit: string): string {
  return unit === 'unit' ? 'unidad' : unit;
}

export default function NewRecipePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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

      const recipe = await upsertRecipe({
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
    <main style={{ display: 'grid', gap: 16 }}>
      <p style={{ margin: 0 }}>
        <Link href="/recipes">← Volver a recetas</Link>
      </p>

      <section className="card" style={{ maxWidth: 720, display: 'grid', gap: 16 }}>
        <header style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ margin: 0 }}>Crear nueva receta</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>
            Completa los datos base para crear una receta y continuar con su configuración.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Nombre *</span>
            <input className="input" name="name" required style={{ width: '100%' }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Tipo *</span>
            <select className="input" name="type" defaultValue="fria" style={{ width: '100%' }}>
              {RECIPE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Cantidad de yield *</span>
            <input
              className="input"
              name="yieldQty"
              type="number"
              min="0.0001"
              step="0.0001"
              required
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Unidad de yield *</span>
            <select className="input" name="yieldUnit" defaultValue="portion" style={{ width: '100%' }}>
              {YIELD_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabel(unit)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input name="active" type="checkbox" defaultChecked />
            <span>Activa</span>
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
