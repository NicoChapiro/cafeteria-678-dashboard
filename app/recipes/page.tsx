'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { Recipe } from '@/src/domain/types';
import { listRecipes } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setRecipes(listRecipes());
  }, []);

  const filteredRecipes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    if (!normalizedSearch) {
      return recipes;
    }

    return recipes.filter((recipe) => recipe.name.toLocaleLowerCase().includes(normalizedSearch));
  }, [recipes, search]);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Recetas</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>
            Consulta el catálogo, revisa estado y entra al detalle de cada receta.
          </p>
        </div>
        <Link
          href="/recipes/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 14px',
            borderRadius: 8,
            background: '#111827',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Nueva receta
        </Link>
      </header>

      <section
        style={{
          marginBottom: 16,
          padding: 12,
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          background: '#f9fafb',
        }}
      >
        <label htmlFor="recipes-search" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
          Buscar por nombre
        </label>
        <input
          id="recipes-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Latte, Masa madre..."
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        />
      </section>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: 12, background: '#f3f4f6' }}>
                Nombre
              </th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: 12, background: '#f3f4f6' }}>
                Tipo
              </th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: 12, background: '#f3f4f6' }}>
                Yield
              </th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: 12, background: '#f3f4f6' }}>
                Activa
              </th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: 12, background: '#f3f4f6' }}>
                Actualizado
              </th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: 12, background: '#f3f4f6' }}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecipes.map((recipe, index) => (
              <tr key={recipe.id} style={{ background: index % 2 === 0 ? '#fff' : '#fcfcfd' }}>
                <td style={{ borderBottom: '1px solid #f3f4f6', padding: 12, fontWeight: 600 }}>{recipe.name}</td>
                <td style={{ borderBottom: '1px solid #f3f4f6', padding: 12 }}>{recipe.type}</td>
                <td style={{ borderBottom: '1px solid #f3f4f6', padding: 12 }}>
                  {recipe.yieldQty} {recipe.yieldUnit}
                </td>
                <td style={{ borderBottom: '1px solid #f3f4f6', padding: 12 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      color: recipe.active ? '#166534' : '#991b1b',
                      background: recipe.active ? '#dcfce7' : '#fee2e2',
                    }}
                  >
                    {recipe.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td style={{ borderBottom: '1px solid #f3f4f6', padding: 12 }}>
                  {formatDate(recipe.updatedAt)}
                </td>
                <td style={{ borderBottom: '1px solid #f3f4f6', padding: 12 }}>
                  <Link href={`/recipes/${recipe.id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
            {recipes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Aún no tienes recetas creadas.</p>
                  <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
                    Comienza registrando tu primera receta para gestionar costos y producción.
                  </p>
                </td>
              </tr>
            ) : null}
            {recipes.length > 0 && filteredRecipes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>No encontramos recetas con ese nombre.</p>
                  <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
                    Prueba con otro término de búsqueda.
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
