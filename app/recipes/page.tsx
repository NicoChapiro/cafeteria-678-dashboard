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
    <main>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Gestión de recetas</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Consulta el catálogo, revisa estado y entra al detalle de cada receta.
          </p>
          <span className="badge badge--info">Total: {recipes.length}</span>
        </div>
        <Link href="/recipes/new" className="btn" style={{ alignSelf: 'center' }}>
          + Nueva receta
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <label htmlFor="recipes-search" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
          Buscar por nombre
        </label>
        <input
          id="recipes-search"
          type="search"
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Latte, Masa madre..."
        />
      </div>

      <div className="tableWrap">
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Yield</th>
              <th>Activa</th>
              <th>Actualizado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecipes.map((recipe) => (
              <tr key={recipe.id}>
                <td style={{ fontWeight: 600 }}>{recipe.name}</td>
                <td>{recipe.type}</td>
                <td>
                  {recipe.yieldQty} {recipe.yieldUnit}
                </td>
                <td>
                  <span
                    className={`badge ${recipe.active ? 'badge--info' : 'badge--warn'}`}
                    style={{ minWidth: 76, justifyContent: 'center' }}
                  >
                    {recipe.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>{formatDate(recipe.updatedAt)}</td>
                <td>
                  <Link href={`/recipes/${recipe.id}`} className="btnSecondary">
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
            {filteredRecipes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 18 }}>
                  <div className="calloutInfo">
                    {recipes.length === 0 ? (
                      <>
                        <strong>No hay recetas creadas todavía.</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          Crea tu primera receta para comenzar a gestionar costos y producción.
                        </p>
                        <Link href="/recipes/new" className="btn" style={{ display: 'inline-block', marginTop: 8 }}>
                          + Nueva receta
                        </Link>
                      </>
                    ) : (
                      <>
                        <strong>Sin resultados para la búsqueda actual.</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          Ajusta el nombre buscado para encontrar otras recetas.
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
