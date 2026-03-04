'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  Branch,
  Item,
  ItemCostVersion,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
  Recipe,
  RecipeLine,
} from '@/src/domain/types';
import {
  computeProductAsOf,
  type ProductAsOfResult,
} from '@/src/services/productCosting';
import {
  listItemCosts,
  listItems,
  listProductCosts,
  listProductPrices,
  listProducts,
  listRecipeLines,
  listRecipes,
} from '@/src/storage/local/store';

type ProductWithCosting = {
  product: Product;
  costing: ProductAsOfResult;
};

type SortKey = 'name' | 'marginPctAsc' | 'marginClpAsc' | 'costClpDesc';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoToUtcDate(value: string): Date {
  const [year, month, day] = value.split('-').map((segment) => Number(segment));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatClp(value: number | null): string {
  if (value === null) {
    return 'N/D';
  }

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value === null) {
    return 'N/D';
  }

  return `${value.toFixed(1)}%`;
}

function sortProducts(items: ProductWithCosting[], sort: SortKey): ProductWithCosting[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sort === 'name') {
      return a.product.name.localeCompare(b.product.name, 'es-CL');
    }

    if (sort === 'marginPctAsc') {
      const left = a.costing.marginPct;
      const right = b.costing.marginPct;

      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }

    if (sort === 'marginClpAsc') {
      const left = a.costing.marginClp;
      const right = b.costing.marginClp;

      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }

    const left = a.costing.costClp;
    const right = b.costing.costClp;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  });

  return sorted;
}

