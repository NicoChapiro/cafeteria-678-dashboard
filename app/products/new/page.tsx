'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

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

      const product = upsertProduct({
        id: crypto.randomUUID(),
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        active: String(formData.get('active') ?? '') === 'on',
        recipeId: null,
      });

      router.push(`/products/${product.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al guardar');
    }
  }

  return (
    <main className="card" style={{ maxWidth: 640 }}>
      <h1>Nuevo Producto</h1>
      <p>
        <Link href="/products">Volver a productos</Link>
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Name *
          <br />
          <input className="input" name="name" required style={{ width: '100%' }} />
        </label>

        <label>
          Category
          <br />
          <input className="input" name="category" style={{ width: '100%' }} />
        </label>

        <label>
          <input name="active" type="checkbox" defaultChecked /> Active
        </label>

        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

        <button className="btn" type="submit">Guardar</button>
      </form>
    </main>
  );
}
