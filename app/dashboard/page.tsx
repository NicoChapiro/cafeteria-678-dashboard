'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
    const recipeLines = recipes.flatMap((recipe) => listRecipeLines(recipe.id));

    const itemCostVersionsByBranch = new Map<Branch, ReturnType<typeof listItemCosts>>();
    BRANCHES.forEach((branch) => {
      itemCostVersionsByBranch.set(
        branch,
        items.flatMap((item) => listItemCosts(item.id, branch)),
      );
    });

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
          qty: 0,
          ventasReales: 0,
          ventasLista: 0,
          costoTeorico: 0,
          alertas: new Set<string>(),
          motivosCosto: new Set<string>(),
        };

      aggregate.qty += sale.qty;
      aggregate.ventasReales += sale.grossSalesClp;

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
          aggregate.motivosCosto.add('Sin receta y sin costo manual vigente');
        } else {
          const costWithWaste = manualCost * (1 + getProductWasteRate(product));
          aggregate.costoTeorico += sale.qty * costWithWaste;
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

          const costWithWaste = recipeCost.costPerYieldUnitClp * (1 + getProductWasteRate(product));
          aggregate.costoTeorico += sale.qty * costWithWaste;
        } catch {
          aggregate.alertas.add('sin costo vigente');
          aggregate.motivosCosto.add('Receta con items sin costo vigente o incompleta');
        }
      }

      perProduct.set(key, aggregate);
    });

    const rows = [...perProduct.values()].map((row) => {
      const costoTeorico = Math.round(row.costoTeorico);
      const margenTeorico = Math.round(row.ventasReales - costoTeorico);
      const margenPct = row.ventasReales > 0 ? (margenTeorico / row.ventasReales) * 100 : 0;
      const deltaLista = Math.round(row.ventasLista - row.ventasReales);
      return {
        ...row,
        costoTeorico,
        margenTeorico,
        margenPct,
        deltaLista,
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

  const topProductosSinCosto = [...dashboard.alerts.sinCosto]
    .sort((a, b) => b.ventasReales - a.ventasReales)
    .slice(0, 10);
  const hayVentas = dashboard.summary.ventasReales > 0;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Dashboard rentabilidad teórica</h1>

      <section style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Sucursal
          <br />
          <select
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
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>

        <label>
          Hasta
          <br />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>

        <button type="button" onClick={refresh}>
          Refrescar
        </button>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Resumen</h2>
        <p style={{ margin: '4px 0' }}>
          <strong>Ventas reales (CLP): </strong>
          {dashboard.summary.ventasReales.toLocaleString('es-CL')}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Costo teórico (CLP): </strong>
          {dashboard.summary.costoTeorico.toLocaleString('es-CL')}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Margen teórico (CLP): </strong>
          {dashboard.summary.margenTeorico.toLocaleString('es-CL')} ({dashboard.summary.margenPct.toFixed(2)}%)
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Ventas a precio lista (CLP): </strong>
          {dashboard.summary.ventasLista.toLocaleString('es-CL')}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Diferencia vs real (CLP): </strong>
          {dashboard.summary.deltaLista.toLocaleString('es-CL')}
        </p>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
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

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Alertas accionables: Top productos sin costo</h2>
        {dashboard.coverageWithCost === 0 && hayVentas ? (
          <div style={{ background: '#fff4e5', border: '1px solid #ffd399', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            No hay cobertura de costo para ventas en el rango seleccionado. Revisa y completa costos en{' '}
            <Link href="/products">Productos</Link>, <Link href="/recipes">Recetas</Link> y{' '}
            <Link href="/items">Insumos</Link>.
          </div>
        ) : null}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Producto</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Ventas reales</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Motivo</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {topProductosSinCosto.map((row) => (
              <tr key={`alerta-${row.productId}`}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.productName}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.ventasReales.toLocaleString('es-CL')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{[...row.motivosCosto].join(', ') || 'Sin costo vigente'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <Link href={`/products/${row.productId}`}>Abrir producto</Link>
                </td>
              </tr>
            ))}
            {topProductosSinCosto.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 8 }}>
                  No hay productos con alertas de costo en el rango seleccionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>product</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>qty</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>ventasReales</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>ventasLista</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>deltaLista</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>costoTeorico</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>margenTeorico</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>margen%</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>alertas</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.rows.map((row) => (
            <tr key={row.productId}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.productName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.qty.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.ventasReales.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.ventasLista.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.deltaLista.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.costoTeorico.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.margenTeorico.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.margenPct.toFixed(2)}%</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
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
    </main>
  );
}
