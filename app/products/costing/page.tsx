'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { DashboardToolbar } from '@/src/components/dashboard/DashboardToolbar';
import { KpiStrip } from '@/src/components/dashboard/KpiStrip';
import { KanbanBoard } from '@/src/components/dashboard/KanbanBoard';
import { ProductCard } from '@/src/components/dashboard/ProductCard';
import { ProductDrawer } from '@/src/components/dashboard/ProductDrawer';
import { ProductTable } from '@/src/components/dashboard/ProductTable';
import type { DrawerAction } from '@/src/components/dashboard/DrawerActions';
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
import { computeProductAsOf } from '@/src/services/productCosting';
import { buildEditorHref } from '@/src/lib/navigation/buildReturnTo';
import {
  listItemCosts,
  listItems,
  listProductCosts,
  listProductPrices,
  listProducts,
  listRecipeLines,
  listRecipes,
} from '@/src/storage/local/store';
import {
  hasIssuesCosting,
  hasMissingCostItems,
  hasMissingCosts,
  hasMissingPrice,
  hasUnsupportedRecipe,
  sortProducts,
  type DrawerQuickNavSection,
  type IssueType,
  type ProductWithCosting,
  type SortKey,
  type ViewMode,
} from '@/src/view-models/productCostingDashboard';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];
const SORT_KEYS: SortKey[] = ['name', 'marginPctAsc', 'marginClpAsc', 'costClpDesc'];
const ISSUE_TYPES: IssueType[] = ['any', 'missingPrice', 'missingCosts', 'missingCostItems', 'unsupportedRecipe'];

const isSortKey = (value: string): value is SortKey => SORT_KEYS.includes(value as SortKey);
const isIssueType = (value: string): value is IssueType => ISSUE_TYPES.includes(value as IssueType);
const todayIso = () => new Date().toISOString().slice(0, 10);
const buildContextualReturnTo = () =>
  typeof window === 'undefined' ? '/products/costing' : `${window.location.pathname}${window.location.search}`;
const parseIsoToUtcDate = (value: string) => {
  const [year, month, day] = value.split('-').map((segment) => Number(segment));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

function buildDrawerActions(
  productId: string,
  recipeId: string | null | undefined,
  costing: ProductWithCosting['costing'],
  branch: Branch,
  asOfDate: string,
  returnTo: string,
): DrawerAction[] {
  const actions: DrawerAction[] = [];
  const baseParams = { branch, asOf: asOfDate, returnTo };

  if (hasMissingPrice(costing)) {
    actions.push({
      label: 'Editar precio',
      href: buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'price' }),
      tone: 'warn',
      ctaLabel: 'Editar precio',
      description: `Falta precio vigente para ${branch} al ${asOfDate}.`,
    });
  }

  if (hasMissingCosts(costing) && costing.badges.includes('Sin receta')) {
    actions.push({
      label: 'Editar costo manual',
      href: buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'manualCost' }),
      tone: 'warn',
      ctaLabel: 'Editar costo manual',
      description: `Producto sin receta: falta un costo manual vigente para ${branch} al ${asOfDate}.`,
    });
  }

  if (costing.missingItems.length > 0) {
    const firstMissing = costing.missingItems[0];
    actions.push({
      label: 'Editar costo faltante',
      href: buildEditorHref(`/items/${firstMissing.id}`, { ...baseParams, focus: 'cost' }),
      tone: 'warn',
      ctaLabel: 'Editar costo faltante',
      description: `Primer item sin costo: ${firstMissing.name}.`,
    });
  }

  if (hasUnsupportedRecipe(costing)) {
    actions.push({
      label: 'Revisar receta',
      href: recipeId
        ? buildEditorHref(`/recipes/${recipeId}`, { ...baseParams })
        : buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'recipePreview' }),
      tone: 'warn',
      ctaLabel: 'Revisar receta',
      description: 'La receta incluye sub-recetas.',
    });
  }

  actions.push({
    label: 'Editar producto',
    href: buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'base' }),
    tone: actions.length > 0 ? 'warn' : 'info',
    ctaLabel: 'Editar producto',
    description: 'Editar datos base y configuración del producto.',
  });

  actions.push({
    label: 'Abrir ficha completa',
    href: buildEditorHref(`/products/${productId}`, baseParams),
    tone: 'info',
    ctaLabel: 'Abrir ficha completa',
    description: 'Abrir ficha completa del producto.',
  });

  return actions;
}


type QuickAction = { label: string; href: string };

