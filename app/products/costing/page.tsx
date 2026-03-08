'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

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

type IssueType = 'any' | 'missingPrice' | 'missingCosts' | 'missingCostItems' | 'unsupportedRecipe';

type MarginStatusTone = 'ok' | 'attention' | 'critical' | 'na';

type MarginStatus = {
  tone: MarginStatusTone;
  display: string;
};

const SORT_KEYS: SortKey[] = ['name', 'marginPctAsc', 'marginClpAsc', 'costClpDesc'];
const ISSUE_TYPES: IssueType[] = ['any', 'missingPrice', 'missingCosts', 'missingCostItems', 'unsupportedRecipe'];

function isSortKey(value: string): value is SortKey {
  return SORT_KEYS.includes(value as SortKey);
}

function isIssueType(value: string): value is IssueType {
  return ISSUE_TYPES.includes(value as IssueType);
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

function badgeIncludes(costing: ProductAsOfResult, fragment: string): boolean {
  const normalizedFragment = fragment.toLocaleLowerCase('es-CL');
  return costing.badges.some((badge) =>
    badge.toLocaleLowerCase('es-CL').includes(normalizedFragment),
  );
}

function hasMissingPrice(costing: ProductAsOfResult): boolean {
  // Robust: si el badge existe, lo consideramos aunque el campo numérico venga “inconsistente”.
  return costing.priceClp === null || badgeIncludes(costing, 'sin precio');
}

function hasMissingCosts(costing: ProductAsOfResult): boolean {
  // "Sin costo" real = costClp === null (incluye productos sin receta y sin costo manual).
  // Ojo: mantenemos "Sub-recetas" como bucket aparte, por eso excluimos unsupported aquí.
  return costing.costClp === null && !hasUnsupportedRecipe(costing);
}

function hasMissingCostItems(costing: ProductAsOfResult): boolean {
  return costing.missingItems.length > 0;
}

function hasUnsupportedRecipe(costing: ProductAsOfResult): boolean {
  return costing.unsupportedLineTypesFound || badgeIncludes(costing, 'sub-receta');
}

function hasIssuesCosting(costing: ProductAsOfResult): boolean {
  return (
    hasMissingPrice(costing) ||
    hasMissingCosts(costing) ||
    hasMissingCostItems(costing) ||
    hasUnsupportedRecipe(costing)
  );
}

function getCardActionLabel(costing: ProductAsOfResult): string {
  if (costing.unsupportedLineTypesFound) {
    return 'Revisar receta';
  }

  if (costing.missingItems.length > 0) {
    return 'Completar costos';
  }

  if (costing.priceClp === null) {
    return 'Definir precio';
  }

  if (costing.costClp === null) {
    return 'Definir costo';
  }

  return 'Ver detalle';
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
    const isNoRecipe = costing.badges.includes('Sin receta');
    actions.push({
      label: firstMissing
        ? 'Completar costo de item'
        : isNoRecipe
          ? 'Definir costo manual'
          : 'Revisar receta',
      href: firstMissing ? `/items/${firstMissing.id}` : `/products/${productId}`,
      tone: 'warn',
      description: firstMissing
        ? `Primer item sin costo: ${firstMissing.name}.`
        : isNoRecipe
          ? `Producto sin receta: falta un costo manual vigente para ${branch} al ${asOfDate}.`
          : 'No se pudo calcular el costo de la receta. Revisa receta/yield e insumos.',
    });
  }

  if (hasUnsupportedRecipe(costing)) {
    actions.push({
      label: 'Revisar sub-recetas',
      href: `/products/${productId}`,
      tone: 'warn',
      description: 'La receta incluye sub-recetas. Mockup 1 V1 no soporta lineType=recipe y el costo queda en N/D.',
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

function getFilterButtonStyle(isActive: boolean, isDisabled: boolean) {
  const baseStyle = {
    fontSize: 12,
    padding: '4px 10px',
  };

  if (isDisabled) {
    return {
      ...baseStyle,
      opacity: 0.62,
      borderColor: 'rgba(214, 186, 232, 0.8)',
      background: 'rgba(214, 186, 232, 0.12)',
      color: 'var(--muted)',
    };
  }

  if (isActive) {
    return {
      ...baseStyle,
      borderColor: 'var(--brand-green)',
      background: 'rgba(72, 102, 48, 0.16)',
      color: 'var(--brand-green)',
      boxShadow: 'inset 0 0 0 1px rgba(72, 102, 48, 0.28)',
      fontWeight: 700,
    };
  }

  return {
    ...baseStyle,
    borderColor: 'var(--brand-lilac)',
    background: 'transparent',
    color: 'var(--brand-green)',
  };
}


function DriverBars({
  drivers,
  compact = false,
}: {
  drivers: ProductAsOfResult['drivers'];
  compact?: boolean;
}) {
  const maxLineCost = Math.max(...drivers.map((driver) => driver.lineCostClp), 0);

  return (
    <div style={{ marginTop: compact ? 8 : 10 }}>
      <strong>Top drivers</strong>
      <div style={{ marginTop: compact ? 6 : 8, display: 'grid', gap: compact ? 6 : 8 }}>
        {drivers.map((driver) => {
          const widthPct = maxLineCost > 0 ? (driver.lineCostClp / maxLineCost) * 100 : 0;
          return (
            <div key={`${driver.itemId}-${driver.itemName}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: compact ? 3 : 4 }}>
                <span style={{ fontSize: 12 }}>{driver.itemName}</span>
                <span className="muted" style={{ fontWeight: 600, fontSize: 12 }}>{formatClp(driver.lineCostClp)}</span>
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
  const [issueType, setIssueType] = useState<IssueType>('any');
  const [copiedView, setCopiedView] = useState(false);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [recipesById, setRecipesById] = useState<Map<string, Recipe>>(new Map());
  const [recipeLinesByRecipeId, setRecipeLinesByRecipeId] = useState<Map<string, RecipeLine[]>>(new Map());
  const [itemsById, setItemsById] = useState<Map<string, Item>>(new Map());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionsSectionRef = useRef<HTMLElement | null>(null);
  const breakdownSectionRef = useRef<HTMLElement | null>(null);
  const missingItemsSectionRef = useRef<HTMLElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const scrollDrawerSection = useCallback((ref: RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  const resetFilters = useCallback(() => {
    setBranch('Santiago');
    setAsOfDate(todayIso());
    setSearch('');
    setSort('name');
    setOnlyIssues(false);
    setIssueType('any');
    setSelectedProductId(null);
  }, []);

  const copyCurrentView = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedView(true);
      window.setTimeout(() => {
        setCopiedView(false);
      }, 1600);
    } catch (error) {
      console.warn('No se pudo copiar la vista actual.', error);
    }
  };

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

    const issueTypeParam = params.get('issueType');
    if (issueTypeParam && isIssueType(issueTypeParam)) {
      setIssueType(issueTypeParam as IssueType);
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
      if (issueType !== 'any') {
        params.set('issueType', issueType);
      }
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [asOfDate, branch, isUrlStateReady, issueType, onlyIssues, search, sort]);

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
        ? searchFiltered.filter(({ costing }) => {
          if (issueType === 'missingPrice') return hasMissingPrice(costing);
          if (issueType === 'missingCosts') return hasMissingCosts(costing);
          if (issueType === 'missingCostItems') return hasMissingCostItems(costing);
          if (issueType === 'unsupportedRecipe') return hasUnsupportedRecipe(costing);
          return hasIssuesCosting(costing);
        })
      : searchFiltered;

    return sortProducts(filtered, sort);
  }, [issueType, onlyIssues, productComputed, search, sort]);

  const issueStats = useMemo(() => {
    let total = 0;
    let issues = 0;
    let missingPrice = 0;
    let missingCosts = 0;
    let missingCostItems = 0;
    let unsupportedRecipe = 0;

    for (const entry of productComputed) {
      total += 1;
      if (hasIssuesCosting(entry.costing)) issues += 1;
      if (hasMissingPrice(entry.costing)) missingPrice += 1;
      if (hasMissingCosts(entry.costing)) missingCosts += 1;
      if (hasMissingCostItems(entry.costing)) missingCostItems += 1;
      if (hasUnsupportedRecipe(entry.costing)) unsupportedRecipe += 1;
    }

    return { total, issues, missingPrice, missingCosts, missingCostItems, unsupportedRecipe };
  }, [productComputed]);

  const issuesSummaryText =
    issueStats.issues > 0
      ? `${issueStats.missingPrice} sin precio · ${issueStats.missingCosts} sin costo · ${issueStats.missingCostItems} faltan costos · ${issueStats.unsupportedRecipe} sub-recetas`
      : 'Sin problemas detectados para esta sucursal y fecha.';

  const activeIssueLabel =
    !onlyIssues ? 'Todos los productos' :
    issueType === 'any' ? 'Todos los problemas' :
    issueType === 'missingPrice' ? 'Solo sin precio' :
    issueType === 'missingCosts' ? 'Solo sin costo' :
    issueType === 'missingCostItems' ? 'Solo faltan costos' :
    'Solo sub-recetas';

  const activeIssueActionText =
    !onlyIssues ? 'Revisión general' :
    issueType === 'any' ? 'Resolver problemas detectados' :
    issueType === 'missingPrice' ? 'Definir precios faltantes' :
    issueType === 'missingCosts' ? 'Completar costos faltantes' :
    issueType === 'missingCostItems' ? 'Completar costos de insumos/ítems' :
    'Revisar sub-recetas no soportadas';

  const isBaseState =
    branch === 'Santiago' &&
    asOfDate === todayIso() &&
    search.trim() === '' &&
    sort === 'name' &&
    !onlyIssues &&
    issueType === 'any' &&
    selectedProductId === null;

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
  const [primaryDrawerAction, ...secondaryDrawerActions] = drawerActions;
  const primaryDrawerIssueText = selected
    ? selected.costing.unsupportedLineTypesFound
      ? 'Este producto tiene sub-recetas no soportadas en Mockup 1 V1.'
      : selected.costing.missingItems.length > 0
        ? `Este producto tiene ${selected.costing.missingItems.length} item(s) sin costo.`
        : selected.costing.priceClp === null
          ? 'Este producto no tiene precio vigente para la sucursal y fecha seleccionadas.'
          : selected.costing.costClp === null
            ? 'Este producto no tiene costo calculable para la sucursal y fecha seleccionadas.'
            : null
    : null;
  const primaryDrawerActionText = selected
    ? selected.costing.unsupportedLineTypesFound
      ? 'Revisar receta'
      : selected.costing.missingItems.length > 0
        ? 'Completar costos de items'
        : selected.costing.priceClp === null
          ? 'Definir precio'
          : selected.costing.costClp === null
            ? 'Definir costo'
            : null
    : null;
  const compactDrawerCardStyle = { marginTop: 10, marginBottom: 0, padding: '8px 10px' } as const;
  const compactDrawerSectionTitleStyle = { margin: '0 0 6px', fontSize: 15, lineHeight: 1.25 } as const;
  const compactDrawerMutedStyle = { margin: '4px 0 0', fontSize: 12 } as const;

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

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          paddingTop: 8,
          paddingBottom: 4,
          background: 'var(--ui-bg, #f8fafc)',
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
        }}
      >
        <section className="card" style={{ marginBottom: 0, paddingTop: 12, paddingBottom: 10 }}>
          <div className="costingFiltersGrid">
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

            <label className="costingOnlyIssuesField">
              <input
                type="checkbox"
                checked={onlyIssues}
                disabled={issueStats.issues === 0}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setOnlyIssues(checked);
                  setIssueType('any');
                  setSelectedProductId(null);
                }}
              />
              Solo con problemas
            </label>
          </div>
        </section>

      </div>

      <section className="card" style={{ marginTop: 8, marginBottom: 16 }}>
        <div className="costingSummaryLayout">
          <div style={{ minWidth: 0 }}>
            <strong>Resumen</strong>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Mostrando {filteredSortedProducts.length} de {issueStats.total} productos
            </p>
            <div
              className="costingSummaryMiniBlocks"
              style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
                marginTop: 8,
              }}
            >
              <div className="costingSummaryBlock costingSummaryBlock--primary">
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Vista</p>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 16 }}>{activeIssueLabel}</p>
              </div>
              <div className="costingSummaryBlock costingSummaryBlock--primary">
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Impacto</p>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 16 }}>
                  {filteredSortedProducts.length} {onlyIssues ? 'por resolver' : 'en vista'}
                </p>
              </div>
              <div className="costingSummaryBlock costingSummaryBlock--secondary">
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Issues</p>
                <p className="muted" style={{ margin: '2px 0 0' }}>{issuesSummaryText}</p>
              </div>
              <div className="costingSummaryBlock costingSummaryBlock--secondary">
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Acción</p>
                <p className="muted" style={{ margin: '2px 0 0' }}>{activeIssueActionText}</p>
              </div>
            </div>
          </div>

          <div className="costingSummaryActionsArea">
            <div className="costingSummaryActionsRow">
              <button
                type="button"
                className="btnSecondary"
                onClick={resetFilters}
                disabled={isBaseState}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                Limpiar filtros
              </button>

              <button
                type="button"
                className="btnSecondary"
                onClick={() => {
                  void copyCurrentView();
                }}
                disabled={copiedView}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                {copiedView ? 'Copiado' : 'Copiar vista'}
              </button>
            </div>

            <div className="costingSummaryChipsRow">
              <button
                type="button"
                className="btnSecondary"
                aria-pressed={!onlyIssues}
                onClick={() => {
                  setOnlyIssues(false);
                  setIssueType('any');
                  setSelectedProductId(null);
                }}
                style={getFilterButtonStyle(!onlyIssues, false)}
              >
                Todos <span className="badge badge--info" style={{ marginLeft: 8 }}>{issueStats.total}</span>
              </button>

              <button
                type="button"
                className="btnSecondary"
                aria-pressed={onlyIssues && issueType === 'any'}
                disabled={issueStats.issues === 0}
                onClick={() => {
                  setOnlyIssues(true);
                  setIssueType('any');
                  setSelectedProductId(null);
                }}
                style={getFilterButtonStyle(onlyIssues && issueType === 'any', issueStats.issues === 0)}
              >
                Problemas <span className="badge badge--warn" style={{ marginLeft: 8 }}>{issueStats.issues}</span>
              </button>

              <button
                type="button"
                className="btnSecondary"
                aria-pressed={onlyIssues && issueType === 'missingPrice'}
                disabled={issueStats.missingPrice === 0}
                onClick={() => {
                  setOnlyIssues(true);
                  setIssueType('missingPrice');
                  setSelectedProductId(null);
                }}
                style={getFilterButtonStyle(onlyIssues && issueType === 'missingPrice', issueStats.missingPrice === 0)}
              >
                Sin precio <span className="badge badge--warn" style={{ marginLeft: 8 }}>{issueStats.missingPrice}</span>
              </button>

              <button
                type="button"
                className="btnSecondary"
                aria-pressed={onlyIssues && issueType === 'missingCosts'}
                disabled={issueStats.missingCosts === 0}
                onClick={() => {
                  setOnlyIssues(true);
                  setIssueType('missingCosts');
                  setSelectedProductId(null);
                }}
                style={getFilterButtonStyle(onlyIssues && issueType === 'missingCosts', issueStats.missingCosts === 0)}
              >
                Sin costo <span className="badge badge--warn" style={{ marginLeft: 8 }}>{issueStats.missingCosts}</span>
              </button>

              <button
                type="button"
                className="btnSecondary"
                aria-pressed={onlyIssues && issueType === 'missingCostItems'}
                disabled={issueStats.missingCostItems === 0}
                onClick={() => {
                  setOnlyIssues(true);
                  setIssueType('missingCostItems');
                  setSelectedProductId(null);
                }}
                style={getFilterButtonStyle(onlyIssues && issueType === 'missingCostItems', issueStats.missingCostItems === 0)}
              >
                Faltan costos <span className="badge badge--warn" style={{ marginLeft: 8 }}>{issueStats.missingCostItems}</span>
              </button>

              <button
                type="button"
                className="btnSecondary"
                aria-pressed={onlyIssues && issueType === 'unsupportedRecipe'}
                disabled={issueStats.unsupportedRecipe === 0}
                onClick={() => {
                  setOnlyIssues(true);
                  setIssueType('unsupportedRecipe');
                  setSelectedProductId(null);
                }}
                style={getFilterButtonStyle(onlyIssues && issueType === 'unsupportedRecipe', issueStats.unsupportedRecipe === 0)}
              >
                Sub-recetas <span className="badge badge--warn" style={{ marginLeft: 8 }}>{issueStats.unsupportedRecipe}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .costingFiltersGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          align-items: end;
        }

        .costingOnlyIssuesField {
          display: flex;
          gap: 8px;
          align-items: center;
          min-height: 38px;
        }

        .costingSummaryLayout {
          display: grid;
          gap: 16px;
          align-items: start;
          grid-template-columns: 1fr;
        }

        .costingSummaryMiniBlocks {
          grid-template-columns: 1fr !important;
        }

        .costingSummaryBlock {
          border-radius: 10px;
          padding: 8px 10px;
        }

        .costingSummaryBlock--primary {
          background: rgba(72, 102, 48, 0.08);
        }

        .costingSummaryBlock--secondary {
          background: rgba(72, 102, 48, 0.03);
        }

        .costingSummaryActionsArea {
          display: grid;
          gap: 8px;
          justify-items: start;
        }

        .costingSummaryActionsRow,
        .costingSummaryChipsRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-start;
        }

        @media (min-width: 1024px) {
          .costingFiltersGrid {
            grid-template-columns: 1.1fr 1fr 1.2fr 1fr auto;
          }

          .costingSummaryLayout {
            grid-template-columns: minmax(320px, 1.1fr) minmax(420px, 0.9fr);
          }

          .costingSummaryMiniBlocks {
            grid-template-columns: repeat(2, minmax(180px, 1fr)) !important;
          }

          .costingSummaryActionsArea {
            justify-items: end;
          }

          .costingSummaryActionsRow,
          .costingSummaryChipsRow {
            justify-content: flex-end;
          }
        }
      `}</style>

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {filteredSortedProducts.map(({ product, costing }) => {
          const marginStatus = getMarginStatus(costing.marginPct);
          const hasIssues = hasIssuesCosting(costing);
          const cardActionLabel = getCardActionLabel(costing);
          const isSelectedCard = selectedProductId === product.id;

          return (<button
            key={product.id}
            className={`card costingProductCard${isSelectedCard ? ' costingProductCard--selected' : ''}`}
            style={{ cursor: 'pointer', marginBottom: 0, textAlign: 'left', width: '100%' }}
            onClick={() => {
              openDrawer(product.id);
            }}
            aria-label={`Abrir detalle de ${product.name}`}
            aria-haspopup="dialog"
            aria-expanded={isSelectedCard}
            type="button"
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'grid', gap: 10, flex: '1 1 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <h2 className="cardTitle" style={{ marginBottom: 8 }}>{product.name}</h2>
                  <span className={`marginPill marginPill--${marginStatus.tone}`}>{marginStatus.display}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6 }}>
                  {costing.badges.map((badge) => (
                    <span key={badge} className={`badge badge--${getBadgeTone(badge)}`}>{badge}</span>
                  ))}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0 }}><strong>Costo unitario:</strong> {formatClp(costing.costClp)}</p>
                  <p style={{ margin: 0 }}><strong>Precio vigente:</strong> {formatClp(costing.priceClp)}</p>
                  <p style={{ margin: 0, gridColumn: '1 / -1' }}>
                    <strong>Margen teórico:</strong>{' '}
                    {costing.marginClp === null || costing.marginPct === null
                      ? 'N/D'
                      : `${formatClp(costing.marginClp)} (${formatPct(costing.marginPct)})`}
                  </p>
                </div>

                {costing.drivers.length > 0 ? <DriverBars drivers={costing.drivers.slice(0, 3)} /> : null}
              </div>

              <div style={{ marginTop: 12, minHeight: 30, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                {hasIssues ? (
                  <button
                    className="btnSecondary"
                    aria-label={`Abrir acción para ${product.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openDrawer(product.id);
                    }}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    type="button"
                  >
                    {cardActionLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </button>
          );
        })}
      </section>

      {filteredSortedProducts.length === 0 ? (
        onlyIssues ? (
          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <p className="calloutInfo" style={{ margin: 0 }}>
              No hay productos con problemas para esta combinación de filtros.
            </p>
            <div>
              <button
                type="button"
                className="btnSecondary"
                onClick={() => {
                  setOnlyIssues(false);
                  setIssueType('any');
                  setSelectedProductId(null);
                }}
              >
                Mostrar todos
              </button>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 16 }}>Sin productos para los filtros seleccionados.</p>
        )
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
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--card)',
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom: '1px solid var(--border)',
                boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <h2 style={{ margin: 0 }}>{selected.product.name}</h2>
                    {selectedMarginStatus ? (
                      <span className={`marginPill marginPill--${selectedMarginStatus.tone}`}>{selectedMarginStatus.display}</span>
                    ) : null}
                  </div>
                  <p className="muted" style={compactDrawerMutedStyle}>
                    {branch} · {asOfDate}
                  </p>
                  <Link href={`/products/${selected.product.id}`} style={{ fontSize: 12, fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
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
                  style={{ padding: '4px 10px' }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {primaryDrawerIssueText ? (
              <p className="calloutWarning" style={{ marginTop: 8, marginBottom: 0, padding: '8px 10px' }}>
                <strong>{primaryDrawerIssueText}</strong>
                <br />
                <span className="muted">Acción sugerida: {primaryDrawerActionText}</span>
              </p>
            ) : null}

            <section className="card" style={{ ...compactDrawerCardStyle, marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <div className="card" style={{ marginBottom: 0, padding: '8px 10px' }}>
                  <p className="muted" style={{ marginBottom: 2 }}>Precio</p>
                  <strong>{formatClp(selected.costing.priceClp)}</strong>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: '8px 10px' }}>
                  <p className="muted" style={{ marginBottom: 2 }}>Costo</p>
                  <strong>{formatClp(selected.costing.costClp)}</strong>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: '8px 10px' }}>
                  <p className="muted" style={{ marginBottom: 2 }}>Margen</p>
                  <strong>
                    {selected.costing.marginClp === null || selected.costing.marginPct === null
                      ? 'N/D'
                      : `${formatClp(selected.costing.marginClp)} (${formatPct(selected.costing.marginPct)})`}
                  </strong>
                </div>
              </div>
              {hasMissingPrice(selected.costing) ? (
                <p className="calloutWarning" style={{ marginTop: 6, marginBottom: 0, padding: '6px 10px' }}>
                  Falta precio vigente para {branch} al {asOfDate}. Define el precio para completar el margen.
                </p>
              ) : null}
            </section>

            <section className="card" style={{ ...compactDrawerCardStyle, marginTop: 8, padding: '6px 10px' }} aria-label="Navegación rápida">
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Navegación rápida</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  className="btnSecondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => {
                    scrollDrawerSection(actionsSectionRef);
                  }}
                >
                  Acciones
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => {
                    scrollDrawerSection(breakdownSectionRef);
                  }}
                >
                  Desglose
                </button>
                {selected.costing.missingItems.length > 0 ? (
                  <button
                    type="button"
                    className="btnSecondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      scrollDrawerSection(missingItemsSectionRef);
                    }}
                  >
                    Faltantes
                  </button>
                ) : null}
              </div>
            </section>

            <section ref={actionsSectionRef} className="card" style={compactDrawerCardStyle}>
              <h3 style={compactDrawerSectionTitleStyle}>Acciones</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {primaryDrawerAction ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      border: '1px solid rgba(72, 102, 48, 0.24)',
                      background: 'linear-gradient(145deg, rgba(72, 102, 48, 0.12), rgba(214, 186, 232, 0.16))',
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 17 }}>{primaryDrawerAction.label}</strong>
                        <span className={`badge badge--${primaryDrawerAction.tone}`}>
                          {primaryDrawerAction.tone === 'warn' ? 'Requiere atención' : 'Info'}
                        </span>
                      </div>
                      {primaryDrawerAction.description ? (
                        <p className="muted" style={{ margin: '6px 0 0' }}>{primaryDrawerAction.description}</p>
                      ) : null}
                    </div>
                    <Link className="btn" href={primaryDrawerAction.href} style={{ whiteSpace: 'nowrap', alignSelf: 'center', padding: '6px 12px' }}>
                      Ir primero
                    </Link>
                  </div>
                ) : null}

                {secondaryDrawerActions.map((action) => (
                  <div key={`${action.href}-${action.label}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
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

            {selected.costing.missingItems.length > 0 ? (
              <section
                className="card"
                style={compactDrawerCardStyle}
                aria-label="Vista rápida de items faltantes"
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Items por completar</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {selected.costing.missingItems.slice(0, 3).map((entry) => (
                    <Link
                      key={`quick-missing-${entry.id}-${entry.name}`}
                      href={`/items/${entry.id}`}
                      className="btnSecondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      {entry.name}
                    </Link>
                  ))}
                </div>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {selected.costing.missingItems.length > 3
                    ? `Mostrando 3 de ${selected.costing.missingItems.length} items faltantes`
                    : `${selected.costing.missingItems.length} items faltantes`}
                </p>
              </section>
            ) : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 0' }}>
              {selected.costing.badges.map((badge) => (
                <span key={badge} className={`badge badge--${getBadgeTone(badge)}`}>{badge}</span>
              ))}
            </div>

            {selected.costing.drivers.length > 0 ? <DriverBars drivers={selected.costing.drivers} compact /> : null}

            <section ref={breakdownSectionRef} className="card" style={compactDrawerCardStyle}>
              <h3 style={compactDrawerSectionTitleStyle}>Desglose de receta (items)</h3>
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
            </section>

            <section ref={missingItemsSectionRef} className="card" style={compactDrawerCardStyle}>
              <strong>Faltan costos: {selected.costing.missingItems.length} items</strong>
              {selected.costing.missingItems.length > 0 ? (
                <ul style={{ marginTop: 5, marginBottom: 0, paddingLeft: 20 }}>
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
              {selected.costing.costClp === null &&
              selected.costing.missingItems.length === 0 &&
              !selected.costing.unsupportedLineTypesFound ? (
                <p className="calloutWarning" style={{ marginTop: 10 }}>
                  Este producto no tiene costos configurados (ni receta costead(a), ni costo manual). Revisa la ficha del producto para definirlos.
                </p>
              ) : null}
              {selected.costing.unsupportedLineTypesFound ? (
                <p className="alert" style={{ marginTop: 10 }}>
                  La receta contiene líneas de sub-receta (lineType=recipe), que en Mockup 1 V1 aún no se
                  calculan automáticamente. Por eso el costo del producto queda como N/D.
                </p>
              ) : null}
            </section>
          </aside>
        </>
      ) : null}
    </main>
  );
}
