'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import BackNav from '@/src/components/BackNav';
import EmptyState from '@/src/components/feedback/EmptyState';
import KpiCard from '@/src/components/KpiCard';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import type { Branch, ProductCostVersion, ProductPriceVersion, SalesDaily } from '@/src/domain/types';
import { costRecipe } from '@/src/services/costing';
import { getProductWasteRate } from '@/src/services/product-waste';
import {
  listItemCosts,
  listItems,
  listProductCosts,
  listProductPrices,
  listProducts,
  listRecipeLines,
  listRecipes,
  listSalesEffective,
} from '@/src/storage/local/store';

type DashboardBranch = Branch | 'Consolidado';

type ProductAggregate = {
  productId: string;
  productName: string;
  recipeId: string | null;
  qty: number;
  ventasReales: number;
  ventasLista: number;
  costoTeorico: number;
  alertas: Set<string>;
  motivosCosto: Set<string>;
};

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return formatIsoDate(new Date());
}

function defaultFromIsoDate(): string {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return formatIsoDate(from);
}

function listDatesInRange(from: string, to: string): string[] {
  if (!from || !to || from > to) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(formatIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}


function loadEffectiveSalesRows(from: string, to: string, branch: DashboardBranch): SalesDaily[] {
  const dates = listDatesInRange(from, to);

  if (branch !== 'Consolidado') {
    return dates.flatMap((date) => listSalesEffective({ date, branch }));
  }

  return dates.flatMap((date) =>
    BRANCHES.flatMap((sourceBranch) => listSalesEffective({ date, branch: sourceBranch })),
  );
}

function findEffectivePrice(versions: ProductPriceVersion[], asOfDate: Date): number | null {
  const target = asOfDate.getTime();
  const effective = versions
    .filter((version) => {
      const from = version.validFrom.getTime();
      const to = version.validTo ? version.validTo.getTime() : Number.POSITIVE_INFINITY;
      return from <= target && target <= to;
    })
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

  return effective ? effective.priceGrossClp : null;
}

function findEffectiveManualCost(versions: ProductCostVersion[], asOfDate: Date): number | null {
  const target = asOfDate.getTime();
  const effective = versions
    .filter((version) => {
      const from = version.validFrom.getTime();
      const to = version.validTo ? version.validTo.getTime() : Number.POSITIVE_INFINITY;
      return from <= target && target <= to;
    })
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

  return effective ? effective.costGrossClp : null;
}

export default function DashboardPage() {
  const [selectedBranch, setSelectedBranch] = useState<DashboardBranch>('Consolidado');

  function buildProductHref(productId: string, focus?: 'base' | 'price' | 'manualCost' | 'recipePreview') {
    const params = new URLSearchParams();
    params.set('returnTo', '/dashboard');

    if (focus) {
      params.set('focus', focus);
      if (selectedBranch !== 'Consolidado') {
        params.set('branch', selectedBranch);
      }
    }

    return `/products/${productId}?${params.toString()}`;
  }

  const [fromDate, setFromDate] = useState<string>(defaultFromIsoDate());
  const [toDate, setToDate] = useState<string>(todayIsoDate());
  const [salesRows, setSalesRows] = useState<SalesDaily[]>([]);

  function refresh(): void {
    setSalesRows(loadEffectiveSalesRows(fromDate, toDate, selectedBranch));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboard = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        rows: [],
        summary: {
          ventasReales: 0,
          ventasLista: 0,
          costoTeorico: 0,
          margenTeorico: 0,
          margenPct: 0,
          deltaLista: 0,
        },
        alerts: {
          sinReceta: [],
          sinCosto: [],
          sinPrecio: [],
        },
        coverageWithCost: 0,
      };
    }

    const products = listProducts();
    const productById = new Map(products.map((product) => [product.id, product]));

    const pricesByKey = new Map<string, ProductPriceVersion[]>();
    const costsByKey = new Map<string, ProductCostVersion[]>();

    products.forEach((product) => {
      BRANCHES.forEach((branch) => {
        pricesByKey.set(`${product.id}:${branch}`, listProductPrices(product.id, branch));
        costsByKey.set(`${product.id}:${branch}`, listProductCosts(product.id, branch));
      });
    });

    const items = listItems();
    const recipes = listRecipes();
    const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    const recipeLines = recipes.flatMap((recipe) => listRecipeLines(recipe.id));
    const recipeLinesByRecipeId = recipeLines.reduce((acc, line) => {
      const current = acc.get(line.recipeId);
      if (current) {
        current.push(line);
      } else {
        acc.set(line.recipeId, [line]);
      }
      return acc;
    }, new Map<string, typeof recipeLines>());

    const itemCostVersionsByBranch = new Map<Branch, ReturnType<typeof listItemCosts>>();
    BRANCHES.forEach((branch) => {
      itemCostVersionsByBranch.set(
        branch,
        items.flatMap((item) => listItemCosts(item.id, branch)),
      );
    });

    const effectiveTotalsByProduct = salesRows
      .reduce((acc, sale) => {
        const current = acc.get(sale.productId);
        if (current) {
          current.qty += sale.qty;
          current.ventasReales += sale.grossSalesClp;
        } else {
          acc.set(sale.productId, {
            qty: sale.qty,
            ventasReales: sale.grossSalesClp,
          });
        }
        return acc;
      }, new Map<string, { qty: number; ventasReales: number }>());

    const perProduct = new Map<string, ProductAggregate>();

    salesRows.forEach((sale) => {
      const product = productById.get(sale.productId);
      const asOfDate = new Date(`${sale.date}T00:00:00.000Z`);
      const key = sale.productId;
      const aggregate =
        perProduct.get(key) ??
        {
          productId: sale.productId,
          productName: product?.name ?? '(Producto no encontrado)',
          recipeId: product?.recipeId ?? null,
          qty: 0,
          ventasReales: 0,
          ventasLista: 0,
          costoTeorico: 0,
          alertas: new Set<string>(),
          motivosCosto: new Set<string>(),
        };

      aggregate.recipeId = product?.recipeId ?? aggregate.recipeId ?? null;

      const priceVersions = pricesByKey.get(`${sale.productId}:${sale.branch}`) ?? [];
      const effectivePrice = findEffectivePrice(priceVersions, asOfDate);
      if (effectivePrice === null) {
        aggregate.alertas.add('sin precio vigente');
      } else {
        aggregate.ventasLista += sale.qty * effectivePrice;
      }

      if (!product?.recipeId) {
        aggregate.alertas.add('sin receta');
        const manualCostVersions = costsByKey.get(`${sale.productId}:${sale.branch}`) ?? [];
        const manualCost = findEffectiveManualCost(manualCostVersions, asOfDate);
        if (manualCost === null) {
          aggregate.alertas.add('sin costo vigente');
          if (manualCostVersions.length > 0) {
            aggregate.motivosCosto.add('Sin costo manual vigente');
          } else {
            aggregate.motivosCosto.add('Sin receta y sin costo manual vigente');
          }
        } else {
          const costWithWaste = manualCost * (1 + getProductWasteRate(product));
          aggregate.costoTeorico += sale.qty * costWithWaste;
        }
      } else {
        try {
          const recipe = recipeById.get(product.recipeId);
          if (!recipe) {
            throw new Error('Receta asociada no encontrada');
          }

          const recipeCost = costRecipe(
            recipe,
            recipeLinesByRecipeId.get(recipe.id) ?? [],
            {
              items,
              recipes,
              recipeLines,
              itemCostVersions: itemCostVersionsByBranch.get(sale.branch) ?? [],
            },
            asOfDate,
            sale.branch,
          );

          const costWithWaste = recipeCost.costPerYieldUnitClp * (1 + getProductWasteRate(product));
          aggregate.costoTeorico += sale.qty * costWithWaste;
        } catch {
          aggregate.alertas.add('sin costo vigente');
          aggregate.motivosCosto.add('Tiene receta pero faltan costos de insumos');
        }
      }

      perProduct.set(key, aggregate);
    });

    const rows = [...perProduct.values()].map((row) => {
      const totals = effectiveTotalsByProduct.get(row.productId);
      const qty = totals?.qty ?? 0;
      const ventasReales = totals?.ventasReales ?? 0;
      const costoTeorico = Math.round(row.costoTeorico);
      const margenTeorico = Math.round(ventasReales - costoTeorico);
      const margenPct = ventasReales > 0 ? (margenTeorico / ventasReales) * 100 : 0;
      const deltaLista = Math.round(row.ventasLista - ventasReales);
      const costoUnitario = qty > 0 && !row.alertas.has('sin costo vigente') ? Math.round(costoTeorico / qty) : null;
      const margenUnitario = qty > 0 && !row.alertas.has('sin costo vigente') ? Math.round(margenTeorico / qty) : null;
      const motivoPrincipal = row.alertas.has('sin costo vigente')
        ? row.recipeId
          ? 'Tiene receta pero faltan costos de insumos'
          : [...row.motivosCosto][0] ?? 'Sin receta y sin costo manual vigente'
        : null;
      return {
        ...row,
        qty,
        ventasReales,
        costoTeorico,
        margenTeorico,
        margenPct,
        deltaLista,
        costoUnitario,
        margenUnitario,
        motivoPrincipal,
      };
    });

    rows.sort((a, b) => a.productName.localeCompare(b.productName, 'es-CL'));

    const summaryRaw = rows.reduce(
      (acc, row) => ({
        ventasReales: acc.ventasReales + row.ventasReales,
        ventasLista: acc.ventasLista + row.ventasLista,
        costoTeorico: acc.costoTeorico + row.costoTeorico,
      }),
      {
        ventasReales: 0,
        ventasLista: 0,
        costoTeorico: 0,
      },
    );

    const summary = {
      ventasReales: Math.round(summaryRaw.ventasReales),
      ventasLista: Math.round(summaryRaw.ventasLista),
      costoTeorico: Math.round(summaryRaw.costoTeorico),
    };

    const margenTeorico = Math.round(summary.ventasReales - summary.costoTeorico);
    const margenPct = summary.ventasReales > 0 ? (margenTeorico / summary.ventasReales) * 100 : 0;
    const deltaLista = Math.round(summary.ventasLista - summary.ventasReales);

    const alerts = {
      sinReceta: rows.filter((row) => row.alertas.has('sin receta')),
      sinCosto: rows.filter((row) => row.alertas.has('sin costo vigente')),
      sinPrecio: rows.filter((row) => row.alertas.has('sin precio vigente')),
    };

    const totalQty = rows.reduce((acc, row) => acc + row.qty, 0);
    const qtyWithCost = rows
      .filter((row) => !row.alertas.has('sin costo vigente'))
      .reduce((acc, row) => acc + row.qty, 0);
    const coverageWithCost = totalQty > 0 ? qtyWithCost / totalQty : 0;

    return {
      rows,
      summary: {
        ...summary,
        margenTeorico,
        margenPct,
        deltaLista,
      },
      alerts,
      coverageWithCost,
    };
  }, [salesRows]);

  return (
    <PageShell>
      <PageHeader
        title="Dashboard rentabilidad teórica"
        description={selectedBranch === 'Consolidado' ? 'Consolidado = Santiago + Temuco (incluye ajustes)' : undefined}
        backNav={<BackNav />}
      />

      <section className="card" style={{ marginBottom: 0, maxWidth: 1240 }}>
        <h2 style={{ marginTop: 0 }}>Filtros</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label>
            Sucursal
            <br />
            <select className="select"
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value as DashboardBranch)}
            >
              <option value="Santiago">Santiago</option>
              <option value="Temuco">Temuco</option>
              <option value="Consolidado">Consolidado</option>
            </select>
          </label>

          <label>
            Desde
            <br />
            <input className="input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>

          <label>
            Hasta
            <br />
            <input className="input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>

          <button className="btn" type="button" onClick={refresh}>
            Refrescar
          </button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0, maxWidth: 1240 }}>
        <h2 style={{ marginTop: 0 }}>Resumen</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <KpiCard label="Ventas reales (CLP)" value={dashboard.summary.ventasReales.toLocaleString('es-CL')} />
          <KpiCard label="Costo teórico (CLP)" value={dashboard.summary.costoTeorico.toLocaleString('es-CL')} />
          <KpiCard label="Margen teórico (CLP)" value={dashboard.summary.margenTeorico.toLocaleString('es-CL')} />
          <KpiCard label="Margen %" value={`${dashboard.summary.margenPct.toFixed(2)}%`} />
          <KpiCard label="Ventas a precio lista (CLP)" value={dashboard.summary.ventasLista.toLocaleString('es-CL')} />
          <KpiCard label="Diferencia vs real (CLP)" value={dashboard.summary.deltaLista.toLocaleString('es-CL')} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0, maxWidth: 1240 }}>
        <h2 style={{ marginTop: 0 }}>Alertas</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
          <article className="card" style={{ marginBottom: 0 }}>
            <p className="muted" style={{ marginBottom: 6 }}>Sin receta</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{dashboard.alerts.sinReceta.length.toLocaleString('es-CL')}</p>
            {dashboard.alerts.sinReceta.length > 0 ? (
              <details style={{ marginTop: 8 }}>
                <summary>Ver productos (máximo 10)</summary>
                <ul style={{ marginBottom: 0 }}>
                  {dashboard.alerts.sinReceta.slice(0, 10).map((row) => (
                    <li key={row.productId}><Link href={buildProductHref(row.productId, 'base')}>{row.productName}</Link></li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>

          <article className="card" style={{ marginBottom: 0 }}>
            <p className="muted" style={{ marginBottom: 6 }}>Sin costo vigente</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{dashboard.alerts.sinCosto.length.toLocaleString('es-CL')}</p>
            {dashboard.alerts.sinCosto.length > 0 ? (
              <details style={{ marginTop: 8 }}>
                <summary>Ver productos (máximo 10)</summary>
                <ul style={{ marginBottom: 0 }}>
                  {dashboard.alerts.sinCosto.slice(0, 10).map((row) => (
                    <li key={row.productId}><Link href={buildProductHref(row.productId, row.recipeId ? 'recipePreview' : 'manualCost')}>{row.productName}</Link></li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>

          <article className="card" style={{ marginBottom: 0 }}>
            <p className="muted" style={{ marginBottom: 6 }}>Sin precio vigente</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{dashboard.alerts.sinPrecio.length.toLocaleString('es-CL')}</p>
            {dashboard.alerts.sinPrecio.length > 0 ? (
              <details style={{ marginTop: 8 }}>
                <summary>Ver productos (máximo 10)</summary>
                <ul style={{ marginBottom: 0 }}>
                  {dashboard.alerts.sinPrecio.slice(0, 10).map((row) => (
                    <li key={row.productId}><Link href={buildProductHref(row.productId, 'price')}>{row.productName}</Link></li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0, maxWidth: 1240 }}>
        <h2 style={{ marginTop: 0 }}>Detalle</h2>
        <div className="tableWrap listPageTable"><table className="table">
          <thead>
            <tr>
              <th>product</th>
              <th>qty</th>
              <th>ventasReales</th>
              <th>ventasLista</th>
              <th>deltaLista</th>
              <th>costoTeorico</th>
              <th>costoUnitario</th>
              <th>margenTeorico</th>
              <th>margenUnitario</th>
              <th>margen%</th>
              <th>alertas</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rows.map((row) => (
              <tr key={row.productId}>
                <td><Link href={buildProductHref(row.productId)}>{row.productName}</Link></td>
                <td>{row.qty.toLocaleString('es-CL')}</td>
                <td>{row.ventasReales.toLocaleString('es-CL')}</td>
                <td>{row.ventasLista.toLocaleString('es-CL')}</td>
                <td>{row.deltaLista.toLocaleString('es-CL')}</td>
                <td>{row.costoTeorico.toLocaleString('es-CL')}</td>
                <td>{row.costoUnitario !== null ? row.costoUnitario.toLocaleString('es-CL') : '-'}</td>
                <td>{row.margenTeorico.toLocaleString('es-CL')}</td>
                <td>{row.margenUnitario !== null ? row.margenUnitario.toLocaleString('es-CL') : '-'}</td>
                <td>{row.margenPct.toFixed(2)}%</td>
                <td>
                  {[...row.alertas].join(', ') || '-'}
                </td>
              </tr>
            ))}
            {dashboard.rows.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <EmptyState compact title="No hay ventas para el rango seleccionado." description="Ajusta el rango de fechas o la sucursal para ver resultados." />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table></div>
      </section>
    </PageShell>
  );
}
