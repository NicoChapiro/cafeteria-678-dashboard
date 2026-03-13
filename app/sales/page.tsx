'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import BackNav from '@/src/components/BackNav';
import EmptyState from '@/src/components/feedback/EmptyState';
import KpiCard from '@/src/components/KpiCard';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import type { Branch } from '@/src/domain/types';
import { listProducts, listSalesEffective } from '@/src/storage/local/store';

type BranchFilter = Branch | 'Consolidado';

type SalesRow = {
  date: string;
  productId: string;
  productName: string;
  qty: number;
  grossSalesClp: number;
};

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return formatIsoDate(new Date());
}

function defaultFromIsoDate(): string {
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return formatIsoDate(from);
}

function listDatesInRange(from: string, to: string): string[] {
  if (from > to) {
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

function loadRows(branch: BranchFilter, fromDate: string, toDate: string): SalesRow[] {
  const products = listProducts();
  const productNameById = new Map(products.map((product) => [product.id, product.name]));

  return listDatesInRange(fromDate, toDate)
    .flatMap((date) => {
      if (branch !== 'Consolidado') {
        return listSalesEffective({ date, branch }).map((entry) => ({
          date: entry.date,
          productId: entry.productId,
          productName: productNameById.get(entry.productId) ?? '(Producto no encontrado)',
          qty: entry.qty,
          grossSalesClp: entry.grossSalesClp,
        }));
      }

      const consolidated = [...listSalesEffective({ date, branch: 'Santiago' }), ...listSalesEffective({ date, branch: 'Temuco' })]
        .reduce((acc, entry) => {
          const current = acc.get(entry.productId);
          if (current) {
            current.qty += entry.qty;
            current.grossSalesClp += entry.grossSalesClp;
          } else {
            acc.set(entry.productId, {
              date,
              productId: entry.productId,
              productName: productNameById.get(entry.productId) ?? '(Producto no encontrado)',
              qty: entry.qty,
              grossSalesClp: entry.grossSalesClp,
            });
          }
          return acc;
        }, new Map<string, SalesRow>());

      return [...consolidated.values()];
    })
    .sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) {
        return dateComparison;
      }

      return a.productName.localeCompare(b.productName, 'es-CL');
    });
}

export default function SalesPage() {
  const [branch, setBranch] = useState<BranchFilter>('Santiago');
  const [fromDate, setFromDate] = useState<string>(defaultFromIsoDate());
  const [toDate, setToDate] = useState<string>(todayIsoDate());

  const [rows, setRows] = useState<SalesRow[]>([]);
  const isInvalidRange = fromDate > toDate;

  useEffect(() => {
    if (isInvalidRange) {
      setRows([]);
      return;
    }

    setRows(loadRows(branch, fromDate, toDate));
  }, [branch, fromDate, isInvalidRange, toDate]);

  const totals = useMemo(
    () => ({
      totalQty: rows.reduce((sum, row) => sum + row.qty, 0),
      totalGrossSalesClp: rows.reduce((sum, row) => sum + row.grossSalesClp, 0),
    }),
    [rows],
  );

  return (
    <PageShell>
      <PageHeader
        title="Ventas"
        description={branch === 'Consolidado' ? 'Consolidado = Santiago + Temuco (incluye ajustes)' : undefined}
        backNav={<BackNav />}
        actions={<Link href="/sales/adjustments">Ajustes de ventas</Link>}
      />

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>Filtros</h2>
        <p style={{ marginTop: 0, marginBottom: 12, color: '#4b5563', fontSize: 14 }}>
          Define sucursal y rango de fechas para revisar el detalle de ventas.
        </p>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Sucursal
            <select className="select" value={branch} onChange={(event) => setBranch(event.target.value as BranchFilter)}>
              <option value="Santiago">Santiago</option>
              <option value="Temuco">Temuco</option>
              <option value="Consolidado">Consolidado</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Desde
            <input className="input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            Hasta
            <input className="input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#f3f4f6',
            color: '#1f2937',
            padding: '6px 10px',
            borderRadius: 999,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 700 }}>Rango seleccionado</span>
          <span>{`${fromDate} → ${toDate}`}</span>
        </div>

        <h2 style={{ marginTop: 0 }}>Resumen</h2>
        <div className="grid">
          <KpiCard label="Venta bruta total (CLP)" value={`$ ${totals.totalGrossSalesClp.toLocaleString('es-CL')}`} />
          <KpiCard label="Cantidad total" value={totals.totalQty.toLocaleString('es-CL')} />
          <KpiCard label="Filas mostradas" value={rows.length.toLocaleString('es-CL')} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Detalle</h2>
        <div className="tableWrap"><table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Fecha</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Producto</th>
              <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #ccc' }}>Cantidad</th>
              <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #ccc' }}>Venta bruta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.date}:${branch}:${row.productId}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>{row.date}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.productName}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.qty.toLocaleString('es-CL')}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.grossSalesClp.toLocaleString('es-CL')}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 16 }}>
                  <EmptyState
                    tone={isInvalidRange ? 'error' : 'neutral'}
                    title={isInvalidRange ? 'Rango de fechas inválido' : 'Sin resultados para esta búsqueda'}
                    description={
                      isInvalidRange
                        ? 'La fecha “Desde” debe ser menor o igual a la fecha “Hasta”.'
                        : 'No hay ventas para los filtros seleccionados. Prueba con otro rango o sucursal.'
                    }
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table></div>
      </section>
    </PageShell>
  );
}
