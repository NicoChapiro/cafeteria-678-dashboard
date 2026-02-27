'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Branch, ProductCostVersion, ProductPriceVersion, SalesDaily } from '@/src/domain/types';
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

type DashboardBranch = Branch | 'Consolidado';

type ProductAggregate = {
  productId: string;
  productName: string;
  qty: number;
  ventasReales: number;
  ventasLista: number;
  costoTeorico: number;
  alertas: Set<string>;
};

type DashboardRow = ProductAggregate & {
  margenTeorico: number;
  margenPct: number;
  deltaLista: number;
};

type BranchSummary = {
  ventasReales: number;
  costoTeorico: number;
  margenTeorico: number;
  margenPct: number;
  filasConCosto: number;
  filasTotales: number;
};

type DailyConsolidated = {
  date: string;
  santiago: number;
  temuco: number;
  total: number;
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

function formatCurrency(value: number): string {
  return value.toLocaleString('es-CL');
}

export default function DashboardPage() {
  const [selectedBranch, setSelectedBranch] = useState<DashboardBranch>('Consolidado');
  const [fromDate, setFromDate] = useState<string>(defaultFromIsoDate());
  const [toDate, setToDate] = useState<string>(todayIsoDate());
  const [salesRows, setSalesRows] = useState<SalesDaily[]>([]);

  function refresh(): void {
    const dates = listDatesInRange(fromDate, toDate);
    const branches = selectedBranch === 'Consolidado' ? BRANCHES : [selectedBranch];

    const rows = dates.flatMap((date) =>
      branches.flatMap((branch) => listSalesDaily({ date, branch })),
    );

    setSalesRows(rows);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboard = useMemo(() => {
    const emptyBranchSummary = (): BranchSummary => ({
      ventasReales: 0,
      costoTeorico: 0,
      margenTeorico: 0,
      margenPct: 0,
      filasConCosto: 0,
      filasTotales: 0,
    });

    if (typeof window === 'undefined') {
      return {
        rows: [] as DashboardRow[],
        summary: {
          ventasReales: 0,
          ventasLista: 0,
          costoTeorico: 0,
          margenTeorico: 0,
          margenPct: 0,
          deltaLista: 0,
        },
        alerts: {
          sinReceta: [] as DashboardRow[],
          sinCosto: [] as DashboardRow[],
          sinPrecio: [] as DashboardRow[],
        },
        byBranch: {
          Santiago: emptyBranchSummary(),
          Temuco: emptyBranchSummary(),
        } as Record<Branch, BranchSummary>,
        dailyConsolidated: [] as DailyConsolidated[],
        topVentas: [] as DashboardRow[],
        topMargen: [] as DashboardRow[],
        topSinCosto: [] as DashboardRow[],
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
    const recipeLines = recipes.flatMap((recipe) => listRecipeLines(recipe.id));

    const itemCostVersionsByBranch = new Map<Branch, ReturnType<typeof listItemCosts>>();
    BRANCHES.forEach((branch) => {
      itemCostVersionsByBranch.set(
        branch,
        items.flatMap((item) => listItemCosts(item.id, branch)),
      );
    });

    const perProduct = new Map<string, ProductAggregate>();
    const byBranch: Record<Branch, BranchSummary> = {
      Santiago: emptyBranchSummary(),
      Temuco: emptyBranchSummary(),
    };

    salesRows.forEach((sale) => {
      const product = productById.get(sale.productId);
      const asOfDate = new Date(`${sale.date}T00:00:00.000Z`);
      const key = sale.productId;
      const aggregate =
        perProduct.get(key) ??
        {
          productId: sale.productId,
          productName: product?.name ?? '(Producto no encontrado)',
          qty: 0,
          ventasReales: 0,
          ventasLista: 0,
          costoTeorico: 0,
          alertas: new Set<string>(),
        };

      aggregate.qty += sale.qty;
      aggregate.ventasReales += sale.grossSalesClp;
      byBranch[sale.branch].ventasReales += sale.grossSalesClp;
      byBranch[sale.branch].filasTotales += 1;

      const priceVersions = pricesByKey.get(`${sale.productId}:${sale.branch}`) ?? [];
      const effectivePrice = findEffectivePrice(priceVersions, asOfDate);
      if (effectivePrice === null) {
        aggregate.alertas.add('sin precio vigente');
      } else {
        aggregate.ventasLista += sale.qty * effectivePrice;
      }

      let hasCost = false;
      if (!product?.recipeId) {
        aggregate.alertas.add('sin receta');
        const manualCostVersions = costsByKey.get(`${sale.productId}:${sale.branch}`) ?? [];
        const manualCost = findEffectiveManualCost(manualCostVersions, asOfDate);
        if (manualCost === null) {
          aggregate.alertas.add('sin costo vigente');
        } else {
          const totalCost = sale.qty * manualCost;
          aggregate.costoTeorico += totalCost;
          byBranch[sale.branch].costoTeorico += totalCost;
          hasCost = true;
        }
      } else {
        try {
          const recipe = recipes.find((entry) => entry.id === product.recipeId);
          if (!recipe) {
            throw new Error('Receta asociada no encontrada');
          }

          const recipeCost = costRecipe(
            recipe,
            recipeLines.filter((line) => line.recipeId === recipe.id),
            {
              items,
              recipes,
              recipeLines,
              itemCostVersions: itemCostVersionsByBranch.get(sale.branch) ?? [],
            },
            asOfDate,
            sale.branch,
          );

          const totalCost = sale.qty * recipeCost.costPerYieldUnitClp;
          aggregate.costoTeorico += totalCost;
          byBranch[sale.branch].costoTeorico += totalCost;
          hasCost = true;
        } catch {
          aggregate.alertas.add('sin costo vigente');
        }
      }

      if (hasCost) {
        byBranch[sale.branch].filasConCosto += 1;
      }

      perProduct.set(key, aggregate);
    });

    BRANCHES.forEach((branch) => {
      const margenTeorico = byBranch[branch].ventasReales - byBranch[branch].costoTeorico;
      byBranch[branch].margenTeorico = margenTeorico;
      byBranch[branch].margenPct =
        byBranch[branch].ventasReales > 0 ? (margenTeorico / byBranch[branch].ventasReales) * 100 : 0;
    });

    const rows = [...perProduct.values()].map((row) => {
      const margenTeorico = row.ventasReales - row.costoTeorico;
      const margenPct = row.ventasReales > 0 ? (margenTeorico / row.ventasReales) * 100 : 0;
      const deltaLista = row.ventasLista - row.ventasReales;
      return {
        ...row,
        margenTeorico,
        margenPct,
        deltaLista,
      };
    });

    rows.sort((a, b) => a.productName.localeCompare(b.productName, 'es-CL'));

    const summary = rows.reduce(
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

    const margenTeorico = summary.ventasReales - summary.costoTeorico;
    const margenPct = summary.ventasReales > 0 ? (margenTeorico / summary.ventasReales) * 100 : 0;
    const deltaLista = summary.ventasLista - summary.ventasReales;

    const alerts = {
      sinReceta: rows.filter((row) => row.alertas.has('sin receta')),
      sinCosto: rows.filter((row) => row.alertas.has('sin costo vigente')),
      sinPrecio: rows.filter((row) => row.alertas.has('sin precio vigente')),
    };

    const dailyByDate = new Map<string, DailyConsolidated>(
      listDatesInRange(fromDate, toDate).map((date) => [
        date,
        {
          date,
          santiago: 0,
          temuco: 0,
          total: 0,
        },
      ]),
    );

    salesRows.forEach((row) => {
      const existing = dailyByDate.get(row.date) ?? {
        date: row.date,
        santiago: 0,
        temuco: 0,
        total: 0,
      };

      if (row.branch === 'Santiago') {
        existing.santiago += row.grossSalesClp;
      }

      if (row.branch === 'Temuco') {
        existing.temuco += row.grossSalesClp;
      }

      existing.total += row.grossSalesClp;
      dailyByDate.set(row.date, existing);
    });

    const dailyConsolidated = [...dailyByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    const topVentas = [...rows].sort((a, b) => b.ventasReales - a.ventasReales).slice(0, 10);
    const topMargen = [...rows]
      .filter((row) => !row.alertas.has('sin costo vigente'))
      .sort((a, b) => b.margenTeorico - a.margenTeorico)
      .slice(0, 10);
    const topSinCosto = [...rows]
      .filter((row) => row.alertas.has('sin costo vigente'))
      .sort((a, b) => b.ventasReales - a.ventasReales)
      .slice(0, 10);

    return {
      rows,
      summary: {
        ...summary,
        margenTeorico,
        margenPct,
        deltaLista,
      },
      alerts,
      byBranch,
      dailyConsolidated,
      topVentas,
      topMargen,
      topSinCosto,
    };
  }, [fromDate, toDate, salesRows]);

  const isConsolidated = selectedBranch === 'Consolidado';

  const noticeMissingCost = dashboard.summary.ventasReales > 0 && dashboard.summary.costoTeorico === 0;

  const cardStyle = {
    border: '1px solid #dbe3ea',
    borderRadius: 12,
    padding: 12,
    background: '#fff',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
  } as const;
  const tableStyle = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' } as const;
  const headerCellStyle = { textAlign: 'left', padding: 8, borderBottom: '1px solid #cfd8e3', background: '#f3f4f6', fontWeight: 600 } as const;
  const rowCellStyle = { padding: 8, borderBottom: '1px solid #e5e7eb' } as const;
  const controlStyle = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', background: '#fff' } as const;
  const buttonStyle = { border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontWeight: 600 } as const;

  return (
    <main style={{ padding: 24, fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: '#f7fafc', minHeight: '100vh', color: '#0f172a' }}>
      <h1 style={{ marginTop: 0, marginBottom: 18, fontSize: 30 }}>Dashboard rentabilidad teórica</h1>

      <section style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Sucursal
          <br />
          <select
            style={controlStyle}
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
          <input style={controlStyle} type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>

        <label>
          Hasta
          <br />
          <input style={controlStyle} type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>

        <button style={buttonStyle} type="button" onClick={refresh}>
          Refrescar
        </button>
      </section>

      {noticeMissingCost ? (
        <section
          style={{
            ...cardStyle,
            marginBottom: 16,
            borderColor: '#f59e0b',
            background: '#fffbeb',
          }}
        >
          <strong>Atención:</strong> hay ventas registradas pero el costo total está en 0. Revisa recetas o costos vigentes para mejorar el cálculo de margen.
        </section>
      ) : null}

      {isConsolidated ? (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {[
              { label: 'Ventas total', value: formatCurrency(dashboard.summary.ventasReales) },
              { label: 'Costo total', value: formatCurrency(dashboard.summary.costoTeorico) },
              { label: 'Margen total', value: formatCurrency(dashboard.summary.margenTeorico) },
              { label: 'Margen %', value: `${dashboard.summary.margenPct.toFixed(2)}%` },
            ].map((item) => (
              <article key={item.label} style={{ ...cardStyle, padding: 16 }}>
                <p style={{ margin: 0, color: '#555' }}>{item.label}</p>
                <p style={{ margin: '6px 0 0 0', fontSize: 28, fontWeight: 700 }}>{item.value}</p>
              </article>
            ))}
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {BRANCHES.map((branch) => {
              const branchSummary = dashboard.byBranch[branch];
              return (
                <article key={branch} style={{ ...cardStyle, padding: 14 }}>
                  <h2 style={{ marginTop: 0, marginBottom: 8 }}>{branch}</h2>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Ventas:</strong> {formatCurrency(branchSummary.ventasReales)}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Costo:</strong> {formatCurrency(branchSummary.costoTeorico)}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Margen:</strong> {formatCurrency(branchSummary.margenTeorico)}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Margen %:</strong> {branchSummary.margenPct.toFixed(2)}%
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Cobertura de costeo:</strong> {branchSummary.filasConCosto.toLocaleString('es-CL')} /{' '}
                    {branchSummary.filasTotales.toLocaleString('es-CL')}
                  </p>
                </article>
              );
            })}
          </section>

          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Ventas diarias consolidadas</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Fecha</th>
                  <th style={headerCellStyle}>Santiago</th>
                  <th style={headerCellStyle}>Temuco</th>
                  <th style={headerCellStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.dailyConsolidated.map((row) => (
                  <tr key={row.date}>
                    <td style={rowCellStyle}>{row.date}</td>
                    <td style={rowCellStyle}>{formatCurrency(row.santiago)}</td>
                    <td style={rowCellStyle}>{formatCurrency(row.temuco)}</td>
                    <td style={rowCellStyle}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {dashboard.dailyConsolidated.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 8 }}>
                      No hay ventas para el rango seleccionado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Top 10 por ventas</h2>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {dashboard.topVentas.map((row) => (
                  <li key={`ventas-${row.productId}`} style={{ marginBottom: 6 }}>
                    {row.productName} — {formatCurrency(row.ventasReales)}
                  </li>
                ))}
                {dashboard.topVentas.length === 0 ? <li>Sin datos</li> : null}
              </ol>
            </article>

            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Top 10 por margen</h2>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {dashboard.topMargen.map((row) => (
                  <li key={`margen-${row.productId}`} style={{ marginBottom: 6 }}>
                    {row.productName} — {formatCurrency(row.margenTeorico)}
                  </li>
                ))}
                {dashboard.topMargen.length === 0 ? <li>Sin datos con costo calculado</li> : null}
              </ol>
            </article>
          </section>

          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Alertas accionables: Top 10 productos sin costo</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>Producto</th>
                  <th style={headerCellStyle}>Ventas (CLP)</th>
                  <th style={headerCellStyle}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.topSinCosto.map((row) => (
                  <tr key={`sin-costo-${row.productId}`}>
                    <td style={rowCellStyle}>{row.productName}</td>
                    <td style={rowCellStyle}>{formatCurrency(row.ventasReales)}</td>
                    <td style={rowCellStyle}>{row.qty.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
                {dashboard.topSinCosto.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 8 }}>
                      Sin productos sin costo en el rango.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <>
          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Resumen</h2>
            <p style={{ margin: '4px 0' }}>
              <strong>Ventas reales (CLP): </strong>
              {formatCurrency(dashboard.summary.ventasReales)}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Costo teórico (CLP): </strong>
              {formatCurrency(dashboard.summary.costoTeorico)}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Margen teórico (CLP): </strong>
              {formatCurrency(dashboard.summary.margenTeorico)} ({dashboard.summary.margenPct.toFixed(2)}%)
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Ventas a precio lista (CLP): </strong>
              {formatCurrency(dashboard.summary.ventasLista)}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Diferencia vs real (CLP): </strong>
              {formatCurrency(dashboard.summary.deltaLista)}
            </p>
          </section>

          <section style={{ ...cardStyle, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Alertas</h2>
            <p style={{ margin: '4px 0' }}>
              <strong>Sin receta:</strong> {dashboard.alerts.sinReceta.length}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Sin costo vigente:</strong> {dashboard.alerts.sinCosto.length}
            </p>
            <p style={{ margin: '4px 0 8px 0' }}>
              <strong>Sin precio vigente:</strong> {dashboard.alerts.sinPrecio.length}
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {dashboard.rows
                .filter((row) => row.alertas.size > 0)
                .map((row) => (
                  <li key={row.productId}>
                    {row.productName} — {[...row.alertas].join(', ')}
                  </li>
                ))}
              {dashboard.rows.every((row) => row.alertas.size === 0) ? <li>Sin alertas</li> : null}
            </ul>
          </section>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headerCellStyle}>product</th>
                <th style={headerCellStyle}>qty</th>
                <th style={headerCellStyle}>ventasReales</th>
                <th style={headerCellStyle}>ventasLista</th>
                <th style={headerCellStyle}>deltaLista</th>
                <th style={headerCellStyle}>costoTeorico</th>
                <th style={headerCellStyle}>margenTeorico</th>
                <th style={headerCellStyle}>margen%</th>
                <th style={headerCellStyle}>alertas</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.rows.map((row) => (
                <tr key={row.productId}>
                  <td style={rowCellStyle}>{row.productName}</td>
                  <td style={rowCellStyle}>{row.qty.toLocaleString('es-CL')}</td>
                  <td style={rowCellStyle}>{formatCurrency(row.ventasReales)}</td>
                  <td style={rowCellStyle}>{formatCurrency(row.ventasLista)}</td>
                  <td style={rowCellStyle}>{formatCurrency(row.deltaLista)}</td>
                  <td style={rowCellStyle}>{formatCurrency(row.costoTeorico)}</td>
                  <td style={rowCellStyle}>{formatCurrency(row.margenTeorico)}</td>
                  <td style={rowCellStyle}>{row.margenPct.toFixed(2)}%</td>
                  <td style={rowCellStyle}>
                    {[...row.alertas].join(', ') || '-'}
                  </td>
                </tr>
              ))}
              {dashboard.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 8 }}>
                    No hay ventas para el rango seleccionado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
