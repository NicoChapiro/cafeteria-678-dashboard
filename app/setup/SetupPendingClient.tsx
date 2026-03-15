'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { Branch, ItemCostVersion, ProductCostVersion, ProductPriceVersion } from '@/src/domain/types';
import { buildEditorHref } from '@/src/lib/navigation/buildReturnTo';
import { costRecipe } from '@/src/services/costing';
import {
  listItemCosts,
  listItems,
  listProductCosts,
  listProductPrices,
  listProducts,
  listRecipeLines,
  listRecipes,
  listSalesDaily,
} from '@/src/storage/local/store';

type SetupBranch = Branch | 'Consolidado';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];

const isSetupBranch = (value: string): value is SetupBranch => value === 'Consolidado' || BRANCHES.includes(value as Branch);

type ProductStatus = {
  productId: string;
  productName: string;
  ventas: number;
  qty: number;
  missingCost: boolean;
  missingPrice: boolean;
  missingRecipe: boolean;
  hasManualCost: boolean;
  costReason: string;
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthBounds(monthKey: string): { start: string; end: string } {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function listDatesInRange(from: string, to: string): string[] {
  if (!from || !to || from > to) {
    return [];
  }

  const rows: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor <= end) {
    rows.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rows;
}

function findEffective<T extends { validFrom: Date; validTo: Date | null }>(
  versions: T[],
  asOfDate: Date,
): T | null {
  const target = asOfDate.getTime();
  const effective = versions
    .filter((version) => {
      const from = version.validFrom.getTime();
      const to = version.validTo ? version.validTo.getTime() : Number.POSITIVE_INFINITY;
      return from <= target && target <= to;
    })
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

  return effective ?? null;
}

function monthOptions(lastMonths = 12): Array<{ value: string; label: string }> {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const base = new Date();
  const current = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));

  return Array.from({ length: lastMonths }).map((_, index) => {
    const d = new Date(current);
    d.setUTCMonth(current.getUTCMonth() - index);
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = formatter.format(d);
    return { value, label: label[0].toUpperCase() + label.slice(1) };
  });
}

