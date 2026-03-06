'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

type MarginStatusTone = 'ok' | 'attention' | 'critical' | 'na';

type MarginStatus = {
  tone: MarginStatusTone;
  display: string;
};

const SORT_KEYS: SortKey[] = ['name', 'marginPctAsc', 'marginClpAsc', 'costClpDesc'];

function isSortKey(value: string): value is SortKey {
  return SORT_KEYS.includes(value as SortKey);
}

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

function getMarginStatus(marginPct: number | null): MarginStatus {
  if (marginPct === null) {
    return { tone: 'na', display: 'N/D' };
  }

  if (marginPct < 20) {
    return { tone: 'critical', display: `Crítico · ${Math.round(marginPct)}%` };
  }

  if (marginPct < 35) {
    return { tone: 'attention', display: `Atención · ${Math.round(marginPct)}%` };
  }

  return { tone: 'ok', display: `OK · ${Math.round(marginPct)}%` };
}

function hasMissingPrice(costing: ProductAsOfResult): boolean {
  return costing.priceClp === null;
}

function hasMissingCosts(costing: ProductAsOfResult): boolean {
  return costing.missingItems.length > 0;
}

function hasUnsupportedRecipe(costing: ProductAsOfResult): boolean {
  return costing.unsupportedLineTypesFound;
}

function hasIssuesCosting(costing: ProductAsOfResult): boolean {
  return hasMissingPrice(costing) || hasMissingCosts(costing) || hasUnsupportedRecipe(costing);
}

type DrawerAction = {
  label: string;
  href: string;
  tone: 'warn' | 'info';
  description?: string;
};

function buildDrawerActions(productId: string, costing: ProductAsOfResult, branch: Branch, asOfDate: string): DrawerAction[] {
  const actions: DrawerAction[] = [];

  if (hasMissingPrice(costing)) {
    actions.push({
      label: 'Definir precio',
      href: `/products/${productId}`,
      tone: 'warn',
      description: `Falta precio vigente para ${branch} al ${asOfDate}.`,
    });
  }

  if (hasMissingCosts(costing)) {
    const firstMissing = costing.missingItems[0];
    actions.push({
      label: firstMissing ? 'Completar costo de item' : 'Revisar costo',
      href: firstMissing ? `/items/${firstMissing.id}` : `/products/${productId}`,
      tone: 'warn',
      description: firstMissing
        ? `Primer item sin costo: ${firstMissing.name}.`
        : 'Faltan costos para calcular el costo unitario.',
    });
  }

  if (actions.length === 0) {
    actions.push({
      label: 'Ver producto',
      href: `/products/${productId}`,
      tone: 'info',
      description: 'Sin acciones pendientes. Puedes revisar la ficha del producto.',
    });
  }

  return actions;
}

function getBadgeTone(badge: string): 'warn' | 'info' {
  const normalized = badge.toLocaleLowerCase('es-CL');
  const isWarn =
    normalized.includes('sin costo') ||
    normalized.includes('sin precio') ||
    normalized.startsWith('faltan costos');

  if (isWarn) {
    return 'warn';
  }
  return 'info';
}


