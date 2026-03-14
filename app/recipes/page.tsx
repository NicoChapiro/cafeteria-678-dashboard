'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '@/src/components/feedback/EmptyState';
import type { Recipe } from '@/src/domain/types';
import { listRecipes } from '@/src/storage/local/store';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    setRecipes(listRecipes());
  }, []);

  const filteredRecipes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return recipes.filter((recipe) => {
      const matchesSearch = !normalizedSearch || recipe.name.toLocaleLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? recipe.active : !recipe.active);

      return matchesSearch && matchesStatus;
    });
  }, [recipes, search, statusFilter]);

  const activeRecipes = recipes.filter((recipe) => recipe.active).length;
  const inactiveRecipes = recipes.length - activeRecipes;

  const filterButtonStyle = (selected: boolean) =>
    selected
      ? { background: 'rgba(72, 102, 48, 0.14)', borderColor: 'rgba(72, 102, 48, 0.4)' }
      : undefined;

  return (
    <main className="pageStack">
      <div className="listPageHeader">
        <div>
          <h1 style={{ marginBottom: 6 }}>Listado de recetas</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Encuentra la receta correcta por nombre o estado y ábrela al instante.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge badge--neutral">Total: {recipes.length}</span>
            <span className="badge badge--success">Activas: {activeRecipes}</span>
            <span className="badge badge--warn">Inactivas: {inactiveRecipes}</span>
          </div>
        </div>
        <Link href="/recipes/new" className="btn" style={{ alignSelf: 'center' }}>
          + Crear nueva receta
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 0, maxWidth: 860 }}>
        <label htmlFor="recipes-search" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
          Buscar y filtrar recetas
        </label>
        <p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
          Aplica filtros rápidos para acotar resultados y abrir más rápido.
        </p>
        <input
          id="recipes-search"
          type="search"
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej: Latte, Masa madre..."
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className={statusFilter === 'all' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(statusFilter === 'all')}
            onClick={() => setStatusFilter('all')}
          >
            Todas
          </button>
          <button
            type="button"
            className={statusFilter === 'active' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(statusFilter === 'active')}
            onClick={() => setStatusFilter('active')}
          >
            Activas
          </button>
          <button
            type="button"
            className={statusFilter === 'inactive' ? 'btnSecondary' : 'btnSecondary btnSmall'}
            style={filterButtonStyle(statusFilter === 'inactive')}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactivas
          </button>
          <span className="badge badge--info">Mostrando: {filteredRecipes.length}</span>
        </div>
      </div>

      <div className="tableWrap listPageTable">
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Rendimiento</th>
              <th>Estado</th>
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
                    Abrir receta
                  </Link>
                </td>
              </tr>
            ))}
            {filteredRecipes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 18 }}>
                  <EmptyState
                    tone="info"
                    title={recipes.length === 0 ? 'No hay recetas creadas todavía.' : 'Sin resultados para la búsqueda actual.'}
                    description={
                      recipes.length === 0
                        ? 'Crea tu primera receta para comenzar a gestionar costos y producción.'
                        : 'Ajusta el nombre buscado para encontrar otras recetas.'
                    }
                    action={
                      recipes.length === 0 ? (
                        <Link href="/recipes/new" className="btn" style={{ display: 'inline-block' }}>
                          + Crear nueva receta
                        </Link>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