export default function SetupPendingPage() {
  const pathname = usePathname();
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const previousDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonth = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, '0')}`;

  const [selectedBranch, setSelectedBranch] = useState<SetupBranch>('Consolidado');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [refreshCount, setRefreshCount] = useState(0);

  const options = useMemo(() => monthOptions(12), []);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const branchParam = params.get('branch');
    if (branchParam && isSetupBranch(branchParam)) {
      setSelectedBranch(branchParam);
    }

    const monthParam = params.get('month');
    if (monthParam && options.some((option) => option.value === monthParam)) {
      setSelectedMonth(monthParam);
    }

    setIsUrlStateReady(true);
  }, [options]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isUrlStateReady) {
      return;
    }

    const params = new URLSearchParams();
    params.set('branch', selectedBranch);
    params.set('month', selectedMonth);

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [isUrlStateReady, pathname, selectedBranch, selectedMonth]);

  const returnTo = useMemo(() => {
    const params = new URLSearchParams();
    params.set('branch', selectedBranch);
    params.set('month', selectedMonth);

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, selectedBranch, selectedMonth]);

  const report = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const refreshNonce = refreshCount;
    void refreshNonce;

    const { start, end } = monthBounds(selectedMonth);
    const dates = listDatesInRange(start, end);
    const branches = selectedBranch === 'Consolidado' ? BRANCHES : [selectedBranch];

    const salesRows = dates.flatMap((date) =>
      branches.flatMap((branch) => listSalesDaily({ date, branch })),
    );

    const products = listProducts();
    const items = listItems();
    const recipes = listRecipes();
    const productById = new Map(products.map((p) => [p.id, p]));
    const recipeById = new Map(recipes.map((r) => [r.id, r]));

    const recipeLinesByRecipeId = new Map<string, ReturnType<typeof listRecipeLines>>();
    recipes.forEach((recipe) => {
      recipeLinesByRecipeId.set(recipe.id, listRecipeLines(recipe.id));
    });

    const allRecipeLines = recipes.flatMap((recipe) => recipeLinesByRecipeId.get(recipe.id) ?? []);

    const pricesByKey = new Map<string, ProductPriceVersion[]>();
    const costsByKey = new Map<string, ProductCostVersion[]>();
    const itemCostsByKey = new Map<string, ItemCostVersion[]>();

    products.forEach((product) => {
      BRANCHES.forEach((branch) => {
        pricesByKey.set(`${product.id}:${branch}`, listProductPrices(product.id, branch));
        costsByKey.set(`${product.id}:${branch}`, listProductCosts(product.id, branch));
      });
    });

    items.forEach((item) => {
      BRANCHES.forEach((branch) => {
        itemCostsByKey.set(`${item.id}:${branch}`, listItemCosts(item.id, branch));
      });
    });

    const itemIdsByRecipeId = new Map<string, Set<string>>();
    const visiting = new Set<string>();

    function collectRecipeItems(recipeId: string): Set<string> {
      const cached = itemIdsByRecipeId.get(recipeId);
      if (cached) {
        return cached;
      }

      if (visiting.has(recipeId)) {
        return new Set<string>();
      }

      visiting.add(recipeId);
      const lines = recipeLinesByRecipeId.get(recipeId) ?? [];
      const ids = new Set<string>();

      lines.forEach((line) => {
        if (line.lineType === 'item') {
          ids.add(line.itemId);
        } else {
          collectRecipeItems(line.subRecipeId).forEach((subItemId) => ids.add(subItemId));
        }
      });

      visiting.delete(recipeId);
      itemIdsByRecipeId.set(recipeId, ids);
      return ids;
    }

    const productStatus = new Map<string, ProductStatus>();
    const ingredientGaps = new Map<
      string,
      { itemId: string; itemName: string; recipeIds: Set<string>; productIds: Set<string> }
    >();

    let ventasTotales = 0;
    let ventasConCosto = 0;

    const itemCostPoolByBranch = new Map<Branch, ItemCostVersion[]>();
    BRANCHES.forEach((branch) => {
      itemCostPoolByBranch.set(branch, items.flatMap((item) => itemCostsByKey.get(`${item.id}:${branch}`) ?? []));
    });

    salesRows.forEach((sale) => {
      const product = productById.get(sale.productId);
      const asOfDate = new Date(`${sale.date}T00:00:00.000Z`);
      const current =
        productStatus.get(sale.productId) ??
        {
          productId: sale.productId,
          productName: product?.name ?? '(Producto no encontrado)',
          ventas: 0,
          qty: 0,
          missingCost: false,
          missingPrice: false,
          missingRecipe: false,
          hasManualCost: false,
          costReason: '-',
        };

      current.ventas += sale.grossSalesClp;
      current.qty += sale.qty;
      ventasTotales += sale.grossSalesClp;

      const effectivePrice = findEffective(pricesByKey.get(`${sale.productId}:${sale.branch}`) ?? [], asOfDate);
      if (!effectivePrice) {
        current.missingPrice = true;
      }

      const manualCost = findEffective(costsByKey.get(`${sale.productId}:${sale.branch}`) ?? [], asOfDate);
      if (manualCost) {
        current.hasManualCost = true;
      }

      let hasCost = false;

      if (!product?.recipeId || !recipeById.has(product.recipeId)) {
        current.missingRecipe = true;
        if (manualCost) {
          hasCost = true;
          current.costReason = 'Sin receta (con costo manual)';
        } else {
          current.missingCost = true;
          current.costReason = 'Sin receta y sin costo manual';
        }
      } else {
        const recipe = recipeById.get(product.recipeId);
        if (recipe) {
          try {
            costRecipe(
              recipe,
              recipeLinesByRecipeId.get(recipe.id) ?? [],
              {
                items,
                recipes,
                recipeLines: allRecipeLines,
                itemCostVersions: itemCostPoolByBranch.get(sale.branch) ?? [],
              },
              asOfDate,
              sale.branch,
            );
            hasCost = true;
            current.costReason = 'OK';
          } catch {
            current.missingCost = true;
            current.costReason = 'Receta sin costo vigente';
          }

          collectRecipeItems(recipe.id).forEach((itemId) => {
            const hasItemCost = Boolean(
              findEffective(itemCostsByKey.get(`${itemId}:${sale.branch}`) ?? [], asOfDate),
            );

            if (!hasItemCost) {
              const item = items.find((entry) => entry.id === itemId);
              const gap = ingredientGaps.get(itemId) ?? {
                itemId,
                itemName: item?.name ?? '(Insumo no encontrado)',
                recipeIds: new Set<string>(),
                productIds: new Set<string>(),
              };

              gap.recipeIds.add(recipe.id);
              gap.productIds.add(sale.productId);
              ingredientGaps.set(itemId, gap);
            }
          });
        }
      }

      if (hasCost) {
        ventasConCosto += sale.grossSalesClp;
      }

      productStatus.set(sale.productId, current);
    });

    const rows = [...productStatus.values()].sort((a, b) => b.ventas - a.ventas);

    const sinCosto = rows.filter((row) => row.missingCost);
    const sinPrecio = rows.filter((row) => row.missingPrice);
    const sinReceta = rows.filter((row) => row.missingRecipe);
    const sinRecetaConManual = sinReceta.filter((row) => row.hasManualCost);
    const sinRecetaSinManual = sinReceta.filter((row) => !row.hasManualCost);

    const coverage = ventasTotales > 0 ? (ventasConCosto / ventasTotales) * 100 : 0;

    const ingredientesSinCosto = [...ingredientGaps.values()]
      .sort((a, b) => {
        if (b.productIds.size !== a.productIds.size) {
          return b.productIds.size - a.productIds.size;
        }

        return b.recipeIds.size - a.recipeIds.size;
      })
      .slice(0, 10);

    return {
      range: { start, end },
      ventasTotales,
      ventasConCosto,
      coverage,
      sinCosto,
      sinPrecio,
      sinRecetaConManual,
      sinRecetaSinManual,
      ingredientesSinCosto,
    };
  }, [refreshCount, selectedBranch, selectedMonth]);


  const productsById = useMemo(
    () => new Map(listProducts().map((entry) => [entry.id, entry])),
    [],
  );

  const contextParams = useMemo(
    () => ({
      branch: selectedBranch !== 'Consolidado' ? selectedBranch : undefined,
      asOf: report?.range.end ?? monthBounds(selectedMonth).end,
      returnTo,
    }),
    [report?.range.end, returnTo, selectedBranch, selectedMonth],
  );

  const setupProductHref = (productId: string, focus: string) =>
    buildEditorHref(`/products/${productId}`, { ...contextParams, focus });

  const setupRecipeHref = (recipeId: string) => buildEditorHref(`/recipes/${recipeId}`, contextParams);

  const setupCostGapAction = (row: ProductStatus): { href: string; label: string } => {
    const product = productsById.get(row.productId);
    if (row.costReason === 'Receta sin costo vigente') {
      if (product?.recipeId) {
        return { href: setupRecipeHref(product.recipeId), label: 'Revisar receta →' };
      }

      return { href: setupProductHref(row.productId, 'recipePreview'), label: 'Editar producto →' };
    }

    return {
      href: setupProductHref(row.productId, row.missingRecipe && !row.hasManualCost ? 'manualCost' : 'base'),
      label: 'Editar producto →',
    };
  };

  const setupItemHref = (itemId: string) => buildEditorHref(`/items/${itemId}`, { ...contextParams, focus: 'cost' });

  return (
    <main className="pageStack" style={{ gap: 14 }}>
      <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.75 }}>Control operativo</p>
        <h1 style={{ margin: 0 }}>Panel de pendientes</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          Revisa cobertura de costeo, brechas de precio y pendientes críticos por período para priorizar acciones.
        </p>
      </section>

      <section className="card" style={{ display: 'grid', gap: 10, marginBottom: 0, maxWidth: 1120 }}>
        <h2 style={{ margin: 0 }}>Filtros</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 6, minWidth: 180 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Sucursal</span>
            <select className="select" value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value as SetupBranch)}>
              <option value="Santiago">Santiago</option>
              <option value="Temuco">Temuco</option>
              <option value="Consolidado">Consolidado</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6, minWidth: 220 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Mes de análisis</span>
            <select className="select" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Atajos</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btnSecondary" type="button" onClick={() => setSelectedMonth(currentMonth)}>Este mes</button>
              <button className="btnSecondary" type="button" onClick={() => setSelectedMonth(previousMonth)}>Mes pasado</button>
            </div>
          </div>

          <button className="btn" type="button" onClick={() => setRefreshCount((prev) => prev + 1)}>Actualizar panel</button>
        </div>
      </section>

      {report ? (
        <>
          <section className="card" style={{ display: 'grid', gap: 10, marginBottom: 0, maxWidth: 1120 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>KPIs operativos</h2>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Rango: {report.range.start} a {report.range.end}</p>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <article style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Ventas reales (CLP)</p>
                <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{report.ventasTotales.toLocaleString('es-CL')}</p>
              </article>
              <article style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Cobertura de costeo</p>
                <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{report.coverage.toFixed(2)}%</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>
                  {report.ventasConCosto.toLocaleString('es-CL')} / {report.ventasTotales.toLocaleString('es-CL')}
                </p>
              </article>
              <article style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Productos sin costo</p>
                <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{report.sinCosto.length}</p>
              </article>
              <article style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Productos sin precio vigente</p>
                <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{report.sinPrecio.length}</p>
              </article>
              <article style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Sin receta + costo manual</p>
                <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{report.sinRecetaConManual.length}</p>
              </article>
              <article style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Sin receta + sin costo manual</p>
                <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{report.sinRecetaSinManual.length}</p>
              </article>
            </div>
          </section>

          <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120 }}>
            <h2 style={{ margin: 0 }}>Top 10 productos sin costo</h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Priorizados por ventas reales del período.</p>
            <div className="tableWrap listPageTable"><table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Ventas</th>
                  <th>Qty</th>
                  <th>Motivo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {report.sinCosto.slice(0, 10).map((row) => {
                  const action = setupCostGapAction(row);

                  return (
                    <tr key={row.productId}>
                      <td>{row.productName}</td>
                      <td>{row.ventas.toLocaleString('es-CL')}</td>
                      <td>{row.qty.toLocaleString('es-CL')}</td>
                      <td>{row.costReason}</td>
                      <td><a href={action.href} data-testid="setup-cost-gap-action">{action.label}</a></td>
                    </tr>
                  );
                })}
                {report.sinCosto.length === 0 ? (
                  <tr><td colSpan={5}>✅ No hay productos vendidos con costo pendiente en este período.</td></tr>
                ) : null}
              </tbody>
            </table></div>
          </section>

          <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120 }}>
            <h2 style={{ margin: 0 }}>Top 10 productos sin precio vigente</h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Estos productos se vendieron sin versión de precio efectiva.</p>
            <div className="tableWrap listPageTable"><table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Ventas</th>
                  <th>Qty</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {report.sinPrecio.slice(0, 10).map((row) => (
                  <tr key={row.productId}>
                    <td>{row.productName}</td>
                    <td>{row.ventas.toLocaleString('es-CL')}</td>
                    <td>{row.qty.toLocaleString('es-CL')}</td>
                    <td><a href={setupProductHref(row.productId, 'price')} data-testid="setup-review-price">Revisar precio →</a></td>
                  </tr>
                ))}
                {report.sinPrecio.length === 0 ? (
                  <tr><td colSpan={4}>✅ No hay brechas de precio vigente para productos vendidos.</td></tr>
                ) : null}
              </tbody>
            </table></div>
          </section>

          <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120 }}>
            <h2 style={{ margin: 0 }}>Top 10 productos sin receta y sin costo manual (críticos)</h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Pendientes prioritarios que impiden costear ventas.</p>
            <div className="tableWrap listPageTable"><table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Ventas</th>
                  <th>Qty</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {report.sinRecetaSinManual.slice(0, 10).map((row) => (
                  <tr key={row.productId}>
                    <td>{row.productName}</td>
                    <td>{row.ventas.toLocaleString('es-CL')}</td>
                    <td>{row.qty.toLocaleString('es-CL')}</td>
                    <td><a href={setupProductHref(row.productId, 'manualCost')} data-testid="setup-create-recipe-or-cost">Crear receta/costo →</a></td>
                  </tr>
                ))}
                {report.sinRecetaSinManual.length === 0 ? (
                  <tr><td colSpan={4}>✅ No hay pendientes críticos de receta/costo manual.</td></tr>
                ) : null}
              </tbody>
            </table></div>
          </section>

          <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120 }}>
            <h2 style={{ margin: 0 }}>Ingredientes sin costo vigente (Top 10)</h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Insumos que bloquean el costeo de recetas y productos vendidos.</p>
            <div className="tableWrap listPageTable"><table className="table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Recetas afectadas</th>
                  <th>Productos vendidos afectados</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {report.ingredientesSinCosto.map((row) => (
                  <tr key={row.itemId}>
                    <td>{row.itemName}</td>
                    <td>{row.recipeIds.size}</td>
                    <td>{row.productIds.size}</td>
                    <td><a href={setupItemHref(row.itemId)} data-testid="setup-edit-item-cost">Editar costo →</a></td>
                  </tr>
                ))}
                {report.ingredientesSinCosto.length === 0 ? (
                  <tr><td colSpan={4}>✅ Todos los ingredientes usados en ventas tienen costo vigente.</td></tr>
                ) : null}
              </tbody>
            </table></div>
          </section>
        </>
      ) : null}
    </main>
  );
}