function DriverBars({ drivers }: { drivers: ProductAsOfResult['drivers'] }) {
  const maxLineCost = Math.max(...drivers.map((driver) => driver.lineCostClp), 0);

  return (
    <div style={{ marginTop: 10 }}>
      <strong>Top 5 drivers</strong>
      <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
        {drivers.map((driver) => {
          const widthPct = maxLineCost > 0 ? (driver.lineCostClp / maxLineCost) * 100 : 0;
          return (
            <div key={`${driver.itemId}-${driver.itemName}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span>{driver.itemName}</span>
                <span className="muted" style={{ fontWeight: 600 }}>{formatClp(driver.lineCostClp)}</span>
              </div>
              <div className="driverBarTrack" role="presentation">
                <div className="driverBarFill" style={{ width: `${Math.max(widthPct, 3)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [recipesById, setRecipesById] = useState<Map<string, Recipe>>(new Map());
  const [recipeLinesByRecipeId, setRecipeLinesByRecipeId] = useState<Map<string, RecipeLine[]>>(new Map());
  const [itemsById, setItemsById] = useState<Map<string, Item>>(new Map());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const restoreLastFocus = useCallback(() => {
    const lastFocusedElement = lastFocusedElementRef.current;
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
    lastFocusedElementRef.current = null;
  }, []);

  const openDrawer = useCallback((productId: string) => {
    const activeElement = document.activeElement;
    lastFocusedElementRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setSelectedProductId(productId);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedProductId(null);
    restoreLastFocus();
  }, [restoreLastFocus]);

  // URL -> State (solo al cargar)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    const branchParam = params.get('branch');
    if (branchParam && BRANCHES.includes(branchParam as Branch)) {
      setBranch(branchParam as Branch);
    }

    const asOfParam = params.get('asOf');
    if (asOfParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) {
      setAsOfDate(asOfParam);
    }

    const qParam = params.get('q');
    if (qParam) {
      setSearch(qParam);
    }

    const sortParam = params.get('sort');
    if (sortParam && isSortKey(sortParam)) {
      setSort(sortParam);
    }

    const issuesParam = params.get('issues');
    if (issuesParam === '1') {
      setOnlyIssues(true);
    }

    setIsUrlStateReady(true);
  }, []);

  // State -> URL (cuando el usuario cambia filtros)
  useEffect(() => {
    if (typeof window === 'undefined' || !isUrlStateReady) {
      return;
    }

    const params = new URLSearchParams();
    params.set('branch', branch);
    params.set('asOf', asOfDate);

    const trimmed = search.trim();
    if (trimmed) {
      params.set('q', trimmed);
    }

    if (sort !== 'name') {
      params.set('sort', sort);
    }

    if (onlyIssues) {
      params.set('issues', '1');
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [asOfDate, branch, isUrlStateReady, onlyIssues, search, sort]);

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

    const searchFiltered = normalizedQuery
      ? productComputed.filter(({ product }) =>
          product.name.toLocaleLowerCase('es-CL').includes(normalizedQuery),
        )
      : productComputed;

    const filtered = onlyIssues
      ? searchFiltered.filter(({ costing }) => hasIssuesCosting(costing))
      : searchFiltered;

    return sortProducts(filtered, sort);
  }, [onlyIssues, productComputed, search, sort]);

  const issueCount = useMemo(() => {
    return productComputed.reduce((acc, entry) => {
      return acc + (hasIssuesCosting(entry.costing) ? 1 : 0);
    }, 0);
  }, [productComputed]);

  const visibleIssueCount = useMemo(() => {
    return filteredSortedProducts.reduce((acc, entry) => {
      return acc + (hasIssuesCosting(entry.costing) ? 1 : 0);
    }, 0);
  }, [filteredSortedProducts]);

  const selected =
    selectedProductId === null
      ? null
      : filteredSortedProducts.find(({ product }) => product.id === selectedProductId) ??
        productComputed.find(({ product }) => product.id === selectedProductId) ??
        null;
  const selectedMarginStatus = selected ? getMarginStatus(selected.costing.marginPct) : null;
  const drawerActions = selected
    ? buildDrawerActions(selected.product.id, selected.costing, branch, asOfDate)
    : [];

  useEffect(() => {
    if (!selectedProductId) {
      return;
    }

    drawerCloseButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) {
        return;
      }

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!activeElement || !drawerRef.current.contains(activeElement)) {
        event.preventDefault();
        if (event.shiftKey) {
          lastElement.focus();
        } else {
          firstElement.focus();
        }
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDrawer, selectedProductId]);


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

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22 }}>
            <input
              type="checkbox"
              checked={onlyIssues}
              onChange={(event) => {
                const checked = event.target.checked;
                setOnlyIssues(checked);
                setSelectedProductId(null);
              }}
            />
            Solo con problemas
          </label>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
          <p className="muted" style={{ margin: 0 }}>
            Mostrando <strong>{filteredSortedProducts.length}</strong> de{' '}
            <strong>{productComputed.length}</strong> productos.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Con problemas:{' '}
            <strong>{onlyIssues ? visibleIssueCount : issueCount}</strong>
            {onlyIssues ? ' (en vista)' : ' (total)'}
          </p>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {filteredSortedProducts.map(({ product, costing }) => {
          const marginStatus = getMarginStatus(costing.marginPct);
          const hasIssues = hasIssuesCosting(costing);

          return (<button
            key={product.id}
            className="card"
            style={{ cursor: 'pointer', marginBottom: 0, textAlign: 'left', width: '100%' }}
            onClick={() => {
              openDrawer(product.id);
            }}
            aria-label={`Abrir detalle de ${product.name}`}
            aria-haspopup="dialog"
            type="button"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <h2 className="cardTitle" style={{ marginBottom: 10 }}>{product.name}</h2>
              <span className={`marginPill marginPill--${marginStatus.tone}`}>{marginStatus.display}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {costing.badges.map((badge) => (
                <span key={badge} className={`badge badge--${getBadgeTone(badge)}`}>{badge}</span>
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

            {costing.drivers.length > 0 ? <DriverBars drivers={costing.drivers} /> : null}

            {hasIssues ? (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btnSecondary"
                  aria-label={`Resolver problemas de ${product.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openDrawer(product.id);
                  }}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  type="button"
                >
                  Resolver
                </button>
              </div>
            ) : null}
          </button>
          );
        })}
      </section>

      {filteredSortedProducts.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>Sin productos para los filtros seleccionados.</p>
      ) : null}

      {selected ? (
        <>
          <div
            onClick={() => {
              closeDrawer();
            }}
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
            role="dialog"
            aria-modal="true"
            ref={drawerRef}
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
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0 }}>{selected.product.name}</h2>
                  {selectedMarginStatus ? (
                    <span className={`marginPill marginPill--${selectedMarginStatus.tone}`}>{selectedMarginStatus.display}</span>
                  ) : null}
                </div>
                <p className="muted" style={{ marginTop: 4 }}>
                  {branch} · {asOfDate}
                </p>
                <Link href={`/products/${selected.product.id}`} style={{ fontSize: 12, fontWeight: 600 }}>
                  Ver producto
                </Link>
              </div>
              <button
                className="btnSecondary"
                onClick={() => {
                  closeDrawer();
                  }}
                aria-label="Cerrar detalle"
                type="button"
                ref={drawerCloseButtonRef}
              >
                Cerrar
              </button>
            </div>

            <section className="card" style={{ marginTop: 12, marginBottom: 0 }}>
              <h3 style={{ marginTop: 0 }}>Acciones</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {drawerActions.map((action) => (
                  <div key={`${action.href}-${action.label}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{action.label}</strong>
                        <span className={`badge badge--${action.tone}`}>{action.tone === 'warn' ? 'Requiere atención' : 'Info'}</span>
                      </div>
                      {action.description ? (
                        <p className="muted" style={{ margin: '6px 0 0' }}>{action.description}</p>
                      ) : null}
                    </div>
                    <Link className="btnSecondary" href={action.href} style={{ whiteSpace: 'nowrap' }}>
                      Ir
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            <div>
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
              {hasMissingPrice(selected.costing) ? (
                <p className="calloutWarning" style={{ marginTop: 10 }}>
                  Falta precio vigente para {branch} al {asOfDate}. Define el precio para completar el margen.
                </p>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 14px' }}>
              {selected.costing.badges.map((badge) => (
                <span key={badge} className={`badge badge--${getBadgeTone(badge)}`}>{badge}</span>
              ))}
            </div>

            {selected.costing.drivers.length > 0 ? <DriverBars drivers={selected.costing.drivers} /> : null}

            <h3 style={{ marginTop: 0 }}>Desglose de receta (items)</h3>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty (receta/batch)</th>
                    <th>Unidad</th>
                    <th>Costo unitario efectivo</th>
                    <th>Costo línea (por unidad vendible)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.costing.breakdown.map((line) => (
                    <tr key={`${line.itemId}-${line.itemName}`} className={line.status === 'Falta costo' ? 'tableRowMissing' : undefined}>
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
                    <li key={`${entry.id}-${entry.name}`}>
                      {entry.name}{' '}
                      <Link href={`/items/${entry.id}`} style={{ fontSize: 12 }}>
                        Ir a item
                      </Link>
                    </li>
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
