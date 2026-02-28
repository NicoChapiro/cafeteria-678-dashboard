'use client';

import { useEffect, useMemo, useState } from 'react';

import { listProducts, listSalesDaily } from '@/src/storage/local/store';

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
  const today = new Date();
  const from = new Date(today);
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

function loadRows(fromDate: string, toDate: string): SalesRow[] {
  const products = listProducts();
  const productNameById = new Map(products.map((product) => [product.id, product.name]));

  return listDatesInRange(fromDate, toDate)
    .flatMap((date) =>
      listSalesDaily({ date, branch: 'Santiago' }).map((entry) => ({
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

export default function SantiagoSalesPage() {
  const [fromDate, setFromDate] = useState<string>(defaultFromIsoDate());
  const [toDate, setToDate] = useState<string>(todayIsoDate());
  const [rows, setRows] = useState<SalesRow[]>([]);


  useEffect(() => {
    setRows(loadRows(fromDate, toDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(
    () => ({
      totalQty: rows.reduce((sum, row) => sum + row.qty, 0),
      totalGrossSalesClp: rows.reduce((sum, row) => sum + row.grossSalesClp, 0),
    }),
    [rows],
  );

  function handleRefresh(): void {
    if (fromDate > toDate) {
      setRows([]);
      return;
    }

    setRows(loadRows(fromDate, toDate));
  }

  return (
    <main>
      <h1>Ventas Santiago (importadas)</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
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

        <button className="btn" type="button" onClick={handleRefresh}>
          Refrescar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <strong>Total ventas (CLP): </strong>
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
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>date</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>product</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>qty</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>grossSalesClp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}:${row.productId}`}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.date}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.productName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.qty.toLocaleString('es-CL')}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                {row.grossSalesClp.toLocaleString('es-CL')}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 8 }}>
                No hay ventas para el rango seleccionado.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table></div>
    </main>
  );
}
