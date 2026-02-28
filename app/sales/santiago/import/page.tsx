'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import {
  importSalesSantiago,
  type SantiagoSalesImportRow,
} from '@/src/storage/local/store';

type PreviewState = {
  rowsRead: number;
  validRows: SantiagoSalesImportRow[];
  errors: string[];
  dateMin: string | null;
  dateMax: string | null;
  totalGross: number;
  totalQty: number;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return date.toISOString().slice(0, 10);
    }
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function parseQty(value: unknown): number | null {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) {
    return 0;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 1000) / 1000;
}

function parseGross(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) {
      return null;
    }

    return Math.round(value);
  }

  const raw = String(value ?? '').trim();
  if (!raw) {
    return 0;
  }

  const cleaned = raw.replace(/[$\s]/g, '').replace(/\./g, '').replace(/,/g, '');
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function parseWorkbook(fileBuffer: ArrayBuffer): PreviewState {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const preferred =
    workbook.SheetNames.find((name) => name === 'Detalle') ??
    workbook.SheetNames.find((name) => name.toLocaleLowerCase('es-CL').includes('detalle')) ??
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[preferred];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  const errors: string[] = [];
  const validRows: SantiagoSalesImportRow[] = [];
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  let totalGross = 0;
  let totalQty = 0;

  rows.forEach((rawRow, index) => {
    const rowIndex = index + 2;
    const byHeader = new Map<string, unknown>();

    Object.entries(rawRow).forEach(([key, value]) => {
      byHeader.set(normalizeHeader(key), value);
    });

    const date =
      toIsoDate(byHeader.get('fecha')) ??
      toIsoDate(byHeader.get('date'));

    const product =
      String(byHeader.get('producto') ?? byHeader.get('product') ?? '')
        .trim();

    const qty =
      parseQty(byHeader.get('cantidades vendidas') ?? byHeader.get('cantidad vendida') ?? byHeader.get('qty'));

    const grossSalesClp =
      parseGross(byHeader.get('monto total') ?? byHeader.get('ventas totales') ?? byHeader.get('monto'));

    if (!date) {
      errors.push(`fila ${rowIndex} sin fecha válida`);
      return;
    }

    if (!product) {
      errors.push(`fila ${rowIndex} sin producto`);
      return;
    }

    if (qty === null) {
      errors.push(`fila ${rowIndex} cantidad inválida`);
      return;
    }

    if (grossSalesClp === null) {
      errors.push(`fila ${rowIndex} monto inválido`);
      return;
    }

    const category = String(byHeader.get('categoria') ?? '').trim() || undefined;
    const subCategory = String(byHeader.get('sub categoria') ?? byHeader.get('subcategoria') ?? '').trim() || undefined;

    validRows.push({
      date,
      productName: product,
      qty,
      grossSalesClp,
      category,
      subCategory,
    });

    totalGross += grossSalesClp;
    totalQty += qty;
    dateMin = dateMin === null || date < dateMin ? date : dateMin;
    dateMax = dateMax === null || date > dateMax ? date : dateMax;
  });

  return {
    rowsRead: rows.length,
    validRows,
    errors,
    dateMin,
    dateMax,
    totalGross,
    totalQty: Math.round(totalQty * 1000) / 1000,
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
