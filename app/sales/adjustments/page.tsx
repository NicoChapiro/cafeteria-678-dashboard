'use client';

import { useEffect, useMemo, useState } from 'react';

import BackNav from '@/src/components/BackNav';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import type { Branch, Product } from '@/src/domain/types';
import {
  addSalesAdjustment,
  deleteSalesAdjustment,
  listProducts,
  listSalesAdjustments,
} from '@/src/storage/local/store';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SalesAdjustmentsPage() {
  const [branch, setBranch] = useState<Branch>('Santiago');
  const [date, setDate] = useState<string>(todayIsoDate());
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [qty, setQty] = useState<string>('0');
  const [grossSalesClp, setGrossSalesClp] = useState<string>('0');
  const [note, setNote] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [rows, setRows] = useState<ReturnType<typeof listSalesAdjustments>>([]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.active).sort((a, b) => a.name.localeCompare(b.name, 'es-CL')),
    [products],
  );

  const productNameById = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  const totals = useMemo(
    () => ({
      totalQty: rows.reduce((sum, row) => sum + row.qty, 0),
      totalGross: rows.reduce((sum, row) => sum + row.grossSalesClp, 0),
    }),
    [rows],
  );

  function refreshRows(nextDate = date, nextBranch = branch): void {
    setRows(listSalesAdjustments({ date: nextDate, branch: nextBranch }));
  }

  useEffect(() => {
    setProducts(listProducts());
  }, []);

  useEffect(() => {
    if (!productId && activeProducts.length > 0) {
      setProductId(activeProducts[0].id);
    }
  }, [activeProducts, productId]);

  useEffect(() => {
    refreshRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, date]);

  function handleAdd(): void {
    try {
      addSalesAdjustment({ date, branch, productId, qty: toNumber(qty), grossSalesClp: toNumber(grossSalesClp), note });
      setQty('0');
      setGrossSalesClp('0');
      setNote('');
      setMessage('Ajuste agregado.');
      refreshRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo agregar el ajuste.');
    }
  }

  function handleDelete(id: string): void {
    try {
      deleteSalesAdjustment(id);
      setMessage('Ajuste eliminado.');
      refreshRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar el ajuste.');
    }
  }

  return (
    <PageShell>
      <PageHeader title="Ajustes de ventas" backNav={<BackNav backTo={{ href: '/sales', label: 'Ventas' }} />} />

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Filtros</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label>Sucursal<br />
            <select className="select" value={branch} onChange={(event) => setBranch(event.target.value as Branch)}>
              <option value="Santiago">Santiago</option>
              <option value="Temuco">Temuco</option>
            </select>
          </label>
          <label>Fecha<br />
            <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Agregar ajuste</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label>Producto<br />
            <select className="select" value={productId} onChange={(event) => setProductId(event.target.value)}>
              {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label>Qty<br />
            <input className="input" type="number" min="0" step="0.001" value={qty} onChange={(event) => setQty(event.target.value)} />
          </label>
          <label>GrossSalesClp<br />
            <input className="input" type="number" min="0" step="1" value={grossSalesClp} onChange={(event) => setGrossSalesClp(event.target.value)} />
          </label>
          <label>Nota<br />
            <input className="input" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="btn" type="button" onClick={handleAdd}>Agregar ajuste</button>
        </div>
      </section>

      {message ? <p>{message}</p> : null}

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Resumen</h2>
        <p><strong>Total qty ajustes:</strong> {totals.totalQty.toLocaleString('es-CL')} | <strong>Total gross ajustes (CLP):</strong> {totals.totalGross.toLocaleString('es-CL')}</p>
      </section>

      <section style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Detalle</h2>
        <div className="tableWrap"><table className="table">
          <thead><tr><th>Producto</th><th>Qty</th><th>Gross</th><th>Nota</th><th>Creado</th><th>Acciones</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{productNameById.get(row.productId) ?? '(Producto no encontrado)'}</td>
                <td>{row.qty.toLocaleString('es-CL')}</td>
                <td>{row.grossSalesClp.toLocaleString('es-CL')}</td>
                <td>{row.note ?? '-'}</td>
                <td>{row.createdAt.toLocaleString('es-CL')}</td>
                <td><button className="btnSecondary" type="button" onClick={() => handleDelete(row.id)}>Eliminar</button></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={6}>No hay ajustes para el filtro seleccionado.</td></tr> : null}
          </tbody>
        </table></div>
      </section>
    </PageShell>
  );
}
