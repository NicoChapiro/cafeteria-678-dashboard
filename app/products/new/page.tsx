'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import InlineAlert from '@/src/components/feedback/InlineAlert';
import { upsertProduct } from '@/src/storage/local/store';

export default function NewProductPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      if (!name) {
        throw new Error('name es obligatorio');
      }

      const wasteRatePct = Number(formData.get('wasteRatePct') ?? '3');
      if (!Number.isFinite(wasteRatePct) || wasteRatePct < 0 || wasteRatePct > 30) {
        throw new Error('merma debe estar entre 0 y 30');
      }

      const product = upsertProduct({
        id: crypto.randomUUID(),
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        active: String(formData.get('active') ?? '') === 'on',
        wasteRatePct,
        recipeId: null,
      });

      router.push(`/products/${product.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al guardar');
    }
  }

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <p style={{ margin: 0 }}>
        <Link href="/products">← Volver a productos</Link>
      </p>

      <section className="card" style={{ maxWidth: 720, display: 'grid', gap: 16 }}>
        <header style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ margin: 0 }}>Crear nuevo producto</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>
            Completa los datos base para crear un producto y continuar con su configuración.
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
            <span>Merma (%)</span>
            <input
              className="input"
              name="wasteRatePct"
              type="number"
              min="0"
              max="30"
              step="0.1"
              defaultValue="3"
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input name="active" type="checkbox" defaultChecked />
            <span>Activo</span>
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
