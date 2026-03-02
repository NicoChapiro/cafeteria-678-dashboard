'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { Branch } from '@/src/domain/types';
import { listProducts, listSalesEffective } from '@/src/storage/local/store';

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

function loadRows(branch: Branch, fromDate: string, toDate: string): SalesRow[] {
  const products = listProducts();
  const productNameById = new Map(products.map((product) => [product.id, product.name]));

  return listDatesInRange(fromDate, toDate)
    .flatMap((date) =>
      listSalesEffective({ date, branch }).map((entry) => ({
        date: entry.date,
        productId: entry.productId,
        productName: productNameById.get(entry.productId) ?? '(Producto no encontrado)',
        qty: entry.qty,
        grossSalesClp: entry.grossSalesClp,
      })),
    )
    .sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) {
        return dateComparison;
      }

      return a.productName.localeCompare(b.productName, 'es-CL');
    });
}

export default function SalesPage() {
  const [branch, setBranch] = useState<Branch>('Santiago');
  const [fromDate, setFromDate] = useState<string>(defaultFromIsoDate());
  const [toDate, setToDate] = useState<string>(todayIsoDate());

  const [rows, setRows] = useState<SalesRow[]>([]);

  useEffect(() => {
    if (fromDate > toDate) {
      setRows([]);
      return;
    }

    setRows(loadRows(branch, fromDate, toDate));
  }, [branch, fromDate, toDate]);

  const totals = useMemo(
    () => ({
      totalQty: rows.reduce((sum, row) => sum + row.qty, 0),
      totalGrossSalesClp: rows.reduce((sum, row) => sum + row.grossSalesClp, 0),
    }),
    [rows],
  );

  return (
    <main>
      <h1>Ventas</h1>
      <p style={{ marginBottom: 16 }}><Link href="/sales/adjustments">Ajustes de ventas</Link></p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Sucursal
          <br />
          <select className="select" value={branch} onChange={(event) => setBranch(event.target.value as Branch)}>
            <option value="Santiago">Santiago</option>
            <option value="Temuco">Temuco</option>
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
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <strong>Total gross (CLP): </strong>
          <span>{totals.totalGrossSalesClp.toLocaleString('es-CL')}</span>
        </div>
        <div>
          <strong>Total qty: </strong>
          <span>{totals.totalQty.toLocaleString('es-CL')}</span>
        </div>
      </div>

      <div className="tableWrap"><table className="table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>fecha</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>producto</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>qty</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>gross</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}:${branch}:${row.productId}`}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.date}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.productName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.qty.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.grossSalesClp.toLocaleString('es-CL')}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 8 }}>
                {fromDate > toDate
                  ? 'Rango inválido: la fecha Desde debe ser menor o igual a Hasta.'
                  : 'No hay ventas para los filtros seleccionados.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table></div>
    </main>
  );
}