export default function ProductCostingPage() {
  const [branch, setBranch] = useState<Branch>('Santiago');
  const [asOfDate, setAsOfDate] = useState<string>(todayIso());
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('name');

  const [products, setProducts] = useState<Product[]>([]);
  const [recipesById, setRecipesById] = useState<Map<string, Recipe>>(new Map());
  const [recipeLinesByRecipeId, setRecipeLinesByRecipeId] = useState<Map<string, RecipeLine[]>>(new Map());
  const [itemsById, setItemsById] = useState<Map<string, Item>>(new Map());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    const loadedProducts = listProducts();
    const loadedRecipes = listRecipes();
    const loadedItems = listItems();

    setProducts(loadedProducts);
    setRecipesById(new Map(loadedRecipes.map((recipe) => [recipe.id, recipe])));
    setItemsById(new Map(loadedItems.map((item) => [item.id, item])));
    setRecipeLinesByRecipeId(
      new Map(
        loadedRecipes.map((recipe) => [recipe.id, listRecipeLines(recipe.id)]),
      ),
    );
  }, []);

  const asOf = useMemo(() => parseIsoToUtcDate(asOfDate), [asOfDate]);

  const productComputed = useMemo(() => {
    const result: ProductWithCosting[] = [];

    for (const product of products) {
      const recipe = product.recipeId ? recipesById.get(product.recipeId) ?? null : null;
      const recipeLines = product.recipeId
        ? recipeLinesByRecipeId.get(product.recipeId) ?? []
        : [];

      const productPriceVersions: ProductPriceVersion[] = listProductPrices(product.id, branch);
      const productCostVersions: ProductCostVersion[] = listProductCosts(product.id, branch);

      const itemCostVersionsByItemId = new Map<string, ItemCostVersion[]>();
      for (const line of recipeLines) {
        if (line.lineType !== 'item') {
          continue;
        }

        if (!itemCostVersionsByItemId.has(line.itemId)) {
          itemCostVersionsByItemId.set(line.itemId, listItemCosts(line.itemId, branch));
        }
      }

      const costing = computeProductAsOf({
        branch,
        asOfDate: asOf,
        product,
        recipe,
        recipeLines,
        itemsById,
        itemCostVersionsByItemId,
        productPriceVersions,
        productCostVersions,
      });

      result.push({ product, costing });
    }

    return result;
  }, [asOf, branch, itemsById, products, recipeLinesByRecipeId, recipesById]);

  const filteredSortedProducts = useMemo(() => {
    const normalizedQuery = search.trim().toLocaleLowerCase('es-CL');

    const filtered = normalizedQuery
      ? productComputed.filter(({ product }) =>
          product.name.toLocaleLowerCase('es-CL').includes(normalizedQuery),
        )
      : productComputed;

    return sortProducts(filtered, sort);
  }, [productComputed, search, sort]);

  const selected =
    selectedProductId === null
      ? null
      : filteredSortedProducts.find(({ product }) => product.id === selectedProductId) ??
        productComputed.find(({ product }) => product.id === selectedProductId) ??
        null;

  return (
    <main>
      <h1>Costos &amp; Recetas (Mockup 1)</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Costeo unitario teórico por producto para una sucursal y fecha, sin ventas ni sub-recetas.
      </p>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label>
            Sucursal
            <select className="select" value={branch} onChange={(event) => setBranch(event.target.value as Branch)}>
              {BRANCHES.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          </label>

          <label>
            Fecha (as-of)
            <input
              className="input"
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
            />
          </label>

          <label>
            Buscar producto
            <input
              className="input"
              placeholder="Ej. Cappuccino"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            Ordenar por
            <select className="select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="name">Nombre A-Z</option>
              <option value="marginPctAsc">Margen % asc</option>
              <option value="marginClpAsc">Margen CLP asc</option>
              <option value="costClpDesc">Costo CLP desc</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {filteredSortedProducts.map(({ product, costing }) => (
          <button
            key={product.id}
            className="card"
            style={{ cursor: 'pointer', marginBottom: 0, textAlign: 'left', width: '100%' }}
            onClick={() => setSelectedProductId(product.id)}
            type="button"
          >
            <h2 className="cardTitle">{product.name}</h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {costing.badges.map((badge) => (
                <span key={badge} className="badge">{badge}</span>
              ))}
            </div>

            <p style={{ margin: '6px 0' }}><strong>Costo unitario:</strong> {formatClp(costing.costClp)}</p>
            <p style={{ margin: '6px 0' }}><strong>Precio vigente:</strong> {formatClp(costing.priceClp)}</p>
            <p style={{ margin: '6px 0' }}>
              <strong>Margen teórico:</strong>{' '}
              {costing.marginClp === null || costing.marginPct === null
                ? 'N/D'
                : `${formatClp(costing.marginClp)} (${formatPct(costing.marginPct)})`}
            </p>

            {costing.drivers.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <strong>Top 5 drivers</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  {costing.drivers.map((driver) => (
                    <li key={driver.itemId}>{driver.itemName}: {formatClp(driver.lineCostClp)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </button>
        ))}
      </section>

      {filteredSortedProducts.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>Sin productos para los filtros seleccionados.</p>
      ) : null}

      {selected ? (
        <>
          <div
            onClick={() => setSelectedProductId(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.35)',
              zIndex: 40,
            }}
            aria-hidden="true"
          />

          <aside
            className="card"
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              width: 'min(720px, 96vw)',
              height: '100vh',
              zIndex: 50,
              overflow: 'auto',
              borderRadius: 0,
              marginBottom: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{selected.product.name}</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  {branch} · {asOfDate}
                </p>
              </div>
              <button className="btnSecondary" onClick={() => setSelectedProductId(null)} type="button">
                Cerrar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <p className="muted">Precio</p>
                <strong>{formatClp(selected.costing.priceClp)}</strong>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <p className="muted">Costo</p>
                <strong>{formatClp(selected.costing.costClp)}</strong>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <p className="muted">Margen</p>
                <strong>
                  {selected.costing.marginClp === null || selected.costing.marginPct === null
                    ? 'N/D'
                    : `${formatClp(selected.costing.marginClp)} (${formatPct(selected.costing.marginPct)})`}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 14px' }}>
              {selected.costing.badges.map((badge) => (
                <span key={badge} className="badge">{badge}</span>
              ))}
            </div>

            <h3 style={{ marginTop: 0 }}>Desglose de receta (items)</h3>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty (base)</th>
                    <th>Unidad</th>
                    <th>Costo unitario efectivo</th>
                    <th>Costo línea</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.costing.breakdown.map((line) => (
                    <tr key={`${line.itemId}-${line.itemName}`}>
                      <td>{line.itemName}</td>
                      <td>{line.qtyInBase}</td>
                      <td>{line.unit}</td>
                      <td>{formatClp(line.effectiveUnitCostClp)}</td>
                      <td>{formatClp(line.lineCostClp)}</td>
                      <td>{line.status}</td>
                    </tr>
                  ))}
                  {selected.costing.breakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">Sin líneas de item para este producto.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Faltan costos: {selected.costing.missingItems.length} items</strong>
              {selected.costing.missingItems.length > 0 ? (
                <ul style={{ marginTop: 6 }}>
                  {selected.costing.missingItems.map((entry) => (
                    <li key={`${entry.id}-${entry.name}`}>{entry.name}</li>
                  ))}
                </ul>
              ) : null}
              {selected.costing.unsupportedLineTypesFound ? (
                <p className="alert" style={{ marginTop: 10 }}>
                  Se detectaron sub-recetas en esta receta. Mockup 1 V1 no soporta lineType=recipe,
                  por lo que el costo del producto queda en N/D.
                </p>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}