function buildPrimaryQuickAction(
  productId: string,
  recipeId: string | null | undefined,
  costing: ProductWithCosting['costing'],
  branch: Branch,
  asOfDate: string,
  returnTo: string,
): QuickAction {
  const baseParams = { branch, asOf: asOfDate, returnTo };

  if (hasMissingPrice(costing)) {
    return {
      label: 'Revisar precio',
      href: buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'price' }),
    };
  }

  if (hasMissingCosts(costing) && costing.badges.includes('Sin receta')) {
    return {
      label: 'Editar costo manual',
      href: buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'manualCost' }),
    };
  }

  if (costing.missingItems.length > 0) {
    const firstMissing = costing.missingItems[0];
    return {
      label: 'Revisar receta',
      href: buildEditorHref(`/items/${firstMissing.id}`, { ...baseParams, focus: 'cost' }),
    };
  }

  if (hasUnsupportedRecipe(costing)) {
    return {
      label: 'Revisar receta',
      href: recipeId
        ? buildEditorHref(`/recipes/${recipeId}`, baseParams)
        : buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'recipePreview' }),
    };
  }

  return {
    label: 'Editar producto',
    href: buildEditorHref(`/products/${productId}`, { ...baseParams, focus: 'base' }),
  };
}

export default function ProductCostingPage() {
  const [branch, setBranch] = useState<Branch>('Santiago');
  const [asOfDate, setAsOfDate] = useState<string>(todayIso());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [issueType, setIssueType] = useState<IssueType>('any');
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

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
  const [activeDrawerSection, setActiveDrawerSection] = useState<DrawerQuickNavSection | null>(null);

  const scrollDrawerSection = useCallback((ref: RefObject<HTMLElement | null>) => {
    const drawerElement = drawerRef.current;
    const sectionElement = ref.current;

    if (!drawerElement || !sectionElement) {
      return;
    }

    const stickyHeaderOffset = 104;
    const drawerRect = drawerElement.getBoundingClientRect();
    const sectionRect = sectionElement.getBoundingClientRect();
    const relativeTop = sectionRect.top - drawerRect.top + drawerElement.scrollTop;
    const nextTop = Math.max(0, relativeTop - stickyHeaderOffset);

    drawerElement.scrollTo({ top: nextTop, behavior: 'smooth' });
  }, []);
  const restoreLastFocus = useCallback(() => {
    const lastFocusedElement = lastFocusedElementRef.current;
    if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
    lastFocusedElementRef.current = null;
  }, []);

  const openDrawer = useCallback((productId: string) => {
    const activeElement = document.activeElement;
    lastFocusedElementRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setActiveDrawerSection(null);
    setSelectedProductId(productId);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawerSection(null);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const branchParam = params.get('branch');
    if (branchParam && BRANCHES.includes(branchParam as Branch)) setBranch(branchParam as Branch);
    const asOfParam = params.get('asOf');
    if (asOfParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) setAsOfDate(asOfParam);
    const qParam = params.get('q');
    if (qParam) setSearch(qParam);
    const sortParam = params.get('sort');
    if (sortParam && isSortKey(sortParam)) setSort(sortParam);
    const issuesParam = params.get('issues');
    if (issuesParam === '1') setOnlyIssues(true);
    const issueTypeParam = params.get('issueType');
    if (issueTypeParam && isIssueType(issueTypeParam)) setIssueType(issueTypeParam);
    setIsUrlStateReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isUrlStateReady) return;
    const params = new URLSearchParams();
    params.set('branch', branch);
    params.set('asOf', asOfDate);
    const trimmed = search.trim();
    if (trimmed) params.set('q', trimmed);
    if (sort !== 'name') params.set('sort', sort);
    if (onlyIssues) {
      params.set('issues', '1');
      if (issueType !== 'any') params.set('issueType', issueType);
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
    setRecipeLinesByRecipeId(new Map(loadedRecipes.map((recipe) => [recipe.id, listRecipeLines(recipe.id)])));
  }, []);

  const asOf = useMemo(() => parseIsoToUtcDate(asOfDate), [asOfDate]);
  const productComputed = useMemo(() => {
    const result: ProductWithCosting[] = [];
    for (const product of products) {
      const recipe = product.recipeId ? recipesById.get(product.recipeId) ?? null : null;
      const recipeLines = product.recipeId ? recipeLinesByRecipeId.get(product.recipeId) ?? [] : [];
      const productPriceVersions: ProductPriceVersion[] = listProductPrices(product.id, branch);
      const productCostVersions: ProductCostVersion[] = listProductCosts(product.id, branch);
      const itemCostVersionsByItemId = new Map<string, ItemCostVersion[]>();
      for (const line of recipeLines) {
        if (line.lineType !== 'item') continue;
        if (!itemCostVersionsByItemId.has(line.itemId)) itemCostVersionsByItemId.set(line.itemId, listItemCosts(line.itemId, branch));
      }
      const costing = computeProductAsOf({ branch, asOfDate: asOf, product, recipe, recipeLines, itemsById, itemCostVersionsByItemId, productPriceVersions, productCostVersions });
      result.push({ product, costing });
    }
    return result;
  }, [asOf, branch, itemsById, products, recipeLinesByRecipeId, recipesById]);

  const filteredSortedProducts = useMemo(() => {
    const normalizedQuery = search.trim().toLocaleLowerCase('es-CL');
    const searchFiltered = normalizedQuery ? productComputed.filter(({ product }) => product.name.toLocaleLowerCase('es-CL').includes(normalizedQuery)) : productComputed;
    const filtered = onlyIssues ? searchFiltered.filter(({ costing }) => {
      if (issueType === 'missingPrice') return hasMissingPrice(costing);
      if (issueType === 'missingCosts') return hasMissingCosts(costing);
      if (issueType === 'missingCostItems') return hasMissingCostItems(costing);
      if (issueType === 'unsupportedRecipe') return hasUnsupportedRecipe(costing);
      return hasIssuesCosting(costing);
    }) : searchFiltered;
    return sortProducts(filtered, sort);
  }, [issueType, onlyIssues, productComputed, search, sort]);

  const issueStats = useMemo(() => {
    let total = 0; let issues = 0; let missingPrice = 0; let missingCosts = 0; let missingCostItems = 0; let unsupportedRecipe = 0;
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

  const selected = selectedProductId === null ? null : filteredSortedProducts.find(({ product }) => product.id === selectedProductId) ?? productComputed.find(({ product }) => product.id === selectedProductId) ?? null;
  const returnTo = buildContextualReturnTo();
  const drawerActions = selected
    ? buildDrawerActions(
      selected.product.id,
      selected.product.recipeId,
      selected.costing,
      branch,
      asOfDate,
      returnTo,
    )
    : [];

  useEffect(() => {
    const drawerElement = drawerRef.current;
    if (!drawerElement) {
      return;
    }

    drawerElement.style.maxHeight = 'calc(100vh - 110px)';
    drawerElement.style.overflowY = 'auto';
  }, [selectedProductId]);

  useEffect(() => {
    if (!selectedProductId) return;
    drawerCloseButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusableElements = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (!activeElement || !drawerRef.current.contains(activeElement)) {
        event.preventDefault();
        if (event.shiftKey) lastElement.focus(); else firstElement.focus();
        return;
      }
      if (event.shiftKey && activeElement === firstElement) { event.preventDefault(); lastElement.focus(); return; }
      if (!event.shiftKey && activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDrawer, selectedProductId]);

  const issueSummary = `${issueStats.missingPrice} sin precio · ${issueStats.missingCosts} sin costo · ${issueStats.missingCostItems} faltan costos · ${issueStats.unsupportedRecipe} sub-recetas`;
  const isBaseState = branch === 'Santiago' && asOfDate === todayIso() && search.trim() === '' && sort === 'name' && !onlyIssues && issueType === 'any' && selectedProductId === null;
  const showIssueEmptyState = onlyIssues && filteredSortedProducts.length === 0;
  const getQuickAction = useCallback((entry: ProductWithCosting) => buildPrimaryQuickAction(entry.product.id, entry.product.recipeId, entry.costing, branch, asOfDate, returnTo), [asOfDate, branch, returnTo]);

  return (
    <main className="container">
      <section className="card" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Resolución operativa</p>
        <h1 style={{ marginTop: 6, marginBottom: 6 }}>Panel de incidencias de costos</h1>
        <p className="muted" style={{ margin: 0 }}>Prioriza productos con brechas de precio o costo y abre su contexto para resolverlos rápido.</p>
      </section>

      <DashboardToolbar
        branch={branch}
        branches={BRANCHES}
        asOfDate={asOfDate}
        search={search}
        viewMode={viewMode}
        onBranchChange={setBranch}
        onAsOfDateChange={setAsOfDate}
        onSearchChange={setSearch}
        onViewModeChange={setViewMode}
        onReset={resetFilters}
        resetDisabled={isBaseState}
      />

      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className="btnSecondary"
            onClick={() => {
              setOnlyIssues(true);
              setIssueType('any');
              setSelectedProductId(null);
            }}
            aria-pressed={onlyIssues && issueType === 'any'}
            style={{
              borderColor: onlyIssues ? 'var(--status-warning)' : undefined,
              boxShadow: onlyIssues ? '0 0 0 1px color-mix(in srgb, var(--status-warning) 40%, transparent)' : undefined,
              fontWeight: 600,
            }}
          >
            Problemas prioritarios <span className="badge badge--warn badgeSmall" style={{ marginLeft: 6 }}>{issueStats.issues}</span>
          </button>
          <button
            type="button"
            className="btnSecondary btnSmall"
            onClick={() => {
              setOnlyIssues(false);
              setIssueType('any');
              setSelectedProductId(null);
            }}
            aria-pressed={!onlyIssues}
          >
            Ver todos <span className="badge badge--info badgeSmall" style={{ marginLeft: 6 }}>{issueStats.total}</span>
          </button>
          <label style={{ marginLeft: 'auto' }}>Ordenar
          <select className="select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="name">Nombre</option><option value="marginPctAsc">Margen % asc</option><option value="marginClpAsc">Margen CLP asc</option><option value="costClpDesc">Costo CLP desc</option>
          </select>
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Filtrar tipo de problema</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btnSecondary btnSmall" onClick={() => { setOnlyIssues(true); setIssueType('missingPrice'); setSelectedProductId(null); }} aria-pressed={onlyIssues && issueType === 'missingPrice'}>Sin precio <span className="badge badge--warn badgeSmall" style={{ marginLeft: 6 }}>{issueStats.missingPrice}</span></button>
            <button type="button" className="btnSecondary btnSmall" onClick={() => { setOnlyIssues(true); setIssueType('missingCosts'); setSelectedProductId(null); }} aria-pressed={onlyIssues && issueType === 'missingCosts'}>Sin costo <span className="badge badge--warn badgeSmall" style={{ marginLeft: 6 }}>{issueStats.missingCosts}</span></button>
            <button type="button" className="btnSecondary btnSmall" onClick={() => { setOnlyIssues(true); setIssueType('missingCostItems'); setSelectedProductId(null); }} aria-pressed={onlyIssues && issueType === 'missingCostItems'}>Faltan costos <span className="badge badge--warn badgeSmall" style={{ marginLeft: 6 }}>{issueStats.missingCostItems}</span></button>
            <button type="button" className="btnSecondary btnSmall" onClick={() => { setOnlyIssues(true); setIssueType('unsupportedRecipe'); setSelectedProductId(null); }} aria-pressed={onlyIssues && issueType === 'unsupportedRecipe'}>Sub-recetas <span className="badge badge--warn badgeSmall" style={{ marginLeft: 6 }}>{issueStats.unsupportedRecipe}</span></button>
          </div>
        </div>
      </section>

      <KpiStrip total={issueStats.total} visible={filteredSortedProducts.length} issues={issueStats.issues} summary={issueSummary} />

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 12 }}>
        <section>
          {showIssueEmptyState ? (
            <article className="card" style={{ textAlign: 'center', padding: '22px 16px', borderColor: 'var(--status-success)', background: 'color-mix(in srgb, var(--status-success) 9%, var(--card))' }}>
              <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>Sin incidencias pendientes en este filtro</p>
              <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>Buen trabajo: no hay productos con problemas para la sucursal y fecha seleccionadas.</p>
              <button type="button" className="btnSecondary btnSmall" onClick={() => { setOnlyIssues(false); setIssueType('any'); }}>
                Ver todos los productos
              </button>
            </article>
          ) : null}
          {viewMode === 'cards' ? (
            <div className="grid">{filteredSortedProducts.map((entry) => <ProductCard key={entry.product.id} entry={entry} selected={selectedProductId === entry.product.id} onOpen={() => openDrawer(entry.product.id)} quickAction={getQuickAction(entry)} />)}</div>
          ) : null}
          {viewMode === 'kanban' ? <KanbanBoard products={filteredSortedProducts} selectedProductId={selectedProductId} onOpen={openDrawer} getQuickAction={getQuickAction} /> : null}
          {viewMode === 'table' ? <ProductTable products={filteredSortedProducts} onOpen={openDrawer} getQuickAction={getQuickAction} /> : null}
        </section>

        <ProductDrawer
          selected={selected}
          onClose={closeDrawer}
          drawerRef={drawerRef}
          closeButtonRef={drawerCloseButtonRef}
          actionsSectionRef={actionsSectionRef}
          breakdownSectionRef={breakdownSectionRef}
          missingItemsSectionRef={missingItemsSectionRef}
          activeDrawerSection={activeDrawerSection}
          actions={drawerActions}
          onGoSection={(section) => {
            setActiveDrawerSection(section);
            if (section === 'actions') scrollDrawerSection(actionsSectionRef);
            if (section === 'breakdown') scrollDrawerSection(breakdownSectionRef);
            if (section === 'missingItems') scrollDrawerSection(missingItemsSectionRef);
          }}
        />
      </div>
    </main>
  );
}
