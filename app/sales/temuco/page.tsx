'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';

import { listProducts, listSalesDaily } from '@/src/storage/local/store';

const containerStyle: CSSProperties = { padding: 20 };
const inputStyle: CSSProperties = { padding: 8, border: '1px solid #ccc', borderRadius: 6 };
const buttonStyle: CSSProperties = {
  padding: '8px 12px',
  background: '#2563eb',
  color: '#fff',
  borderRadius: 6,
  border: 0,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
};

export default function SalesTemucoPage() {
  const [from, setFrom] = useState('2026-01-31');
  const [to, setTo] = useState('2026-03-01');
  const [rows, setRows] = useState<
    { date: string; productId: string; qty: number; grossSalesClp: number }[]
  >([]);

  const productsById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    listProducts().forEach((p) => map.set(p.id, { name: p.name }));
    return map;
  }, []);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalGross = 0;
    rows.forEach((r) => {
      totalQty += r.qty;
      totalGross += r.grossSalesClp;
    });
    return { totalQty, totalGross };
  }, [rows]);

  const refresh = (): void => {
    const out: { date: string; productId: string; qty: number; grossSalesClp: number }[] = [];
    const start = new Date(from);
    const end = new Date(to);

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const day = listSalesDaily({ date, branch: 'Temuco' });
      day.forEach((entry) => {
        out.push({
          date: entry.date,
          productId: entry.productId,
          qty: entry.qty,
          grossSalesClp: entry.grossSalesClp,
        });
      });
    }

    setRows(out);
  };

  return (
    <div style={containerStyle}>
      <h1>Ventas Temuco (importadas)</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div>Desde</div>
          <input style={inputStyle} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <div>Hasta</div>
          <input style={inputStyle} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <button style={buttonStyle} type="button" onClick={refresh}>
          Refrescar
        </button>

        <Link href="/sales/temuco/import" style={buttonStyle}>
          Importar XLSX
        </Link>
      </div>

      <div style={{ marginTop: 16 }}>
        <b>Total ventas (CLP):</b> {totals.totalGross} &nbsp;&nbsp; <b>Total qty:</b> {totals.totalQty}
      </div>

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>date</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>product</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>qty</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>grossSalesClp</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12 }}>
                  No hay ventas para el rango seleccionado.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.date}-${r.productId}-${i}`}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{r.date}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                    {productsById.get(r.productId)?.name ?? '(Producto no encontrado)'}
                  </td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{r.qty}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{r.grossSalesClp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link href="/sales/temuco/manual">Ir a modo manual</Link>
      </div>
    </div>
  );
}
