'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Product } from '@/src/domain/types';
import {
  duplicateSalesFromPreviousDay,
  listProducts,
  listSalesDaily,
  setSalesDaily,
} from '@/src/storage/local/store';

type DraftRow = {
  productId: string;
  productName: string;
  qty: string;
  grossSalesClp: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SalesTemucoPage() {
  const [date, setDate] = useState<string>(todayIsoDate());
  const [products, setProducts] = useState<Product[]>([]);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeProducts = useMemo(
    () =>
      products
        .filter((product) => product.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'es-CL')),
    [products],
  );

  function loadDraftRows(targetDate: string, sourceProducts?: Product[]): void {
    const availableProducts = sourceProducts ?? activeProducts;
    const entries = listSalesDaily({ date: targetDate, branch: 'Temuco' });
    const byProduct = new Map(entries.map((entry) => [entry.productId, entry]));

    setDraftRows(
      availableProducts.map((product) => {
        const entry = byProduct.get(product.id);

        return {
          productId: product.id,
          productName: product.name,
          qty: entry ? String(entry.qty) : '0',
          grossSalesClp: entry ? String(entry.grossSalesClp) : '0',
        };
      }),
    );
  }

  useEffect(() => {
    const loadedProducts = listProducts();
    setProducts(loadedProducts);
    const active = loadedProducts
      .filter((product) => product.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
    loadDraftRows(date, active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDraftRows(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, activeProducts.length]);

  function updateDraft(productId: string, patch: Partial<Pick<DraftRow, 'qty' | 'grossSalesClp'>>): void {
    setDraftRows((current) =>
      current.map((row) => (row.productId === productId ? { ...row, ...patch } : row)),
    );
  }

  function saveRows(rows: DraftRow[]): void {
    setSalesDaily(
      date,
      'Temuco',
      rows.map((row) => ({
        productId: row.productId,
        qty: toNumber(row.qty),
        grossSalesClp: toNumber(row.grossSalesClp),
      })),
    );
  }

  function handleSave(): void {
    try {
      saveRows(draftRows);
      loadDraftRows(date);
      setMessage({ type: 'success', text: 'Ventas guardadas.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error al guardar ventas.',
      });
    }
  }

  function handleDuplicatePrevious(): void {
    try {
      duplicateSalesFromPreviousDay(date, 'Temuco');
      loadDraftRows(date);
      setMessage({ type: 'success', text: 'Se duplicó el día anterior.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error al duplicar día anterior.',
      });
    }
  }

  function handleClearDay(): void {
    const cleared = draftRows.map((row) => ({ ...row, qty: '0', grossSalesClp: '0' }));
    setDraftRows(cleared);

    try {
      saveRows(cleared);
      loadDraftRows(date);
      setMessage({ type: 'success', text: 'Día limpiado.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error al limpiar día.',
      });
    }
  }

  function handlePasteFromRow(startIndex: number, text: string): void {
    const lines = text
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return;
    }

    setDraftRows((current) => {
      const next = [...current];

      lines.forEach((line, offset) => {
        const targetIndex = startIndex + offset;
        if (targetIndex >= next.length) {
          return;
        }

        const cells = line.split('\t');
        const qtyCell = cells[0]?.trim() ?? '';
        const amountCell = cells[1]?.trim() ?? '';

        next[targetIndex] = {
          ...next[targetIndex],
          qty: qtyCell || '0',
          grossSalesClp: amountCell || '0',
        };
      });

      return next;
    });
  }

  return (
    <main>
      <h1>Ventas Temuco (manual)</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Fecha
          <br />
          <input className="input"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setMessage(null);
            }}
          />
        </label>

        <button className="btn" type="button" onClick={handleSave}>
          Guardar
        </button>
        <button className="btnSecondary" type="button" onClick={handleDuplicatePrevious}>
          Duplicar día anterior
        </button>
        <button className="btnSecondary" type="button" onClick={handleClearDay}>
          Limpiar día
        </button>
      </div>

      {message ? (
        <p style={{ color: message.type === 'error' ? '#b00020' : '#0f5132' }}>{message.text}</p>
      ) : null}

      <div className="tableWrap"><table className="table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Product</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Qty</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Monto (CLP)</th>
          </tr>
        </thead>
        <tbody>
          {draftRows.map((row, index) => (
            <tr key={row.productId}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.productName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={row.qty}
                  onChange={(event) => updateDraft(row.productId, { qty: event.target.value })}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData('text/plain');
                    if (!pasted.includes('\t') && !pasted.includes('\n')) {
                      return;
                    }

                    event.preventDefault();
                    handlePasteFromRow(index, pasted);
                  }}
                />
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={row.grossSalesClp}
                  onChange={(event) =>
                    updateDraft(row.productId, {
                      grossSalesClp: event.target.value,
                    })
                  }
                />
              </td>
            </tr>
          ))}
          {draftRows.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: 8 }}>
                No hay productos activos.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table></div>
    </main>
  );
}
