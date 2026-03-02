'use client';

import { useMemo, useState } from 'react';

import {
  importSalesSantiago,
  type SantiagoSalesImportRow,
} from '@/src/storage/local/store';
import { parseFudoProductsXlsx } from '@/src/services/fudoReport';

type PreviewState = {
  rowsRead: number;
  validRows: SantiagoSalesImportRow[];
  errors: string[];
  dateMin: string | null;
  dateMax: string | null;
  totalGross: number;
  totalQty: number;
};

function parseWorkbook(fileBuffer: ArrayBuffer): PreviewState {
  const parsed = parseFudoProductsXlsx(fileBuffer);

  return {
    rowsRead: parsed.rowsRead,
    validRows: parsed.rows,
    errors: parsed.errors,
    dateMin: parsed.dateMin,
    dateMax: parsed.dateMax,
    totalGross: parsed.totalGross,
    totalQty: parsed.totalQty,
  };
}

export default function SantiagoImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [createMissingProducts, setCreateMissingProducts] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const previewRows = useMemo(() => preview?.validRows.slice(0, 40) ?? [], [preview]);

  async function handlePreview(): Promise<void> {
    if (!file) {
      setMessage({ type: 'error', text: 'Selecciona un archivo .xlsx para previsualizar.' });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const result = parseWorkbook(buffer);
      setPreview(result);
      setMessage({ type: 'success', text: 'Previsualización lista.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo procesar el archivo.',
      });
    }
  }

  function handleImport(): void {
    if (!preview) {
      setMessage({ type: 'error', text: 'Primero genera una previsualización.' });
      return;
    }

    try {
      const summary = importSalesSantiago(preview.validRows, {
        createMissingProducts,
        rowsRead: preview.rowsRead,
      });

      setMessage({
        type: 'success',
        text: `Importación OK. Filas válidas: ${summary.rowsValid}. Productos creados: ${summary.createdProductsCount}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error al importar ventas de Santiago.',
      });
    }
  }

  return (
    <main>
      <h1>Importar Ventas Santiago</h1>

      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <label>
          Archivo Reporte-Productos
          <br />
          <input className="input"
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setMessage(null);
            }}
          />
        </label>

        <button className="btn" type="button" onClick={handlePreview}>
          Previsualizar
        </button>

        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={createMissingProducts}
            onChange={(event) => setCreateMissingProducts(event.target.checked)}
          />
          Crear productos faltantes
        </label>

        <button className="btnSecondary" type="button" onClick={handleImport} disabled={!preview}>
          Importar
        </button>
      </div>

      {message ? (
        <p style={{ color: message.type === 'error' ? '#b00020' : '#0f5132' }}>{message.text}</p>
      ) : null}

      {preview ? (
        <section style={{ marginBottom: 16 }}>
          <h2>Resumen</h2>
          <ul>
            <li>Filas leídas: {preview.rowsRead}</li>
            <li>Filas válidas: {preview.validRows.length}</li>
            <li>Rango fechas: {preview.dateMin ?? '-'} a {preview.dateMax ?? '-'}</li>
            <li>Total ventas (CLP): {preview.totalGross}</li>
            <li>Total qty: {preview.totalQty}</li>
            <li>Errores: {preview.errors.length}</li>
          </ul>

          {preview.errors.length > 0 ? (
            <details>
              <summary>Ver errores</summary>
              <ul>
                {preview.errors.slice(0, 100).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {previewRows.length > 0 ? (
        <section>
          <h2>Preview (primeras {previewRows.length} filas)</h2>
          <div className="tableWrap"><table className="table">
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>date</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>productName</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>qty</th>
                <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>grossSalesClp</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${row.date}-${row.productName}-${index}`}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.date}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.productName}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.qty}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.grossSalesClp}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      ) : null}
    </main>
  );
}
