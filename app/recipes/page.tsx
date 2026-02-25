'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { Recipe } from '@/src/domain/types';
import { listRecipes } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    setRecipes(listRecipes());
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Recetas</h1>
      <p>
        <Link href="/recipes/new">Nueva Receta</Link>
      </p>

      <table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Name
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Type
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Yield
            </th>
            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
              Active
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
          {recipes.map((recipe) => (
            <tr key={recipe.id}>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{recipe.name}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{recipe.type}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {recipe.yieldQty} {recipe.yieldUnit}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {recipe.active ? 'Sí' : 'No'}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {formatDate(recipe.updatedAt)}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                <Link href={`/recipes/${recipe.id}`}>Ver detalle</Link>
              </td>
            </tr>
          ))}
          {recipes.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 8 }}>
                Sin recetas aún.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
